// Menu do campo da Forja: "/" mostra os comandos, "@" mostra os arquivos, e escolher troca só o pedaço digitado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuDoCampo, escolher } from '../src/forja/menu-campo.ts';

const ARQ = ['README.md', 'src/app.js', 'src/util/app-helper.js', 'testes/app.test.js', 'package.json'];

test('"/" no começo lista os comandos e filtra pelo que foi digitado', () => {
  assert.ok(menuDoCampo('/', 1, ARQ).itens.length >= 5);
  assert.deepEqual(menuDoCampo('/te', 3, ARQ).itens.map((i) => i.rotulo), ['/testes']);
  assert.equal(menuDoCampo('rode /testes', 12, ARQ), null, '"/" no meio do texto não abre o menu');
  assert.equal(menuDoCampo('/xyz', 4, ARQ), null);
});

test('"@" lista arquivos: primeiro os que começam pelo nome digitado', () => {
  const m = menuDoCampo('corrija @app', 12, ARQ);
  assert.equal(m.tipo, 'arquivo');
  assert.equal(m.itens[0].descricao, 'src/app.js');
  assert.ok(m.itens.some((i) => i.descricao === 'testes/app.test.js'));
  assert.equal(menuDoCampo('mande para ana@exe', 18, ARQ), null, 'e-mail não abre o menu');
});

test('escolher troca só o trecho digitado e põe o cursor depois', () => {
  const texto = 'corrija @app e rode';
  const m = menuDoCampo(texto, 12, ARQ);
  const r = escolher(texto, m, m.itens[0]);
  assert.equal(r.texto, 'corrija @src/app.js  e rode');
  assert.equal(r.texto.slice(0, r.cursor), 'corrija @src/app.js ');
  const c = menuDoCampo('/cor', 4, ARQ);
  assert.match(escolher('/cor', c, c.itens[0]).texto, /^Rode os testes, ache o que está falhando/);
});
