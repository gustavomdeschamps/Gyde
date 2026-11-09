// Prévia ao vivo: acha a página que abre como site pronto, inclusive em subpastas e na saída do build, e quando
// nenhuma serve explica o limite e o que fazer (nunca fica muda). Reproduz o caso de um monorepo grande (como o do Vue).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { acharEntradaPrevia } from '../previa.ts';

function projeto(arquivos) {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-previa-'));
  for (const [nome, conteudo] of Object.entries(arquivos)) { mkdirSync(path.dirname(path.join(pasta, nome)), { recursive: true }); writeFileSync(path.join(pasta, nome), conteudo); }
  return pasta;
}
const comPasta = async (arquivos, f) => { const p = projeto(arquivos); try { await f(p); } finally { rmSync(p, { recursive: true, force: true }); } };

test('site simples na raiz abre direto', () => comPasta({ 'index.html': '<link rel="stylesheet" href="estilo.css"><script src="app.js"></script>', 'estilo.css': '', 'app.js': '' }, (p) => {
  assert.equal(acharEntradaPrevia(p).entrada, 'index.html');
}));

test('ícone com caminho "/" não impede a prévia (só scripts e estilos contam)', () => comPasta({ 'index.html': '<link rel="icon" href="/favicon.ico"><h1>oi</h1>' }, (p) => {
  assert.equal(acharEntradaPrevia(p).entrada, 'index.html');
}));

test('monorepo: página pronta numa subpasta é encontrada', () => comPasta({ 'package.json': '{}', 'packages/lib/src/a.ts': 'x', 'exemplos/demo/index.html': '<script src="./demo.js"></script>', 'exemplos/demo/demo.js': '' }, (p) => {
  assert.equal(acharEntradaPrevia(p).entrada, 'exemplos/demo/index.html');
}));

test('saída do build (dist/) é preferida a uma página que precisa compilar', () => comPasta({ 'index.html': '<script type="module" src="/src/main.ts"></script>', 'dist/index.html': '<script src="./assets/app.js"></script>', 'dist/assets/app.js': '' }, (p) => {
  assert.equal(acharEntradaPrevia(p).entrada, 'dist/index.html');
}));

test('projeto grande como o do Vue: páginas que precisam de build viram motivo claro, com o comando', () => comPasta({
  'package.json': JSON.stringify({ scripts: { build: 'node scripts/build.js' } }),
  'packages-private/sfc-playground/index.html': '<script type="module" src="/src/main.ts"></script>',
  'packages-private/template-explorer/index.html': '<script src="./dist/template-explorer.global.js"></script>',
  'packages-private/vite-debug/index.html': '<script type="module" src="./main.ts"></script>',
}, (p) => {
  const r = acharEntradaPrevia(p);
  assert.equal(r.entrada, null);
  assert.equal(r.candidatas.length, 3);
  assert.match(r.motivo, /Achei 3 página\(s\)/);
  assert.match(r.motivo, /sfc-playground\/index\.html: carrega \/src\/main\.ts, que precisa ser compilado/);
  assert.match(r.motivo, /template-explorer\.global\.js, que ainda não existe/);
  assert.match(r.motivo, /rode "npm run build"/);
}));

test('import de pacote pelo nome conta como "precisa de build"', () => comPasta({ 'index.html': '<script type="module">import { createApp } from "vue"; createApp({}).mount("#app")</script>' }, (p) => {
  const r = acharEntradaPrevia(p);
  assert.equal(r.entrada, null);
  assert.match(r.motivo, /importa pacotes pelo nome/);
}));

test('sem nenhuma página: diz onde procurou e que o projeto parece ser de outro tipo', () => comPasta({ 'main.py': 'print(1)' }, (p) => {
  const r = acharEntradaPrevia(p);
  assert.equal(r.entrada, null);
  assert.match(r.motivo, /não achei nenhuma página index\.html/);
  assert.match(r.motivo, /biblioteca, servidor ou aplicativo/);
}));
