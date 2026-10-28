// Prática: toda submissão válida do questionário precisa virar um plano utilizável, sem chamar IA.
// Testa por combinações das alternativas REAIS do quiz (quiz.js), com e sem progresso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ, gradeQuiz } from '../quiz.ts';
import { planoDe, GUIADOS, TECNOLOGIAS, findGuiado } from '../pratica-plano.ts';
import { TRACKS, findExercise } from '../pratica-dados.ts';
import { Plano } from '../contratos.ts';

const pergunta = (id) => QUIZ.find((q) => q.id === id);
const conhecimento = QUIZ.filter((q) => q.kind === 'knowledge');
const opcoesLing = pergunta('languages').options;
const TIPOS = ['trilha', 'adaptada', 'montada', 'inicial'];

// gerador simples e repetível (mesma sequência sempre)
let semente = 42;
const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
const subconjunto = () => opcoesLing.filter(() => aleatorio() < 0.3);

function confere(plano, progress, contexto) {
  const msg = (m) => `${m} | ${JSON.stringify(contexto)}`;
  assert.ok(plano && typeof plano === 'object' && !(plano instanceof Promise), msg('plano não é objeto síncrono'));
  const contrato = Plano.safeParse(plano);
  assert.ok(contrato.success, msg(`plano fora do contrato: ${contrato.success ? '' : contrato.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`));
  assert.ok(TIPOS.includes(plano.tipo), msg(`tipo inválido ${plano.tipo}`));
  assert.equal(typeof plano.explicacao, 'string', msg('sem explicação'));
  assert.ok(plano.tecnologias.length > 0 && plano.tecnologias.every((t) => TECNOLOGIAS.includes(t)), msg('tecnologias inválidas'));
  // sempre há o que fazer: próximo passo, ou conclusão com novo desafio
  assert.ok(plano.proximo || (plano.concluido && plano.novoDesafio), msg('plano sem próximo passo nem desafio'));
  if (plano.proximo?.tipo === 'trilha') {
    const f = findExercise(plano.proximo.exerciseId);
    assert.ok(f && f.track.id === plano.proximo.trackId, msg('próximo aponta para exercício inexistente'));
    assert.ok(!progress[plano.proximo.exerciseId]?.done, msg('próximo já foi feito'));
  }
  if (plano.proximo?.tipo === 'guiado') {
    assert.ok(findGuiado(plano.proximo.id), msg('guiado inexistente'));
    assert.ok(!progress[plano.proximo.id]?.done, msg('guiado já feito'));
  }
  if (plano.recomendada) assert.ok(TRACKS.some((t) => t.id === plano.recomendada), msg('trilha recomendada não existe'));
  // tecnologia sem trilha nunca aparece como trilha
  for (const f of plano.focos) if (f.tipo === 'guiado') assert.equal(f.trilhas.length, 0, msg('foco guiado com trilha'));
  // toda tecnologia sem trilha tem exercícios guiados no plano
  for (const t of plano.semTrilha) assert.ok(GUIADOS.some((g) => g.tecnologia === t), msg(`sem exercícios para ${t}`));
}

test('todas as combinações das alternativas reais do questionário geram plano utilizável', () => {
  const exp = [...pergunta('experience').options, undefined];
  const obj = [...pergunta('goal').options, undefined];
  const est = [...pergunta('style').options, undefined];
  const lings = [[], ['Ainda não sei'], ...opcoesLing.map((l) => [l]), ...Array.from({ length: 25 }, subconjunto)];
  const respostasConhecimento = [
    Object.fromEntries(conhecimento.map((q) => [q.id, 'Não sei ainda'])),
    Object.fromEntries(conhecimento.map((q) => [q.id, q.answer])),
    Object.fromEntries(conhecimento.map((q, i) => [q.id, i % 2 ? q.answer : 'Não sei ainda'])),
  ];
  let n = 0;
  for (const experience of exp) for (const goal of obj) for (const style of est) for (const languages of lings) for (const k of respostasConhecimento) {
    const { profile } = gradeQuiz({ experience, goal, style, languages, ...k });
    confere(planoDe(profile, {}), {}, { experience, goal, style, languages });
    n++;
  }
  assert.ok(n > 10_000, `só ${n} combinações`);
});

