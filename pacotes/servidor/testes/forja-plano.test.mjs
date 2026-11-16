// Plano separado da execução: só tarefa grande planeja antes (as pequenas não podem ficar mais lentas), e o plano
// que o modelo devolve é lido com cuidado (nada de etapas vazias ou listas enormes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ehTarefaGrande, lerPlano } from '../codigo-agente.ts';

test('só tarefa grande planeja: os pedidos pequenos da avaliação não entram', () => {
  const pequenos = [
    'O teste está falhando. Descubra o bug, corrija e rode os testes.',
    'Adicione em util.js uma função dobro(n) que devolve o dobro de n, exporte e crie um teste para ela em teste.js. Rode os testes.',
    'Quero que a resposta da API (/api/ola) traga também o campo "hora" (texto HH:MM) e que a página mostre essa hora junto da mensagem. Ajuste o back-end e o front-end e rode os testes.',
    'Só me explique o que este projeto faz e como rodo os testes. Não mude nenhum arquivo.',
    'Pedidos de exatamente R$ 100 deveriam ter frete grátis, mas estão pagando frete. Corrija e rode os testes.',
  ];
  for (const p of pequenos) assert.equal(ehTarefaGrande(p), false, p);
  assert.equal(ehTarefaGrande('Quero um campo "categoria" nas tarefas: obrigatório ao criar e só pode ser "casa", "trabalho" ou "estudo" (senão a criação responde 400). A listagem devolve a categoria e aceita o filtro ?categoria=. A página mostra a categoria ao lado do título. Ajuste o que precisar, atualize os testes e rode.'), true);
  assert.equal(ehTarefaGrande('Crie a tela de login. Valide o e-mail. Mostre o erro embaixo do campo. Escreva os testes.'), true, '4 requisitos curtos');
});

test('o plano do modelo é lido com limites', () => {
  assert.deepEqual(lerPlano('{"etapas": ["Ler src/modelo.js", "Validar a categoria", "Rodar os testes"], "arquivos": ["src/modelo.js"]}'),
    { etapas: ['Ler src/modelo.js', 'Validar a categoria', 'Rodar os testes'], arquivos: ['src/modelo.js'] });
  assert.equal(lerPlano('{"etapas": ["só uma etapa"]}'), null, 'menos de 2 etapas não é plano');
  assert.equal(lerPlano('{"acoes": [{"ferramenta": "ler"}]}'), null, 'resposta de ação não é plano');
  assert.equal(lerPlano('texto solto'), null);
  const longo = lerPlano(JSON.stringify({ etapas: Array.from({ length: 20 }, (_, i) => `Etapa número ${i}`), arquivos: [] }));
  assert.equal(longo.etapas.length, 8, 'no máximo 8 etapas');
  assert.deepEqual(lerPlano('```json\n{"etapas": ["  a etapa um  ", "", 3, "etapa dois"]}\n```').etapas, ['a etapa um', 'etapa dois']);
});

test('texto que só anuncia o próximo passo não encerra a tarefa', async () => {
  const { pareceAnuncio } = await import('../codigo-agente.ts');
  for (const t of ['Desculpe, vou ler os arquivos corretamente.', 'Vou corrigir agora o arquivo src/modelo.js.', 'Ok. Agora vou rodar os testes.', 'Deixe-me conferir o teste.', 'Primeiro, vou ler o README.'])
    assert.equal(pareceAnuncio(t), true, t);
  for (const t of ['**O que fiz**\nCorrigi a soma em soma.js e os testes passam.', 'Você pode rodar os testes com npm test.', 'Voucher é um campo opcional.', 'Pronto: a categoria agora é obrigatória.'])
    assert.equal(pareceAnuncio(t), false, t);
});
