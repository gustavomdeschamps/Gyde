// Página do projeto abre como site pronto? (o Ao vivo oferece "Site de HTML" ou "Site pronto em dist/" só quando abre)
// Reproduz os casos de um monorepo grande como o do Vue: páginas que precisam de build não contam como site pronto.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { problemaDaPagina } from '../previa.ts';

const pastas = [];
after(() => { for (const p of pastas) rmSync(p, { recursive: true, force: true }); });
function pagina(html, extras = {}) {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-previa-'));
  pastas.push(pasta);
  for (const [nome, conteudo] of Object.entries({ 'index.html': html, ...extras })) { mkdirSync(path.dirname(path.join(pasta, nome)), { recursive: true }); writeFileSync(path.join(pasta, nome), conteudo); }
  return problemaDaPagina(pasta, 'index.html');
}

test('site simples abre; ícone com "/" não atrapalha (só scripts e estilos contam)', () => {
  assert.equal(pagina('<link rel="stylesheet" href="estilo.css"><script src="app.js"></script>', { 'estilo.css': '', 'app.js': '' }), null);
  assert.equal(pagina('<link rel="icon" href="/favicon.ico"><h1>oi</h1>'), null);
});

test('páginas que precisam de build (como as do Vue) dizem por quê', () => {
  assert.match(pagina('<script type="module" src="/src/main.ts"></script>'), /carrega \/src\/main\.ts, que precisa ser compilado/);
  assert.match(pagina('<script type="module" src="./main.ts"></script>'), /carrega \.\/main\.ts, que precisa ser compilado/);
  assert.match(pagina('<script src="./dist/template-explorer.global.js"></script>'), /que ainda não existe/);
  assert.match(pagina('<script type="module">import { createApp } from "vue"; createApp({}).mount("#app")</script>'), /importa pacotes pelo nome/);
});

test('caminho começando com "/" é apontado (o Ao vivo serve com a raiz certa, então aceita esse caso)', () => {
  assert.match(pagina('<script src="/assets/app.js"></script>', { 'assets/app.js': '' }), /começa com "\/"/);
});