test('cada linguagem oferecida no questionário tem conteúdo; as sem trilha usam exercícios guiados', () => {
  for (const l of opcoesLing.filter((x) => x !== 'Ainda não sei')) {
    const { profile } = gradeQuiz({ experience: 'Nunca programei', languages: [l], goal: 'Criar jogos' });
    const plano = planoDe(profile, {});
    confere(plano, {}, { l });
    assert.ok(plano.tecnologias.includes(l), `${l} sumiu do plano`);
    const foco = plano.focos.find((f) => f.tecnologia === l);
    assert.ok(foco.tipo === 'trilha' || plano.guiados.some((g) => g.tecnologia === l), `${l} sem exercícios`);
  }
  const java = planoDe(gradeQuiz({ languages: ['Java'] }).profile, {});
  assert.equal(java.tipo, 'montada');
  assert.equal(java.proximo.tipo, 'guiado');
  const sql = planoDe(gradeQuiz({ languages: ['SQL'] }).profile, {});
  assert.ok(sql.guiados.every((g) => g.tecnologia === 'SQL') && /consulta|Ordenar/i.test(sql.guiados.map((g) => g.titulo + g.enunciado).join(' ')));
});

test('nível: quem nunca programou não recebe avançado; quem é avançado não refaz o básico', () => {
  const zero = planoDe(gradeQuiz({ experience: 'Nunca programei', languages: ['Java'] }).profile, {});
  assert.ok(zero.guiados.every((g) => g.nivel !== 'avancado'));
  const certas = Object.fromEntries(conhecimento.map((q) => [q.id, q.answer]));
  const av = planoDe(gradeQuiz({ experience: 'Faço projetos grandes ou trabalho com isso', languages: ['Python'], ...certas }).profile, {});
  assert.notEqual(av.recomendada, 'python-basico');
  const avJava = planoDe(gradeQuiz({ experience: 'Faço projetos grandes ou trabalho com isso', languages: ['Java'], ...certas }).profile, {});
  assert.ok(avJava.guiados.every((g) => g.nivel !== 'basico'));
});

test('dados ausentes, inválidos ou incompatíveis viram plano válido (sem quebrar)', () => {
  for (const perfil of [null, undefined, 'texto', 42, [], {}, { languages: 'Python' }, { languages: ['Cobol', 7, null] }, { level: 'xyz', goal: 'qualquer' }, { level: 'zero' }]) {
    confere(planoDe(perfil, {}), {}, { perfil });
  }
  assert.equal(planoDe(null, {}).tipo, 'inicial');
  const { profile } = gradeQuiz({ experience: 'inventada', languages: ['Cobol'], goal: 42 });
  assert.equal(profile.experience, null);
  assert.deepEqual(profile.languages, []);
  confere(planoDe(profile, {}), {}, { inválido: true });
});

test('progresso: continua depois de concluir trilhas e oferece novo desafio quando tudo acaba', () => {
  const { profile } = gradeQuiz({ experience: 'Nunca programei', languages: ['Python'] });
  const tudoPython = Object.fromEntries(TRACKS.filter((t) => t.lang === 'python').flatMap((t) => t.exercises).map((e) => [e.id, { done: true, fails: 0 }]));
  const p1 = planoDe(profile, tudoPython);
  confere(p1, tudoPython, { tudoPython: true });
  const tudo = Object.fromEntries([...TRACKS.flatMap((t) => t.exercises.map((e) => e.id)), ...GUIADOS.map((g) => g.id)].map((id) => [id, { done: true, fails: 0 }]));
  const p2 = planoDe(profile, tudo);
  assert.equal(p2.proximo, null);
  assert.equal(p2.concluido, true);
  assert.equal(p2.novoDesafio.tipo, 'chat');
  // progresso parcial: o próximo nunca é um exercício já feito
  const parcial = { 'py-ola': { done: true, fails: 1 }, 'py-area': { done: false, fails: 2 } };
  const p3 = planoDe(profile, parcial);
  confere(p3, parcial, { parcial: true });
  assert.deepEqual(p3.observado.travados, ['py-area']);
});

test('refazer o questionário muda o plano sem depender do progresso antigo sumir', () => {
  const prog = { 'py-ola': { done: true, fails: 0 } };
  const antes = planoDe(gradeQuiz({ languages: ['Python'] }).profile, prog);
  const depois = planoDe(gradeQuiz({ languages: ['SQL'] }).profile, prog);
  assert.notDeepEqual(antes.tecnologias, depois.tecnologias);
  assert.equal(depois.observado.feitos, 1);
});

test('catálogo guiado: ids únicos e todas as tecnologias com os três níveis', () => {
  assert.equal(new Set(GUIADOS.map((g) => g.id)).size, GUIADOS.length);
  for (const t of TECNOLOGIAS) for (const nv of ['basico', 'intermediario', 'avancado']) assert.ok(GUIADOS.some((g) => g.tecnologia === t && g.nivel === nv), `${t} sem ${nv}`);
});
