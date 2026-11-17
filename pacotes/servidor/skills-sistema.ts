// Skills do Gyde: pacotes de instruções instaláveis (como plugins), com uma loja onde
// cada pessoa publica as próprias skills e as outras instalam uma cópia.
// Cada skill é um arquivo .md com cabeçalho (--- ... ---) e o corpo com as instruções, em seções curtas:
// "## Passos", "## Checklist", "## Exemplo" e "## Erros comuns".
//
// Como uma skill entra na resposta: só as INSTALADAS, e só quando a mensagem pede (pelo comando, como /sql, ou pelas
// palavras do assunto). Entram no máximo 2 por mensagem e só as partes que cabem no limite (trechoDaSkill): passos e
// checklist sempre; exemplo e erros comuns se couberem (erros comuns primeiro quando a mensagem fala de erro). Assim o
// contexto dos modelos grátis não estoura. A resposta mostra "Usando a skill X".
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Express } from 'express';
import type { Db } from './tipos.ts';
import { consulta, comoErro, erroGyde } from './tipos.ts';
import * as C from '../compartilhado/contratos.ts';
import { NOMES_ICONES } from '../compartilhado/icones-nomes.ts';
import { responder } from './contratos-servidor.ts';

export interface Skill { id: string; nome: string; descricao: string; icone: string; comando: string; gatilhos: string[]; categoria: string; corpo: string }
export type SkillListada = Skill & { origem: 'catalogo' | 'minha'; publicada?: string | null; loja?: string | null; instalada?: boolean };
export interface Trecho { texto: string; secoes: string[] }
export type SkillAtiva = SkillListada & { trecho: Trecho };
interface LinhaLoja { id: string; source_id: string; author_id: string; data: string; installs: number; published_at: number; updated_at: number }

const MAX_BODY = 8000;
const MAX_ACTIVE = 2;
export const LIMITE_SKILL = 1500; // caracteres de uma skill no pedido (cerca de 400 tokens)
export const LIMITE_TOTAL = 2600; // todas as skills de uma mensagem juntas (cerca de 700 tokens)
const FIELDS = ['id', 'nome', 'descricao', 'icone', 'comando', 'gatilhos', 'categoria'] as const;
const ICONES = new Set(NOMES_ICONES);
export const ICONE_PADRAO = 'puzzle';

// Lê o formato "--- chave: valor --- corpo".
export function parseSkill(text: unknown): Skill {
  const m = String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) throw new Error('Arquivo de skill inválido: falta o cabeçalho entre linhas "---".');
  const meta: Record<string, string> = {};
  for (const line of (m[1] ?? '').split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return normalize({ ...meta, corpo: (m[2] ?? '').trim() });
}

function normalize(s: Record<string, unknown>): Skill {
  const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
  const icone = clean(s.icone, 40).toLowerCase();
  const skill: Skill = {
    id: clean(s.id, 60).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    nome: clean(s.nome, 60),
    descricao: clean(s.descricao, 240),
    // skills antigas tinham um "simbolo" (um caractere); agora todas usam um ícone do conjunto do Gyde
    icone: ICONES.has(icone) ? icone : ICONE_PADRAO,
    comando: clean(s.comando, 30).toLowerCase(),
    gatilhos: (Array.isArray(s.gatilhos) ? s.gatilhos : String(s.gatilhos ?? '').split(','))
      .map((g: unknown) => String(g).trim().toLowerCase()).filter(Boolean).slice(0, 20),
    categoria: clean(s.categoria, 30) || 'Outras',
    corpo: String(s.corpo ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_BODY),
  };
  if (skill.comando && !/^\/[a-z0-9-]{2,24}$/.test(skill.comando)) skill.comando = '';
  if (!skill.nome) throw new Error('A skill precisa de um nome.');
  if (!skill.corpo) throw new Error('A skill precisa de instruções.');
  return skill;
}

export function toMarkdown(s: Skill): string {
  return `---\n${FIELDS.map((k) => `${k}: ${k === 'gatilhos' ? s.gatilhos.join(', ') : s[k] ?? ''}`).join('\n')}\n---\n${s.corpo}\n`;
}

