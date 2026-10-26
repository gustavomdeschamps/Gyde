import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import path from 'node:path';
import { setupAuth } from './auth.js';
import { publicQuiz, gradeQuiz } from './quiz.js';
import { setupPratica } from './pratica-servidor.js';
import { setupMemoria } from './memoria.js';
import { setupTurmas } from './turmas.js';
import { setupAgente } from './agente.js';
import { cadeiaDe } from './motor.js';
import { setupCodigoAgente } from './codigo-agente.js';
import { setupSkills } from './skills-sistema.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// O .env do Gyde sempre vence variáveis do Windows com o mesmo nome
// (process.loadEnvFile não sobrescreve as que já existem).
const BASE = path.join(ROOT, '..'); // pasta principal do Gyde (.env, data/, node_modules/)
const ENV_FILE = path.join(BASE, '.env');
if (existsSync(ENV_FILE)) Object.assign(process.env, parseEnv(readFileSync(ENV_FILE, 'utf8')));

const PORT = Number(process.env.PORT || 3210);
const ROUTER_URL = (process.env.FREELLMAPI_URL || 'http://127.0.0.1:31415').replace(/\/+$/, '');
const ROUTER_KEY = process.env.FREELLMAPI_KEY || '';
const MAX_ATTACHMENT_TEXT = 100_000; // caracteres por anexo enviados ao modelo (projetos inteiros cabem)

// Modelos da marca: nomes que o usuário vê -> roteamento real no FreeLLMAPI.
const GYDE_MODELS = {
  'gyde-1': { route: 'auto', label: 'Gyde 1', hint: 'Combina Claude Sonnet, Qwen, GPT-OSS e Codestral: usa o melhor disponível para programar' },
  'gyde-1-pro': { route: 'fusion', label: 'Gyde 1 Pro', hint: 'Combina Claude Opus, Claude Sonnet e GPT-OSS: o mais forte, um pouco mais lento' },
};
// Poucos modelos escolhidos a dedo para programação (testados com o FreeLLMAPI).
// Só aparecem os que o roteador marca como disponíveis.
const CODE_MODELS = [
  { id: 'qwen3.8-27b', label: 'Qwen 3.8', hint: 'Ótimo em código e rápido' },
  { id: 'codestral', label: 'Codestral', hint: 'Especialista em código, da Mistral' },
  { id: 'mistral-code', label: 'Mistral Code', hint: 'Focado em escrever e corrigir código' },
  { id: 'nemotron-3-ultra-550b', label: 'Nemotron Ultra', hint: 'Modelo grande da NVIDIA, bom para raciocinar' },
];
const DEFAULT_MODEL = 'gyde-1';
// Modelo direto (sem "raciocínio em voz alta") para tarefas internas: títulos e prompts de imagem.
const UTIL_MODEL = process.env.UTIL_MODEL || 'mistral-code';
const resolveModel = (id) => { const k = String(id).replace(/^bugo-/, 'gyde-'); return GYDE_MODELS[k]?.route ?? k; };

