// Memória do Gyde: fatos duradouros sobre a pessoa, lembrados entre conversas.
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { Db, Router, Usuario } from './tipos.ts';
import { consulta } from './tipos.ts';

interface Memoria { id: string; text: string; source: string; created_at: number }

// Modelo direto (sem "raciocínio em voz alta") para tarefas internas; o automático fica de reserva.
const UTIL_MODELS = [process.env.UTIL_MODEL || 'mistral-code', 'auto'];
const MAX_MEMORIES = 60;
const MAX_LEN = 200;
const REMEMBER = /\b(lembr[ea]|lembra|não esqueç|nao esqueç|guarde que|anota que|anote que)\b/i;

export function setupMemoria(app: Express, db: Db, { router, getSetting, setSetting }: { router: Router; getSetting: (userId: string, chave: string, padrao?: string) => string; setSetting: (userId: string, chave: string, valor: string) => unknown }) {
  db.exec(`CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, text TEXT NOT NULL, source TEXT NOT NULL, created_at INTEGER NOT NULL
  ); CREATE INDEX IF NOT EXISTS idx_mem_user ON memories(user_id, created_at);`);
  const q = {
    list: consulta<Memoria>(db, 'SELECT id, text, source, created_at FROM memories WHERE user_id = ? ORDER BY created_at DESC'),
    add: db.prepare('INSERT INTO memories (id, user_id, text, source, created_at) VALUES (?, ?, ?, ?, ?)'),
    del: db.prepare('DELETE FROM memories WHERE id = ? AND user_id = ?'),
    delAll: db.prepare('DELETE FROM memories WHERE user_id = ?'),
    count: consulta<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM memories WHERE user_id = ?'),
    oldestAuto: consulta<{ id: string }>(db, "SELECT id FROM memories WHERE user_id = ? AND source = 'auto' ORDER BY created_at LIMIT 1"),
  };
  const enabled = (userId: string) => getSetting(userId, 'memory_enabled', '1') === '1';
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

  function save(userId: string, text: unknown, source: 'auto' | 'manual' | 'pedido') {
    const clean = String(text).replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
    if (clean.length < 4) return false;
    const existing = q.list.all(userId).map((m) => norm(m.text));
    if (existing.includes(norm(clean))) return false;
    while ((q.count.get(userId)?.n ?? 0) >= MAX_MEMORIES) {
      const old = q.oldestAuto.get(userId);
      if (!old) return false;
      q.del.run(old.id, userId);
    }
    q.add.run(randomUUID(), userId, clean, source, Date.now());
    return true;
  }

  // Texto para o prompt do sistema.
  function promptFor(userId: string) {
    if (!enabled(userId)) return '';
    const items = q.list.all(userId).slice(0, 30);
    if (!items.length) return '';
    return `O que você lembra sobre o usuário (de conversas anteriores; use quando ajudar, sem citar que é uma "memória"):\n${items.map((m) => `- ${m.text}`).join('\n')}`;
  }

  // Depois de uma resposta: extrai fatos novos em segundo plano (não atrasa o chat).
  async function learnFrom(user: Usuario, history: { role: string; content: string }[], answer: string) {
    if (!enabled(user.id)) return;
    const userMsgs = history.filter((m) => m.role === 'user');
    const last = userMsgs.at(-1)?.content || '';
    const asked = REMEMBER.test(last);
    // Para gastar pouca cota: só na 1ª, 4ª, 8ª... mensagem, ou quando pedirem para lembrar.
    if (!asked && ![1, 4, 8, 12, 16, 20].includes(userMsgs.length)) return;
    const known = q.list.all(user.id).slice(0, 40).map((m) => `- ${m.text}`).join('\n') || '(nada ainda)';
    const convo = history.slice(-6).map((m) => `${m.role === 'user' ? 'Usuário' : 'Gyde'}: ${String(m.content).slice(0, 1500)}`).join('\n\n');
    for (const model of UTIL_MODELS) {
    try {
      const r = await router('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model,
          max_tokens: 400,
          messages: [
            { role: 'system', content: [
              'Você extrai fatos DURADOUROS sobre o usuário de uma conversa com um tutor de programação.',
              'Guarde só o que será útil em conversas futuras: projetos em andamento, objetivos, curso/escola, linguagens que usa,',
              'preferências de explicação, dificuldades recorrentes e coisas que ele pediu explicitamente para lembrar.',
              'NÃO guarde: perguntas pontuais, código, senhas, chaves, dados sensíveis (saúde, documentos, endereço) nem fatos já conhecidos.',
              'Escreva cada fato em português, em terceira pessoa, curto (até 120 caracteres). No máximo 3 fatos.',
              'Responda SOMENTE com JSON no formato {"fatos": ["..."]}. Se não houver nada novo, {"fatos": []}.',
            ].join(' ') },
            { role: 'user', content: `Fatos já conhecidos:\n${known}\n\nConversa recente:\n${convo}\n\nÚltima resposta do Gyde:\n${String(answer).slice(0, 1500)}` },
          ],
        }),
      });
      const json = await r.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content || '';
      // Pega o último objeto JSON com "fatos" (alguns modelos escrevem texto antes).
      const match = [...text.matchAll(/\{[^{}]*"fatos"[^{}]*\}/g)].pop();
      if (!match) continue;
      const fatos = JSON.parse(match[0]).fatos;
      if (Array.isArray(fatos)) for (const f of fatos.slice(0, 3)) if (typeof f === 'string') save(user.id, f, asked ? 'pedido' : 'auto');
      return;
    } catch {
      // Memória é um extra: se falhar, tenta o próximo modelo; o chat segue normalmente.
    }
    }
  }

  const view = (userId: string) => ({ ativa: enabled(userId), itens: q.list.all(userId) });
  app.get('/api/memoria', (req, res) => res.json(view(req.user.id)));
  app.post('/api/memoria', (req, res) => {
    if (!save(req.user.id, req.body?.texto || '', 'manual')) return res.status(400).json({ error: 'Texto vazio, repetido ou memória cheia.' });
    res.status(201).json(view(req.user.id));
  });
  app.put('/api/memoria/config', (req, res) => {
    setSetting(req.user.id, 'memory_enabled', req.body?.ativa ? '1' : '0');
    res.json(view(req.user.id));
  });
  app.delete('/api/memoria/:id', (req, res) => { q.del.run(req.params.id, req.user.id); res.json(view(req.user.id)); });
  app.delete('/api/memoria', (req, res) => { q.delAll.run(req.user.id); res.json(view(req.user.id)); });

  return { promptFor, learnFrom };
}
