// Conectar IA com provedores FALSOS: testar chave (1 token de verdade), salvar sem devolver a chave, lista de modelos ao vivo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { criarConexoes, setupConexoes } from '../ia/conexoes.ts';
import { criarCatalogo } from '../ia/catalogo.ts';
import { PROVEDORES_GRATIS } from '../ia/provedores-gratis.ts';

const CHAVE_BOA = `nvapi-${'boa0'.repeat(8)}`;
const CHAVE_RUIM = `nvapi-${'ruim'.repeat(8)}`;
const CHAVE_LIMITE = `nvapi-${'lim0'.repeat(8)}`;
const NVIDIA = PROVEDORES_GRATIS.find((p) => p.id === 'nvidia');
const medicoes = { em: null, modelos: { 'nvidia:poolside/laguna-xs-2.1': { via: [], categorias: { codigo: { acertos: 4, respondidas: 4, limites: 0, ms: 900 } } }, 'nvidia:modelo/que-sumiu': { via: [], categorias: { codigo: { acertos: 4, respondidas: 4, limites: 0, ms: 900 } } } } };

// provedor falso: a lista de modelos abre sem chave (como a da NVIDIA de verdade); a chamada de chat confere a chave
let listaModelos = ['poolside/laguna-xs-2.1', 'nvidia/embed-qa-4', 'outro/modelo-novo'];
const chamadas = [];
const falso = http.createServer((req, res) => {
  const chave = (req.headers.authorization ?? '').replace('Bearer ', '');
  res.setHeader('Content-Type', 'application/json');
  if (req.url.endsWith('/models')) return res.end(JSON.stringify({ data: listaModelos.map((id) => ({ id })) }));
  let corpo = ''; req.on('data', (d) => { corpo += d; });
  req.on('end', () => {
    chamadas.push({ chave, corpo: JSON.parse(corpo) });
    if (chave === CHAVE_RUIM) { res.statusCode = 403; return res.end(JSON.stringify({ error: { message: 'Authorization failed' } })); }
    if (chave === CHAVE_LIMITE) { res.statusCode = 429; return res.end('{}'); }
    res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
  });
});
await new Promise((ok) => falso.listen(0, '127.0.0.1', ok));
process.env.GYDE_URL_NVIDIA = `http://127.0.0.1:${falso.address().port}/v1`;
after(() => { falso.close(); delete process.env.GYDE_URL_NVIDIA; delete process.env.NVIDIA_API_KEY; });

test('testar chave: formato errado, recusada, certa, no limite e sem internet dizem claramente o que houve', async () => {
  const c = criarConexoes({ medicoes });
  const formato = await c.testar(NVIDIA, 'minha-chave');
  assert.equal(formato.ok, false);
  assert.match(formato.mensagem, /começa com "nvapi-"/);
  assert.equal(chamadas.length, 0, 'formato errado nem chama o provedor');
  const ruim = await c.testar(NVIDIA, CHAVE_RUIM);
  assert.equal(ruim.ok, false);
  assert.match(ruim.mensagem, /recusou essa chave/);
  const boa = await c.testar(NVIDIA, CHAVE_BOA);
  assert.equal(boa.ok, true);
  assert.match(boa.mensagem, /Funcionou/);
  assert.equal(chamadas.at(-1).corpo.max_tokens, 1, 'só 1 token: a lista de modelos não prova a chave');
  assert.equal(chamadas.at(-1).corpo.model, 'poolside/laguna-xs-2.1', 'testa com um modelo medido que ainda existe');
  const limite = await c.testar(NVIDIA, CHAVE_LIMITE);
  assert.equal(limite.ok, true, 'no limite, a chave é válida');
  assert.match(limite.mensagem, /limite/);
  const semRede = await criarConexoes({ medicoes, buscar: async () => { throw new TypeError('fetch failed'); } }).testar(NVIDIA, CHAVE_BOA);
  assert.equal(semRede.ok, false);
  assert.match(semRede.mensagem, /internet/);
});