// Geração de imagens: Cloudflare Workers AI (cota diária grátis).
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const IMAGE_MODEL = process.env.IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
const imagesEnabled = () => Boolean(CF_ACCOUNT && CF_TOKEN);
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(BASE, 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

// ---------- Banco de dados (SQLite embutido no Node) ----------
mkdirSync(IMAGES_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'chat.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Nova conversa',
    model TEXT NOT NULL DEFAULT 'auto',
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    attachments TEXT NOT NULL DEFAULT '[]',
    model TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
// Migração: cada conversa passa a pertencer a um usuário.
if (!db.prepare("SELECT 1 FROM pragma_table_info('conversations') WHERE name = 'user_id'").get()) {
  db.exec('ALTER TABLE conversations ADD COLUMN user_id TEXT');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_convs_user ON conversations(user_id, updated_at)');
// Migração do nome antigo (Bugo -> Gyde) nos modelos salvos.
db.exec(`UPDATE conversations SET model = 'gyde' || substr(model, 5) WHERE model LIKE 'bugo-%';
         UPDATE messages SET model = 'gyde' || substr(model, 5) WHERE model LIKE 'bugo-%';`);

const q = {
  listConvs: db.prepare(`SELECT id, title, model, pinned, updated_at FROM conversations WHERE user_id = ?
                         ORDER BY pinned DESC, updated_at DESC LIMIT 500`),
  searchConvs: db.prepare(`SELECT DISTINCT c.id, c.title, c.model, c.pinned, c.updated_at FROM conversations c
                           LEFT JOIN messages m ON m.conversation_id = c.id
                           WHERE c.user_id = ? AND (c.title LIKE ? OR m.content LIKE ?)
                           ORDER BY c.pinned DESC, c.updated_at DESC LIMIT 200`),
  getConv: db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?'),
  insertConv: db.prepare('INSERT INTO conversations (id, user_id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'),
  touchConv: db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?'),
  deleteConv: db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?'),
  claimOrphans: db.prepare('UPDATE conversations SET user_id = ? WHERE user_id IS NULL'),
  getMessages: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid'),
  getMessage: db.prepare('SELECT * FROM messages WHERE id = ? AND conversation_id = ?'),
  insertMessage: db.prepare(`INSERT INTO messages (id, conversation_id, role, content, attachments, model, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`),
  deleteFrom: db.prepare('DELETE FROM messages WHERE conversation_id = ? AND (created_at > ? OR (created_at = ? AND rowid >= ?))'),
  rowidOf: db.prepare('SELECT rowid AS r, created_at FROM messages WHERE id = ? AND conversation_id = ?'),
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  setSetting: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
};

// Preferências são guardadas por usuário: chave "<userId>:<nome>".
const getSetting = (userId, key, fallback = '') => q.getSetting.get(`${userId}:${key}`)?.value ?? fallback;
const setSetting = (userId, key, value) => q.setSetting.run(`${userId}:${key}`, value);
const parseMessage = (m) => ({ ...m, attachments: JSON.parse(m.attachments) });
// created_at precisa ser estritamente crescente dentro de uma conversa.
let lastTs = 0;
const now = () => (lastTs = Math.max(Date.now(), lastTs + 1));

// ---------- Cliente do FreeLLMAPI ----------
async function router(pathname, init = {}) {
  if (!ROUTER_KEY) {
    const err = new Error('Chave do FreeLLMAPI não configurada. Rode o configurar\\configurar-chave.bat.');
    err.status = 503;
    throw err;
  }
  let res;
  try {
    res = await fetch(ROUTER_URL + pathname, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ROUTER_KEY}`, ...init.headers },
    });
  } catch (cause) {
    if (cause.name === 'AbortError') throw cause;
    const err = new Error('Não consegui falar com o FreeLLMAPI. Ele está aberto na bandeja do Windows?');
    err.status = 502;
    throw err;
  }
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j.error?.message || j.message || JSON.stringify(j); } catch { /* corpo vazio */ }
    const err = new Error(`FreeLLMAPI respondeu ${res.status}${detail ? `: ${detail}` : ''}`);
    err.status = res.status === 401 ? 401 : 502;
    throw err;
  }
  return res;
}

// Converte uma mensagem salva para o formato de chat da OpenAI.
function toApiMessage(m) {
  if (m.role !== 'user' || m.attachments.length === 0) return { role: m.role, content: m.content };
  const files = m.attachments.filter((a) => a.kind === 'file');
  const images = m.attachments.filter((a) => a.kind === 'image');
  let text = m.content;
  for (const f of files) {
    text += `\n\n--- Arquivo anexado: ${f.name} ---\n${f.text.slice(0, MAX_ATTACHMENT_TEXT)}`;
    if (f.text.length > MAX_ATTACHMENT_TEXT) text += '\n[arquivo cortado por ser muito grande]';
  }
  if (images.length === 0) return { role: 'user', content: text };
  return {
    role: 'user',
    content: [{ type: 'text', text }, ...images.map((i) => ({ type: 'image_url', image_url: { url: i.dataUrl } }))],
  };
}

// Resumo do perfil (vindo do quiz de boas-vindas) para o modelo adaptar as respostas.
function profileSummary(user) {
  const p = JSON.parse(user.profile || '{}');
  if (!p.level) return '';
  const parts = [
    `Nome: ${user.name}.`,
    `Nível estimado em programação: ${p.levelLabel} (acertou ${p.score} de ${p.total} perguntas do quiz).`,
  ];
  if (p.languages?.length) parts.push(`Linguagens que usa ou quer aprender: ${p.languages.join(', ')}.`);
  if (p.goal) parts.push(`Objetivo: ${p.goal}.`);
  if (p.style) parts.push(`Prefere explicações: ${p.style}.`);
  if (p.weak?.length) parts.push(`Pontos para reforçar (errou no quiz): ${p.weak.join(', ')}.`);
  const guide = {
    zero: 'Explique tudo do zero, sem assumir nenhum conhecimento; use analogias do dia a dia e passos bem pequenos.',
    basic: 'Assuma só o básico (variáveis, if, loops); explique conceitos novos antes de usá-los.',
    intermediate: 'Pode usar termos técnicos comuns, mas explique os menos conhecidos; foque em boas práticas.',
    advanced: 'Seja direto e técnico; aprofunde em desempenho, arquitetura e casos de borda.',
  }[p.level];
  if (guide) parts.push(guide);
  return parts.join(' ');
}

function buildPrompt(history, user, activeSkills = []) {
  const system = [
    [
      'Você é o Gyde, um tutor de programação simpático para iniciantes brasileiros.',
      'Responda em português do Brasil, com linguagem simples; explique termos técnicos na primeira vez que aparecerem.',
      'Ao corrigir um erro: diga em uma frase o que ele significa, mostre a linha ou trecho culpado, explique a causa e só então mostre a correção.',
      'Ao revisar código: aponte primeiro o que está bom, depois os problemas em ordem de importância, sempre dizendo o porquê.',
      'Quando o usuário pedir um exercício, não entregue a resposta; corrija a solução dele depois, com dicas antes da resposta completa.',
      'Prefira exemplos curtos e comentados. Não invente funções ou bibliotecas; se não tiver certeza, diga.',
    ].join(' '),
    'Use Markdown quando ajudar: títulos, listas, tabelas e blocos de código sempre com a linguagem indicada.',
    'Nunca use emojis. Se precisar de ícones, use apenas símbolos tipográficos simples como ✓, ✗, →, •, ⚠︎, ★.',
    `Data de hoje: ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}.`,
  ];
  const profile = profileSummary(user);
  const about = getSetting(user.id, 'about_user');
  const style = getSetting(user.id, 'response_style');
  if (profile) system.push(`Perfil do usuário:\n${profile}`);
  const remembered = memory.promptFor(user.id);
  if (remembered) system.push(remembered);
  if (about) system.push(`Sobre o usuário:\n${about}`);
  if (style) system.push(`Como o usuário quer as respostas:\n${style}`);
  for (const s of activeSkills) {
    system.push(`Skill ativa: ${s.nome}\nSiga estas instruções nesta resposta (elas complementam as regras acima, sem anular a regra de não usar emojis):\n${s.corpo}`);
  }
  return [{ role: 'system', content: system.join('\n\n') }, ...history.map(toApiMessage)];
}

async function generateTitle(convId, firstUserText) {
  try {
    const res = await router('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: UTIL_MODEL,
        max_tokens: 24,
        messages: [
          { role: 'system', content: 'Crie um título curto (máx. 6 palavras) em português para esta conversa. Responda só com o título, sem aspas nem pontuação final.' },
          { role: 'user', content: firstUserText.slice(0, 2000) },
        ],
      }),
    });
    const json = await res.json();
    const title = (json.choices?.[0]?.message?.content || '').replace(/["*#\n]/g, '').trim().slice(0, 80);
    if (title) db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, convId);
    return title;
  } catch {
    return null;
  }
}

// Modelos de imagem entendem melhor inglês: o Gyde reescreve o pedido antes de gerar.
async function improveImagePrompt(text) {
  try {
    const res = await router('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: UTIL_MODEL,
        max_tokens: 200,
        messages: [
          { role: 'system', content: 'Rewrite the user request as a single detailed English prompt for an image generation model (subject, style, composition, lighting). Keep any text that must appear in the image in its original language, in quotes. Reply with the prompt only.' },
          { role: 'user', content: text.slice(0, 2000) },
        ],
      }),
    });
    const json = await res.json();
    return (json.choices?.[0]?.message?.content || '').trim() || text;
  } catch {
    return text;
  }
}

async function generateImage(prompt, signal) {
  if (!imagesEnabled()) {
    throw Object.assign(new Error('A geração de imagens ainda não foi configurada. Rode o configurar\\configurar-imagens.bat.'), { status: 503 });
  }
  let res;
  try {
    res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${IMAGE_MODEL}`, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 6 }),
    });
  } catch (cause) {
    if (cause.name === 'AbortError') throw cause;
    throw Object.assign(new Error('Não consegui falar com a Cloudflare. Verifique sua internet.'), { status: 502 });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.result?.image) {
    const msg = json.errors?.[0]?.message || `HTTP ${res.status}`;
    const hint = res.status === 401 || res.status === 403 ? ' Confira o Account ID e o token (precisa da permissão Workers AI).'
      : res.status === 429 ? ' A cota grátis de hoje acabou; tente amanhã.' : '';
    throw Object.assign(new Error(`A Cloudflare não gerou a imagem: ${msg}.${hint}`), { status: 502 });
  }
  const id = randomUUID();
  writeFileSync(path.join(IMAGES_DIR, `${id}.jpg`), Buffer.from(json.result.image, 'base64'));
  return `/images/${id}.jpg`;
}

