// Prática no servidor: progresso, XP, revisão espaçada, desafio do dia, sequência de dias,
// amigos com ranking semanal e a Dica do Gyde.
import { TRACKS, TOPICO_EXERCICIOS, findExercise } from './pratica-dados.ts';
import { planoDe, findGuiado } from './pratica-plano.ts';
import { PROJETOS, findProjeto, conferirEtapa, projetoPublico, chaveEtapa } from './projetos-dados.ts';
import type { Express } from 'express';
import type { Db, Router, AsyncRoute, Usuario } from './tipos.ts';
import type { Uso } from './uso.ts';
import { consulta, comoErro } from './tipos.ts';
import type { Perfil, Progresso, Plano } from './pratica-plano.ts';
import * as C from '../compartilhado/contratos.ts';
import { responder } from './contratos-servidor.ts';

type Pessoa = { id: string; name: string; email: string };

export { planoDe };

const REVIEW_DAYS = [1, 3, 7, 21]; // intervalos da revisão espaçada
const DAY_MS = 86_400_000;
// perfil salvo corrompido não pode derrubar a Prática: vira perfil vazio (plano inicial)
const perfilDe = (user: Usuario): Perfil => { try { const p = JSON.parse(user.profile || '{}'); return p && typeof p === 'object' ? p : {}; } catch { return {}; } };
const today = (t = Date.now()) => new Date(t).toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso do PC
const allExercises = () => TRACKS.flatMap((t) => t.exercises.map((ex) => ({ ...ex, track: t })));

