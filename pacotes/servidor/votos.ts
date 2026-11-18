// Votos da pessoa, guardados só no banco local deste computador (nada sai daqui):
//  - polegar para cima ou para baixo em cada resposta do chat;
//  - "Comparar respostas": a mesma pergunta respondida pelo guia de estilo atual e pelo anterior, lado a lado e sem
//    dizer qual é qual (a ordem é sorteada); depois do voto a tela revela as duas.
// ferramentas/resumir-votos.mjs lê esses votos para ajustar o guia de estilo (docs/guia-de-estilo.md).
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { AsyncRoute, Db, Router } from './tipos.ts';
import { consulta, erroGyde } from './tipos.ts';
import { completar } from './motor.ts';
import { classificar } from './ia/classificar.ts';
import { tamanhoDe } from './ia/contexto.ts';
import { IDENTIDADE, IDENTIDADE_ANTERIOR, sistemaDoChat } from './ia/prompts.ts';
import { limparResposta } from './ia/filtro.ts';
import { conferirResposta } from './ia/conferir-resposta.ts';
import type { Orquestrador } from './ia/orquestrador.ts';
import * as C from '../compartilhado/contratos.ts';
import { responder } from './contratos-servidor.ts';

export const VARIANTES = { atual: 'Guia de estilo atual', anterior: 'Guia de estilo anterior' } as const;
type Variante = keyof typeof VARIANTES;
const SOFTWARE = new Set(['codigo', 'sql', 'frontend', 'backend']);

export function setupVotos(app: Express, db: Db, { router, orquestrador, asyncRoute }: { router: Router; orquestrador: Orquestrador; asyncRoute: AsyncRoute }) {
  const q = {
    dono: consulta<{ id: string }>(db, 'SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.id = ? AND c.user_id = ? AND m.role = \'assistant\''),
    votar: db.prepare('INSERT INTO votos_resposta (message_id, user_id, valor, em) VALUES (?, ?, ?, ?) ON CONFLICT(message_id, user_id) DO UPDATE SET valor = excluded.valor, em = excluded.em'),
    tirar: db.prepare('DELETE FROM votos_resposta WHERE message_id = ? AND user_id = ?'),
    meus: consulta<{ message_id: string; valor: number }>(db, 'SELECT v.message_id, v.valor FROM votos_resposta v JOIN messages m ON m.id = v.message_id WHERE v.user_id = ? AND m.conversation_id = ?'),
    criar: db.prepare('INSERT INTO comparacoes (id, user_id, pergunta, resposta_a, resposta_b, variante_a, variante_b, voto, em) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)'),
    comparacao: consulta<{ id: string; variante_a: string; variante_b: string; voto: string | null }>(db, 'SELECT id, variante_a, variante_b, voto FROM comparacoes WHERE id = ? AND user_id = ?'),
    votarComparacao: db.prepare('UPDATE comparacoes SET voto = ? WHERE id = ? AND user_id = ?'),
    placar: consulta<{ variante_a: string; variante_b: string; voto: string }>(db, 'SELECT variante_a, variante_b, voto FROM comparacoes WHERE user_id = ? AND voto IS NOT NULL'),
  };

  // polegar numa resposta: 1, -1 ou 0 (tira o voto)
  app.post('/api/mensagens/:id/voto', (req, res) => {
    const valor = Number(req.body?.valor);
    if (![1, -1, 0].includes(valor)) return res.status(400).json({ error: 'Voto inválido.' });
    if (!q.dono.get(String(req.params.id), req.user.id)) return res.status(404).json({ error: 'Resposta não encontrada.' });
    if (valor === 0) q.tirar.run(String(req.params.id), req.user.id);
    else q.votar.run(String(req.params.id), req.user.id, valor, Date.now());
    responder(res, C.Voto, { valor });
  });
  app.get('/api/conversations/:id/votos', (req, res) => {
    responder(res, C.VotosDaConversa, { votos: Object.fromEntries(q.meus.all(req.user.id, String(req.params.id)).map((v) => [v.message_id, v.valor])) });
  });

  const placar = (userId: string) => {
    const p = { atual: 0, anterior: 0, empate: 0 };
    for (const c of q.placar.all(userId)) {
      if (c.voto === 'empate') p.empate++;
      else p[(c.voto === 'a' ? c.variante_a : c.variante_b) as Variante]++;
    }
    return p;
  };

  // Comparar respostas: gera as duas versões (mesmos modelos, ordem sorteada) e só revela qual é qual depois do voto
  app.post('/api/comparar', asyncRoute(async (req, res) => {
    const pergunta = String(req.body?.pergunta ?? '').trim();
    if (pergunta.length < 3 || pergunta.length > 4000) return res.status(400).json({ error: 'Escreva uma pergunta de 3 a 4.000 caracteres.' });
    const c = classificar(pergunta);
    const base = (identidade: string) => [{ role: 'system' as const, content: sistemaDoChat({ tarefa: c.tarefa, extras: [], identidade }) }, { role: 'user' as const, content: pergunta }];
    const plano = await orquestrador.planejar(c, { modo: 'equilibrado', tamanho: tamanhoDe(base(IDENTIDADE)), reserva: [] });
    if (!plano.principal.length) throw erroGyde('A IA ainda não está conectada. Abra Configurações > Conectar IA.', { status: 503 });
    const gerar = async (v: Variante) => {
      const mensagens = base(v === 'atual' ? IDENTIDADE : IDENTIDADE_ANTERIOR);
      const r = await completar(router, { cadeia: plano.principal, messages: mensagens, max_tokens: 4000, temperature: 0.5, tempoLimite: 120_000 });
      const texto = limparResposta(r.texto);
      if (v === 'anterior') return texto;
      return (await conferirResposta({ texto, mensagens, router, cadeia: plano.principal, verificar: SOFTWARE.has(c.tarefa) })).texto;
    };
    const [atual, anterior] = await Promise.all([gerar('atual'), gerar('anterior')]);
    const atualPrimeiro = Math.random() < 0.5;
    const id = randomUUID();
    const [a, b] = atualPrimeiro ? [atual, anterior] : [anterior, atual];
    q.criar.run(id, req.user.id, pergunta, a, b, atualPrimeiro ? 'atual' : 'anterior', atualPrimeiro ? 'anterior' : 'atual', Date.now());
    responder(res, C.Comparacao, { id, a, b });
  }));

  app.post('/api/comparar/:id/voto', (req, res) => {
    const voto = String(req.body?.voto ?? '');
    if (!['a', 'b', 'empate'].includes(voto)) return res.status(400).json({ error: 'Voto inválido.' });
    const c = q.comparacao.get(String(req.params.id), req.user.id);
    if (!c) return res.status(404).json({ error: 'Comparação não encontrada.' });
    q.votarComparacao.run(voto, c.id, req.user.id);
    responder(res, C.VotoComparacao, {
      a: VARIANTES[c.variante_a as Variante] ?? c.variante_a, b: VARIANTES[c.variante_b as Variante] ?? c.variante_b, placar: placar(req.user.id),
    });
  });
  app.get('/api/comparar/placar', (req, res) => responder(res, C.PlacarComparacao, { placar: placar(req.user.id) }));
}
