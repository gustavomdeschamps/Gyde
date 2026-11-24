// Regras da Forja que não dependem de IA: argumentos, quebra de laço, verificação e afirmações sem base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { problemaNosArgs, criarDetectorDeLaco, LIMITE_REPETICAO, verificacaoDaTarefa, afirmacoesSemBase, mencoesDoPedido } from '../forja-regras.ts';
import { instrucoesDoProjeto, analisarProjeto, MAX_GYDE_MD } from '../codigo-agente.ts';
import { apagarSeguro } from '../../../ferramentas/limpeza-segura.mjs';

test('argumentos: aceita os certos e explica os errados com um exemplo', () => {
  assert.equal(problemaNosArgs('ler', { caminho: 'src/a.js' }), null);
  assert.equal(problemaNosArgs('editar', { caminho: 'a.js', procurar: 'x', substituir: '' }), null, 'substituir vazio apaga o trecho');
  assert.equal(problemaNosArgs('listar', undefined), null);
  assert.equal(problemaNosArgs('desfazer', {}), null);
  assert.match(problemaNosArgs('ler', {}), /"caminho" é obrigatório.*Exemplo: \{"caminho"/);
  assert.match(problemaNosArgs('editar', { caminho: 'a.js', procurar: '' }), /"procurar" é obrigatório/);
  assert.match(problemaNosArgs('escrever', { caminho: 'a.js', conteudo: 42 }), /"conteudo"/);
  assert.match(problemaNosArgs('executar', { comando: '   ' }), /"comando" é obrigatório/);
  assert.match(problemaNosArgs('ler', { caminho: 'a.js', inicio: -3 }), /"inicio"/);
  assert.match(problemaNosArgs('ler', 'a.js'), /precisam ser um objeto JSON/);
  assert.match(problemaNosArgs('formatar', {}), /não existe/);
});

test('laço: a mesma falha repetida vira aviso e, rodada após rodada, parada', () => {
  const l = criarDetectorDeLaco();
  const editar = { caminho: 'a.js', procurar: 'nao existe', substituir: 'y' };
  assert.equal(l.registrar('editar', editar, false, false), null, '1ª falha: ainda é normal');
  assert.equal(l.fimDaRodada(false), false);
  assert.match(l.registrar('editar', { substituir: 'y', procurar: 'nao existe', caminho: 'a.js' }, false, false), /já tentou exatamente esta ação 2 vezes/, 'mesma ação com as chaves em outra ordem conta igual');
  let parou = false;
  for (let i = 0; i < LIMITE_REPETICAO && !parou; i++) parou = l.fimDaRodada(false);
  assert.ok(parou, `para depois de ${LIMITE_REPETICAO} rodadas presas`);
  assert.match(l.repetida, /editar a\.js/);
});

test('laço: avançar zera a contagem; ler de novo depois de editar é normal', () => {
  const l = criarDetectorDeLaco();
  l.fimDaRodada(false); l.fimDaRodada(false);
  assert.equal(l.fimDaRodada(true), false, 'uma rodada com avanço zera');
  const ler = { caminho: 'a.js' };
  l.registrar('ler', ler, true, false); l.registrar('ler', ler, true, false);
  assert.match(l.registrar('ler', ler, true, false), /mesma leitura 3 vezes/);
  l.registrar('editar', { caminho: 'a.js', procurar: 'a', substituir: 'b' }, true, true);
  assert.equal(l.registrar('ler', ler, true, false), null, 'depois de mudar o arquivo, ler de novo não é laço');
});

const M = (o = {}) => ({ criados: [], modificados: [], apagados: [], comandos: [], ...o });
test('verificação: vem do que rodou depois da última mudança', () => {
  assert.equal(verificacaoDaTarefa(M(), []).estado, 'sem-mudanca');
  assert.equal(verificacaoDaTarefa(M({ modificados: ['a.js'] }), []).estado, 'nao-verificado');
  assert.equal(verificacaoDaTarefa(M({ modificados: ['a.js'] }), [{ comando: 'npm test', ok: false }]).estado, 'falhou');
  const v = verificacaoDaTarefa(M({ modificados: ['a.js'] }), [{ comando: 'npm test', ok: false }, { comando: 'npm test', ok: true }]);
  assert.equal(v.estado, 'verificado');
  assert.match(v.texto, /npm test/);
});

test('afirmações sem base: "os testes passaram" sem verificação vira aviso', () => {
  const mud = M({ modificados: ['a.js'], comandos: [{ comando: 'npm test', ok: false, codigo: 1 }] });
  const falhou = verificacaoDaTarefa(mud, [{ comando: 'npm test', ok: false }]);
  assert.equal(afirmacoesSemBase('**Testes**: todos os testes passaram.', mud, falhou).length, 1);
  assert.match(afirmacoesSemBase('Rodei os testes e tudo passou.', M({ criados: ['b.js'] }), verificacaoDaTarefa(M({ criados: ['b.js'] }), []))[0], /nenhum comando rodou/);
  const ok = verificacaoDaTarefa(mud, [{ comando: 'npm test', ok: true }]);
  assert.deepEqual(afirmacoesSemBase('Os testes passaram.', mud, ok), [], 'verificado: sem aviso');
  assert.deepEqual(afirmacoesSemBase('Corrigi o erro de digitação na função soma.', mud, falhou), [], 'sem afirmação, sem aviso');
  assert.equal(afirmacoesSemBase('Não alterei nenhum arquivo.', mud, falhou).length, 1);
});

test('@arquivo no pedido', () => {
  assert.deepEqual(mencoesDoPedido('corrija @src/app.js e veja @README.md.'), ['src/app.js', 'README.md']);
  assert.deepEqual(mencoesDoPedido('mande email para ana@exemplo.com'), [], 'e-mail não é menção');
  assert.deepEqual(mencoesDoPedido('olhe @src\\util.ts, @src/util.ts'), ['src/util.ts']);
});

test('GYDE.md e comandos de verificação do projeto', () => {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-forja-regras-'));
  try {
    assert.equal(instrucoesDoProjeto(pasta), null);
    mkdirSync(path.join(pasta, '.gyde'));
    writeFileSync(path.join(pasta, '.gyde', 'GYDE.md'), 'Use aspas simples.\nChave: nvapi-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd');
    const t = instrucoesDoProjeto(pasta);
    assert.match(t, /aspas simples/);
    assert.doesNotMatch(t, /nvapi-ABCDEF/, 'segredo no GYDE.md não vai para o modelo');
    writeFileSync(path.join(pasta, 'GYDE.md'), 'x'.repeat(MAX_GYDE_MD + 50));
    assert.match(instrucoesDoProjeto(pasta), /cortado/, 'o da raiz vem primeiro e é cortado no limite');
    writeFileSync(path.join(pasta, 'package.json'), JSON.stringify({ scripts: { test: 'node --test', build: 'vite build', lint: 'eslint .' } }));
    assert.deepEqual(analisarProjeto(pasta).verificar, ['npm test', 'npm run build', 'npm run lint']);
  } finally { apagarSeguro(pasta); }
});

test('a conferência de site só entra em pedido sobre aparência, site ou acessibilidade', async () => {
  const { PEDIDO_VISUAL } = await import('../codigo-agente.ts');
  assert.ok(PEDIDO_VISUAL.test('Redesenhe este site para ficar moderno e funcionar no celular'));
  assert.ok(PEDIDO_VISUAL.test('melhore o contraste das cores'));
  assert.ok(!PEDIDO_VISUAL.test('Quero que a API traga o campo hora e que a página mostre essa hora'), 'pedido de API que toca o HTML: não cobra lang e viewport');
  assert.ok(!PEDIDO_VISUAL.test('O teste está falhando. Corrija e rode os testes.'));
});

test('"Verificado" só conta comando que prova algo (teste, build, lint)', async () => {
  const { verificaAlgo } = await import('../forja-regras.ts');
  for (const c of ['npm test', 'npm run build', 'npm run lint', 'python -m pytest', 'node --test', 'node teste.js', 'npx vitest run', 'go test ./...', 'cargo test', 'mvn test', 'tsc --noEmit']) assert.ok(verificaAlgo(c), c);
  for (const c of ['echo ok', 'dir', 'node -v', 'git status', 'type app.js', 'npm install']) assert.ok(!verificaAlgo(c), c);
  assert.ok(verificaAlgo('npm run verificar', ['npm run verificar']), 'o comando do próprio projeto vale');
});

test('GYDE.md por atalho (pasta .gyde que aponta para fora) não é lido', async () => {
  const { symlinkSync } = await import('node:fs');
  const raiz = mkdtempSync(path.join(tmpdir(), 'gyde-gydemd-'));
  try {
    const projeto = path.join(raiz, 'projeto'), fora = path.join(raiz, 'fora');
    mkdirSync(projeto); mkdirSync(fora);
    writeFileSync(path.join(fora, 'GYDE.md'), 'SEGREDO-DE-FORA');
    symlinkSync(fora, path.join(projeto, '.gyde'), 'junction');
    assert.equal(instrucoesDoProjeto(projeto), null);
  } finally { apagarSeguro(raiz); }
});
