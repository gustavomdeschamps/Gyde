// Regras do Diagnóstico: o que conta como problema e o que a tela manda fazer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemEspaco, itemIA } from '../verificacoes.ts';

const MB = 1024 * 1024;
test('espaço em disco: erro abaixo de 200 MB, aviso abaixo de 1 GB', () => {
  assert.equal(itemEspaco(100 * MB).estado, 'erro');
  assert.equal(itemEspaco(500 * MB).estado, 'aviso');
  assert.equal(itemEspaco(5 * 1024 * MB).estado, 'ok');
  assert.match(itemEspaco(5 * 1024 * MB).detalhe, /5,0 GB livres/);
  assert.equal(itemEspaco(null).estado, 'aviso', 'sem medida: avisa, não inventa');
});

test('IA: sem chave, com chave sem resposta e respondendo', () => {
  assert.match(itemIA({ ok: false }, false).acao, /Conectar IA/);
  assert.match(itemIA({ ok: false, erro: 'tempo esgotado' }, true).detalhe, /tempo esgotado/);
  const ok = itemIA({ ok: true, modelo: 'groq:modelo', ms: 1234 }, true);
  assert.equal(ok.estado, 'ok');
  assert.match(ok.detalhe, /1,2 s \(groq:modelo\)/);
});