test('lista ao vivo: modelo medido que sumiu sai da fila; se todos sumirem, entram os de conversa que o provedor tem agora', async () => {
  process.env.NVIDIA_API_KEY = CHAVE_BOA;
  listaModelos = ['poolside/laguna-xs-2.1', 'nvidia/embed-qa-4'];
  const c = criarConexoes({ medicoes });
  await c.atualizar();
  assert.deepEqual(c.extras()[0].modelos.map((m) => m.id), ['poolside/laguna-xs-2.1'], 'modelo/que-sumiu saiu');
  const cat = criarCatalogo({ router: async () => { throw new Error('sem FreeLLMAPI'); }, medicoes, extras: c.extras, apenas: c.ids });
  assert.deepEqual(cat.cadeia(['codigo']), ['nvidia:poolside/laguna-xs-2.1'], 'sem FreeLLMAPI: sem auto no fim');
  const c2 = criarConexoes({ medicoes: { em: null, modelos: { 'nvidia:modelo/que-sumiu': medicoes.modelos['nvidia:modelo/que-sumiu'] } } });
  listaModelos = ['nvidia/embed-qa-4', 'outro/modelo-novo', 'meta/llama-guard-4-12b'];
  await c2.atualizar();
  assert.deepEqual(c2.extras()[0].modelos.map((m) => m.id), ['outro/modelo-novo'], 'embeddings e moderação nunca entram');
  delete process.env.NVIDIA_API_KEY;
  assert.deepEqual(c2.extras(), [], 'sem chave, o provedor não entra');
});

test('rotas: testar salva só se funcionar, a chave nunca volta na resposta, apagar desconecta', async () => {
  delete process.env.NVIDIA_API_KEY;
  const gravado = {};
  const app = express();
  app.use(express.json());
  const conexoes = criarConexoes({ medicoes });
  setupConexoes(app, { conexoes, asyncRoute: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next), aoMudar: () => {},
    gravarNoEnv: (pares) => { for (const [k, v] of Object.entries(pares)) { gravado[k] = v; if (v === null) delete process.env[k]; else process.env[k] = v; } } });
  const srv = app.listen(0, '127.0.0.1');
  await new Promise((ok) => srv.once('listening', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = (rota, corpo) => fetch(base + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

  const inicio = await (await fetch(`${base}/api/ia/conexoes`)).json();
  assert.deepEqual(inicio.provedores.map((p) => [p.id, p.papel]), [['nvidia', 'inicial'], ['google', 'inicial'], ['groq', 'opcional']], 'Mistral não aparece');
  assert.match(inicio.avisoIdade, /18 anos/);
  assert.equal(inicio.provedores.find((p) => p.id === 'groq').descricao, 'Deixa o chat mais rápido e serve de reserva.');
  assert.match(inicio.provedores.find((p) => p.id === 'google').avisos.join(' '), /pessoas podem ler/);
  assert.match(inicio.provedores.find((p) => p.id === 'nvidia').avisos.join(' '), /teste grátis.*pode encerrar/);

  const ruim = await (await post('/api/ia/conexoes/nvidia/testar', { chave: CHAVE_RUIM })).json();
  assert.equal(ruim.ok, false);
  assert.equal(gravado.NVIDIA_API_KEY, undefined, 'chave recusada não é salva');
  const r = await post('/api/ia/conexoes/nvidia/testar', { chave: CHAVE_BOA });
  const texto = await r.text();
  assert.equal(JSON.parse(texto).ok, true);
  assert.equal(gravado.NVIDIA_API_KEY, CHAVE_BOA, 'chave que funcionou é salva no .env');
  assert.ok(!texto.includes(CHAVE_BOA) && !texto.includes('boa0'), 'a chave nunca volta na resposta');
  assert.equal(JSON.parse(texto).conexoes.provedores.find((p) => p.id === 'nvidia').conectado, true);
  const deNovo = await (await post('/api/ia/conexoes/nvidia/testar', {})).json();
  assert.equal(deNovo.ok, true, 'testar de novo usa a chave salva');
  assert.equal((await post('/api/ia/conexoes/mistral/testar', { chave: 'x' })).status, 404, 'Mistral não se conecta pela tela');
  const apagou = await (await fetch(`${base}/api/ia/conexoes/nvidia`, { method: 'DELETE' })).json();
  assert.equal(apagou.provedores.find((p) => p.id === 'nvidia').conectado, false);
  assert.equal(gravado.NVIDIA_API_KEY, null);
  srv.close();
});
