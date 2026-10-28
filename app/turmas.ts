// Modo turma: professor cria a turma, alunos entram com um código, o professor passa exercícios
// da Prática como tarefas e acompanha o progresso de cada aluno.
import { randomUUID, randomInt } from 'node:crypto';
import { findExercise } from './pratica-dados.ts';
import type { Express } from 'express';
import type { Db } from './tipos.ts';
import type { Request, Response } from 'express';
import { consulta } from './tipos.ts';

interface Turma { id: string; code: string; name: string; owner_id: string; created_at: number }
interface Tarefa { id: string; turma_id: string; exercise_id: string; prazo: string | null; created_at: number }

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I para não confundir

export function setupTurmas(app: Express, db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS turmas (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, owner_id TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS turma_membros (turma_id TEXT NOT NULL REFERENCES turmas(id) ON DELETE CASCADE, user_id TEXT NOT NULL, joined_at INTEGER NOT NULL, PRIMARY KEY (turma_id, user_id));
    CREATE TABLE IF NOT EXISTS turma_tarefas (id TEXT PRIMARY KEY, turma_id TEXT NOT NULL REFERENCES turmas(id) ON DELETE CASCADE, exercise_id TEXT NOT NULL, prazo TEXT, created_at INTEGER NOT NULL);
  `);
  const q = {
    byId: consulta<Turma>(db, 'SELECT * FROM turmas WHERE id = ?'),
    byCode: consulta<Turma>(db, 'SELECT * FROM turmas WHERE code = ?'),
    owned: consulta<Turma>(db, 'SELECT * FROM turmas WHERE owner_id = ? ORDER BY created_at DESC'),
    joined: consulta<Turma & { owner_name: string }>(db, `SELECT t.*, u.name AS owner_name FROM turma_membros m JOIN turmas t ON t.id = m.turma_id
                        JOIN users u ON u.id = t.owner_id WHERE m.user_id = ? ORDER BY m.joined_at DESC`),
    create: db.prepare('INSERT INTO turmas (id, code, name, owner_id, created_at) VALUES (?, ?, ?, ?, ?)'),
    rename: db.prepare('UPDATE turmas SET name = ? WHERE id = ?'),
    remove: db.prepare('DELETE FROM turmas WHERE id = ?'),
    join: db.prepare('INSERT OR IGNORE INTO turma_membros (turma_id, user_id, joined_at) VALUES (?, ?, ?)'),
    leave: db.prepare('DELETE FROM turma_membros WHERE turma_id = ? AND user_id = ?'),
    members: consulta<{ id: string; name: string; email: string; joined_at: number }>(db, `SELECT u.id, u.name, u.email, m.joined_at FROM turma_membros m JOIN users u ON u.id = m.user_id
                         WHERE m.turma_id = ? ORDER BY u.name COLLATE NOCASE`),
    isMember: consulta<{ 1: number }>(db, 'SELECT 1 FROM turma_membros WHERE turma_id = ? AND user_id = ?'),
    countMembers: consulta<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM turma_membros WHERE turma_id = ?'),
    tasks: consulta<Tarefa>(db, 'SELECT * FROM turma_tarefas WHERE turma_id = ? ORDER BY created_at'),
    addTask: db.prepare('INSERT INTO turma_tarefas (id, turma_id, exercise_id, prazo, created_at) VALUES (?, ?, ?, ?, ?)'),
    delTask: db.prepare('DELETE FROM turma_tarefas WHERE id = ? AND turma_id = ?'),
    hasTask: consulta<{ 1: number }>(db, 'SELECT 1 FROM turma_tarefas WHERE turma_id = ? AND exercise_id = ?'),
    done: consulta<{ exercise_id: string }>(db, 'SELECT exercise_id FROM skill_progress WHERE user_id = ? AND done = 1'),
    xp: consulta<{ xp: number }>(db, 'SELECT COALESCE(SUM(amount), 0) AS xp FROM xp_events WHERE user_id = ?'),
    lastDay: consulta<{ day: string | null }>(db, 'SELECT MAX(day) AS day FROM activity_days WHERE user_id = ?'),
    owned_count: consulta<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM turmas WHERE owner_id = ?'),
  };

  const newCode = () => {
    for (;;) {
      const code = Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
      if (!q.byCode.get(code)) return code;
    }
  };
  const taskView = (t: Tarefa) => {
    const f = findExercise(t.exercise_id);
    return { id: t.id, exerciseId: t.exercise_id, trackId: f?.track.id, title: f?.ex.title || t.exercise_id, track: f?.track.title, lang: f?.track.lang, prazo: t.prazo };
  };
  const loadOwned = (req: Request<{ id: string }>, res: Response): Turma | null => {
    const t = q.byId.get(req.params.id);
    if (!t) { res.status(404).json({ error: 'Turma não encontrada.' }); return null; }
    if (t.owner_id !== req.user.id) { res.status(403).json({ error: 'Só o professor da turma pode fazer isso.' }); return null; }
    return t;
  };

  app.get('/api/turmas', (req, res) => {
    res.json({
      ensino: q.owned.all(req.user.id).map((t) => ({ id: t.id, name: t.name, code: t.code, alunos: q.countMembers.get(t.id)?.n ?? 0, tarefas: q.tasks.all(t.id).length })),
      participo: q.joined.all(req.user.id).map((t) => {
        const done = new Set(q.done.all(req.user.id).map((r) => r.exercise_id));
        const tasks = q.tasks.all(t.id);
        return { id: t.id, name: t.name, professor: t.owner_name, tarefas: tasks.length, feitas: tasks.filter((k) => done.has(k.exercise_id)).length };
      }),
    });
  });

  app.post('/api/turmas', (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Dê um nome para a turma.' });
    if ((q.owned_count.get(req.user.id)?.n ?? 0) >= 20) return res.status(400).json({ error: 'Limite de 20 turmas.' });
    const id = randomUUID();
    q.create.run(id, newCode(), name, req.user.id, Date.now());
    res.status(201).json({ id });
  });

  app.post('/api/turmas/entrar', (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const t = q.byCode.get(code);
    if (!t) return res.status(404).json({ error: 'Código não encontrado. Confira com o professor.' });
    if (t.owner_id === req.user.id) return res.status(400).json({ error: 'Você é o professor desta turma.' });
    q.join.run(t.id, req.user.id, Date.now());
    res.json({ id: t.id });
  });

  // Visão da turma: o professor vê todos os alunos x tarefas; o aluno vê as próprias tarefas.
  app.get('/api/turmas/:id', (req, res) => {
    const t = q.byId.get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Turma não encontrada.' });
    const isOwner = t.owner_id === req.user.id;
    if (!isOwner && !q.isMember.get(t.id, req.user.id)) return res.status(403).json({ error: 'Você não está nesta turma.' });
    const tasks = q.tasks.all(t.id).map(taskView);
    if (isOwner) {
      const alunos = q.members.all(t.id).map((m) => {
        const done = new Set(q.done.all(m.id).map((r) => r.exercise_id));
        return { id: m.id, name: m.name, email: m.email, xp: q.xp.get(m.id)?.xp ?? 0, ultimoDia: q.lastDay.get(m.id)?.day ?? null, feitas: tasks.map((k) => done.has(k.exerciseId)) };
      });
      return res.json({ id: t.id, name: t.name, code: t.code, professor: true, tarefas: tasks, alunos });
    }
    const done = new Set(q.done.all(req.user.id).map((r) => r.exercise_id));
    const owner = consulta<{ name: string }>(db, 'SELECT name FROM users WHERE id = ?').get(t.owner_id);
    res.json({ id: t.id, name: t.name, professor: false, professorNome: owner?.name, tarefas: tasks.map((k) => ({ ...k, feita: done.has(k.exerciseId) })) });
  });

  app.patch('/api/turmas/:id', (req, res) => {
    const t = loadOwned(req, res);
    if (!t) return;
    const name = String(req.body?.name || '').trim().slice(0, 60);
    if (name) q.rename.run(name, t.id);
    res.json({ ok: true });
  });

  app.delete('/api/turmas/:id', (req, res) => {
    const t = q.byId.get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Turma não encontrada.' });
    if (t.owner_id === req.user.id) q.remove.run(t.id); // professor apaga a turma
    else q.leave.run(t.id, req.user.id); // aluno sai
    res.json({ ok: true });
  });

  app.post('/api/turmas/:id/tarefas', (req, res) => {
    const t = loadOwned(req, res);
    if (!t) return;
    const exerciseId = String(req.body?.exerciseId || '');
    if (!findExercise(exerciseId)) return res.status(400).json({ error: 'Exercício inválido.' });
    if (q.hasTask.get(t.id, exerciseId)) return res.status(400).json({ error: 'Esse exercício já é tarefa desta turma.' });
    const prazo = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.prazo || '') ? req.body.prazo : null;
    q.addTask.run(randomUUID(), t.id, exerciseId, prazo, Date.now());
    res.status(201).json({ ok: true });
  });

  app.delete('/api/turmas/:id/tarefas/:tarefa', (req, res) => {
    const t = loadOwned(req, res);
    if (!t) return;
    q.delTask.run(req.params.tarefa, t.id);
    res.json({ ok: true });
  });

  app.delete('/api/turmas/:id/alunos/:aluno', (req, res) => {
    const t = loadOwned(req, res);
    if (!t) return;
    q.leave.run(t.id, req.params.aluno);
    res.json({ ok: true });
  });
}
