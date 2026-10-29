// Duelo: Ana no navegador, Bia pela API. Ana desafia, Bia aceita, as duas recebem o mesmo exercício; Bia passa nos
// testes primeiro e vence; a tela da Ana mostra o resultado sozinha. Também confere as recusas.
import { subirServidor, abrirNavegador, clienteApi, placar } from './ajuda.mjs';

const { ok, fim } = placar();
const servidor = await subirServidor();
const ana = clienteApi(servidor.base), bia = clienteApi(servidor.base);
const contaAna = await ana.criarConta({ nome: 'Ana' });
const contaBia = await bia.criarConta({ nome: 'Bia' });
const nav = await abrirNavegador();
const { avaliar, esperar } = nav;
try {
  await nav.entrar(servidor.base, contaAna);
  await nav.ir(`${servidor.base}/?r=1#/pratica`);
  ok('a Prática tem o cartão de duelo', await esperar(`document.querySelector('.duelos form') !== null`));

  // recusas
  ok('não dá para desafiar a si mesma', (await ana.pedir('POST', '/api/duelos', { email: contaAna.email })).status === 400);
  ok('e-mail que não existe neste Gyde é recusado', (await ana.pedir('POST', '/api/duelos', { email: 'ninguem@t.test' })).status === 404);

  // Ana desafia pela tela
  await avaliar(`(()=>{ const c = document.querySelector('.duelos input[type="email"]'); c.value = ${JSON.stringify(contaBia.email)}; c.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.duelos form').requestSubmit(); return 1; })()`);
  ok('o desafio aparece esperando a Bia aceitar', await esperar(`/Você desafiou Bia/.test(document.querySelector('.duelos-lista')?.textContent || '') && /esperando aceitar/.test(document.querySelector('.duelos-lista').textContent)`));
  ok('não dá para abrir dois duelos com a mesma pessoa', (await ana.pedir('POST', '/api/duelos', { email: contaBia.email })).status === 409);
  const daBia = (await (await bia.pedir('GET', '/api/duelos')).json()).duelos;
  ok('a Bia recebe o convite com o exercício sorteado', daBia.length === 1 && daBia[0].estado === 'convite' && !daBia[0].souDesafiante && daBia[0].oponente === 'Ana');
  const duelo = daBia[0];
  ok('quem desafiou não pode aceitar o próprio convite', (await ana.pedir('POST', `/api/duelos/${duelo.id}/aceitar`, {})).status === 404);

  // Bia aceita: a tela da Ana mostra "Ir para o duelo" sozinha
  ok('a Bia aceita', (await bia.pedir('POST', `/api/duelos/${duelo.id}/aceitar`, {})).status === 200);
  ok('a tela da Ana atualiza sozinha para "Ir para o duelo"', await esperar(`[...document.querySelectorAll('.duelos-lista a')].some((a) => /Ir para o duelo/.test(a.textContent))`, 8000));
  await avaliar(`[...document.querySelectorAll('.duelos-lista a')].find((a) => /Ir para o duelo/.test(a.textContent)).click()`);
  ok('o exercício do duelo abre com a faixa e o relógio andando', await esperar(`document.querySelector('.duelo-faixa.andamento .duelo-relogio') !== null && location.hash === '#/pratica/${duelo.exercicio.trackId}/${duelo.exercicio.exerciseId}'`));
  const r1 = await avaliar(`document.querySelector('.duelo-relogio').textContent`);
  await nav.esperar('false', 1600);
  ok('o relógio anda', (await avaliar(`document.querySelector('.duelo-relogio').textContent`)) !== r1);

  // Bia passa nos testes primeiro
  await bia.pedir('POST', '/api/pratica/progress', { exerciseId: duelo.exercicio.exerciseId, passed: true, code: '# ok' });
  ok('a tela da Ana mostra que a Bia venceu, sem recarregar', await esperar(`/Bia venceu/.test(document.querySelector('.duelo-faixa')?.textContent || '')`, 6000));
  const fimBia = (await (await bia.pedir('GET', '/api/duelos')).json()).duelos[0];
  ok('para a Bia: venceu, com o tempo medido pelo servidor', fimBia.estado === 'fim' && fimBia.resultado === 'venci' && fimBia.meuTempo > 0);

  // Ana termina depois: o tempo dela também fica guardado
  await ana.pedir('POST', '/api/pratica/progress', { exerciseId: duelo.exercicio.exerciseId, passed: true, code: '# ok' });
  const fimAna = (await (await ana.pedir('GET', '/api/duelos')).json()).duelos[0];
  ok('para a Ana: perdeu, e o tempo dela também ficou registrado', fimAna.resultado === 'perdi' && fimAna.meuTempo >= fimAna.tempoOponente);
  await nav.ir(`${servidor.base}/?r=2#/pratica`);
  ok('a lista de duelos mostra o resultado', await esperar(`/Bia venceu em \\d+ s/.test(document.querySelector('.duelos-lista')?.textContent || '')`));
  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 2).join(' | '));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); }
process.exit(fim());
