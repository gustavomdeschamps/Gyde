// As conferências da medição por resultado (ferramentas/tarefas-resultado.mjs) medem o resultado e não o formato:
// a resposta de referência tira 1 e uma resposta vazia tira 0. Aqui ficam as que rodam em qualquer sistema sem navegador,
// Python ou PowerShell; a lista completa é conferida por ferramentas/conferir-tarefas-resultado.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAREFAS } from '../../../ferramentas/tarefas-resultado.mjs';
import { REFERENCIAS } from '../../../ferramentas/referencias-resultado.mjs';

const SO_EM_BLOCO = new Set(['workflow-testes', 'api-tarefas', 'testes-cupom']);
const PRECISAM_DE_FORA = new Set(['ps-maiores', 'organizar-fotos', 'pagina-contato', 'pagina-galeria', 'pagina-curso', 'cartoes-quatro', 'jsdoc-tipos']);

test('tarefas de resultado: referência tira 1, resposta vazia tira 0', { timeout: 240_000 }, async () => {
  assert.ok(TAREFAS.length >= 35, 'conjunto separado com pelo menos 35 tarefas');
  for (const t of TAREFAS.filter((x) => !PRECISAM_DE_FORA.has(x.id))) {
    assert.equal(await t.verificar(REFERENCIAS[t.id]), 1, `${t.id}: a referência deveria tirar 1`);
    assert.equal(await t.verificar('Não sei.'), 0, `${t.id}: a resposta vazia deveria tirar 0`);
    if (SO_EM_BLOCO.has(t.id)) continue;
    // a nota não depende do formato: sem bloco de código, ou com o código de uma linha dentro da linha, também tira 1
    assert.equal(await t.verificar(REFERENCIAS[t.id].replace(/```[\w-]*\n?/g, '')), 1, `${t.id}: sem bloco de código`);
    assert.equal(await t.verificar(REFERENCIAS[t.id].replace(/```[\w-]*\n([^\n]+)\n```/g, 'Use `$1` para isso.')), 1, `${t.id}: código na linha`);
  }
});
