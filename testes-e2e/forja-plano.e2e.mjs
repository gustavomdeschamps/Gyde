// Plano da Forja em tarefa grande: aparece antes de qualquer mudança, com "Seguir o plano" e "Não seguir". Sem a
// aprovação nada roda; aprovado, a Forja segue. Tarefa pequena não mostra plano.
import { subirServidor, abrirNavegador, clienteApi, placar, criarProjetoForja } from './ajuda.mjs';
import { provedorFalso } from './provedor-falso.mjs';

const { ok, fim } = placar();
const ia = await provedorFalso();
const servidor = await subirServidor({ env: { FREELLMAPI_URL: ia.url, FREELLMAPI_KEY: 'freellmapi-teste-falsa-0000' } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Estudante' });
const proj = criarProjetoForja();
const sessao = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta: proj.pasta })).json();
const nav = await abrirNavegador();
const { avaliar, esperar } = nav;
const pedir = (texto) => avaliar(`(()=>{ const t = document.querySelector('#agenteView textarea'); t.value = ${JSON.stringify(texto)}; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#agenteView form').requestSubmit(); return 1; })()`);
const GRANDE = 'PLANO-GRANDE: corrija a função soma. Leia o arquivo antes. Explique o erro na resposta. Rode os testes no fim.';
const somaAntes = proj.ler('soma.js');
try {
  await nav.entrar(servidor.base, conta);
  await nav.ir(`${servidor.base}/?r=1#/agente/${sessao.id}`, 2500);
  await esperar(`document.querySelector('#agenteView textarea') !== null`);

  // recusar: nada roda
  await pedir(GRANDE);
  ok('tarefa grande: o plano aparece antes de qualquer mudança', await esperar(`document.querySelectorAll('.forja-plano li').length === 3`, 15_000),
    await avaliar(`document.querySelector('.forja-turno')?.textContent.slice(0, 200) ?? 'sem turno'`));
  ok('o plano tem "Seguir o plano" e "Não seguir"', await avaliar(`/Seguir o plano/.test(document.querySelector('.forja-plano').textContent) && /Não seguir/.test(document.querySelector('.forja-plano').textContent)`));
  ok('enquanto espera, a Forja não leu nem mudou nada', await avaliar(`document.querySelectorAll('.ag-passo').length === 0`) && proj.ler('soma.js') === somaAntes);
  await avaliar(`[...document.querySelectorAll('.forja-plano button')].find((b) => b.textContent === 'Não seguir').click()`);
  ok('"Não seguir": a tarefa termina sem mexer em nada', await esperar(`/Não segui o plano/.test([...document.querySelectorAll('.forja-turno')].pop()?.textContent || '') && document.querySelector('#agenteView .send').getAttribute('aria-label') !== 'Parar'`, 10_000)
    && proj.ler('soma.js') === somaAntes && await avaliar(`document.querySelectorAll('.ag-passo').length === 0`));

  // aprovar: a Forja segue o plano
  await pedir(GRANDE);
  await esperar(`[...document.querySelectorAll('.forja-plano')].some((p) => /Seguir o plano/.test(p.textContent) && p.querySelector('button'))`, 15_000);
  await avaliar(`[...document.querySelectorAll('.forja-plano button')].find((b) => b.textContent === 'Seguir o plano').click()`);
  ok('"Seguir o plano": a Forja trabalha e corrige', await esperar(`document.querySelector('#agenteView .send').getAttribute('aria-label') !== 'Parar' && /Segui o plano/.test(document.querySelector('#agenteView .messages').textContent)`, 30_000) && /a \+ b/.test(proj.ler('soma.js')),
    proj.ler('soma.js').split(/\r?\n/).find((l) => /return/.test(l)) ?? '');
  ok('o cartão fica como "Plano aprovado"', await avaliar(`/Plano aprovado/.test([...document.querySelectorAll('.forja-plano')].pop().textContent)`));
  const plano = ia.pedidos.filter((p) => /^Você planeja uma tarefa/.test(JSON.stringify(p.mensagens[0].content).slice(1)));
  ok('quem planeja não recebe ferramentas nem age (só o pedido e o contexto)', plano.length === 2 && plano.every((p) => !/"acoes"/.test(JSON.stringify(p.mensagens[0]))));
  ok('a execução recebe o plano aprovado', ia.pedidos.some((p) => /PLANO APROVADO PELO USUÁRIO/.test(JSON.stringify(p.mensagens[0]))));

  // tarefa pequena: sem plano
  const planosAntes = await avaliar(`document.querySelectorAll('.forja-plano').length`);
  await pedir('Corrija a função soma em soma.js e rode npm test.');
  await esperar(`document.querySelector('#agenteView .send').getAttribute('aria-label') !== 'Parar' && document.querySelectorAll('.forja-turno').length === 3`, 60_000);
  ok('tarefa pequena: nenhum plano novo', await avaliar(`document.querySelectorAll('.forja-plano').length`) === planosAntes);
  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); await ia.fechar(); proj.apagar(); }
process.exit(fim());
