// Skills do Gyde: pacotes de instruções instaláveis (como plugins), com uma loja onde
// cada pessoa publica as próprias skills e as outras instalam uma cópia.
// Cada skill é um arquivo .md com cabeçalho (--- ... ---) e o corpo com as instruções.
import { readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const MAX_BODY = 8000;
const MAX_ACTIVE = 3;
const FIELDS = ['id', 'nome', 'descricao', 'simbolo', 'comando', 'gatilhos', 'categoria'];

// Lê o formato "--- chave: valor --- corpo".
export function parseSkill(text) {
  const m = String(text).replace(/^﻿/, '').match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) throw new Error('Arquivo de skill inválido: falta o cabeçalho entre linhas "---".');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return normalize({ ...meta, corpo: m[2].trim() });
}

function normalize(s) {
  const clean = (v, max) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
  const skill = {
    id: clean(s.id, 60).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    nome: clean(s.nome, 60),
    descricao: clean(s.descricao, 240),
    simbolo: clean(s.simbolo, 3) || '◆',
    comando: clean(s.comando, 30).toLowerCase(),
    gatilhos: (Array.isArray(s.gatilhos) ? s.gatilhos : String(s.gatilhos ?? '').split(','))
      .map((g) => g.trim().toLowerCase()).filter(Boolean).slice(0, 20),
    categoria: clean(s.categoria, 30) || 'Outras',
    corpo: String(s.corpo ?? '').trim().slice(0, MAX_BODY),
  };
  if (skill.comando && !/^\/[a-z0-9-]{2,24}$/.test(skill.comando)) skill.comando = '';
  if (!skill.nome) throw new Error('A skill precisa de um nome.');
  if (!skill.corpo) throw new Error('A skill precisa de instruções.');
  return skill;
}

