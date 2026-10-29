// Prática na tela: plano adaptado pelo questionário, exercício guiado (só conta com entrega), projeto guiado conferido
// etapa por etapa, trilha, editor, testes no navegador, XP, resposta errada, rascunho e o Passo a passo de Python.
import { subirServidor, abrirNavegador, clienteApi, placar } from './ajuda.mjs';
import { findProjeto } from '../pacotes/servidor/projetos-dados.ts';

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
  const xpDaTela = `Number(document.querySelector('.xp-card b').textContent.replace(/[^0-9]/g, ''))`;
  const xpAntes = await avaliar(xpDaTela);
  const guiadoVazio = await api.pedir('POST', `/api/pratica/guiado/${encodeURIComponent((await (await api.pedir('GET', '/api/pratica')).json()).plano.guiados[0].id)}`, { resposta: '  ' });
  ok('guiado sem solução entregue é recusado (clicar não dá XP)', guiadoVazio.status === 400 && /Cole a sua solução/.test((await guiadoVazio.json()).error));
  await avaliar(`[...document.querySelectorAll('.guiado .btn.ghost')][0].click()`);
  ok('"Entregar solução" abre o campo, e o botão só libera com uma resposta', await esperar(`document.querySelector('.guiado-entrega textarea') !== null && document.querySelector('.guiado-entrega button').disabled`));
  await avaliar(`(()=>{ const t = document.querySelector('.guiado-entrega textarea'); t.value = 'SELECT nome, idade FROM alunos WHERE cidade = "Blumenau";'; t.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await esperar(`!document.querySelector('.guiado-entrega button').disabled`);
  await avaliar(`document.querySelector('.guiado-entrega button').click()`);
  ok('entregar o guiado dá XP e marca como feito', await esperar(`${xpDaTela} === ${xpAntes} + 10 && document.querySelector('.guiado.feito') !== null`));

  // projeto guiado de SQL (a tecnologia sem trilha com testes do plano)
  ok('projeto guiado de SQL aparece no plano', await avaliar(`[...document.querySelectorAll('.track-card')].some((c) => /Banco de dados de uma escola/.test(c.textContent))`));
  await avaliar(`location.hash = '#/pratica/projeto/pj-sql-escola'`);
  ok('página do projeto: objetivo, resultado, arquivo inicial e etapas', await esperar(`/Objetivo/.test(document.querySelector('.projeto-sobre')?.textContent || '') && /escola\\.sql/.test(document.querySelector('.projeto-arquivo')?.textContent || '') && document.querySelectorAll('.projeto-etapa').length === 3`));
  ok('explicação da solução fica escondida antes de concluir', await avaliar(`document.querySelector('.projeto-fim') === null`));
  const colar = (codigo) => avaliar(`(()=>{ const t = document.querySelector('.projeto-etapa.atual textarea'); t.value = ${JSON.stringify(codigo)}; t.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  const xpServidor = async () => (await (await api.pedir('GET', '/api/pratica')).json()).xp;
  const xpProjeto = await xpServidor();
  await colar('-- ainda vou fazer\nCREATE TABLE turmas (id INTEGER);');
  await avaliar(`[...document.querySelectorAll('.projeto-etapa.atual .btn')].find((b) => /Conferir/.test(b.textContent)).click()`);
  ok('etapa incompleta: mostra os critérios que faltam e não dá XP', await esperar(`document.querySelectorAll('.projeto-etapa.atual .projeto-criterios li.falta').length > 0`) && (await xpServidor()) === xpProjeto);
  const sql = findProjeto('pj-sql-escola');
  await colar(sql.etapas[0].referencia);
  await avaliar(`[...document.querySelectorAll('.projeto-etapa.atual .btn')].find((b) => /Conferir/.test(b.textContent)).click()`);
  ok('etapa certa: passa em todos os critérios, dá XP e avança para a próxima', await esperar(`document.querySelector('.projeto-etapa.feita') !== null && /Inserir dados/.test(document.querySelector('.projeto-etapa.atual summary')?.textContent || '')`) && (await xpServidor()) === xpProjeto + sql.etapas[0].xp);
  for (const e of sql.etapas.slice(1)) {
    await colar(e.referencia);
    await avaliar(`[...document.querySelectorAll('.projeto-etapa.atual .btn')].find((b) => /Conferir/.test(b.textContent)).click()`);
    await esperar(`[...document.querySelectorAll('.projeto-etapa')].filter((x) => x.classList.contains('feita')).length >= ${sql.etapas.indexOf(e) + 1}`);
  }
  ok('projeto concluído: explicação da solução e próximos desafios aparecem', await esperar(`/Como a solução funciona/.test(document.querySelector('.projeto-fim')?.textContent || '') && document.querySelectorAll('.projeto-desafios li').length >= 1`));
  const xpTotal = sql.etapas.reduce((n, e) => n + e.xp, 0) + 30;
  const xpFinal = await xpServidor();
  ok(`XP do projeto: etapas + bônus de conclusão (${xpTotal})`, xpFinal === xpProjeto + xpTotal, `${xpProjeto} -> ${xpFinal}`);
  const deNovo = await (await api.pedir('POST', '/api/pratica/projeto/pj-sql-escola/etapa/tabelas', { codigo: sql.etapas[0].referencia })).json();
  ok('conferir de novo uma etapa feita não dá XP outra vez', deNovo.conferencia.ok && deNovo.ganhos.length === 0);
  const outra = clienteApi(servidor.base); await outra.criarConta({ nome: 'Outra' });
  const daOutra = await (await outra.pedir('GET', '/api/pratica')).json();
  ok('progresso de projeto é de cada conta (outra pessoa começa do zero)', daOutra.projetos.find((x) => x.id === 'pj-sql-escola').etapas.every((e) => !e.feita) && daOutra.projetos.every((x) => x.explicacaoSolucao === null));
  ok('a solução de referência não vai para o navegador', !JSON.stringify(daOutra).includes('referencia') && !JSON.stringify(daOutra).includes(JSON.stringify(sql.etapas[2].referencia).slice(1, -1)));
  await api.pedir('POST', '/api/profile', { answers: { ...respostas, languages: ['Python'] } });
  const depois = await (await api.pedir('GET', '/api/pratica')).json();
  ok('refazer o questionário não apaga o progresso do projeto', depois.projetos.find((x) => x.id === 'pj-sql-escola').concluido && depois.xp >= xpProjeto + xpTotal);

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

  // exercício de Python com resposta booleana: a tela usa True/False, como no Python
  await nav.ir(`${servidor.base}/?r=4#/pratica/python-basico/py-par`, 3000);
  ok('Python mostra True/False (não true/false)', await esperar(`/esperado: (True|False)/.test(document.querySelector('#praticaView .test-row')?.textContent || '') && !/esperado: (true|false)/.test(document.querySelector('#praticaView .tests')?.textContent || document.body.textContent)`, 8000), await avaliar(`document.querySelector('#praticaView .test-row')?.textContent`));
  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); }
process.exit(fim());
