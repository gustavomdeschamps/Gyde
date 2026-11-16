// Edição por trecho com conserto: trecho com espaços ou recuo diferentes ainda acha o lugar certo (se for único), mantém o
// recuo do arquivo e não mexe no resto; sem lugar único, explica e mostra as linhas mais parecidas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consertarTrecho } from '../codigo-agente.ts';

const ARQ = 'function soma(a, b) {\n    // soma dois números\n    return a - b;\n}\n\nfunction dobro(n) {\n    return n * 2;\n}\n';

test('recuo diferente: acha o único lugar e mantém o recuo do arquivo', () => {
  const r = consertarTrecho(ARQ, '  return a - b;', '  return a + b;');
  assert.equal(r.texto, ARQ.replace('return a - b;', 'return a + b;'));
});

test('várias linhas com espaços sobrando nas pontas e linhas em branco em volta', () => {
  const r = consertarTrecho(ARQ, '\n// soma dois números   \nreturn a - b;\n\n', '// soma dois números\nconst total = a + b;\nreturn total;');
  assert.equal(r.texto, ARQ.replace('    // soma dois números\n    return a - b;', '    // soma dois números\n    const total = a + b;\n    return total;'));
});

test('arquivo com CRLF continua com CRLF', () => {
  const crlf = ARQ.replace(/\n/g, '\r\n');
  const r = consertarTrecho(crlf, 'return a - b;', 'return a + b;');
  assert.equal(r.texto, crlf.replace('return a - b;', 'return a + b;'));
  assert.ok(!/[^\r]\n/.test(r.texto), 'sem LF solto');
});

test('trecho que aparece mais de uma vez (ignorando espaços) não é trocado', () => {
  const r = consertarTrecho('a();\n  a();\n', 'a();', 'b();');
  assert.match(r.dica, /aparece 2 vezes/);
});

test('trecho que não existe: devolve as linhas mais parecidas, com número', () => {
  const r = consertarTrecho(ARQ, 'return n * 3;', 'return n * 4;');
  assert.match(r.dica, /mais parecido/);
  assert.match(r.dica, /7 \|\s+return n \* 2;/);
});

test('substituir vazio apaga só as linhas do trecho', () => {
  const r = consertarTrecho(ARQ, '// soma dois números', '');
  assert.equal(r.texto, ARQ.replace('    // soma dois números\n', ''));
});