// ---------- API ----------
const app = express();
app.use(express.json({ limit: '30mb' }));

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Cadastro/login (/api/auth/*). Tudo abaixo de /api exige usuário logado, menos o status.
const { requireAuth } = setupAuth(app, db);
let orphansClaimed = false;
app.use(['/api', '/images'], (req, res, next) => {
  if (req.baseUrl === '/api' && req.path === '/status') return next();
  requireAuth(req, res, () => {
    // Conversas criadas antes do login existir ficam com a primeira conta confirmada.
    if (!orphansClaimed) {
      const first = db.prepare('SELECT id FROM users WHERE email_verified = 1 ORDER BY created_at LIMIT 1').get();
      if (first?.id === req.user.id) q.claimOrphans.run(req.user.id);
      if (first) orphansClaimed = true;
    }
    next();
  });
});

// Skills instaláveis (catálogo em skills-catalogo/*.md + skills próprias de cada pessoa).
const skillsSystem = setupSkills(app, db, { root: ROOT });

// Memória entre conversas (memoria.js).
const memory = setupMemoria(app, db, { router, getSetting, setSetting });

app.get('/api/status', asyncRoute(async (_req, res) => {
  const status = { keyConfigured: Boolean(ROUTER_KEY), routerUrl: ROUTER_URL, routerOnline: false, imagesEnabled: imagesEnabled() };
  try {
    const r = await fetch(ROUTER_URL + '/health', { signal: AbortSignal.timeout(3000) });
    status.routerOnline = r.ok;
  } catch { /* offline */ }
  res.json(status);
}));

