// Ruas de dependência e saúde do projeto: quem importa quem (JS/TS, Python, CSS, HTML) e o que a saúde conta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { citacoes, resolver, ruasDaCidade, saudeDoProjeto } from '../ruas.ts';
import { apagarSeguro } from '../../../ferramentas/limpeza-segura.mjs';

test('citações: só caminhos do projeto, sem pacotes de fora nem comentários', () => {
  const js = `import a from './a.js';\nimport { b } from "../lib/b";\nconst c = require('./c');\nexport * from './d';\nimport('./e.js');\nimport express from 'express';\n// import x from './comentado';\n/* require('./tambem') */`;
  assert.deepEqual(citacoes('src/app.js', js), ['src/a.js', 'lib/b', 'src/c', 'src/d', 'src/e.js']);
  assert.deepEqual(citacoes('pkg/mod.py', 'import os\nfrom . import util\nfrom .dados import ler\nfrom pkg.outro import x'), ['py:os', 'pyrel:pkg', 'pyrel:pkg/util', 'pyrel:pkg/dados', 'py:pkg.outro']);
  assert.deepEqual(citacoes('ext/package.json', '{"main": "extension.js", "scripts": {"pack": "node empacotar.mjs"}, "x": "https://a.b/c.js"}'), ['ext/extension.js', 'ext/empacotar.mjs']);
  assert.deepEqual(citacoes('manifest.json', '{"background": {"service_worker": "background.js"}}'), ['background.js']);
  assert.deepEqual(citacoes('estilo.css', "@import 'base.css';\n@import url(\"https://fonts.x/y.css\");"), ['base.css']);
  assert.deepEqual(citacoes('site/index.html', '<link href="estilo.css"><script src="/js/app.js"></script><a href="https://x.com">x</a><img src="data:image/png;base64,x">'), ['site/estilo.css', 'js/app.js']);
});

test('resolver: extensões, index e módulos Python', () => {
  const existe = new Set(['src/a.ts', 'lib/b/index.js', 'pkg/util.py', 'pkg/outro/__init__.py']);
  assert.equal(resolver('src/a', existe, 'src/app.js'), 'src/a.ts');
  assert.equal(resolver('lib/b', existe, 'src/app.js'), 'lib/b/index.js');
  assert.equal(resolver('pyrel:pkg/util', existe, 'pkg/mod.py'), 'pkg/util.py');
  assert.equal(resolver('py:pkg.outro', existe, 'pkg/mod.py'), 'pkg/outro/__init__.py');
  assert.equal(resolver('py:os', existe, 'pkg/mod.py'), null, 'biblioteca do Python não vira rua');
  assert.equal(resolver('../fora', existe, 'x.js'), null);
});

test('ruas de uma pasta de verdade e a saúde: ciclo, sem uso, grande, testes', async () => {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-ruas-'));
  try {
    mkdirSync(path.join(pasta, 'src')); mkdirSync(path.join(pasta, 'testes'));
    const arquivos = {
      'src/index.js': "import { a } from './a.js';\n",
      'src/a.js': "import { b } from './b.js';\nexport const a = 1;\n",
      'src/b.js': "import { a } from './a.js';\nexport const b = 2;\n", // ciclo a <-> b
      'src/esquecido.js': 'export const nada = 0;\n',
      'testes/a.test.js': "import { a } from '../src/a.js';\n",
    };
    for (const [f, t] of Object.entries(arquivos)) writeFileSync(path.join(pasta, f), t);
    const lista = Object.keys(arquivos).sort().map((caminho) => ({ caminho, bytes: 100, binario: false, linhas: caminho === 'src/b.js' ? 900 : 3, mudancas: caminho === 'src/a.js' ? 4 : 0 }));
    const { ruas, cortadas } = await ruasDaCidade(pasta, lista);
    const nomes = ruas.map(([de, para]) => `${lista[de].caminho}>${lista[para].caminho}`).sort();
    assert.deepEqual(nomes, ['src/a.js>src/b.js', 'src/b.js>src/a.js', 'src/index.js>src/a.js', 'testes/a.test.js>src/a.js']);
    assert.equal(cortadas, 0);
    const s = saudeDoProjeto(lista, ruas);
    assert.equal(s.arquivosDeCodigo, 5);
    assert.equal(s.arquivosDeTeste, 1);
    assert.deepEqual(s.ciclos.map((c) => [...c].sort()), [['src/a.js', 'src/b.js']]);
    assert.deepEqual(s.semUso.exemplos, ['src/esquecido.js'], 'index é entrada, teste não conta; só o esquecido fica');
    assert.deepEqual(s.grandes, [{ caminho: 'src/b.js', linhas: 900 }]);
    assert.equal(saudeDoProjeto([{ caminho: 'vendor/lib.js', linhas: 3000, binario: false, mudancas: 0 }, { caminho: 'a.min.js', linhas: 900, binario: false, mudancas: 0 }], []).grandes.length, 0, 'código de terceiros não entra');
    assert.deepEqual(s.maisAlterados, [{ caminho: 'src/a.js', mudancas: 4 }]);
    const limitado = await ruasDaCidade(pasta, lista, 2);
    assert.equal(limitado.ruas.length, 2); assert.equal(limitado.cortadas, 2);
  } finally { apagarSeguro(pasta); }
});
