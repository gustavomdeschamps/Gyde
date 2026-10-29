// Relatório de erro: caminhos sem o nome da pessoa, em qualquer sistema (C:\Users\..., /home/..., /Users/...),
// escritos como caminho comum ou como file:// (como aparecem nas pilhas de erro do Node).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { semCaminhosPessoais } from '../diagnostico.ts';

const RAIZ = path.join(import.meta.dirname, '..', '..', '..');

test('pasta do Gyde vira <gyde> e a pasta da pessoa vira ~, com caminho comum ou file://', () => {
  const arquivo = path.join(RAIZ, 'pacotes', 'servidor', 'chat.ts');
  const casa = path.join(os.homedir(), 'Documentos', 'projeto', 'app.js');
  for (const entrada of [arquivo, pathToFileURL(arquivo).href, `at f (${pathToFileURL(arquivo).href}:10:5)`]) {
    const saida = semCaminhosPessoais(entrada);
    assert.ok(saida.includes('<gyde>/pacotes/servidor/chat.ts'), `${entrada} -> ${saida}`);
    assert.ok(!saida.includes(os.homedir().replaceAll('\\', '/')) && !saida.includes(os.homedir()), saida);
  }
  for (const entrada of [casa, pathToFileURL(casa).href]) {
    const saida = semCaminhosPessoais(entrada);
    assert.ok(saida.startsWith('~/Documentos/projeto/app.js'), `${entrada} -> ${saida}`);
  }
  assert.equal(semCaminhosPessoais('nada de caminho aqui'), 'nada de caminho aqui');
});
