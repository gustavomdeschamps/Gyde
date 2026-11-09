// Planta da Cidade 3D: cada arquivo vira um prédio dentro da quadra do seu bairro, sem prédios encostados
// ou fora da quadra, e com altura limitada (um arquivo gigante não esconde o resto).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarPlanta, alturaDe } from '../src/forja/cidade3d.ts';
import { calorDe, bairroDe } from '../src/forja/cidade-comum.ts';

const predio = (caminho, linhas = 10, mudancas = 0) => ({ caminho, linhas, bytes: linhas * 30, binario: false, mudancas, ultima: null });

test('cada arquivo vira um prédio dentro da quadra do seu bairro, sem sobreposição', () => {
  const arquivos = [];
  for (let i = 0; i < 37; i++) arquivos.push(predio(`src/a${i}.js`));
  for (let i = 0; i < 5; i++) arquivos.push(predio(`docs/d${i}.md`));
  arquivos.push(predio('README.md'));
  const planta = montarPlanta(arquivos);
  assert.equal(planta.predios.length, arquivos.length);
  assert.deepEqual(planta.quadras.map((q) => q.nome).sort(), ['', 'docs', 'src']);
  for (const b of planta.predios) {
    const q = planta.quadras.find((x) => x.nome === bairroDe(b.p.caminho));
    assert.ok(b.x - 0.5 >= q.x && b.x + 0.5 <= q.x + q.largura && b.z - 0.5 >= q.z && b.z + 0.5 <= q.z + q.fundo, `${b.p.caminho} fora da quadra`);
  }
  const pos = new Set(planta.predios.map((b) => `${b.x.toFixed(2)},${b.z.toFixed(2)}`));
  assert.equal(pos.size, planta.predios.length, 'dois prédios no mesmo lugar');
  // quadras não se encostam
  for (const a of planta.quadras) for (const b of planta.quadras) {
    if (a === b) continue;
    const separadas = a.x + a.largura <= b.x || b.x + b.largura <= a.x || a.z + a.fundo <= b.z || b.z + b.fundo <= a.z;
    assert.ok(separadas, `quadras ${a.nome} e ${b.nome} se sobrepõem`);
  }
});

test('altura cresce com o tamanho, com teto; cor vai de 0 (nunca mudou) a 1 (o mais alterado)', () => {
  assert.ok(alturaDe(predio('a', 10)) < alturaDe(predio('b', 400)));
  assert.ok(alturaDe(predio('c', 1_000_000)) <= 12.3);
  assert.equal(calorDe(0, 16), 0);
  assert.equal(calorDe(16, 16), 1);
  assert.equal(calorDe(4, 16), 0.25);
});
