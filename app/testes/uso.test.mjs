// Contabilização de uso e mensagens de limite, com um provedor FALSO local (não gasta cota de ninguém).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { criarUso } from '../uso.ts';
import { migrar } from '../banco.ts';
import { criarProvedores } from '../provedores.ts';
import { completar } from '../motor.ts';

// provedor falso: /health ok; o modelo "cheio" dá 429 só dele; "sem-uso" responde sem tokens; "estoura" acaba o minuto
function provedorFalso() {
  const srv = http.createServer((req, res) => {
    if (req.url === '/health') return res.end('ok');
    let corpo = '';
    req.on('data', (d) => { corpo += d; });
    req.on('end', () => {
      const { model } = JSON.parse(corpo || '{}');
      const cab = { 'Content-Type': 'application/json', 'x-ratelimit-limit': '120', 'x-ratelimit-remaining': model === 'estoura' ? '0' : '50', 'x-ratelimit-reset': '1900000000', 'x-routed-via': `falso/${model}` };
      if (model === 'cheio' || model === 'estoura') { res.writeHead(429, cab); return res.end(JSON.stringify({ error: { message: 'rate limited' } })); }
      res.writeHead(200, cab);
      const resposta = { choices: [{ message: { content: 'oi' } }] };
      if (model !== 'sem-uso') resposta.usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
      res.end(JSON.stringify(resposta));
    });
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

async function montar() {
  const srv = await provedorFalso();
  const db = new DatabaseSync(':memory:');
  migrar(db);
  const uso = criarUso(db);
  const p = criarProvedores({ routerUrl: `http://127.0.0.1:${srv.address().port}`, routerKey: 'teste', ollamaUrl: 'http://127.0.0.1:1', ollamaModelo: 'nenhum', modo: 'online', uso });
  return { srv, db, uso, p };
}

test('troca de modelo conta 1 pedido e 2 chamadas; tokens são os informados', async () => {
  const { srv, uso, p } = await montar();
  const reg = uso.iniciar('u1', 'chat');
  const r = await completar(p.router, { cadeia: ['cheio', 'bom'], messages: [], registro: reg });
  reg.fim('ok');
  reg.fim('ok'); // fechar de novo não pode contar outra vez
  const hoje = uso.resumo('u1').hoje.online;
  assert.equal(r.modelo, 'falso/bom');
  assert.equal(hoje.pedidos, 1);
  assert.equal(hoje.chamadas, 2);
  assert.equal(hoje.chamadasFalhas, 1);
  assert.equal(hoje.tokensEntrada, 10);
  assert.equal(hoje.tokensSaida, 5);
  srv.close();
});

test('sem campo usage, os tokens ficam como não informados (não estimados)', async () => {
  const { srv, uso, p } = await montar();
  const reg = uso.iniciar('u1', 'chat');
  await completar(p.router, { cadeia: ['sem-uso'], messages: [], registro: reg });
  reg.fim('ok');
  const [ultimo] = uso.resumo('u1').ultimos;
  assert.equal(ultimo.tokens_entrada, null);
  assert.equal(uso.resumo('u1').hoje.online.semTokens, 1);
  srv.close();
});

test('limite do minuto acabou: erro 429 claro, com quem limita, quando renova, e registro "limite"', async () => {
  const { srv, uso, p } = await montar();
  const reg = uso.iniciar('u1', 'chat');
  await assert.rejects(completar(p.router, { cadeia: ['estoura', 'bom'], messages: [], registro: reg }), (err) => {
    reg.fim(uso.resultadoDe(err), err.message);
    assert.equal(err.status, 429);
    assert.match(err.message, /Limite atingido/);
    assert.match(err.message, /120 pedidos por minuto do FreeLLMAPI/);
    assert.match(err.message, /renova às/);
    assert.doesNotMatch(err.message, /modelo local/); // não oferece o que não está disponível
    return true;
  });
  const hoje = uso.resumo('u1').hoje.online;
  assert.equal(hoje.limite, 1);
  assert.equal(hoje.chamadas, 1); // não tentou o próximo modelo: o limite é do roteador inteiro
  srv.close();
});

test('cancelado é diferente de falha; contas não se misturam', async () => {
  const { srv, uso } = await montar();
  const a = uso.iniciar('u1', 'forja'); a.chamada({ provedor: 'online', ok: true }); a.fim('cancelado');
  const b = uso.iniciar('u2', 'chat'); b.chamada({ provedor: 'online', ok: false }); b.fim('erro', 'x');
  assert.equal(uso.resumo('u1').hoje.online.cancelados, 1);
  assert.equal(uso.resumo('u1').hoje.online.falhas, 0);
  assert.equal(uso.resumo('u2').hoje.online.falhas, 1);
  uso.apagarDe('u1');
  assert.deepEqual(uso.resumo('u1').hoje, {});
  assert.equal(uso.resumo('u2').hoje.online.pedidos, 1);
  srv.close();
});

test('chamadas sem dono (títulos, memória) viram registro interno, fora da conta do usuário', async () => {
  const { srv, uso, p } = await montar();
  await p.router('/v1/chat/completions', { method: 'POST', body: JSON.stringify({ model: 'bom', messages: [] }) });
  await p.router('/health'); // não é chamada de IA: não conta
  assert.equal(uso.resumo('u1', { mostrarInternas: true }).internasHoje, 1);
  srv.close();
});
