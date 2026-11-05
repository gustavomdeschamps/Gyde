// Chat do Gyde: conversas, mensagens com resposta em streaming, títulos automáticos, imagens e leitura de PDF.
import express from 'express';
import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import type { AsyncRoute, Db, ErroGyde, MensagemIA, Router, Usuario } from './tipos.ts';
import { consulta, comoErro } from './tipos.ts';
import { cadeiaDe, CADEIAS, completar } from './motor.ts';
import { redigir } from './seguranca.ts';
import { classificar } from './ia/classificar.ts';
import { selecionarHistorico, tamanhoDe, type Anexo } from './ia/contexto.ts';
import { PROMPT_RESUMO, sistemaDoChat } from './ia/prompts.ts';
import { limparResposta } from './ia/filtro.ts';
import type { Orquestrador } from './ia/orquestrador.ts';
import type { PreferenciasIA } from './ia/rotas.ts';
import { profileSummary, type Preferencias } from './perfil.ts';
import type { Uso } from './uso.ts';
import type { Imagens } from './imagens.ts';
import type { SkillListada } from './skills-sistema.ts';
import * as C from '../compartilhado/contratos.ts';
import { responder } from './contratos-servidor.ts';
import { registrarErro } from './diagnostico.ts';

// Formatos guardados no banco
interface Conversa { id: string; user_id: string | null; title: string; model: string; pinned: number; created_at: number; updated_at: number; resumo: string; resumo_ate: number }
interface LinhaMensagem { id: string; conversation_id: string; role: 'user' | 'assistant'; content: string; attachments: string; model: string | null; created_at: number }
type Mensagem = Omit<LinhaMensagem, 'attachments'> & { attachments: Anexo[] };
// Resposta de chat do provedor (formato OpenAI), sem streaming
interface RespostaChat { choices?: { message?: { content?: string } }[] }

// Modelos da marca: nomes que o usuário vê. A escolha real é do orquestrador (ia/orquestrador.ts).
const GYDE_MODELS: Record<string, { label: string; hint: string }> = {
  'gyde-1': { label: 'Gyde 1', hint: 'Escolhe o modelo certo para cada pedido e troca sozinho se um falhar' },
  'gyde-1-pro': { label: 'Gyde 1 Pro', hint: 'Capricho: um segundo modelo confere código e raciocínio. Mais lento e gasta cerca de 3 vezes mais cota' },
};
// Poucos modelos escolhidos a dedo para programação (testados com o FreeLLMAPI). Só aparecem os que o roteador marca como disponíveis.
const CODE_MODELS = [
  { id: 'qwen3.8-27b', label: 'Qwen 3.8', hint: 'Ótimo em código e rápido' },
  { id: 'codestral', label: 'Codestral', hint: 'Especialista em código, da Mistral' },
  { id: 'mistral-code', label: 'Mistral Code', hint: 'Focado em escrever e corrigir código' },
  { id: 'nemotron-3-ultra-550b', label: 'Nemotron Ultra', hint: 'Modelo grande da NVIDIA, bom para raciocinar' },
];
const DEFAULT_MODEL = 'gyde-1';

// anexos vêm do navegador: só passam os campos conhecidos, com tipos conferidos
export const limparAnexos = (lista: unknown): Anexo[] => (Array.isArray(lista) ? lista : [])
  .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === 'object' && (a.kind === 'image' || a.kind === 'file'))
  .slice(0, 20)
  .map((a) => ({ kind: a.kind as Anexo['kind'], name: String(a.name ?? 'anexo').slice(0, 200), ...(typeof a.dataUrl === 'string' ? { dataUrl: a.dataUrl } : {}), ...(typeof a.text === 'string' ? { text: a.text } : {}) }));

interface Opcoes {
  router: Router; uso: Uso; imagens: Imagens; asyncRoute: AsyncRoute; preferencias: Preferencias;
  orquestrador: Orquestrador; preferenciasIA: (userId: string) => PreferenciasIA;
  skills: { activeFor: (userId: string, texto: string) => SkillListada[] };
  memoria: { promptFor: (userId: string) => string; learnFrom: (user: Usuario, historico: Mensagem[], resposta: string) => unknown };
}

