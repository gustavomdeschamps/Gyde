// O substituto do deepmerge (ferramentas/deepmerge-seguro) faz o mesmo que o original nos usos normais e não deixa
// __proto__, constructor nem prototype contaminarem os objetos (alerta GHSA-gcqx-w48m-w2h4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const deepmerge = createRequire(import.meta.url)(path.join(import.meta.dirname, '..', '..', '..', 'ferramentas', 'deepmerge-seguro', 'index.js'));

test('junta objetos como o deepmerge: aninhados, arrays, clone e opções', () => {
  const a = { x: 1, aninhado: { a: 1, lista: [1] }, data: new Date(0) };
  const b = { y: 2, aninhado: { b: 2, lista: [2] } };
  const r = deepmerge(a, b);
  assert.deepEqual(r, { x: 1, y: 2, aninhado: { a: 1, b: 2, lista: [1, 2] }, data: new Date(0) });
  assert.notEqual(r.aninhado, a.aninhado, 'clona em vez de reaproveitar');
  assert.equal(r.data, a.data, 'Date não é mesclável: passa como está');
  // como o vite-plugin-svelte usa: arrays substituídos
  assert.deepEqual(deepmerge({ l: [1, 2], k: { m: 1 } }, { l: [3] }, { arrayMerge: (alvo, origem) => origem ?? alvo }), { l: [3], k: { m: 1 } });
  assert.deepEqual(deepmerge([1], [2]), [1, 2]);
  assert.deepEqual(deepmerge({ a: 1 }, [2]), [2], 'tipos diferentes: fica a origem');
  assert.deepEqual(deepmerge.all([{ a: 1 }, { b: 2 }, { a: 3 }]), { a: 3, b: 2 });
  const custom = deepmerge({ n: { v: 1 } }, { n: { v: 2 } }, { customMerge: (k) => (k === 'n' ? (x, y) => ({ v: x.v + y.v }) : undefined) });
  assert.deepEqual(custom, { n: { v: 3 } });
  const semClone = { z: 1 };
  assert.equal(deepmerge({}, { o: semClone }, { clone: false }).o, semClone);
  const s = Symbol('s');
  assert.equal(deepmerge({}, { [s]: 1 })[s], 1, 'símbolos enumeráveis também');
});

test('não deixa __proto__, constructor nem prototype contaminarem', () => {
  const ataque = JSON.parse('{"__proto__": {"poluido": true}, "constructor": {"prototype": {"poluido2": true}}, "ok": 1}');
  const r = deepmerge({}, ataque);
  assert.equal(r.ok, 1);
  assert.equal(r.poluido, undefined);
  assert.equal({}.poluido, undefined);
  assert.equal({}.poluido2, undefined);
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
  assert.equal(deepmerge({ a: { b: 1 } }, JSON.parse('{"a": {"__proto__": {"x": 1}}}')).a.x, undefined);
});
