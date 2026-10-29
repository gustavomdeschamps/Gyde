// Modo duelo: duas contas do mesmo Gyde recebem o mesmo exercício (com testes automáticos, que rodam no navegador) e
// vence quem passar em todos os testes primeiro. O tempo é medido pelo servidor, do aceite até o acerto.
// Duelos são de momento: ficam na memória do servidor por 1 hora (não vão para o banco nem para a cópia de segurança).
import { randomUUID, randomInt } from 'node:crypto';
import type { Express } from 'express';
import type { Db, Usuario } from './tipos.ts';
import { consulta } from './tipos.ts';
import { TRACKS } from './pratica-dados.ts';
import * as C from '../compartilhado/contratos.ts';
import { responder } from './contratos-servidor.ts';

type Estado = 'convite' | 'andamento' | 'fim' | 'recusado' | 'cancelado';
interface Duelo {
  id: string; criado: number; estado: Estado; desafiante: string; desafiado: string;
  trackId: string; exerciseId: string; inicio: number | null; acertos: Record<string, number>; vencedor: string | null;
}
const VALIDADE = 3_600_000;
// exercícios sorteáveis: das trilhas (não dos projetos, que dependem das etapas anteriores)
const SORTEAVEIS = TRACKS.filter((t) => !t.projeto).flatMap((t) => t.exercises.map((e) => ({ trackId: t.id, exerciseId: e.id, titulo: e.title, lang: t.lang })));

export function setupDuelos(app: Express, db: Db) {
  const duelos = new Map<string, Duelo>();
  const q = {
    porEmail: consulta<{ id: string; name: string }>(db, 'SELECT id, name FROM users WHERE email = ? AND email_verified = 1'),
    nome: consulta<{ name: string }>(db, 'SELECT name FROM users WHERE id = ?'),
  };
  const limpar = () => { for (const [k, d] of duelos) if (Date.now() - d.criado > VALIDADE) duelos.delete(k); };
  const doUsuario = (id: string) => [...duelos.values()].filter((d) => d.desafiante === id || d.desafiado === id).sort((a, b) => b.criado - a.criado);

  function publico(d: Duelo, eu: string) {
    const outro = d.desafiante === eu ? d.desafiado : d.desafiante;
    const ex = SORTEAVEIS.find((x) => x.exerciseId === d.exerciseId)!;
    const tempo = (id: string) => (d.acertos[id] && d.inicio ? d.acertos[id]! - d.inicio : null);
    return {
      id: d.id, estado: d.estado, souDesafiante: d.desafiante === eu, oponente: q.nome.get(outro)?.name ?? 'alguém',
      exercicio: { trackId: d.trackId, exerciseId: d.exerciseId, titulo: ex.titulo, lang: ex.lang },
      inicio: d.inicio, agora: Date.now(), meuTempo: tempo(eu), tempoOponente: tempo(outro),
      resultado: d.estado !== 'fim' ? null : d.vencedor === eu ? 'venci' as const : 'perdi' as const,
    };
  }
  const lista = (u: Usuario) => ({ duelos: doUsuario(u.id).slice(0, 10).map((d) => publico(d, u.id)) });

  app.get('/api/duelos', (req, res) => { limpar(); responder(res, C.ListaDuelos, lista(req.user)); });

  app.post('/api/duelos', (req, res) => {
    limpar();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const outro = q.porEmail.get(email);
    if (!outro) return res.status(404).json({ error: 'Não achei ninguém com esse e-mail neste Gyde.' });
    if (outro.id === req.user.id) return res.status(400).json({ error: 'Desafie outra pessoa: esse é o seu e-mail.' });
    const aberto = doUsuario(req.user.id).find((d) => (d.estado === 'convite' || d.estado === 'andamento') && (d.desafiante === outro.id || d.desafiado === outro.id));
    if (aberto) return res.status(409).json({ error: 'Vocês já têm um duelo em aberto.' });
    const ex = SORTEAVEIS[randomInt(SORTEAVEIS.length)]!;
    const d: Duelo = { id: randomUUID(), criado: Date.now(), estado: 'convite', desafiante: req.user.id, desafiado: outro.id, trackId: ex.trackId, exerciseId: ex.exerciseId, inicio: null, acertos: {}, vencedor: null };
    duelos.set(d.id, d);
    responder(res, C.ListaDuelos, lista(req.user), 201);
  });

  const meu = (id: string, u: Usuario) => { const d = duelos.get(id); return d && (d.desafiante === u.id || d.desafiado === u.id) ? d : null; };
  app.post('/api/duelos/:id/aceitar', (req, res) => {
    const d = meu(String(req.params.id), req.user);
    if (!d || d.desafiado !== req.user.id || d.estado !== 'convite') return res.status(404).json({ error: 'Esse convite não existe mais.' });
    d.estado = 'andamento'; d.inicio = Date.now();
    responder(res, C.ListaDuelos, lista(req.user));
  });
  app.post('/api/duelos/:id/recusar', (req, res) => {
    const d = meu(String(req.params.id), req.user);
    if (!d || d.estado === 'fim') return res.status(404).json({ error: 'Esse duelo não existe mais.' });
    d.estado = d.estado === 'convite' && d.desafiado === req.user.id ? 'recusado' : 'cancelado';
    responder(res, C.ListaDuelos, lista(req.user));
  });

  // chamado quando a pessoa passa em todos os testes de um exercício: o primeiro a acertar vence; quem chega depois
  // também tem o tempo guardado
  function registrarAcerto(userId: string, exerciseId: string) {
    for (const d of duelos.values()) {
      if ((d.estado !== 'andamento' && d.estado !== 'fim') || d.exerciseId !== exerciseId || (d.desafiante !== userId && d.desafiado !== userId) || d.acertos[userId]) continue;
      d.acertos[userId] = Date.now();
      if (!d.vencedor) { d.vencedor = userId; d.estado = 'fim'; }
    }
  }
  return { registrarAcerto };
}
