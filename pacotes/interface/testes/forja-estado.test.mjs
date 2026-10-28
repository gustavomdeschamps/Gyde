// Lógica da tela da Forja: como os eventos do servidor viram turnos (histórico e ao vivo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicar, fecharPendentes, duracao, relogio } from '../src/forja/estado.ts';

const historico = [
  { tipo: 'tarefa', em: 1000, texto: 'Corrija o soma.js', inicio: 1000, anexos: [] },
  { tipo: 'pensando', em: 1001, passo: 1 },
  { tipo: 'ferramenta', em: 1002, nome: 'ler', args: { caminho: 'soma.js' }, pensamento: 'Vou ler' },
  { tipo: 'resultado', em: 1003, nome: 'ler', ok: true, resumo: 'soma.js (linhas 1–5 de 5)', saida: '...' },
  { tipo: 'ferramenta', em: 1004, nome: 'editar', args: { caminho: 'soma.js' }, pensamento: '' },
  { tipo: 'resultado', em: 1005, nome: 'editar', ok: true, resumo: 'editou soma.js', saida: 'Editado', diff: { antes: 'a - b', depois: 'a + b' } },
  { tipo: 'ferramenta', em: 1006, nome: 'executar', args: { comando: 'npm test' }, pensamento: '' },
  { tipo: 'resultado', em: 1007, nome: 'executar', ok: true, resumo: 'npm test → código 0', saida: 'OK' },
  { tipo: 'resposta', em: 9000, texto: '**O que fiz**', duracao_ms: 8000, mudancas: { criados: [], modificados: ['soma.js'], apagados: [], comandos: [{ comando: 'npm test', ok: true, codigo: 0 }] }, comandos: 1, arquivos: ['soma.js'] },
];

test('histórico vira um turno fechado com contagens reais', () => {
  const itens = [];
  for (const ev of historico) aplicar(itens, ev);
  assert.equal(itens.length, 1);
  const t = itens[0];
  assert.equal(t.tipo, 'turno');
  assert.equal(t.etapas.length, 3);
  assert.ok(t.etapas.every((e) => e.estado === 'ok'));
  assert.equal(t.etapas[1].diff.depois, 'a + b');
  assert.deepEqual({ estado: t.fim.estado, acoes: t.fim.acoes, arquivos: t.fim.arquivos, comandos: t.fim.comandos, duracao: t.fim.duracaoMs }, { estado: 'ok', acoes: 3, arquivos: 1, comandos: 1, duracao: 8000 });
  assert.equal(t.pensando, false, 'no histórico, "pensando" não fica aceso');
});

test('ao vivo: relógio começa no navegador e "pensando" aparece', () => {
  const itens = [];
  aplicar(itens, { tipo: 'tarefa', texto: 'oi', inicio: 1 }, true, 50_000);
  aplicar(itens, { tipo: 'pensando', passo: 1 }, true, 50_100);
  assert.equal(itens[0].inicio, 50_000);
  assert.equal(itens[0].pensando, true);
});

test('confirmação: botões só ao vivo; resposta registrada; Parar fecha como "parado"', () => {
  const itens = [];
  aplicar(itens, { tipo: 'tarefa', texto: 'apague lixo.txt' }, true, 0);
  aplicar(itens, { tipo: 'ferramenta', nome: 'apagar', args: { caminho: 'lixo.txt' } }, true);
  aplicar(itens, { tipo: 'confirmar', id: 'c1', acao: 'Apagar lixo.txt', motivo: 'apaga um arquivo' }, true);
  const conf = itens[0].etapas[1];
  assert.equal(conf.aoVivo, true);
  aplicar(itens, { tipo: 'confirmacao', id: 'c1', aprovado: false }, true);
  assert.equal(conf.resposta, false);
  assert.equal(conf.aoVivo, false);
  aplicar(itens, { tipo: 'erro', texto: 'Parado por você.' }, true, 5000);
  assert.equal(itens[0].fim.estado, 'parado');
  assert.equal(itens[0].etapas[0].estado, 'interrompido', 'ação sem resultado fica interrompida');
});

test('turno sem fim no histórico (servidor reiniciado) fecha como interrompido; eventos soltos não quebram', () => {
  const itens = [];
  aplicar(itens, { tipo: 'resultado', ok: true }); // antes de qualquer tarefa: ignorado
  aplicar(itens, { tipo: 'tarefa', texto: 'x', em: 100 });
  aplicar(itens, { tipo: 'ferramenta', nome: 'ler', args: {} });
  fecharPendentes(itens, 2100);
  assert.equal(itens[0].fim.estado, 'interrompido');
  assert.equal(itens[0].fim.duracaoMs, 2000);
  aplicar(itens, { tipo: 'desfeito', texto: 'Voltei 1 arquivo' });
  aplicar(itens, { tipo: 'reconectado', para: 'C:\\novo' });
  assert.deepEqual(itens.slice(1).map((i) => i.tipo), ['desfeito', 'reconectado']);
  assert.equal(new Set(itens.map((i) => i.chave)).size, 3, 'chaves únicas para a lista da tela');
});

test('formatos de tempo', () => {
  assert.equal(duracao(8000), '8 s');
  assert.equal(duracao(75_000), '1 min 15 s');
  assert.equal(duracao(120_000), '2 min');
  assert.equal(relogio(65_000), '1:05');
});