/** Seções "## Título" do corpo; o texto antes da primeira seção fica como "Instruções". */
export function secoesDe(corpo: string): { titulo: string; texto: string }[] {
  const partes = corpo.split(/^##\s+/m);
  const r: { titulo: string; texto: string }[] = [];
  if (partes[0]!.trim()) r.push({ titulo: 'Instruções', texto: partes[0]!.trim() });
  for (const p of partes.slice(1)) {
    const quebra = p.indexOf('\n');
    const titulo = (quebra < 0 ? p : p.slice(0, quebra)).trim();
    const texto = quebra < 0 ? '' : p.slice(quebra + 1).trim();
    if (titulo && texto) r.push({ titulo, texto });
  }
  return r;
}

const FALA_DE_ERRO = /\b(erro|error|bug|exception|traceback|n[ãa]o funciona|quebrou|falha)/i;
function corta(t: string, max: number): string {
  if (t.length <= max) return t;
  const quebra = t.lastIndexOf('\n', max);
  return `${t.slice(0, quebra > max * 0.5 ? quebra : max).trimEnd()}\n(...)`;
}

/** As partes da skill que entram no pedido, dentro do limite: passos e checklist sempre; o resto se couber. */
export function trechoDaSkill(skill: Skill, mensagem: string, limite = LIMITE_SKILL): Trecho {
  if (!/^##\s/m.test(skill.corpo)) return { texto: corta(skill.corpo, limite), secoes: ['Instruções'] };
  const secoes = secoesDe(skill.corpo);
  const peso = (t: string) => (/^(passos|instru)/i.test(t) ? 0 : /^checklist/i.test(t) ? 1 : /^erros/i.test(t) ? (FALA_DE_ERRO.test(mensagem) ? 2 : 4) : /^exemplo/i.test(t) ? 3 : 5);
  const escolhidas = new Map<string, string>();
  let usado = 0;
  for (const s of [...secoes].sort((a, b) => peso(a.titulo) - peso(b.titulo))) {
    const tamanho = s.titulo.length + s.texto.length + 6;
    if (usado + tamanho <= limite) { escolhidas.set(s.titulo, s.texto); usado += tamanho; } else if (peso(s.titulo) <= 1 && !escolhidas.size) { escolhidas.set(s.titulo, corta(s.texto, limite - s.titulo.length - 6)); usado = limite; }
  }
  const naOrdem = secoes.filter((s) => escolhidas.has(s.titulo));
  return { texto: naOrdem.map((s) => `## ${s.titulo}\n${escolhidas.get(s.titulo)}`).join('\n\n'), secoes: naOrdem.map((s) => s.titulo) };
}

/** O texto que vai nas instruções do modelo. */
export function textoDaSkillNoPedido(skill: { nome: string }, trecho: Trecho): string {
  return `Skill ativa: ${skill.nome}\nSiga estes passos e confira o checklist nesta resposta (eles complementam as regras acima, sem anular a regra de não usar emojis):\n${trecho.texto}`;
}

/** Catálogo: todos os .md de skills-catalogo. */
export function lerCatalogo(root: string): Map<string, SkillListada> {
  const pasta = path.join(root, 'skills-catalogo');
  const catalogo = new Map<string, SkillListada>();
  for (const file of readdirSync(pasta).filter((f) => f.endsWith('.md'))) {
    try {
      const s = parseSkill(readFileSync(path.join(pasta, file), 'utf8'));
      catalogo.set(s.id, { ...s, origem: 'catalogo' });
    } catch (err) {
      console.warn(`[Gyde] Skill ignorada (${file}): ${comoErro(err).message}`);
    }
  }
  return catalogo;
}

export interface Pacote { id: string; nome: string; icone: string; descricao: string; frases: string[]; skills: string[] }
export interface Objetivos { categorias: { nome: string; icone: string }[]; paraComecar: string[]; pacotes: Pacote[] }
export interface AvaliacaoSkill { com: number | null; sem: number | null; n: number; criterios: number; melhorou: boolean }
const lerJson = <T>(p: string, padrao: T): T => { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as T : padrao; } catch { return padrao; } };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const temGatilho = (msg: string, g: string) => new RegExp(`(^|[^\\p{L}])${escapeRe(g)}([^\\p{L}]|$)`, 'u').test(msg);

/** Escolhe as skills de uma mensagem entre as instaladas: comando primeiro; senão, as com mais palavras do assunto. */
export function escolherSkills(instaladas: SkillListada[], texto: string): SkillAtiva[] {
  const msg = String(texto || '').toLowerCase();
  const porComando = instaladas.filter((s) => s.comando && new RegExp(`(^|\\s)${escapeRe(s.comando)}(\\s|$)`).test(msg));
  const candidatas = porComando.length ? porComando : instaladas
    .map((s) => ({ s, acertos: s.gatilhos.filter((g) => temGatilho(msg, g)).length }))
    .filter((x) => x.acertos > 0)
    .sort((a, b) => b.acertos - a.acertos)
    .map((x) => x.s);
  const r: SkillAtiva[] = [];
  let usado = 0;
  for (const s of candidatas.slice(0, MAX_ACTIVE)) {
    const trecho = trechoDaSkill(s, msg, Math.min(LIMITE_SKILL, LIMITE_TOTAL - usado));
    if (trecho.texto.length < 80) break;
    r.push({ ...s, trecho });
    usado += trecho.texto.length;
  }
  return r;
}

/** Uma skill do catálogo (não instalada) que ajudaria nesta mensagem: o chat sugere instalar. */
export function sugerirSkill(naoInstaladas: SkillListada[], texto: string): SkillListada | null {
  const msg = String(texto || '').toLowerCase();
  const melhor = naoInstaladas
    .map((s) => ({ s, acertos: s.gatilhos.filter((g) => g.length >= 4 && temGatilho(msg, g)).length }))
    .filter((x) => x.acertos > 0)
    .sort((a, b) => b.acertos - a.acertos)[0];
  return melhor?.s ?? null;
}

export function setupSkills(app: Express, db: Db, { root }: { root: string }) {
  const catalog = lerCatalogo(root);
  // categorias, pacotes por objetivo e "para começar"; e o resultado da avaliação de cada skill (com e sem ela)
  const objetivos = lerJson<Objetivos>(path.join(root, 'skills-catalogo', 'objetivos.json'), { categorias: [], paraComecar: [], pacotes: [] });
  const avaliacao = lerJson<{ em?: string; provedores?: string[]; skills?: Record<string, AvaliacaoSkill> }>(path.join(root, 'skills-catalogo', 'avaliacao.json'), {});
  const pacotes = objetivos.pacotes.map((p) => ({ ...p, skills: p.skills.filter((id) => catalog.has(id)) })).filter((p) => p.skills.length);

  const q = {
    installed: consulta<{ skill_id: string }>(db, 'SELECT skill_id FROM user_skills WHERE user_id = ?'),
    install: db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, installed_at) VALUES (?, ?, ?)'),
    uninstall: db.prepare('DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?'),
    customs: consulta<{ id: string; data: string }>(db, 'SELECT id, data FROM custom_skills WHERE user_id = ? ORDER BY updated_at DESC'),
    getCustom: consulta<{ id: string; data: string }>(db, 'SELECT id, data FROM custom_skills WHERE id = ? AND user_id = ?'),
    upsertCustom: db.prepare(`INSERT INTO custom_skills (id, user_id, data, updated_at) VALUES (?, ?, ?, ?)
                              ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
    deleteCustom: db.prepare('DELETE FROM custom_skills WHERE id = ? AND user_id = ?'),
    countCustom: consulta<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM custom_skills WHERE user_id = ?'),
    loja: consulta<LinhaLoja & { author_name: string }>(db, `SELECT l.*, u.name AS author_name FROM skill_loja l JOIN users u ON u.id = l.author_id
                      ORDER BY l.installs DESC, l.updated_at DESC LIMIT 300`),
    lojaGet: consulta<LinhaLoja>(db, 'SELECT * FROM skill_loja WHERE id = ?'),
    lojaBySource: consulta<LinhaLoja>(db, 'SELECT * FROM skill_loja WHERE source_id = ?'),
    lojaMine: consulta<{ id: string; source_id: string }>(db, 'SELECT id, source_id FROM skill_loja WHERE author_id = ?'),
    lojaPublish: db.prepare(`INSERT INTO skill_loja (id, source_id, author_id, data, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
                             ON CONFLICT(source_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
    lojaRemove: db.prepare('DELETE FROM skill_loja WHERE id = ? AND author_id = ?'),
    lojaRemoveSource: db.prepare('DELETE FROM skill_loja WHERE source_id = ? AND author_id = ?'),
    lojaInstalled: db.prepare('UPDATE skill_loja SET installs = installs + 1 WHERE id = ?'),
    maisUsadas: consulta<{ skill_id: string; n: number }>(db, 'SELECT skill_id, COUNT(*) AS n FROM user_skills GROUP BY skill_id ORDER BY n DESC LIMIT 20'),
  };

  // Skills próprias recebem o prefixo "minha-" no id para não colidir com o catálogo.
  const customsOf = (userId: string): SkillListada[] => {
    const published = new Map(q.lojaMine.all(userId).map((r) => [r.source_id, r.id]));
    return q.customs.all(userId).map((r) => {
      const d = JSON.parse(r.data);
      return { ...d, icone: ICONES.has(d.icone) ? d.icone : ICONE_PADRAO, id: r.id, origem: 'minha', publicada: published.get(r.id) || null };
    });
  };

  function listFor(userId: string): (SkillListada & { instalada: boolean })[] {
    const installed = new Set(q.installed.all(userId).map((r) => r.skill_id));
    const all = [...catalog.values(), ...customsOf(userId)];
    return all.map((s) => ({ ...s, instalada: installed.has(s.id), teste: s.origem === 'catalogo' ? avaliacao.skills?.[s.id] ?? null : null }));
  }

  // Skills desta mensagem (as instaladas que o pedido chama) e, se nenhuma serve, uma do catálogo para sugerir.
  function activeFor(userId: string, text: unknown): { ativas: SkillAtiva[]; sugestao: SkillListada | null } {
    const todas = listFor(userId);
    const ativas = escolherSkills(todas.filter((s) => s.instalada), String(text || ''));
    return { ativas, sugestao: ativas.length ? null : sugerirSkill(todas.filter((s) => !s.instalada && s.origem === 'catalogo'), String(text || '')) };
  }

  const findFor = (userId: string, id: string) => listFor(userId).find((s) => s.id === id);

  app.get('/api/skills', (req, res) => responder(res, C.ListaSkills, { skills: listFor(req.user.id) }));

  // Catálogo por objetivo: categorias, pacotes ("Criar um site" instala várias de uma vez), "para começar" e as mais
  // instaladas neste Gyde. A avaliação diz quando e com que modelos as skills foram testadas.
  app.get('/api/skills/objetivos', (_req, res) => {
    const maisUsadas = q.maisUsadas.all().map((r) => r.skill_id).filter((id) => catalog.has(id)).slice(0, 6);
    responder(res, C.ObjetivosSkills, {
      categorias: objetivos.categorias, pacotes, paraComecar: objetivos.paraComecar.filter((id) => catalog.has(id)), maisUsadas,
      avaliacao: { em: avaliacao.em ?? null, provedores: avaliacao.provedores ?? [] },
    });
  });

  app.post('/api/skills/pacotes/:id/install', (req, res) => {
    const p = pacotes.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Pacote não encontrado.' });
    const agora = Date.now();
    for (const id of p.skills) q.install.run(req.user.id, id, agora);
    responder(res, C.ListaSkills, { skills: listFor(req.user.id) });
  });

  app.post('/api/skills/:id/install', (req, res) => {
    const s = findFor(req.user.id, req.params.id);
    if (!s) return res.status(404).json({ error: 'Skill não encontrada.' });
    q.install.run(req.user.id, s.id, Date.now());
    responder(res, C.ListaSkills, { skills: listFor(req.user.id) });
  });

  app.delete('/api/skills/:id/install', (req, res) => {
    q.uninstall.run(req.user.id, req.params.id);
    responder(res, C.ListaSkills, { skills: listFor(req.user.id) });
  });

  function saveCustom(userId: string, data: Record<string, unknown>, existingId?: string | null, extra: { loja?: string } = {}): string {
    if (!existingId && (q.countCustom.get(userId)?.n ?? 0) >= 50) {
      throw erroGyde('Limite de 50 skills próprias.', { status: 400 });
    }
    let skill: Skill;
    try {
      skill = normalize(data);
    } catch (err) {
      throw Object.assign(comoErro(err), { status: 400 });
    }
    const id = existingId || `minha-${randomUUID().slice(0, 8)}`;
    // Um comando igual ao de outra skill instalada confundiria o chat.
    const clash = skill.comando && listFor(userId).find((s) => s.id !== id && s.comando === skill.comando);
    if (clash) throw erroGyde(`O comando ${skill.comando} já é usado pela skill "${clash.nome}".`, { status: 400 });
    const prev = existingId ? JSON.parse(q.getCustom.get(existingId, userId)?.data || '{}') : {};
    q.upsertCustom.run(id, userId, JSON.stringify({ ...skill, id, loja: extra.loja ?? prev.loja ?? null }), Date.now());
    q.install.run(userId, id, Date.now()); // criou, já fica instalada
    return id;
  }

  app.post('/api/skills/custom', (req, res) => {
    const id = saveCustom(req.user.id, req.body || {});
    responder(res, C.SkillSalva, { id, skills: listFor(req.user.id) }, 201);
  });

  app.put('/api/skills/custom/:id', (req, res) => {
    if (!q.getCustom.get(req.params.id, req.user.id)) return res.status(404).json({ error: 'Skill não encontrada.' });
    saveCustom(req.user.id, req.body || {}, req.params.id);
    responder(res, C.SkillSalva, { id: req.params.id, skills: listFor(req.user.id) });
  });

  app.delete('/api/skills/custom/:id', (req, res) => {
    q.deleteCustom.run(req.params.id, req.user.id);
    q.uninstall.run(req.user.id, req.params.id);
    q.lojaRemoveSource.run(req.params.id, req.user.id); // excluir a skill também tira da loja
    responder(res, C.ListaSkills, { skills: listFor(req.user.id) });
  });

  // Importa um arquivo .md (de outra pessoa ou exportado antes) como skill própria.
  app.post('/api/skills/import', (req, res) => {
    let parsed: Skill;
    try {
      parsed = parseSkill(String(req.body?.markdown || '').slice(0, 20_000));
    } catch (err) {
      return res.status(400).json({ error: comoErro(err).message });
    }
    const id = saveCustom(req.user.id, { ...parsed });
    responder(res, C.SkillSalva, { id, skills: listFor(req.user.id) }, 201);
  });

  // Loja: skills publicadas por quem usa este Gyde. Instalar cria uma cópia própria (editável),
  // então o autor mudar ou despublicar depois não altera o que outras pessoas já instalaram.
  app.get('/api/skills/loja', (req, res) => {
    const copies = new Set(customsOf(req.user.id).map((s) => s.loja).filter(Boolean));
    responder(res, C.Loja, {
      loja: q.loja.all().map((r) => {
        const s = JSON.parse(r.data);
        return { ...s, icone: ICONES.has(s.icone) ? s.icone : ICONE_PADRAO, id: r.id, autor: r.author_name, installs: r.installs, atualizada: r.updated_at,
          minha: r.author_id === req.user.id, instalada: copies.has(r.id) };
      }),
    });
  });

  app.post('/api/skills/custom/:id/publicar', (req, res) => {
    const row = q.getCustom.get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Skill não encontrada.' });
    const data = JSON.parse(row.data);
    if (data.loja) return res.status(400).json({ error: 'Esta skill veio da loja. Só quem criou pode publicar.' });
    const { loja: _loja, id: _id, ...pub } = data;
    if (String(pub.corpo).length < 40) return res.status(400).json({ error: 'Escreva instruções um pouco mais completas antes de publicar.' });
    if (!pub.descricao) return res.status(400).json({ error: 'Adicione uma descrição curta antes de publicar.' });
    const existing = q.lojaBySource.get(row.id);
    const lojaId = existing?.id || `loja-${randomUUID().slice(0, 8)}`;
    q.lojaPublish.run(lojaId, row.id, req.user.id, JSON.stringify(pub), Date.now(), Date.now());
    responder(res, C.SkillPublicada, { id: lojaId, atualizada: Boolean(existing), skills: listFor(req.user.id) });
  });

  app.delete('/api/skills/loja/:id', (req, res) => {
    q.lojaRemove.run(req.params.id, req.user.id);
    responder(res, C.ListaSkills, { skills: listFor(req.user.id) });
  });

  app.post('/api/skills/loja/:id/instalar', (req, res) => {
    const item = q.lojaGet.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Essa skill saiu da loja.' });
    if (item.author_id === req.user.id) return res.status(400).json({ error: 'Essa skill é sua: ela já está na sua conta.' });
    if (customsOf(req.user.id).some((s) => s.loja === item.id)) return res.status(400).json({ error: 'Você já instalou esta skill.' });
    const data = JSON.parse(item.data);
    let id: string;
    let semComando = false;
    try {
      id = saveCustom(req.user.id, data, null, { loja: item.id });
    } catch (err) {
      if (!/comando/.test(comoErro(err).message)) throw err;
      id = saveCustom(req.user.id, { ...data, comando: '' }, null, { loja: item.id }); // comando já usado: instala sem ele
      semComando = true;
    }
    q.lojaInstalled.run(item.id);
    responder(res, C.SkillDaLoja, { id, semComando, skills: listFor(req.user.id) }, 201);
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
