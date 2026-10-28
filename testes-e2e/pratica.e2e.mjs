// Prática na tela: plano adaptado pelo questionário, exercício guiado, trilha, editor, testes no navegador,
// XP, resposta errada, rascunho e o Passo a passo de Python.
import { subirServidor, abrirNavegador, clienteApi, placar } from './ajuda.mjs';

const { ok, fim } = placar();
const servidor = await subirServidor();
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Lia', pularQuiz: false });
const quiz = (await (await api.pedir('GET', '/api/quiz')).json()).questions;
const respostas = Object.fromEntries(quiz.map((q) => [q.id, q.id === 'languages' ? ['JavaScript', 'SQL'] : q.id === 'goal' ? 'Criar meus próprios apps e sites' : q.kind === 'knowledge' ? 'Não sei ainda' : q.options[0]]));
await api.pedir('POST', '/api/profile', { answers: respostas });

const nav = await abrirNavegador();
const { avaliar, esperar } = nav;
const digitar = (codigo) => avaliar(`(()=>{ const t = document.querySelector('#praticaView .editor textarea'); t.value = ${JSON.stringify(codigo)}; t.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
const clicar = (rotulo) => avaliar(`[...document.querySelectorAll('#praticaView .editor-actions .btn')].find((b) => b.textContent.includes(${JSON.stringify(rotulo)})).click()`);
try {
  await nav.entrar(servidor.base, conta);
  await nav.ir(`${servidor.base}/?r=1#/pratica`);
  ok('Prática abre com o plano', await esperar(`/Seu plano/.test(document.querySelector('#praticaView .plano')?.textContent || '')`));
  ok('plano adaptado (JavaScript com trilha, SQL guiado)', await avaliar(`/Plano adaptado/.test(document.querySelector('.plano-tipo')?.textContent || '')`));
  ok('exercícios guiados de SQL aparecem', await avaliar(`[...document.querySelectorAll('.guiado')].some((g) => /SQL/.test(g.textContent))`));
  ok('trilha de JavaScript vem primeiro e recomendada', await avaliar(`(()=>{ const c = document.querySelector('.track-grid .track-card'); return /JavaScript/.test(c.textContent) && Boolean(c.querySelector('.recommended')); })()`));
  const xpAntes = await avaliar(`Number(document.querySelector('.xp-card b').textContent.replace(/[^0-9]/g, ''))`);
  await avaliar(`[...document.querySelectorAll('.guiado .btn.ghost')][0].click()`);
  ok('marcar guiado como feito dá XP e atualiza a tela', await esperar(`Number(document.querySelector('.xp-card b').textContent.replace(/[^0-9]/g, '')) === ${xpAntes} + 10 && document.querySelector('.guiado.feito') !== null`));

  await nav.ir(`${servidor.base}/?r=2#/pratica/js-zero`);
  ok('página da trilha lista os exercícios', await esperar(`document.querySelectorAll('#praticaView .ex-item').length > 3`));
  await avaliar(`location.hash = '#/pratica/js-zero/js-saudacao'`);
  ok('exercício abre com editor e testes', await esperar(`document.querySelector('#praticaView .editor textarea') !== null && document.querySelectorAll('#praticaView .test-row').length === 2`));
  ok('editor colore o código', await avaliar(`document.querySelector('#praticaView .editor code').innerHTML.includes('hljs-')`));
  await digitar('function saudacao(nome, idade) {\n  return nome + " tem " + idade + " anos";\n}\n');
  await clicar('Verificar');
  ok('Verificar roda os testes no navegador e todos passam', await esperar(`document.querySelectorAll('#praticaView .test-row.pass').length === 2`));
  ok('banner de sucesso com "Próximo"', await esperar(`/Mandou bem/.test(document.querySelector('.success-banner')?.textContent || '') && /Próximo/.test(document.querySelector('.success-banner').textContent)`));
  ok('XP do menu lateral atualiza', await esperar(`/[0-9]+ XP/.test(document.getElementById('xpBadge')?.textContent || '')`, 3000));
  await digitar('function saudacao(n, i) { return n; }\n');
  await clicar('Verificar');
  ok('resposta errada: testes falham e mostram o recebido', await esperar(`document.querySelectorAll('#praticaView .test-row.fail').length === 2 && /recebido/.test(document.querySelector('.test-row.fail').textContent)`));
  await avaliar(`location.hash = '#/pratica/js-zero'`); await nav.esperar('false', 800);
  await avaliar(`location.hash = '#/pratica/js-zero/js-saudacao'`);
  ok('rascunho sobrevive a trocar de tela', await esperar(`document.querySelector('#praticaView .editor textarea')?.value.includes('return n;')`, 5000));

  // Passo a passo de Python (roda o Pyodide no navegador: a primeira vez demora)
  await nav.ir(`${servidor.base}/?r=3#/pratica/python-basico/py-area`, 3000);
  await avaliar(`[...document.querySelectorAll('#praticaView button')].find((b) => /Passo a passo/.test(b.textContent))?.click()`);
  ok('Passo a passo abre', await esperar(`document.querySelector('dialog.trace-dialog[open]') !== null`, 5000));
  ok('passos gravados aparecem, com a linha atual destacada', await esperar(`document.querySelector('.trace-count') !== null`, 90_000) && await avaliar(`document.querySelectorAll('.trace-code .tl.current').length === 1`));
  await avaliar(`document.querySelector('[title^="Próximo passo"]').click()`);
  ok('Próximo avança', await esperar(`/^2 de/.test(document.querySelector('.trace-count').textContent)`, 2000));
  await avaliar(`document.querySelector('dialog.trace-dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))`);
  ok('seta para a esquerda volta', await esperar(`/^1 de/.test(document.querySelector('.trace-count').textContent)`, 2000));
  await avaliar(`document.querySelector('[title="Fim"]').click()`);
  ok('Fim explica o resultado', await esperar(`/Fim\\.|Erro/.test(document.querySelector('.trace-explain').textContent)`, 2000));
  await avaliar(`document.querySelector('[title="Início"]').click()`);
  await avaliar(`[...document.querySelectorAll('.trace-controls button')].find((b) => /Reproduzir/.test(b.textContent)).click()`);
  ok('Reproduzir anda sozinho', await esperar(`!/^1 de/.test(document.querySelector('.trace-count').textContent)`, 3000));
  await avaliar(`document.querySelector('.trace-head button').click()`);
  ok('fechar tira o diálogo da página', await esperar(`document.querySelector('dialog.trace-dialog') === null`, 2000));

  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); }
process.exit(fim());
