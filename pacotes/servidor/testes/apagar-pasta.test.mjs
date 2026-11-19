// O app só apaga pastas que ele mesmo criou: filha direta de uma base conhecida, com nome do padrão, sem seguir atalhos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { apagarPastaDoGyde, motivoParaNaoApagar } from '../apagar-pasta.ts';
import { apagarSeguro } from '../../../ferramentas/limpeza-segura.mjs';

test('apaga só a subpasta do padrão, dentro da base, e nunca o destino de uma junction', () => {
  const raiz = mkdtempSync(path.join(tmpdir(), 'gyde-apagar-pasta-'));
  try {
    const base = path.join(raiz, 'dados'), fora = path.join(raiz, 'projeto-da-pessoa');
    mkdirSync(base); mkdirSync(fora);
    writeFileSync(path.join(fora, 'importante.txt'), 'não pode sumir');
    const alvo = path.join(base, 'restaurar-pendente');
    mkdirSync(path.join(alvo, 'images'), { recursive: true });
    writeFileSync(path.join(alvo, 'chat.db'), 'x');
    symlinkSync(fora, path.join(alvo, 'atalho'), 'junction'); // atalho para fora dentro do que vai ser apagado
    const nome = /^restaurar-pendente$/;
    assert.match(motivoParaNaoApagar(base, raiz, /^dados$/) ?? '', /^$/, 'filha direta com nome certo pode');
    assert.ok(motivoParaNaoApagar(base, base, nome), 'a própria base não');
    assert.ok(motivoParaNaoApagar(path.join(base, 'outra'), base, nome), 'nome fora do padrão não');
    assert.ok(motivoParaNaoApagar(path.join(alvo, 'images'), base, /^images$/), 'neta da base não');
    assert.ok(motivoParaNaoApagar(path.join(base, '..', 'projeto-da-pessoa'), base, /.*/), 'fora da base não');
    assert.throws(() => apagarPastaDoGyde(fora, base, /.*/), /Não apaguei/);
    assert.equal(apagarPastaDoGyde(alvo, base, nome), true);
    assert.ok(!existsSync(alvo));
    assert.ok(existsSync(path.join(fora, 'importante.txt')), 'o destino da junction ficou intacto');
    assert.equal(apagarPastaDoGyde(alvo, base, nome), false, 'já não existe: nada a fazer');
  } finally { apagarSeguro(raiz); }
});
