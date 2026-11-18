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
