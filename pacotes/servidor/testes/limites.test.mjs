// Limite de tentativas de login: vale entre reinícios do servidor e não guarda e-mail nem IP no banco.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { migrar } from '../banco.ts';
import { makeLimiter } from '../auth.ts';

test('o limite continua valendo depois de "reiniciar" e o banco só tem hashes', () => {
  const db = new DatabaseSync(':memory:');
  migrar(db);
  const antes = makeLimiter(db, 3, 60_000);
  assert.deepEqual([1, 2, 3].map(() => antes('login:ana@t.test')), [true, true, true]);
  assert.equal(antes('login:ana@t.test'), false, 'a quarta tentativa é barrada');
  const depois = makeLimiter(db, 3, 60_000); // o servidor reabriu: limitador novo, mesmo banco
  assert.equal(depois('login:ana@t.test'), false, 'continua barrada depois de reiniciar');
  assert.equal(depois('login:bia@t.test'), true, 'outra conta não é afetada');
  const guardado = db.prepare('SELECT chave FROM tentativas').all().map((r) => r.chave).join(' ');
  assert.doesNotMatch(guardado, /ana|bia|t\.test/);
  assert.match(guardado, /^[0-9a-f]{64}( [0-9a-f]{64})*$/);
});

test('limites diferentes não se misturam e a janela expira', () => {
  const db = new DatabaseSync(':memory:');
  migrar(db);
  const curto = makeLimiter(db, 1, 1);
  const longo = makeLimiter(db, 1, 60_000);
  assert.equal(longo('x'), true);
  assert.equal(curto('x'), true, 'o limite curto não conta as tentativas do longo');
  const espera = Date.now() + 5; while (Date.now() < espera) { /* deixa a janela de 1 ms passar */ }
  assert.equal(curto('x'), true, 'janela expirada libera');
});
