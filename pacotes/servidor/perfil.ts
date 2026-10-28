// Perfil de cada conta: questionário de boas-vindas, resumo do perfil para a IA e preferências (Configurações).
import type { Express } from 'express';
import type { Db, Usuario } from './tipos.ts';
import { consulta } from './tipos.ts';
import { publicQuiz, gradeQuiz } from './quiz.ts';
import type { Perfil } from './pratica-plano.ts';
import * as C from '../compartilhado/contratos.ts';
import { responder } from './contratos-servidor.ts';

// Preferências ficam na tabela settings, por usuário: chave "<userId>:<nome>".
export function criarPreferencias(db: Db) {
  const ler = consulta<{ value: string }>(db, 'SELECT value FROM settings WHERE key = ?');
  const gravar = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  return {
    getSetting: (userId: string, chave: string, padrao = ''): string => ler.get(`${userId}:${chave}`)?.value ?? padrao,
    setSetting: (userId: string, chave: string, valor: string) => gravar.run(`${userId}:${chave}`, valor),
  };
}
export type Preferencias = ReturnType<typeof criarPreferencias>;

// Resumo do perfil (vindo do questionário) para o modelo adaptar as respostas.
export function profileSummary(user: Usuario): string {
  let p: Perfil;
  try { p = JSON.parse(user.profile || '{}') as Perfil; } catch { p = {}; }
  if (!p.level) return '';
  const parts = [
    `Nome: ${user.name}.`,
    `Nível estimado em programação: ${p.levelLabel} (acertou ${p.score} de ${p.total} perguntas do quiz).`,
  ];
  if (Array.isArray(p.languages) && p.languages.length) parts.push(`Linguagens que usa ou quer aprender: ${p.languages.join(', ')}.`);
  if (p.goal) parts.push(`Objetivo: ${p.goal}.`);
  if (p.style) parts.push(`Prefere explicações: ${p.style}.`);
  if (p.weak?.length) parts.push(`Pontos para reforçar (errou no quiz): ${p.weak.join(', ')}.`);
  const guide = ({
    zero: 'Explique tudo do zero, sem assumir nenhum conhecimento; use analogias do dia a dia e passos bem pequenos.',
    basic: 'Assuma só o básico (variáveis, if, loops); explique conceitos novos antes de usá-los.',
    intermediate: 'Pode usar termos técnicos comuns, mas explique os menos conhecidos; foque em boas práticas.',
    advanced: 'Seja direto e técnico; aprofunde em desempenho, arquitetura e casos de borda.',
  } as Record<string, string>)[p.level];
  if (guide) parts.push(guide);
  return parts.join(' ');
}

export function setupPerfil(app: Express, db: Db, { getSetting, setSetting }: Preferencias) {
  app.get('/api/quiz', (_req, res) => responder(res, C.Questionario, { questions: publicQuiz() }));

  app.post('/api/profile', (req, res) => {
    const answers = req.body?.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return res.status(400).json({ error: 'Respostas do questionário inválidas.' });
    const { profile, results } = gradeQuiz(answers); // alternativas que não existem são descartadas
    // refazer o questionário atualiza o perfil sem apagar o progresso; guarda os resultados anteriores para mostrar a evolução
    let antes: Perfil = {};
    try { antes = JSON.parse(req.user.profile || '{}') as Perfil; } catch { /* perfil antigo inválido: começa do zero */ }
    const anteriores = antes.level ? [{ em: antes.takenAt, nivel: antes.levelLabel, acertos: antes.score, total: antes.total }, ...(antes.anteriores || [])].slice(0, 5) : undefined;
    if (anteriores) Object.assign(profile, { anteriores });
    db.prepare('UPDATE users SET profile = ?, onboarded = 1 WHERE id = ?').run(JSON.stringify(profile), req.user.id);
    responder(res, C.ResultadoQuestionario, { profile, results });
  });

  // Pular o questionário (dá para fazer depois em Configurações > Prática).
  app.post('/api/profile/skip', (req, res) => {
    db.prepare('UPDATE users SET onboarded = 1 WHERE id = ?').run(req.user.id);
    res.json({ ok: true });
  });

  // Preferências da conta (ficam no banco, valem em qualquer navegador). Tema e animação ficam no navegador.
  const ehPaginaInicial = (v: unknown): v is C.TPreferencias['pagina_inicial'] => (C.PAGINAS_INICIAIS as readonly unknown[]).includes(v);
  const lerPreferencias = (userId: string): C.TPreferencias => {
    const pagina = getSetting(userId, 'pagina_inicial', 'chat');
    return { about_user: getSetting(userId, 'about_user'), response_style: getSetting(userId, 'response_style'), pagina_inicial: ehPaginaInicial(pagina) ? pagina : 'chat' };
  };
  app.get('/api/settings', (req, res) => responder(res, C.Preferencias, lerPreferencias(req.user.id)));
  app.put('/api/settings', (req, res) => {
    for (const key of ['about_user', 'response_style']) {
      if (typeof req.body?.[key] === 'string') setSetting(req.user.id, key, req.body[key].slice(0, 4000));
    }
    if (ehPaginaInicial(req.body?.pagina_inicial)) setSetting(req.user.id, 'pagina_inicial', req.body.pagina_inicial);
    responder(res, C.Preferencias, lerPreferencias(req.user.id));
  });
}
