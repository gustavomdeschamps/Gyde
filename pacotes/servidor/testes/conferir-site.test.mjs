// Conferência de site sem navegador: contraste, lang, alt e viewport.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conferirSite, contraste, corDe } from '../conferir-site.ts';

test('contraste pela fórmula da WCAG', () => {
  assert.equal(contraste([0, 0, 0], [255, 255, 255]).toFixed(0), '21');
  assert.ok(contraste(corDe('#999'), corDe('#fff')) < 4.5);
  assert.ok(contraste(corDe('#595959'), corDe('white')) >= 4.5);
  assert.deepEqual(corDe('rgb(10, 20, 30)'), [10, 20, 30]);
  assert.equal(corDe('rgba(0,0,0,0.5)'), null, 'semitransparente: o fundo real é outro');
  assert.deepEqual(corDe('var(--texto)', { '--texto': '#123456' }), [0x12, 0x34, 0x56]);
});

test('acha os problemas do site feio e nenhum no site arrumado', () => {
  const feio = conferirSite({
    'index.html': '<html><head><title>x</title></head><body><img src="a.png"><p class="p">oi</p></body></html>',
    'estilo.css': 'body { background: #ffffff; color: #999999; } .p { color: #dddddd; } .topo { background: #ffff00; color: #ffffff; }',
  }).map((p) => p.problema).join('\n');
  assert.match(feio, /falta lang/);
  assert.match(feio, /meta name="viewport"/);
  assert.match(feio, /1 <img> sem alt/);
  assert.match(feio, /contraste .* em "body"/);
  assert.match(feio, /contraste .* em "\.p"/);
  assert.match(feio, /contraste .* em "\.topo" .*fundo da própria regra/);
  const bom = conferirSite({
    'index.html': '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>:root { --t: #2b2118; }</style></head><body><img src="a.png" alt=""></body></html>',
    'estilo.css': ':root { --fundo: #fbf7f2; } body { background: var(--fundo); color: var(--t); } a { color: #8a4b12; } @media (max-width: 600px) { .x { color: #333; } }',
  });
  assert.deepEqual(bom, []);
});

test('casos vistos na medição: variável redefinida no tema escuro, degradê e fundo do elemento em volta', () => {
  const css = `:root { --primaria: #b87333; --fundo: #faf8f5; --claro: #ffffff; }
body { background: var(--fundo); color: #2d2d2d; }
.servico { background: var(--claro); }
.servico h2 { color: var(--primaria); }
.topo { background: linear-gradient(135deg, var(--primaria) 0%, #965d28 100%); color: #fff; }
.rodape { background: #2d2d2d; }
.rodape a { color: #e6c28f; }
@media (prefers-color-scheme: dark) { :root { --primaria: #f0b27a; --fundo: #1a1a1a; } .x { color: #333; } }
[data-theme="dark"] .y { color: #444; }`;
  const p = conferirSite({ 'estilo.css': css }).map((x) => x.problema).join('\n');
  assert.match(p, /3\.\d:1 em "\.servico h2" .*fundo do elemento em volta/, 'usa a cor do tema claro, não a do escuro');
  assert.match(p, /em "\.topo" .*fundo da própria regra/, 'texto branco sobre a cor mais clara do degradê');
  assert.doesNotMatch(p, /\.rodape a/, 'link claro sobre o fundo escuro do rodapé está certo');
  assert.doesNotMatch(p, /"\.x"|\.y/, 'regras do tema escuro ficam de fora');
});