export function setupPratica(app: Express, db: Db, { router, profileSummary, asyncRoute, uso }: { router: Router; profileSummary: (user: Usuario) => string; asyncRoute: AsyncRoute; uso?: Uso }) {

  const q = {
    progress: consulta<{ exercise_id: string; done: number; code: string; fails: number }>(db, 'SELECT exercise_id, done, code, fails FROM skill_progress WHERE user_id = ?'),
    one: consulta<{ done: number; fails: number }>(db, 'SELECT done, fails FROM skill_progress WHERE user_id = ? AND exercise_id = ?'),
    upsert: db.prepare(`INSERT INTO skill_progress (user_id, exercise_id, done, code, updated_at, fails) VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(user_id, exercise_id) DO UPDATE SET done = MAX(done, excluded.done), code = excluded.code,
                        updated_at = excluded.updated_at, fails = excluded.fails`),
    xpTotal: consulta<{ xp: number; n: number }>(db, 'SELECT COALESCE(SUM(amount), 0) AS xp, COUNT(*) AS n FROM xp_events WHERE user_id = ?'),
    xpSince: consulta<{ xp: number }>(db, 'SELECT COALESCE(SUM(amount), 0) AS xp FROM xp_events WHERE user_id = ? AND at >= ?'),
    addXp: db.prepare('INSERT INTO xp_events (user_id, amount, kind, ref, at) VALUES (?, ?, ?, ?, ?)'),
    addDay: db.prepare('INSERT OR IGNORE INTO activity_days (user_id, day) VALUES (?, ?)'),
    days: consulta<{ day: string }>(db, 'SELECT day FROM activity_days WHERE user_id = ? ORDER BY day DESC LIMIT 400'),
    reviews: consulta<{ exercise_id: string; level: number; due_at: number }>(db, 'SELECT exercise_id, level, due_at FROM review_queue WHERE user_id = ? ORDER BY due_at'),
    review: consulta<{ level: number; due_at: number }>(db, 'SELECT level, due_at FROM review_queue WHERE user_id = ? AND exercise_id = ?'),
    setReview: db.prepare(`INSERT INTO review_queue (user_id, exercise_id, level, due_at) VALUES (?, ?, ?, ?)
                           ON CONFLICT(user_id, exercise_id) DO UPDATE SET level = excluded.level, due_at = excluded.due_at`),
    dropReview: db.prepare('DELETE FROM review_queue WHERE user_id = ? AND exercise_id = ?'),
    daily: consulta<{ exercise_id: string; rewarded: number }>(db, 'SELECT exercise_id, rewarded FROM daily_challenge WHERE user_id = ? AND day = ?'),
    setDaily: db.prepare('INSERT OR IGNORE INTO daily_challenge (user_id, day, exercise_id) VALUES (?, ?, ?)'),
    rewardDaily: db.prepare('UPDATE daily_challenge SET rewarded = 1 WHERE user_id = ? AND day = ?'),
    userByEmail: consulta<Pessoa>(db, 'SELECT id, name, email FROM users WHERE email = ? AND email_verified = 1'),
    userById: consulta<Pessoa>(db, 'SELECT id, name, email FROM users WHERE id = ?'),
    addFriend: db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)'),
    removeFriend: db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?'),
    following: consulta<{ friend_id: string }>(db, 'SELECT friend_id FROM friends WHERE user_id = ?'),
    followers: consulta<{ user_id: string }>(db, 'SELECT user_id FROM friends WHERE friend_id = ?'),
  };

  // XP vem dos eventos. Quem já tinha exercícios feitos antes dos eventos existirem recebe o histórico uma vez.
  function backfill(userId: string) {
    if ((q.xpTotal.get(userId)?.n ?? 0) > 0) return;
    for (const r of q.progress.all(userId)) {
      const found = r.done && findExercise(r.exercise_id);
      if (found) q.addXp.run(userId, found.ex.xp, 'exercicio', found.ex.id, Date.now());
    }
  }

  function streakOf(userId: string) {
    const days = new Set(q.days.all(userId).map((r) => r.day));
    let t = Date.now();
    if (!days.has(today(t))) t -= DAY_MS; // ainda dá tempo de praticar hoje
    let n = 0;
    while (days.has(today(t))) { n++; t -= DAY_MS; }
    return { dias: n, praticouHoje: days.has(today()) };
  }

  // Desafio do dia: escolhido uma vez por dia, entre os exercícios ainda não feitos.
  function dailyOf(userId: string, progress: Progresso, plano: Plano) {
    const day = today();
    let row = q.daily.get(userId, day);
    if (!row) {
      // primeiro das 2 trilhas mais indicadas para a pessoa; se ela já fez tudo nelas, de qualquer trilha
      const indicadas = new Set(plano.ordem.slice(0, 2));
      const pendentes = allExercises().filter((e) => !progress[e.id]?.done);
      const daIndicada = pendentes.filter((e) => indicadas.has(e.track.id));
      const pending = daIndicada.length ? daIndicada : pendentes;
      const pool = pending.length ? pending : allExercises();
      let h = 0;
      for (const ch of userId + day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      q.setDaily.run(userId, day, pool[h % pool.length]!.id);
      row = q.daily.get(userId, day)!;
    }
    const ex = findExercise(row.exercise_id);
    return { exerciseId: row.exercise_id, trackId: ex?.track.id, bonus: ex?.ex.xp ?? 0, rewarded: Boolean(row.rewarded) };
  }

  function friendsOf(userId: string) {
    const following = new Set(q.following.all(userId).map((r) => r.friend_id));
    const followers = new Set(q.followers.all(userId).map((r) => r.user_id));
    const mutual = [...following].filter((id) => followers.has(id));
    const pedidos = [...followers].filter((id) => !following.has(id)).map((id) => q.userById.get(id)).filter((u): u is Pessoa => Boolean(u));
    const aguardando = [...following].filter((id) => !followers.has(id)).map((id) => q.userById.get(id)).filter((u): u is Pessoa => Boolean(u));
    return { mutual, pedidos: pedidos.map((u) => ({ name: u.name, email: u.email })), aguardando: aguardando.map((u) => ({ name: u.name, email: u.email })) };
  }

  function state(user: Usuario) {
    const userId = user.id;
    backfill(userId);
    const progress: Progresso = Object.fromEntries(q.progress.all(userId).map((r) => [r.exercise_id, { done: Boolean(r.done), code: r.code, fails: r.fails }]));
    const now = Date.now();
    const reviews = q.reviews.all(userId).map((r) => ({ exerciseId: r.exercise_id, level: r.level, dueAt: r.due_at, due: r.due_at <= now }));
    // Pontos fracos do quiz viram exercícios recomendados (os que ainda não foram feitos).
    const weakSalvo = perfilDe(user).weak;
    const weak: string[] = Array.isArray(weakSalvo) ? weakSalvo : [];
    const reforco = [...new Set(weak.flatMap((t) => TOPICO_EXERCICIOS[t] || []))].filter((id) => !progress[id]?.done);
    // erros observados também viram reforço (exercícios em que errou e ainda não acertou)
    for (const [id, v] of Object.entries(progress)) if ((v.fails ?? 0) > 0 && !v.done && !reforco.includes(id)) reforco.push(id);
    const plano = planoDe(perfilDe(user), progress);
    const { mutual, pedidos, aguardando } = friendsOf(userId);
    const weekAgo = now - 7 * DAY_MS;
    const ranking = [userId, ...mutual].map((id) => {
      const u = id === userId ? user : q.userById.get(id);
      return { name: u?.name ?? '', voce: id === userId, xpSemana: q.xpSince.get(id, weekAgo)?.xp ?? 0, sequencia: streakOf(id).dias };
    }).sort((a, b) => b.xpSemana - a.xpSemana);
    return {
      tracks: TRACKS, progress, xp: q.xpTotal.get(userId)?.xp ?? 0, sequencia: streakOf(userId),
      desafio: dailyOf(userId, progress, plano), revisoes: reviews, reforco, ranking, pedidos, aguardando, plano,
      projetos: PROJETOS.map((p) => projetoPublico(p, (id) => Boolean(progress[id]?.done))),
    };
  }

  app.get('/api/pratica', (req, res) => responder(res, C.EstadoPratica, state(req.user)));

  // Salva o código; se passou em todos os testes, dá XP, conta o dia e cuida da revisão.
  app.post('/api/pratica/progress', (req, res) => {
    const found = findExercise(String(req.body?.exerciseId || ''));
    if (!found) return res.status(404).json({ error: 'Exercício não encontrado.' });
    const { ex } = found;
    const userId = req.user.id;
    const passed = Boolean(req.body?.passed);
    const code = String(req.body?.code || '').slice(0, 20_000);
    const before = q.one.get(userId, ex.id) || { done: 0, fails: 0 };
    const now = Date.now();
    const ganhos = [];
    q.upsert.run(userId, ex.id, passed ? 1 : 0, code, now, before.fails + (passed ? 0 : 1));

    const review = q.review.get(userId, ex.id);
    if (!passed) {
      // Errou numa revisão: volta para o começo (revisar amanhã).
      if (review && review.due_at <= now) q.setReview.run(userId, ex.id, 0, now + DAY_MS);
    } else {
      q.addDay.run(userId, today(now));
      if (!before.done) {
        q.addXp.run(userId, ex.xp, 'exercicio', ex.id, now);
        ganhos.push({ motivo: 'Exercício concluído', xp: ex.xp });
        // Errou antes de acertar: entra na revisão espaçada.
        if (before.fails > 0) q.setReview.run(userId, ex.id, 0, now + REVIEW_DAYS[0] * DAY_MS);
      } else if (review && review.due_at <= now) {
        const level = review.level + 1;
        if (level >= REVIEW_DAYS.length) q.dropReview.run(userId, ex.id); // aprendido!
        else q.setReview.run(userId, ex.id, level, now + REVIEW_DAYS[level] * DAY_MS);
        q.addXp.run(userId, 5, 'revisao', ex.id, now);
        ganhos.push({ motivo: 'Revisão feita', xp: 5 });
      }
      const daily = q.daily.get(userId, today(now));
      if (daily && daily.exercise_id === ex.id && !daily.rewarded) {
        q.rewardDaily.run(userId, today(now));
        q.addXp.run(userId, ex.xp, 'desafio', ex.id, now);
        ganhos.push({ motivo: 'Desafio do dia (bônus)', xp: ex.xp });
      }
    }
    responder(res, C.EstadoPraticaComGanhos, { ...state(req.user), ganhos });
  });

  // Exercício guiado (sem testes automáticos): a pessoa resolve, o Gyde corrige no chat e ela entrega a solução.
  // Só conta como feito com uma entrega de verdade (abrir ou clicar não dá XP).
  app.post('/api/pratica/guiado/:id', (req, res) => {
    const g = findGuiado(String(req.params.id));
    if (!g) return res.status(404).json({ error: 'Exercício guiado não encontrado.' });
    const resposta = typeof req.body?.resposta === 'string' ? req.body.resposta.trim().slice(0, 20_000) : '';
    if (resposta.replace(/\s/g, '').length < 20) return res.status(400).json({ error: 'Cole a sua solução (o código ou a resposta) para marcar como feito.' });
    const userId = req.user.id, now = Date.now();
    const antes = q.one.get(userId, g.id);
    q.upsert.run(userId, g.id, 1, resposta, now, antes?.fails || 0);
    q.addDay.run(userId, today(now));
    const ganhos = [];
    if (!antes?.done) { q.addXp.run(userId, 10, 'guiado', g.id, now); ganhos.push({ motivo: 'Exercício guiado feito', xp: 10 }); }
    responder(res, C.EstadoPraticaComGanhos, { ...state(req.user), ganhos });
  });

  // Etapa de projeto guiado: confere os critérios no código entregue. Só conta (e só dá XP) quando passa em todos.
  app.post('/api/pratica/projeto/:id/etapa/:etapa', (req, res) => {
    const p = findProjeto(String(req.params.id));
    const etapa = p?.etapas.find((e) => e.id === String(req.params.etapa));
    if (!p || !etapa) return res.status(404).json({ error: 'Etapa de projeto não encontrada.' });
    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.slice(0, 50_000) : '';
    if (!codigo.trim()) return res.status(400).json({ error: `Cole o conteúdo do ${etapa.arquivo} para conferir.` });
    const userId = req.user.id, now = Date.now(), chave = chaveEtapa(p.id, etapa.id);
    const antes = q.one.get(userId, chave) || { done: 0, fails: 0 };
    const conferencia = conferirEtapa(p, etapa, codigo);
    q.upsert.run(userId, chave, conferencia.ok ? 1 : 0, codigo, now, antes.fails + (conferencia.ok ? 0 : 1));
    const ganhos = [];
    if (conferencia.ok) {
      q.addDay.run(userId, today(now));
      if (!antes.done) {
        q.addXp.run(userId, etapa.xp, 'projeto', chave, now);
        ganhos.push({ motivo: 'Etapa do projeto concluída', xp: etapa.xp });
        const todas = p.etapas.every((e) => e.id === etapa.id || q.one.get(userId, chaveEtapa(p.id, e.id))?.done);
        if (todas) { q.addXp.run(userId, 30, 'projeto', p.id, now); ganhos.push({ motivo: 'Projeto concluído', xp: 30 }); }
      }
    }
    responder(res, C.ConferenciaEtapa, { ...state(req.user), ganhos, conferencia });
  });

  // Amizade só vale quando os dois se adicionam (assim ninguém vê seu XP sem você querer).
  app.post('/api/amigos', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const friend = q.userByEmail.get(email);
    if (!friend) return res.status(404).json({ error: 'Não achei ninguém com esse e-mail neste Gyde.' });
    if (friend.id === req.user.id) return res.status(400).json({ error: 'Esse é o seu próprio e-mail.' });
    q.addFriend.run(req.user.id, friend.id, Date.now());
    responder(res, C.EstadoPratica, state(req.user));
  });
  app.delete('/api/amigos/:email', (req, res) => {
    const friend = q.userByEmail.get(String(req.params.email).toLowerCase());
    if (friend) q.removeFriend.run(req.user.id, friend.id);
    responder(res, C.EstadoPratica, state(req.user));
  });

  // Dica do Gyde: aponta o caminho sem entregar a solução.
  app.post('/api/pratica/hint', asyncRoute(async (req, res) => {
    const found = findExercise(String(req.body?.exerciseId || ''));
    if (!found) return res.status(404).json({ error: 'Exercício não encontrado.' });
    const { track, ex } = found;
    const code = String(req.body?.code || '').slice(0, 8000);
    type ResultadoTeste = { pass?: boolean; args?: unknown; expected?: unknown; got?: unknown; error?: string };
    const results: ResultadoTeste[] = Array.isArray(req.body?.results) ? req.body.results.slice(0, 10) : [];
    const failed = results.filter((r) => !r.pass).map((r) => `- entrada ${JSON.stringify(r.args)}: esperado ${JSON.stringify(r.expected)}, ${r.error ? `erro: ${r.error}` : `recebido ${JSON.stringify(r.got)}`}`).join('\n');
    const lang = track.lang === 'python' ? 'Python' : 'JavaScript';
    const registro = uso?.iniciar(req.user.id, 'pratica');
    let r: Response;
    try {
    r = await router('/v1/chat/completions', {
      method: 'POST',
      registro,
      body: JSON.stringify({
        model: 'auto',
        max_tokens: 400,
        messages: [
          { role: 'system', content: [
            'Você é o Gyde, tutor de programação para iniciantes brasileiros.',
            'Dê UMA dica curta (no máximo 4 frases) para o aluno avançar no exercício.',
            'NUNCA escreva a solução completa nem a função inteira. No máximo um trecho de 1 linha como exemplo de sintaxe.',
            'Se houver erro, explique em linguagem simples o que ele significa e onde provavelmente está.',
            'Responda em português, em Markdown, sem emojis.',
            profileSummary(req.user) ? `Perfil do aluno: ${profileSummary(req.user)}` : '',
          ].join(' ') },
          { role: 'user', content: `Exercício (${lang}): ${ex.title}\n\n${ex.statement}\n\nCódigo do aluno:\n\`\`\`\n${code}\n\`\`\`\n\n${failed ? `Testes que falharam:\n${failed}` : 'O aluno ainda não rodou os testes ou pediu ajuda para começar.'}` },
        ],
      }),
    });
    } catch (err) { if (registro && uso) registro.fim(uso.resultadoDe(err), comoErro(err).message); throw err; }
    const json = await r.json() as { usage?: import('./tipos.ts').UsoInformado; choices?: { message?: { content?: string } }[] };
    registro?.tokens(json.usage); registro?.fim('ok');
    res.json({ hint: json.choices?.[0]?.message?.content?.trim() || 'Tente rodar os testes e ler a mensagem de erro com calma.' });
  }));
}