app.get('/api/models', asyncRoute(async (_req, res) => {
  const r = await router('/v1/models');
  const json = await r.json();
  const available = new Set((json.data || []).filter((m) => m.available !== false).map((m) => m.id));
  res.json({
    brand: Object.entries(GYDE_MODELS).map(([id, m]) => ({ id, label: m.label, hint: m.hint })),
    models: CODE_MODELS.filter((m) => available.has(m.id)),
  });
}));

app.get('/api/conversations', (req, res) => {
  const term = String(req.query.q || '').trim();
  const rows = term ? q.searchConvs.all(req.user.id, `%${term}%`, `%${term}%`) : q.listConvs.all(req.user.id);
  res.json({ conversations: rows });
});

app.post('/api/conversations', (req, res) => {
  const id = randomUUID();
  const t = now();
  q.insertConv.run(id, req.user.id, 'Nova conversa', String(req.body?.model || DEFAULT_MODEL), t, t);
  res.status(201).json(q.getConv.get(id, req.user.id));
});

app.get('/api/conversations/:id', (req, res) => {
  const conv = q.getConv.get(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada.' });
  res.json({ ...conv, messages: q.getMessages.all(conv.id).map(parseMessage) });
});

app.patch('/api/conversations/:id', (req, res) => {
  const conv = q.getConv.get(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada.' });
  const { title, model, pinned } = req.body || {};
  if (typeof title === 'string' && title.trim()) db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title.trim().slice(0, 120), conv.id);
  if (typeof model === 'string' && model) db.prepare('UPDATE conversations SET model = ? WHERE id = ?').run(model, conv.id);
  if (typeof pinned === 'boolean') db.prepare('UPDATE conversations SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, conv.id);
  res.json(q.getConv.get(conv.id, req.user.id));
});

app.delete('/api/conversations/:id', (req, res) => {
  q.deleteConv.run(req.params.id, req.user.id);
  res.status(204).end();
});

// ---------- Prática: exercícios, projetos, revisão, desafio do dia, amigos (pratica-servidor.js) ----------
setupPratica(app, db, { router, profileSummary, asyncRoute });
setupTurmas(app, db); // modo turma (turmas.js)
setupAgente(app, { router, asyncRoute }); // agente do navegador da extensão (agente.js)
setupCodigoAgente(app, db, { router, asyncRoute }); // Forja (agente de código): trabalha numa pasta de projeto (codigo-agente.js)

// ---------- Quiz de boas-vindas ----------
app.get('/api/quiz', (_req, res) => res.json({ questions: publicQuiz() }));

app.post('/api/profile', (req, res) => {
  const { profile, results } = gradeQuiz(req.body?.answers);
  db.prepare('UPDATE users SET profile = ?, onboarded = 1 WHERE id = ?').run(JSON.stringify(profile), req.user.id);
  res.json({ profile, results });
});

// Pular o quiz (dá para fazer depois em Personalizar).
app.post('/api/profile/skip', (req, res) => {
  db.prepare('UPDATE users SET onboarded = 1 WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

app.get('/api/settings', (req, res) => {
  res.json({ about_user: getSetting(req.user.id, 'about_user'), response_style: getSetting(req.user.id, 'response_style') });
});

app.put('/api/settings', (req, res) => {
  for (const key of ['about_user', 'response_style']) {
    if (typeof req.body?.[key] === 'string') setSetting(req.user.id, key, req.body[key].slice(0, 4000));
  }
  res.json({ about_user: getSetting(req.user.id, 'about_user'), response_style: getSetting(req.user.id, 'response_style') });
});

// Extrai texto de PDFs enviados pelo navegador.
app.post('/api/extract', express.raw({ type: () => true, limit: '30mb' }), asyncRoute(async (req, res) => {
  const { extractText, getDocumentProxy } = await import('unpdf');
  try {
    const pdf = await getDocumentProxy(new Uint8Array(req.body));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    res.json({ text: text.trim(), pages: totalPages });
  } catch {
    res.status(422).json({ error: 'Não consegui ler esse PDF (ele pode estar protegido ou ser só imagem).' });
  }
}));

/**
 * Envia uma mensagem e devolve a resposta em streaming (Server-Sent Events).
 * body: { content, attachments, model, mode: 'new' | 'regenerate' | 'edit' | 'retry', messageId, kind: 'chat' | 'image' }
 */
app.post('/api/conversations/:id/messages', asyncRoute(async (req, res) => {
  const conv = q.getConv.get(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada.' });

  const { content = '', attachments = [], model, mode = 'new', messageId } = req.body || {};
  let isImage = req.body?.kind === 'image';
  // "Gerar de novo" numa imagem gera outra imagem.
  if (mode === 'regenerate' && messageId) isImage ||= /^!\[/.test(q.getMessage.get(messageId, conv.id)?.content || '');
  const chosenModel = String(model || conv.model || DEFAULT_MODEL).replace(/^bugo-/, 'gyde-');
  if (chosenModel !== conv.model) db.prepare('UPDATE conversations SET model = ? WHERE id = ?').run(chosenModel, conv.id);

  // Ajusta o histórico conforme o modo.
  if (mode === 'regenerate' || mode === 'edit') {
    const target = messageId && q.rowidOf.get(messageId, conv.id);
    if (!target) return res.status(400).json({ error: 'Mensagem de referência inválida.' });
    q.deleteFrom.run(conv.id, target.created_at, target.created_at, target.r);
  }
  let userMessage = null;
  if (mode === 'new' || mode === 'edit') {
    if (!String(content).trim() && attachments.length === 0) return res.status(400).json({ error: 'Mensagem vazia.' });
    userMessage = { id: randomUUID(), role: 'user', content: String(content), attachments, created_at: now() };
    q.insertMessage.run(userMessage.id, conv.id, 'user', userMessage.content, JSON.stringify(attachments), null, userMessage.created_at);
  }

  const history = q.getMessages.all(conv.id).map(parseMessage);
  if (history.at(-1)?.role !== 'user') return res.status(400).json({ error: 'Nada para responder.' });
  const isFirstExchange = history.length === 1;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  if (userMessage) send({ type: 'user', message: userMessage });
  const activeSkills = skillsSystem.activeFor(req.user.id, history.at(-1).content);
  if (activeSkills.length) send({ type: 'skills', skills: activeSkills.map((s) => ({ id: s.id, nome: s.nome, simbolo: s.simbolo })) });

  const controller = new AbortController();
  res.on('close', () => controller.abort());

  let answer = '';
  let servedModel = chosenModel;
  let failure = null;
  const started = Date.now();
  try {
    if (isImage) {
      const request = history.at(-1).content;
      send({ type: 'status', text: 'Criando a imagem…' });
      const prompt = await improveImagePrompt(request);
      const url = await generateImage(prompt, controller.signal);
      servedModel = IMAGE_MODEL.split('/').pop();
      const alt = request.replace(/[[\]\n]/g, ' ').slice(0, 120);
      answer = `![${alt}](${url})\n\n*Prompt usado:* ${prompt.replace(/\n/g, ' ')}`;
      send({ type: 'delta', text: answer });
    } else {
    // Motor do Gyde: tenta os modelos da cadeia em ordem; troca de modelo se um falhar antes de responder.
    const cadeia = cadeiaDe(String(chosenModel).replace(/^bugo-/, 'gyde-'));
    const mensagens = buildPrompt(history, req.user, activeSkills);
    for (let tentativa = 0; tentativa < cadeia.length; tentativa++) {
    const modeloAtual = cadeia[tentativa];
    try {
    const upstream = await router('/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({ model: modeloAtual, stream: true, messages: mensagens }),
    });
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let json;
        try { json = JSON.parse(data); } catch { continue; }
        if (json.error) throw Object.assign(new Error(json.error.message || 'Erro no provedor.'), { status: 502 });
        if (json.model && !GYDE_MODELS[chosenModel]) servedModel = json.model;
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          answer += delta;
          send({ type: 'delta', text: delta });
        }
      }
    }
    if (answer) break;
    } catch (err) {
      if (err.name === 'AbortError' || answer || tentativa === cadeia.length - 1) throw err; // já respondeu algo: não recomeça
    }
    }
    }
  } catch (err) {
    if (err.name !== 'AbortError') failure = err;
  }

  if (answer) {
    const assistant = { id: randomUUID(), role: 'assistant', content: answer, attachments: [], model: servedModel, created_at: now() };
    q.insertMessage.run(assistant.id, conv.id, 'assistant', answer, '[]', servedModel, assistant.created_at);
    q.touchConv.run(Date.now(), conv.id);
    if (!res.writableEnded) send({ type: 'done', message: assistant, elapsedMs: Date.now() - started, stopped: controller.signal.aborted });
    if (!isImage) memory.learnFrom(req.user, history, answer); // em segundo plano
  } else if (!res.writableEnded) {
    send({ type: 'error', error: failure?.message || 'O modelo não devolveu nenhuma resposta. Tente de novo ou troque o modelo.' });
  }
  q.touchConv.run(Date.now(), conv.id);

  if (isFirstExchange && answer && conv.title === 'Nova conversa') {
    const title = await generateTitle(conv.id, history[0].content || history[0].attachments.map((a) => a.name).join(', '));
    if (title && !res.writableEnded) send({ type: 'title', title });
  }
  res.end();
}));

// ---------- Arquivos estáticos ----------
const nm = (p) => path.join(BASE, 'node_modules', p);
app.use('/images', express.static(IMAGES_DIR, { maxAge: '30d', immutable: true }));
app.use('/vendor/marked', express.static(nm('marked/lib')));
app.use('/vendor/dompurify', express.static(nm('dompurify/dist')));
app.use('/vendor/fflate', express.static(nm('fflate/esm')));
app.use('/vendor/hljs', express.static(nm('@highlightjs/cdn-assets')));
app.get('/favicon.ico', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'gyde.ico'), { maxAge: 0 }));
app.use(express.static(path.join(ROOT, 'public')));

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500 && status !== 502 && status !== 503) console.error(err);
  if (res.headersSent) return res.end();
  res.status(status).json({ error: err.message || 'Erro interno.' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Gyde rodando em http://127.0.0.1:${PORT}`);
  console.log(`  FreeLLMAPI: ${ROUTER_URL}  |  chave: ${ROUTER_KEY ? 'configurada' : 'FALTANDO (rode configurar\\configurar-chave.bat)'}\n`);
});