export function toMarkdown(s) {
  return `---\n${FIELDS.map((k) => `${k}: ${k === 'gatilhos' ? s.gatilhos.join(', ') : s[k] ?? ''}`).join('\n')}\n---\n${s.corpo}\n`;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function setupSkills(app, db, { root }) {
  // Catálogo: todos os .md da pasta skills-catalogo.
  const catalogDir = path.join(root, 'skills-catalogo');
  const catalog = new Map();
  for (const file of readdirSync(catalogDir).filter((f) => f.endsWith('.md'))) {
    try {
      const s = parseSkill(readFileSync(path.join(catalogDir, file), 'utf8'));
      catalog.set(s.id, { ...s, origem: 'catalogo' });
    } catch (err) {
      console.warn(`[Gyde] Skill ignorada (${file}): ${err.message}`);
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_skills (
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      installed_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, skill_id)
    );
    CREATE TABLE IF NOT EXISTS custom_skills (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS skill_loja (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL UNIQUE,
      author_id TEXT NOT NULL,
      data TEXT NOT NULL,
      installs INTEGER NOT NULL DEFAULT 0,
      published_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  const q = {
    installed: db.prepare('SELECT skill_id FROM user_skills WHERE user_id = ?'),
    install: db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, installed_at) VALUES (?, ?, ?)'),
    uninstall: db.prepare('DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?'),
    customs: db.prepare('SELECT id, data FROM custom_skills WHERE user_id = ? ORDER BY updated_at DESC'),
    getCustom: db.prepare('SELECT id, data FROM custom_skills WHERE id = ? AND user_id = ?'),
    upsertCustom: db.prepare(`INSERT INTO custom_skills (id, user_id, data, updated_at) VALUES (?, ?, ?, ?)
                              ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
    deleteCustom: db.prepare('DELETE FROM custom_skills WHERE id = ? AND user_id = ?'),
    countCustom: db.prepare('SELECT COUNT(*) AS n FROM custom_skills WHERE user_id = ?'),
    loja: db.prepare(`SELECT l.*, u.name AS author_name FROM skill_loja l JOIN users u ON u.id = l.author_id
                      ORDER BY l.installs DESC, l.updated_at DESC LIMIT 300`),
    lojaGet: db.prepare('SELECT * FROM skill_loja WHERE id = ?'),
    lojaBySource: db.prepare('SELECT * FROM skill_loja WHERE source_id = ?'),
    lojaMine: db.prepare('SELECT id, source_id FROM skill_loja WHERE author_id = ?'),
    lojaPublish: db.prepare(`INSERT INTO skill_loja (id, source_id, author_id, data, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
                             ON CONFLICT(source_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
    lojaRemove: db.prepare('DELETE FROM skill_loja WHERE id = ? AND author_id = ?'),
    lojaRemoveSource: db.prepare('DELETE FROM skill_loja WHERE source_id = ? AND author_id = ?'),
    lojaInstalled: db.prepare('UPDATE skill_loja SET installs = installs + 1 WHERE id = ?'),
  };

  // Skills próprias recebem o prefixo "minha-" no id para não colidir com o catálogo.
  const customsOf = (userId) => {
    const published = new Map(q.lojaMine.all(userId).map((r) => [r.source_id, r.id]));
    return q.customs.all(userId).map((r) => ({ ...JSON.parse(r.data), id: r.id, origem: 'minha', publicada: published.get(r.id) || null }));
  };

  function listFor(userId) {
    const installed = new Set(q.installed.all(userId).map((r) => r.skill_id));
    const all = [...catalog.values(), ...customsOf(userId)];
    return all.map((s) => ({ ...s, instalada: installed.has(s.id) }));
  }

  // Escolhe as skills desta mensagem: comando no início ("/revisar ...") ou palavras-gatilho.
  function activeFor(userId, text) {
    const msg = String(text || '').toLowerCase();
    const installed = listFor(userId).filter((s) => s.instalada);
    const byCommand = installed.filter((s) => s.comando && new RegExp(`(^|\\s)${escapeRe(s.comando)}(\\s|$)`).test(msg));
    if (byCommand.length) return byCommand.slice(0, MAX_ACTIVE);
    const scored = installed
      .map((s) => ({ s, hits: s.gatilhos.filter((g) => new RegExp(`(^|[^\\p{L}])${escapeRe(g)}([^\\p{L}]|$)`, 'u').test(msg)).length }))
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    return scored.slice(0, MAX_ACTIVE).map((x) => x.s);
  }

  const findFor = (userId, id) => listFor(userId).find((s) => s.id === id);

  app.get('/api/skills', (req, res) => res.json({ skills: listFor(req.user.id) }));

  app.post('/api/skills/:id/install', (req, res) => {
    const s = findFor(req.user.id, req.params.id);
    if (!s) return res.status(404).json({ error: 'Skill não encontrada.' });
    q.install.run(req.user.id, s.id, Date.now());
    res.json({ skills: listFor(req.user.id) });
  });

  app.delete('/api/skills/:id/install', (req, res) => {
    q.uninstall.run(req.user.id, req.params.id);
    res.json({ skills: listFor(req.user.id) });
  });

  function saveCustom(userId, data, existingId, extra = {}) {
    if (!existingId && q.countCustom.get(userId).n >= 50) {
      throw Object.assign(new Error('Limite de 50 skills próprias.'), { status: 400 });
    }
    let skill;
    try {
      skill = normalize(data);
    } catch (err) {
      throw Object.assign(err, { status: 400 });
    }
    const id = existingId || `minha-${randomUUID().slice(0, 8)}`;
    // Um comando igual ao de outra skill instalada confundiria o chat.
    const clash = skill.comando && listFor(userId).find((s) => s.id !== id && s.comando === skill.comando);
    if (clash) throw Object.assign(new Error(`O comando ${skill.comando} já é usado pela skill "${clash.nome}".`), { status: 400 });
    const prev = existingId ? JSON.parse(q.getCustom.get(existingId, userId)?.data || '{}') : {};
    q.upsertCustom.run(id, userId, JSON.stringify({ ...skill, id, loja: extra.loja ?? prev.loja ?? null }), Date.now());
    q.install.run(userId, id, Date.now()); // criou, já fica instalada
    return id;
  }

  app.post('/api/skills/custom', (req, res) => {
    const id = saveCustom(req.user.id, req.body || {});
    res.status(201).json({ id, skills: listFor(req.user.id) });
  });

  app.put('/api/skills/custom/:id', (req, res) => {
    if (!q.getCustom.get(req.params.id, req.user.id)) return res.status(404).json({ error: 'Skill não encontrada.' });
    saveCustom(req.user.id, req.body || {}, req.params.id);
    res.json({ id: req.params.id, skills: listFor(req.user.id) });
  });

  app.delete('/api/skills/custom/:id', (req, res) => {
    q.deleteCustom.run(req.params.id, req.user.id);
    q.uninstall.run(req.user.id, req.params.id);
    q.lojaRemoveSource.run(req.params.id, req.user.id); // excluir a skill também tira da loja
    res.json({ skills: listFor(req.user.id) });
  });

  // Importa um arquivo .md (de outra pessoa ou exportado antes) como skill própria.
  app.post('/api/skills/import', (req, res) => {
    let parsed;
    try {
      parsed = parseSkill(String(req.body?.markdown || '').slice(0, 20_000));
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    const id = saveCustom(req.user.id, parsed);
    res.status(201).json({ id, skills: listFor(req.user.id) });
  });

  // Loja: skills publicadas por quem usa este Gyde. Instalar cria uma cópia própria (editável),
  // então o autor mudar ou despublicar depois não altera o que outras pessoas já instalaram.
  app.get('/api/skills/loja', (req, res) => {
    const copies = new Set(customsOf(req.user.id).map((s) => s.loja).filter(Boolean));
    res.json({
      loja: q.loja.all().map((r) => {
        const s = JSON.parse(r.data);
        return { ...s, id: r.id, autor: r.author_name, installs: r.installs, atualizada: r.updated_at,
          minha: r.author_id === req.user.id, instalada: copies.has(r.id) };
      }),
    });
  });

  app.post('/api/skills/custom/:id/publicar', (req, res) => {
    const row = q.getCustom.get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Skill não encontrada.' });
    const data = JSON.parse(row.data);
    if (data.loja) return res.status(400).json({ error: 'Esta skill veio da loja. Só quem criou pode publicar.' });
    const { loja, id: _id, ...pub } = data;
    if (String(pub.corpo).length < 40) return res.status(400).json({ error: 'Escreva instruções um pouco mais completas antes de publicar.' });
    if (!pub.descricao) return res.status(400).json({ error: 'Adicione uma descrição curta antes de publicar.' });
    const existing = q.lojaBySource.get(row.id);
    const lojaId = existing?.id || `loja-${randomUUID().slice(0, 8)}`;
    q.lojaPublish.run(lojaId, row.id, req.user.id, JSON.stringify(pub), Date.now(), Date.now());
    res.json({ id: lojaId, atualizada: Boolean(existing), skills: listFor(req.user.id) });
  });

  app.delete('/api/skills/loja/:id', (req, res) => {
    q.lojaRemove.run(req.params.id, req.user.id);
    res.json({ skills: listFor(req.user.id) });
  });

  app.post('/api/skills/loja/:id/instalar', (req, res) => {
    const item = q.lojaGet.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Essa skill saiu da loja.' });
    if (item.author_id === req.user.id) return res.status(400).json({ error: 'Essa skill é sua: ela já está na sua conta.' });
    if (customsOf(req.user.id).some((s) => s.loja === item.id)) return res.status(400).json({ error: 'Você já instalou esta skill.' });
    const data = JSON.parse(item.data);
    let id;
    let semComando = false;
    try {
      id = saveCustom(req.user.id, data, null, { loja: item.id });
    } catch (err) {
      if (!/comando/.test(err.message)) throw err;
      id = saveCustom(req.user.id, { ...data, comando: '' }, null, { loja: item.id }); // comando já usado: instala sem ele
      semComando = true;
    }
    q.lojaInstalled.run(item.id);
    res.status(201).json({ id, semComando, skills: listFor(req.user.id) });
  });

  app.get('/api/skills/:id/export', (req, res) => {
    const s = findFor(req.user.id, req.params.id);
    if (!s) return res.status(404).json({ error: 'Skill não encontrada.' });
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${s.id}.md"`);
    res.send(toMarkdown(s));
  });

  return { activeFor };
}
