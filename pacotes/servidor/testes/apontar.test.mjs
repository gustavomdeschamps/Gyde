// "Mostrar o erro": só aceita respostas do modelo com região dentro da imagem; o resto troca de modelo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerApontamento } from '../apontar.ts';
import { Apontamento } from '../../compartilhado/contratos.ts';

test('resposta válida vira região em porcentagem, cortada na borda', () => {
  const r = lerApontamento('Aqui está:\n```json\n{"achou": true, "x": 10, "y": 40.5, "largura": 50, "altura": 8, "explicacao": "A linha 3 usa uma variável que não existe."}\n```');
  assert.deepEqual(r.regiao, { x: 10, y: 40.5, largura: 50, altura: 8 });
  assert.ok(Apontamento.safeParse({ ...r, modelo: 'm' }).success);
  // arredondamento do modelo passa um pouco da borda: corta
  assert.deepEqual(lerApontamento('{"achou": true, "x": 80, "y": 95, "largura": 21, "altura": 6, "explicacao": "ok"}').regiao, { x: 80, y: 95, largura: 20, altura: 5 });
});

test('sem erro no print: sem região, com explicação', () => {
  const r = lerApontamento('{"achou": false, "explicacao": "Não vi nenhum erro neste print."}');
  assert.equal(r.achou, false); assert.equal(r.regiao, null);
  assert.ok(Apontamento.safeParse({ ...r, modelo: 'm' }).success);
});

test('formato inválido é recusado (o próximo modelo tenta)', () => {
  for (const t of [
    'Não consigo ver a imagem.',
    '{"achou": true, "x": 10, "y": 10, "explicacao": "faltou o tamanho"}',
    '{"achou": true, "x": -5, "y": 10, "largura": 10, "altura": 10, "explicacao": "negativo"}',
    '{"achou": true, "x": 10, "y": 10, "largura": 150, "altura": 10, "explicacao": "fora"}',
    '{"achou": true, "x": 10, "y": 10, "largura": 0, "altura": 10, "explicacao": "vazia"}',
    '{"achou": true, "x": "10", "y": 10, "largura": 10, "altura": 10, "explicacao": "texto"}',
    '{"achou": true, "x": 10, "y": 10, "largura": 10, "altura": 10, "explicacao": "  "}',
  ]) assert.equal(lerApontamento(t), null, t);
});
