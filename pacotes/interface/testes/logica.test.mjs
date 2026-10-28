// Lógica da interface que não depende da tela: eventos do chat, valores do Python, voz, cliente da API e o pacote de
// projeto que vai para a IA (sem segredos nem dependências).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { z } from 'zod';

// módulos da interface esperam um navegador: o mínimo que eles tocam ao serem importados
globalThis.window ??= globalThis;
const { lerEventos } = await import('../src/chat/sse.ts');
const { mostrar } = await import('../src/pratica/icones.ts');
const { escaparHtml } = await import('../src/util.ts');
const { textoParaFala } = await import('../src/voz.ts');
const { pedir, ErroContrato, mensagemDe } = await import('../src/api.ts');
const { projectFromZip } = await import('../src/projeto.ts');

test('eventos do chat: junta pedaços cortados no meio e guarda o resto para a próxima leitura', () => {
  const tudo = 'data: {"type":"delta","text":"Olá"}\n\ndata: {"type":"delta","text":" mundo"}\n\n: comentário do servidor\n\ndata: {"type":"done"}\n\n';
  const eventos = [];
  let resto = '';
  for (let i = 0; i < tudo.length; i += 7) { // chega de 7 em 7 caracteres
    const r = lerEventos(resto + tudo.slice(i, i + 7));
    eventos.push(...r.eventos);
    resto = r.resto;
  }
  assert.deepEqual(eventos.map((e) => e.type), ['delta', 'delta', 'done']);
  assert.equal(eventos.map((e) => e.text ?? '').join(''), 'Olá mundo');
  assert.equal(resto, '');
  assert.deepEqual(lerEventos('data: {"type":"delt').eventos, [], 'evento incompleto espera o resto');
  assert.deepEqual(lerEventos('data: {quebrado}\n\ndata: {"type":"ok"}\n\n').eventos, [{ type: 'ok' }], 'evento quebrado é ignorado, os outros seguem');
});

test('valores no jeito do Python, sem estragar textos', () => {
  assert.equal(mostrar(true, 'python'), 'True');
  assert.equal(mostrar(false, 'python'), 'False');
  assert.equal(mostrar(null, 'python'), 'None');
  assert.equal(mostrar([1, true, null, 'a'], 'python'), '[1, True, None, "a"]');
  assert.equal(mostrar({ ok: false }, 'python'), '{"ok": False}');
  assert.equal(mostrar('isso é true ou null', 'python'), '"isso é true ou null"', 'texto com as palavras fica igual');
  assert.equal(mostrar(true, 'javascript'), 'true');
  assert.equal(mostrar([1, 2], 'javascript'), '[1,2]');
  assert.equal(mostrar('__undefined__', 'javascript'), 'undefined');
});

test('escapar HTML', () => {
  assert.equal(escaparHtml(`<img src=x onerror="a('b')">`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;');
});

test('texto para fala: não lê código, links nem marcações do markdown', () => {
  const t = textoParaFala('# Título\nVeja o `print()` e [este link](https://x.com).\n```py\nprint(1)\n```\n**fim**');
  assert.match(t, /tem um bloco de código aqui na tela/);
  assert.doesNotMatch(t, /https|```|\*\*|#/);
  assert.match(t, /este link/);
});

test('cliente da API: confere o contrato e explica os erros', async () => {
  const Esquema = z.object({ nome: z.string() });
  const responder = (corpo, status = 200) => { globalThis.fetch = async (_url, init) => { responder.cabecalhos = init.headers; return new Response(JSON.stringify(corpo), { status }); }; };
  responder({ nome: 'Gyde' });
  assert.deepEqual(await pedir('/api/x', Esquema), { nome: 'Gyde' });
  assert.equal(responder.cabecalhos['x-gyde'], '1', 'manda o cabeçalho anti-CSRF');

  responder({ nome: 42 });
  const erroOriginal = console.error; console.error = () => {};
  await assert.rejects(pedir('/api/x', Esquema), (e) => e instanceof ErroContrato && /formato diferente/.test(e.message));
  console.error = erroOriginal;

  responder({ error: 'Explicação do servidor.' }, 400);
  await assert.rejects(pedir('/api/x', Esquema), /Explicação do servidor\./);
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(pedir('/api/x', Esquema), (e) => /Sem conexão com o servidor do Gyde/.test(mensagemDe(e)));
});

test('projeto .zip para a IA: sem .env, chaves, dependências nem lock; README primeiro', async () => {
  const zip = zipSync({
    'meu-app/README.md': strToU8('# Meu app'),
    'meu-app/src/index.js': strToU8('console.log(1)'),
    'meu-app/.env': strToU8('SENHA=nao-pode-ir'),
    'meu-app/chave.pem': strToU8('-----BEGIN-----'),
    'meu-app/node_modules/lib/index.js': strToU8('lixo'),
    'meu-app/package-lock.json': strToU8('{}'),
    'meu-app/imagem.png': new Uint8Array([137, 80, 78, 71]),
  });
  const r = await projectFromZip(new File([zip], 'meu-app.zip'));
  assert.match(r.text, /===== README\.md =====[\s\S]*===== src\/index\.js =====/, 'README vem antes');
  assert.doesNotMatch(r.text, /nao-pode-ir|BEGIN|lixo|package-lock/);
  assert.match(r.name, /Projeto: meu-app \(2 de 2 arquivos\)/);
});
