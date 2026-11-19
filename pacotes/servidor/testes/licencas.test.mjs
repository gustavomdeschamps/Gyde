// Os pacotes que vão dentro do app têm licença que permite distribuir junto e estão creditados em
// LICENCAS-DE-TERCEIROS.md (ferramentas/licencas.mjs). Falha se entrar um pacote novo sem atualizar a lista.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { licencaPermitida } from '../../../ferramentas/licencas.mjs';

test('licenças: expressões com OR e AND', () => {
  assert.ok(licencaPermitida('MIT'));
  assert.ok(licencaPermitida('(MPL-2.0 OR Apache-2.0)'));
  assert.ok(licencaPermitida('GPL-3.0 OR MIT'), 'basta uma opção permitida');
  assert.ok(!licencaPermitida('GPL-3.0'));
  assert.ok(!licencaPermitida('MIT AND AGPL-3.0'));
  assert.ok(!licencaPermitida('sem licença declarada'));
});

test('licenças: a lista de LICENCAS-DE-TERCEIROS.md está em dia e sem licença proibida', () => {
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, '..', '..', '..', 'ferramentas', 'licencas.mjs'), '--conferir'], { encoding: 'utf8', timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
});
