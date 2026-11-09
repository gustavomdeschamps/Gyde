// Conectar IA, do zero: sem nenhuma chave, o aviso leva à tela; chave em formato errado, chave recusada e chave certa dizem
// claramente o que houve; a chave nunca volta para a tela; depois de conectar, o chat responde pela NVIDIA (falsa).
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { subirServidor, abrirNavegador, clienteApi, placar } from './ajuda.mjs';
import { provedorFalso } from './provedor-falso.mjs';

const { ok, fim } = placar();
const ia = await provedorFalso();
const servidor = await subirServidor({ env: { FREELLMAPI_KEY: '', GYDE_URL_NVIDIA: `${ia.url}/v1`, GYDE_URL_GOOGLE: `${ia.url}/v1`, GYDE_URL_GROQ: `${ia.url}/v1` } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Lia' });
const nav = await abrirNavegador();
const { avaliar, esperar } = nav;
const CHAVE = `nvapi-${'teste0'.repeat(6)}`;
const cartao = (id) => `[...document.querySelectorAll('.conexao')].find((c) => c.querySelector('h3')?.id === 'conexao-${id}')`;
const colar = (id, valor) => avaliar(`(() => { const c = ${cartao(id)}; const i = c.querySelector('input'); i.value = ${JSON.stringify(valor)}; i.dispatchEvent(new Event('input', { bubbles: true })); c.querySelector('form').requestSubmit(); return 1; })()`);
const resultado = (id) => `(${cartao(id)}?.querySelector('.conexao-resultado')?.textContent || '')`;
try {
  await nav.entrar(servidor.base, conta);
  await nav.ir(`${servidor.base}/?r=1#/`, 2500);
  ok('sem chave nenhuma: o aviso do topo diz que a IA não está conectada', await esperar(`!document.querySelector('#banner').hidden && /IA ainda não está conectada/.test(document.querySelector('#banner').textContent)`));
  await avaliar(`document.querySelector('#bannerConfigIa').click()`);
  ok('o aviso abre Configurações > Conectar IA', await esperar(`document.querySelector('[data-painel="conectar"] .conexao') !== null`, 5000));
  const tela = await avaliar(`(() => { const p = document.querySelector('[data-painel="conectar"]'); return { texto: p.innerText, iniciais: [...p.querySelectorAll('.conectar-grade')][0]?.querySelectorAll('.conexao').length, opcionais: [...p.querySelectorAll('.conectar-grade')][1]?.innerText }; })()`);
  ok('explica o que é uma chave em linguagem simples', /parecido com uma senha/.test(tela.texto));
  ok('"Escolha uma chave para começar" com dois cartões: NVIDIA e Google', /Escolha uma chave para começar/.test(tela.texto) && tela.iniciais === 2 && /NVIDIA/.test(tela.texto) && /Google AI Studio/.test(tela.texto));
  ok('Groq é opcional e só "deixa o chat mais rápido e serve de reserva"', /Groq/.test(tela.opcionais) && /Deixa o chat mais rápido e serve de reserva\./.test(tela.opcionais) && !/Forja/.test(tela.opcionais));
  ok('aviso de 18 anos', /18 anos ou mais/.test(tela.texto));
  ok('aviso de privacidade do Google', /pessoas podem ler essas conversas/.test(tela.texto));
  ok('aviso de que o teste da NVIDIA pode mudar', /teste grátis da NVIDIA.*pode encerrar/s.test(tela.texto));
  ok('FreeLLMAPI fica em "Avançado"', /Avançado: FreeLLMAPI/.test(tela.texto));
  ok('cada cartão tem link para criar a chave, campo e "Testar chave"', await avaliar(`[...document.querySelectorAll('.conexao')].every((c) => c.querySelector('a[target="_blank"][href^="https://"]') && c.querySelector('input[type="password"]') && /Testar chave/.test(c.querySelector('form button').textContent))`));

  await colar('nvidia', 'minha-chave-123');
  ok('formato errado: diz como a chave começa', await esperar(`/começa com "nvapi-"/.test(${resultado('nvidia')})`, 5000));
  await colar('nvidia', `nvapi-${'ruim00'.repeat(6)}`);
  ok('chave recusada pelo provedor: diz que foi recusada e o que fazer', await esperar(`/recusou essa chave.*copiou ela inteira/.test(${resultado('nvidia')})`, 8000));
  await colar('nvidia', CHAVE);
  ok('chave certa: "Funcionou!"', await esperar(`/Funcionou! O Gyde já pode usar a NVIDIA/.test(${resultado('nvidia')})`, 8000));
  ok('o cartão fica "Conectado" e o campo some', await esperar(`/Conectado/.test(${cartao('nvidia')}.textContent) && !${cartao('nvidia')}.querySelector('input')`, 3000));
  ok('a chave não aparece em lugar nenhum da tela', await avaliar(`!document.documentElement.outerHTML.includes(${JSON.stringify(CHAVE)}) && ![...document.querySelectorAll('input')].some((i) => i.value.includes('teste0'))`));
  const respostas = await avaliar(`(async () => { let t = ''; for (const u of ['/api/ia/conexoes', '/api/status', '/api/uso', '/api/settings']) t += await (await fetch(u, { headers: { 'x-gyde': '1' } })).text(); return t; })()`);
  ok('nenhuma resposta da API devolve a chave', !respostas.includes(CHAVE));
  const env = existsSync(path.join(servidor.pasta, '.env')) ? readFileSync(path.join(servidor.pasta, '.env'), 'utf8') : '';
  ok('a chave foi salva no .env deste computador', env.includes(`NVIDIA_API_KEY=${CHAVE}`));
  ok('o aviso do topo some', await esperar(`document.querySelector('#banner').hidden || !/IA ainda não está conectada/.test(document.querySelector('#banner').textContent)`, 5000));
  await avaliar(`([...${cartao('nvidia')}.querySelectorAll('button')].find((b) => /Testar de novo/.test(b.textContent)).click(), 1)`);
  ok('"Testar de novo" usa a chave salva', await esperar(`/Funcionou/.test(${resultado('nvidia')})`, 8000));
  await avaliar(`document.querySelector('dialog.config').close()`);

  const antes = ia.pedidos.length;
  const conv = await (await api.pedir('POST', '/api/conversations', {})).json();
  const sse = await (await api.pedir('POST', `/api/conversations/${conv.id}/messages`, { mode: 'new', content: 'o que é uma variável?', attachments: [], model: 'gyde-1', kind: 'chat' })).text();
  ok('depois de conectar, o chat responde pela NVIDIA, direto, sem FreeLLMAPI', /"type":"done"/.test(sse) && ia.pedidos.slice(antes).some((p) => p.stream && p.chave === CHAVE), sse.slice(0, 200));
  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); await ia.fechar(); }
process.exit(fim());