export function setupChat(app: Express, db: Db, { router, uso, imagens, asyncRoute, preferencias, skills, memoria, orquestrador, preferenciasIA }: Opcoes) {
  // Modelo direto (sem "raciocínio em voz alta") para tarefas internas: títulos e prompts de imagem.
  const UTIL_MODEL = process.env.UTIL_MODEL || 'mistral-code';
  const { getSetting } = preferencias;
  const q = {
    listConvs: consulta<Omit<Conversa, 'user_id' | 'created_at'>>(db, `SELECT id, title, model, pinned, updated_at FROM conversations WHERE user_id = ?
                           ORDER BY pinned DESC, updated_at DESC LIMIT 500`),
    searchConvs: consulta<Omit<Conversa, 'user_id' | 'created_at'>>(db, `SELECT DISTINCT c.id, c.title, c.model, c.pinned, c.updated_at FROM conversations c
                             LEFT JOIN messages m ON m.conversation_id = c.id
                             WHERE c.user_id = ? AND (c.title LIKE ? OR m.content LIKE ?)
                             ORDER BY c.pinned DESC, c.updated_at DESC LIMIT 200`),
    getConv: consulta<Conversa>(db, 'SELECT * FROM conversations WHERE id = ? AND user_id = ?'),
    insertConv: db.prepare('INSERT INTO conversations (id, user_id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'),
    touchConv: db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?'),
    deleteConv: db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?'),
    getMessages: consulta<LinhaMensagem>(db, 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid'),
    getMessage: consulta<LinhaMensagem>(db, 'SELECT * FROM messages WHERE id = ? AND conversation_id = ?'),
    insertMessage: db.prepare(`INSERT INTO messages (id, conversation_id, role, content, attachments, model, created_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?)`),
    deleteFrom: db.prepare('DELETE FROM messages WHERE conversation_id = ? AND (created_at > ? OR (created_at = ? AND rowid >= ?))'),
    rowidOf: consulta<{ r: number; created_at: number }>(db, 'SELECT rowid AS r, created_at FROM messages WHERE id = ? AND conversation_id = ?'),
  };
  const parseMessage = (m: LinhaMensagem): Mensagem => ({ ...m, attachments: JSON.parse(m.attachments) as Anexo[] });
  // created_at precisa ser estritamente crescente dentro de uma conversa.
  let lastTs = 0;
  const now = () => (lastTs = Math.max(Date.now(), lastTs + 1));

  // Partes da memória do Gyde que valem para todo modelo desta conversa.
  function extrasDoSistema(user: Usuario, activeSkills: SkillListada[], nota: string): string[] {
    const extras: string[] = [];
    const profile = profileSummary(user);
    const about = getSetting(user.id, 'about_user');
    const style = getSetting(user.id, 'response_style');
    if (profile) extras.push(`Perfil do usuário:\n${profile}`);
    const remembered = memoria.promptFor(user.id);
    if (remembered) extras.push(remembered);
    if (about) extras.push(`Sobre o usuário:\n${about}`);
    if (style) extras.push(`Como o usuário quer as respostas:\n${style}`);
    if (nota) extras.push(nota);
    for (const s of activeSkills) {
      extras.push(`Skill ativa: ${s.nome}\nSiga estas instruções nesta resposta (elas complementam as regras acima, sem anular a regra de não usar emojis):\n${s.corpo}`);
    }
    return extras;
  }

  // Conversa longa: guarda um resumo do que ficou de fora do contexto. Em segundo plano; se falhar, fica a lista de pedidos.
  async function atualizarResumo(conv: Conversa, historico: Mensagem[], cortadas: number) {
    if (cortadas - conv.resumo_ate < 8) return;
    const trecho = historico.slice(conv.resumo_ate, cortadas).map((m) => `${m.role === 'user' ? 'Pessoa' : 'Gyde'}: ${redigir(m.content.slice(0, 1200))}`).join('\n\n');
    try {
      const { texto } = await completar(router, {
        cadeia: CADEIAS.util ?? ['auto'], max_tokens: 500, temperature: 0.1, tempoLimite: 45_000,
        messages: [{ role: 'system', content: PROMPT_RESUMO }, { role: 'user', content: `${conv.resumo ? `RESUMO ATÉ AGORA:\n${conv.resumo}\n\n` : ''}CONVERSA:\n${trecho}` }],
      });
      db.prepare('UPDATE conversations SET resumo = ?, resumo_ate = ? WHERE id = ?').run(texto.trim().slice(0, 3000), cortadas, conv.id);
    } catch { /* o resumo é um extra */ }
  }

  async function generateTitle(convId: string, firstUserText: string) {
    try {
      const { texto } = await completar(router, {
        cadeia: CADEIAS.util ?? ['auto'], max_tokens: 24, tempoLimite: 20_000,
        messages: [
          { role: 'system', content: 'Crie um título curto (máx. 6 palavras) em português para esta conversa. Responda só com o título, sem aspas nem pontuação final.' },
          { role: 'user', content: firstUserText.slice(0, 2000) },
        ],
      });
      const title = limparResposta(texto).replace(/["*#\n]/g, '').trim().slice(0, 80);
      if (title) db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, convId);
      return title;
    } catch {
      return null;
    }
  }

  // Modelos de imagem entendem melhor inglês: o Gyde reescreve o pedido antes de gerar.
  async function improveImagePrompt(text: string) {
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
      const json = await res.json() as RespostaChat;
      return (json.choices?.[0]?.message?.content || '').trim() || text;
    } catch {
      return text;
    }
  }

  app.get('/api/models', asyncRoute(async (_req, res) => {
    const r = await router('/v1/models');
    const json = await r.json() as { data?: { id: string; available?: boolean }[] };
    const available = new Set((json.data || []).filter((m) => m.available !== false).map((m) => m.id));
    responder(res, C.Modelos, {
      brand: Object.entries(GYDE_MODELS).map(([id, m]) => ({ id, label: m.label, hint: m.hint })),
      models: CODE_MODELS.filter((m) => available.has(m.id)),
    });
  }));

  app.get('/api/conversations', (req, res) => {
    const term = String(req.query.q || '').trim();
    const rows = term ? q.searchConvs.all(req.user.id, `%${term}%`, `%${term}%`) : q.listConvs.all(req.user.id);
    responder(res, C.ListaConversas, { conversations: rows });
  });

  app.post('/api/conversations', (req, res) => {
    const id = randomUUID();
    const t = now();
    q.insertConv.run(id, req.user.id, 'Nova conversa', String(req.body?.model || DEFAULT_MODEL), t, t);
    responder(res, C.Conversa, q.getConv.get(id, req.user.id)!, 201);
  });

  app.get('/api/conversations/:id', (req, res) => {
    const conv = q.getConv.get(req.params.id, req.user.id);
    if (!conv) return res.status(404).json({ error: 'Conversa não encontrada.' });
    responder(res, C.Conversa, { ...conv, messages: q.getMessages.all(conv.id).map(parseMessage) });
  });

  app.patch('/api/conversations/:id', (req, res) => {
    const conv = q.getConv.get(req.params.id, req.user.id);
    if (!conv) return res.status(404).json({ error: 'Conversa não encontrada.' });
    const { title, model, pinned } = req.body || {};
    if (typeof title === 'string' && title.trim()) db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title.trim().slice(0, 120), conv.id);
    if (typeof model === 'string' && model) db.prepare('UPDATE conversations SET model = ? WHERE id = ?').run(model, conv.id);
    if (typeof pinned === 'boolean') db.prepare('UPDATE conversations SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, conv.id);
    responder(res, C.Conversa, q.getConv.get(conv.id, req.user.id)!);
  });

  app.delete('/api/conversations/:id', (req, res) => {
    q.deleteConv.run(req.params.id, req.user.id);
    res.status(204).end();
  });

  // Apagar TODAS as conversas do chat desta conta (a tela pede confirmação antes).
  app.delete('/api/conversations', (req, res) => {
    const { changes } = db.prepare('DELETE FROM conversations WHERE user_id = ?').run(req.user.id);
    res.json({ apagadas: changes });
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
    const conv = q.getConv.get(String(req.params.id), req.user.id);
    if (!conv) return res.status(404).json({ error: 'Conversa não encontrada.' });

    const { content = '', model, mode = 'new', messageId } = (req.body || {}) as { content?: unknown; model?: string; mode?: string; messageId?: string };
    const attachments = limparAnexos(req.body?.attachments);
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
    let userMessage: { id: string; role: 'user'; content: string; attachments: Anexo[]; created_at: number } | null = null;
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
    const send = (event: Record<string, unknown>) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (userMessage) send({ type: 'user', message: userMessage });
    const ultima = history.at(-1)!;
    const activeSkills = skills.activeFor(req.user.id, ultima.content);
    if (activeSkills.length) send({ type: 'skills', skills: activeSkills.map((s) => ({ id: s.id, nome: s.nome, simbolo: s.simbolo })) });

    const controller = new AbortController();
    res.on('close', () => controller.abort());

    let answer = '';
    let servedModel = chosenModel;
    let consumo: Awaited<ReturnType<Orquestrador['executar']>>['consumo'] = null; // informados pelo provedor
    let orquestracao: { estrategia: string; revisada: boolean; mudou: boolean; chamadas: number; modelos: string[] } | null = null;
    let failure: ErroGyde | null = null;
    let cortadas = 0;
    const started = Date.now();
    const registro = uso.iniciar(req.user.id, isImage ? 'imagem' : 'chat');
    try {
      if (isImage) {
        const request = ultima.content;
        send({ type: 'status', text: 'Criando a imagem…' });
        const prompt = await improveImagePrompt(request);
        const url = await imagens.gerar(prompt, controller.signal);
        servedModel = imagens.modelo.split('/').pop() ?? imagens.modelo;
        const alt = request.replace(/[[\]\n]/g, ' ').slice(0, 120);
        answer = `![${alt}](${url})\n\n*Prompt usado:* ${prompt.replace(/\n/g, ' ')}`;
        send({ type: 'delta', text: answer });
      } else {
        // O núcleo entende o pedido, escolhe modelo e estratégia e devolve uma resposta só (ia/orquestrador.ts).
        const comImagem = ultima.attachments?.some((x) => x.kind === 'image');
        const arquivos = ultima.attachments?.filter((x) => x.kind === 'file') ?? [];
        const classificacao = classificar(ultima.content, { comImagem, comArquivo: arquivos.length > 0, tamanhoAnexos: arquivos.reduce((n, a) => n + (a.text?.length ?? 0), 0) });
        const selecao = selecionarHistorico(history, { resumo: conv.resumo });
        cortadas = selecao.cortadas;
        const mensagens: MensagemIA[] = [{ role: 'system', content: sistemaDoChat({ tarefa: classificacao.tarefa, extras: extrasDoSistema(req.user, activeSkills, selecao.nota) }) }, ...selecao.mensagens];
        const prefs = preferenciasIA(req.user.id);
        const marca = Boolean(GYDE_MODELS[chosenModel]);
        const plano = await orquestrador.planejar(classificacao, {
          modo: chosenModel === 'gyde-1-pro' ? 'capricho' : prefs.modo,
          especialistas: prefs.especialistas,
          ...(!marca && !comImagem ? { fixo: cadeiaDe(chosenModel) } : {}),
          desligados: prefs.desligados,
          tamanho: tamanhoDe(mensagens),
          reserva: comImagem ? CADEIAS.visao ?? [] : cadeiaDe(marca ? chosenModel : 'gyde-1').filter((m) => m !== 'auto'),
        });
        const r = await orquestrador.executar(plano, {
          mensagens, signal: controller.signal, registro, userId: req.user.id, origem: 'chat',
          aoEscrever: (texto) => { answer += texto; send({ type: 'delta', text: texto }); },
          aoStatus: (texto) => send({ type: 'status', text: texto }),
        });
        if (!marca && r.modelo) servedModel = r.modelo;
        consumo = r.consumo;
        orquestracao = { estrategia: r.estrategia, revisada: r.revisadaPorOutro, mudou: r.mudou, chamadas: r.chamadas, modelos: r.modelos };
      }
    } catch (e) {
      const err = comoErro(e);
      if (err.name !== 'AbortError') { failure = err; registrarErro(err, isImage ? 'imagem do chat' : 'resposta do chat'); }
    }
    registro.fim(controller.signal.aborted ? 'cancelado' : answer ? 'ok' : uso.resultadoDe(failure), failure?.message);

    if (answer) {
      const assistant = { id: randomUUID(), role: 'assistant', content: answer, attachments: [], model: servedModel, created_at: now() };
      q.insertMessage.run(assistant.id, conv.id, 'assistant', answer, '[]', servedModel, assistant.created_at);
      q.touchConv.run(Date.now(), conv.id);
      if (!res.writableEnded) send({ type: 'done', message: assistant, elapsedMs: Date.now() - started, stopped: controller.signal.aborted, consumo, orquestracao });
      if (!isImage) { memoria.learnFrom(req.user, history, answer); void atualizarResumo(conv, history, cortadas); } // em segundo plano
    } else if (!res.writableEnded) {
      send({ type: 'error', error: failure?.message || 'O modelo não devolveu nenhuma resposta. Tente de novo ou troque o modelo.' });
    }
    q.touchConv.run(Date.now(), conv.id);

    if (isFirstExchange && answer && conv.title === 'Nova conversa') {
      const title = await generateTitle(conv.id, history[0]!.content || history[0]!.attachments.map((a) => a.name).join(', '));
      if (title && !res.writableEnded) send({ type: 'title', title });
    }
    res.end();
  }));
}
