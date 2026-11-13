// "Pedir à Forja" do VS Code: a extensão (com o token) só guarda um rascunho. O app mostra um cartão; "Abrir na Forja"
// abre a Forja daquela pasta com o pedido escrito, sem enviar; "Descartar" apaga. Nada roda sem a pessoa.
import { realpathSync } from 'node:fs';
import { subirServidor, abrirNavegador, clienteApi, placar, criarProjetoForja } from './ajuda.mjs';
import { provedorFalso } from './provedor-falso.mjs';

const { ok, fim } = placar();
const ia = await provedorFalso();
const servidor = await subirServidor({ env: { FREELLMAPI_URL: ia.url, FREELLMAPI_KEY: 'freellmapi-teste-falsa-0000' } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Estudante' });
const { token } = await (await api.pedir('POST', '/api/tokens', { name: 'VS Code' })).json();
const proj = criarProjetoForja();
// o que a extensão do VS Code faz: só o token, sem cookie
const pedirPeloVsCode = (pedido) => fetch(`${servidor.base}/api/forja/rascunho`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'x-gyde': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ pasta: proj.pasta, pedido, origem: 'vscode' }),
});
const sessoes = async () => (await (await api.pedir('GET', '/api/codigo/sessoes')).json()).sessoes;
const nav = await abrirNavegador();
const { avaliar, esperar } = nav;
try {
  await nav.entrar(servidor.base, conta);
  await nav.ir(`${servidor.base}/?r=1#/`, 2500);
  ok('o app abre no chat, sem cartão', await esperar(`document.querySelector('.main')?.dataset.page === 'chat'`) && await avaliar(`document.querySelector('.rascunho-forja') === null`));

  const pedido = 'Procure bugs no arquivo soma.js e corrija os que encontrar, explicando cada um.';
  ok('a extensão guarda o pedido com o token', (await pedirPeloVsCode(pedido)).status === 200);
  ok('o app mostra o cartão com a pasta e o pedido', await esperar(`/O VS Code pediu à Forja/.test(document.querySelector('.rascunho-forja')?.textContent || '') && document.querySelector('.rascunho-pedido')?.textContent === ${JSON.stringify(pedido)}`, 10_000),
    await avaliar(`document.querySelector('.rascunho-forja')?.textContent ?? 'sem cartão'`));
  ok('o cartão diz que nada roda sozinho', await avaliar(`/Nada roda sozinho/.test(document.querySelector('.rascunho-forja').textContent)`));
  ok('só mostrar o cartão não cria conversa da Forja', (await sessoes()).length === 0);

  const pedidosAntes = ia.pedidos.length;
  await avaliar(`document.querySelector('.rascunho-forja [data-a="abrir"]').click()`);
  ok('"Abrir na Forja" abre a Forja daquela pasta com o pedido escrito', await esperar(`location.hash.startsWith('#/agente/') && document.querySelector('#agenteView textarea')?.value === ${JSON.stringify(pedido)}`, 10_000),
    await avaliar(`location.hash + ' · ' + (document.querySelector('#agenteView textarea')?.value ?? 'sem campo')`));
  ok('a pasta certa ficou conectada', await esperar(`(document.querySelector('.forja-proj-txt small')?.textContent || '').toLowerCase() === ${JSON.stringify(realpathSync.native(proj.pasta).toLowerCase())}`, 5000),
    await avaliar(`document.querySelector('.forja-proj-txt small')?.textContent ?? ''`));
  ok('o pedido NÃO foi enviado (quem envia é a pessoa)', await avaliar(`document.querySelector('.forja-turno') === null`) && ia.pedidos.length === pedidosAntes);
  ok('o cartão some e o rascunho é apagado', await avaliar(`document.querySelector('.rascunho-forja') === null`) && (await (await api.pedir('GET', '/api/forja/rascunho')).json()).rascunho === null);
  const id = (await sessoes())[0]?.id;

  // segundo pedido para a mesma pasta: reaproveita a conversa que já existe
  await nav.ir(`${servidor.base}/?r=2#/`, 2500);
  const outro = 'Crie testes para o arquivo soma.js e rode.';
  await pedirPeloVsCode(outro);
  await esperar(`document.querySelector('.rascunho-pedido')?.textContent === ${JSON.stringify(outro)}`, 10_000);
  await avaliar(`document.querySelector('.rascunho-forja [data-a="abrir"]').click()`);
  ok('mesma pasta: abre a conversa que já existia', await esperar(`location.hash === '#/agente/${id}' && document.querySelector('#agenteView textarea')?.value === ${JSON.stringify(outro)}`, 10_000) && (await sessoes()).length === 1);

  // "Descartar" apaga o rascunho e não abre nada
  await nav.ir(`${servidor.base}/?r=3#/`, 2500);
  await pedirPeloVsCode('Explique o arquivo soma.js.');
  await esperar(`document.querySelector('.rascunho-forja') !== null`, 10_000);
  await avaliar(`document.querySelector('.rascunho-forja [data-a="descartar"]').click()`);
  ok('"Descartar" fecha o cartão, apaga o rascunho e fica no chat', await esperar(`document.querySelector('.rascunho-forja') === null`, 3000)
    && (await (await api.pedir('GET', '/api/forja/rascunho')).json()).rascunho === null && await avaliar(`document.querySelector('.main')?.dataset.page === 'chat'`));
  ok('nada foi enviado à IA em nenhum momento', ia.pedidos.length === pedidosAntes);
  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); await ia.fechar(); proj.apagar(); }
process.exit(fim());
