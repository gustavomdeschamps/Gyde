// Token das extensões: só conversar e o agente do navegador. Chaves, modo da IA, Forja e dados ficam com quem entrou no app.
// Sobe um servidor de verdade numa pasta temporária (sem internet e sem tocar nos dados reais).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';

const SERVIDOR = path.join(import.meta.dirname, '..', 'server.ts');
const portaLivre = () => new Promise((ok) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });
let aberto = null;
after(async () => { if (!aberto) return; aberto.proc.kill(); if (aberto.proc.exitCode === null) await new Promise((r) => aberto.proc.once('exit', r)); rmSync(aberto.pasta, { recursive: true, force: true }); });

test('token das extensões conversa, mas não mexe em chaves, configurações, Forja nem dados', async () => {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-token-'));
  const porta = await portaLivre();
  const proc = spawn(process.execPath, [SERVIDOR], {
    env: { ...process.env, DATA_DIR: pasta, PORT: String(porta), GYDE_DESKTOP: '1', GYDE_ENV_FILE: path.join(pasta, '.env'), FREELLMAPI_URL: 'http://127.0.0.1:1', OLLAMA_URL: 'http://127.0.0.1:1', FREELLMAPI_KEY: '' },
    stdio: 'ignore',
  });
  aberto = { proc, pasta };
  const base = `http://127.0.0.1:${porta}`;
  for (let i = 0; i < 100; i++) { try { await fetch(`${base}/api/auth/me`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  const pedir = (metodo, rota, corpo, extra = {}) => fetch(base + rota, { method: metodo, headers: { 'Content-Type': 'application/json', 'x-gyde': '1', ...extra }, ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }) });

  assert.equal((await pedir('POST', '/api/auth/register', { name: 'Ana', email: 'ana@t.test', password: 'senha12345' })).status, 201);
  const cookie = (await pedir('POST', '/api/auth/login', { email: 'ana@t.test', password: 'senha12345' })).headers.get('set-cookie').split(';')[0];
  const { token } = await (await pedir('POST', '/api/tokens', { name: 'VS Code' }, { Cookie: cookie })).json();
  assert.match(token, /^gyde_[0-9a-f]{48}$/);
  const comToken = { Authorization: `Bearer ${token}` };

  // o que as extensões usam continua funcionando
  assert.equal((await (await pedir('GET', '/api/auth/me', undefined, comToken)).json()).user.email, 'ana@t.test');
  const conv = await (await pedir('POST', '/api/conversations', {}, comToken)).json();
  assert.ok(conv.id, 'cria conversa');
  assert.equal((await pedir('GET', `/api/conversations/${conv.id}`, undefined, comToken)).status, 200);
  assert.equal((await pedir('GET', '/api/conversations', undefined, comToken)).status, 200);
  assert.notEqual((await pedir('POST', '/api/agente/passo', {}, comToken)).status, 403, 'agente do navegador (Chrome)');
  // as extensões mostram só as opções do Gyde (o modelo de verdade aparece embaixo de cada resposta)
  const modelos = await (await pedir('GET', '/api/models', undefined, comToken)).json();
  assert.deepEqual(modelos.brand.map((m) => m.id), ['gyde-1', 'gyde-1-pro']);
  assert.deepEqual(modelos.models, []);
  // sem IA conectada: a mensagem chega em português e manda abrir o Conectar IA (nada de erro técnico)
  const resposta = await (await pedir('POST', `/api/conversations/${conv.id}/messages`, { content: 'oi', mode: 'new', model: 'gyde-1-pro' }, comToken)).text();
  assert.match(resposta, /"type":"error"[^\n]*A IA ainda não está conectada[^\n]*Conectar IA/, resposta.slice(0, 300));
  // o cliente da extensão do VS Code: lista só as opções do Gyde e reconhece "IA não conectada" (para mostrar o aviso)
  const { createClient } = await import('../../extensao-vscode/cliente.js');
  const cliente = createClient({ server: base, token });
  assert.deepEqual((await cliente.modelos()).map((o) => o.label), ['Gyde 1', 'Gyde 1 Pro']);
  await assert.rejects(cliente.send(conv.id, 'oi', [], { modelo: 'gyde-1-pro' }), (e) => e.semIA === true && /Conectar IA/.test(e.message));
  assert.equal((await (await pedir('GET', `/api/conversations/${conv.id}`, undefined, comToken)).json()).model, 'gyde-1-pro', 'o modelo escolhido na extensão vai junto');

  // avisos ao abrir o painel: a versão do app e se a IA está conectada (rota /api/status, liberada ao token)
  const { avaliarStatus, appMaisAntigo } = await import('../../extensao-vscode/cliente.js');
  const status = await cliente.status();
  const versaoRaiz = JSON.parse(readFileSync(path.join(import.meta.dirname, '..', '..', '..', 'package.json'), 'utf8')).version;
  assert.equal(status.versao, versaoRaiz, 'o app informa a própria versão');
  assert.deepEqual(avaliarStatus(status, versaoRaiz), { semIA: true, versaoApp: versaoRaiz, appAntigo: false });
  assert.equal(avaliarStatus({ ...status, keyConfigured: true }, versaoRaiz).semIA, false);
  assert.equal(avaliarStatus({ ...status, iaAtiva: 'offline', offlineDisponivel: true }, versaoRaiz).semIA, false, 'modelo local conta como IA pronta');
  assert.equal(appMaisAntigo('2.1.0', '2.2.0'), true);
  assert.equal(appMaisAntigo('2.10.0', '2.9.1'), false);
  assert.equal(appMaisAntigo('2.2.0', '2.2.0'), false);
  assert.equal(appMaisAntigo('3.0', '2.9.9'), false);
  assert.equal(appMaisAntigo(undefined, '2.2.0'), true, 'app de antes da 2.2 não informa a versão: conta como mais antigo');

  // "Pedir à Forja" do VS Code: o token só GUARDA o pedido. Não cria conversa, não conecta pasta, não roda nada;
  // ler e apagar o rascunho é só do app (cookie)
  const projeto = mkdtempSync(path.join(tmpdir(), 'gyde-token-projeto-'));
  writeFileSync(path.join(projeto, 'soma.js'), 'export const soma = (a, b) => a - b;\n');
  try {
    await cliente.pedirForja(projeto, 'Procure bugs no arquivo soma.js e corrija os que encontrar.');
    const visto = await (await pedir('GET', '/api/forja/rascunho', undefined, { Cookie: cookie })).json();
    assert.equal(visto.rascunho.pedido, 'Procure bugs no arquivo soma.js e corrija os que encontrar.');
    assert.equal(visto.rascunho.origem, 'VS Code');
    assert.equal((await (await pedir('GET', '/api/codigo/sessoes', undefined, { Cookie: cookie })).json()).sessoes.length, 0, 'nenhuma conversa da Forja foi criada');
    assert.equal(readFileSync(path.join(projeto, 'soma.js'), 'utf8'), 'export const soma = (a, b) => a - b;\n', 'nada no projeto mudou');
    // mesma regra de pasta da Forja: nada de pasta do usuário, do sistema ou dos dados do Gyde; pedido vazio ou enorme não passa
    for (const [corpoRuim, motivo] of [[{ pasta: homedir(), pedido: 'x' }, 'pasta do usuário'], [{ pasta: pasta, pedido: 'x' }, 'pasta de dados do Gyde'],
      [{ pasta: path.join(projeto, 'nao-existe'), pedido: 'x' }, 'pasta inexistente'], [{ pasta: projeto, pedido: '  ' }, 'pedido vazio'], [{ pasta: projeto, pedido: 'x'.repeat(4001) }, 'pedido grande']]) {
      assert.equal((await pedir('POST', '/api/forja/rascunho', corpoRuim, comToken)).status, 400, motivo);
    }
    // o token não lê nem apaga o rascunho, e continua sem acesso ao resto da Forja
    for (const [metodo, rota, corpo] of [['GET', '/api/forja/rascunho'], ['DELETE', '/api/forja/rascunho'], ['POST', '/api/codigo/sessoes', { pasta: projeto }],
      ['POST', '/api/forja/rascunho/abrir', {}], ['PUT', '/api/forja/rascunho', { pasta: projeto, pedido: 'x' }]]) {
      assert.equal((await pedir(metodo, rota, corpo, comToken)).status, 403, `${metodo} ${rota} deveria recusar o token`);
    }
    assert.equal((await pedir('DELETE', '/api/forja/rascunho', undefined, { Cookie: cookie })).status, 200);
    assert.equal((await (await pedir('GET', '/api/forja/rascunho', undefined, { Cookie: cookie })).json()).rascunho, null);
  } finally { rmSync(projeto, { recursive: true, force: true }); }

  // o que não é delas fica fechado, mesmo com o token certo
  const fechadas = [
    ['PUT', '/api/config/chave-freellmapi', { chave: 'freellmapi-trocadaporfora123' }],
    ['PUT', '/api/config/imagens', { conta: 'a'.repeat(32), token: 'b'.repeat(40) }],
    ['DELETE', '/api/config/imagens'],
    ['POST', '/api/uso/modo', { modo: 'offline' }],
    ['PUT', '/api/ia/preferencias', { modo: 'capricho' }],
    ['GET', '/api/ia/preferencias'],
    ['GET', '/api/dados/copia'],
    ['POST', '/api/dados/restaurar', {}],
    ['GET', '/api/diagnostico'],
    ['POST', '/api/codigo/sessoes', { pasta: pasta }],
    ['GET', '/api/codigo/sessoes'],
    ['PUT', '/api/settings', { about_user: 'x' }],
    ['GET', '/api/memoria'],
    ['DELETE', '/api/conversations'],
    ['DELETE', `/api/conversations/${conv.id}`],
    ['DELETE', '/api/uso'],
    ['POST', '/api/skills/custom', { nome: 'x' }],
    ['GET', '/api/tokens'],
    ['POST', '/api/tokens', { name: 'outro' }],
  ];
  for (const [metodo, rota, corpo] of fechadas) {
    const r = await pedir(metodo, rota, corpo, comToken);
    assert.equal(r.status, 403, `${metodo} ${rota} deveria recusar o token (veio ${r.status})`);
  }
  const env = path.join(pasta, '.env');
  assert.ok(!existsSync(env) || !readFileSync(env, 'utf8').includes('trocadaporfora'), 'a chave não foi trocada');

  // token na query ou com variação no caminho não passa
  assert.equal((await pedir('GET', '/api/conversations/../config', undefined, comToken)).status === 200, false);
  assert.equal((await pedir('PUT', '/api/ia/preferencias?x=/api/conversations', { modo: 'rapido' }, comToken)).status, 403);

  // quem entrou no app continua podendo tudo
  assert.equal((await pedir('PUT', '/api/ia/preferencias', { modo: 'capricho' }, { Cookie: cookie })).status, 200);
  assert.equal((await pedir('GET', '/api/memoria', undefined, { Cookie: cookie })).status, 200);
});
