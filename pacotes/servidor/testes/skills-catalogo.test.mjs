// Skills: só as partes necessárias entram no pedido (limite para os modelos grátis), no máximo 2 por mensagem, e todo
// item do catálogo segue o formato (passos, checklist, exemplo, erros comuns), com ícone do conjunto e categoria certa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerCatalogo, trechoDaSkill, escolherSkills, sugerirSkill, secoesDe, LIMITE_SKILL, LIMITE_TOTAL, parseSkill } from '../skills-sistema.ts';
import { NOMES_ICONES } from '../../compartilhado/icones-nomes.ts';

const RAIZ_SERVIDOR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogo = lerCatalogo(RAIZ_SERVIDOR);
const objetivos = JSON.parse(readFileSync(path.join(RAIZ_SERVIDOR, 'skills-catalogo', 'objetivos.json'), 'utf8'));
const EMOJI = /\p{Extended_Pictographic}/u;

test('catálogo: todas no formato, com ícone do conjunto e categoria da lista; só fica skill que melhorou o resultado ou ainda não tem como ser medida', () => {
  assert.ok(catalogo.size >= 15, `só ${catalogo.size} skills`);
  const categorias = new Set(objetivos.categorias.map((c) => c.nome));
  // medição por resultado: nenhuma skill do catálogo pode ter ficado igual ou pior com ela
  const avaliacao = JSON.parse(readFileSync(path.join(RAIZ_SERVIDOR, 'skills-catalogo', 'avaliacao.json'), 'utf8')).skills;
  for (const [id, a] of Object.entries(avaliacao)) { assert.ok(catalogo.has(id), `avaliação de skill que não existe: ${id}`); assert.ok(a.diferenca > 0, `${id} não melhorou o resultado e não deveria estar no catálogo`); }
  const icones = new Set(NOMES_ICONES);
  const comandos = new Set();
  for (const s of catalogo.values()) {
    const titulos = secoesDe(s.corpo).map((x) => x.titulo);
    assert.deepEqual(titulos, ['Passos', 'Checklist', 'Exemplo', 'Erros comuns'], `${s.id}: seções`);
    assert.ok(icones.has(s.icone), `${s.id}: ícone ${s.icone} fora do conjunto`);
    assert.ok(categorias.has(s.categoria), `${s.id}: categoria ${s.categoria}`);
    assert.ok(s.descricao.length <= 110, `${s.id}: descrição longa demais para uma linha (${s.descricao.length})`);
    assert.ok(s.comando && !comandos.has(s.comando), `${s.id}: comando repetido ou vazio`);
    comandos.add(s.comando);
    assert.ok(!EMOJI.test(s.corpo + s.nome + s.descricao), `${s.id}: emoji`);
    assert.ok(s.gatilhos.length >= 3, `${s.id}: poucos gatilhos`);
  }
  for (const c of categorias) assert.ok([...catalogo.values()].some((s) => s.categoria === c), `categoria ${c} sem nenhuma skill`);
  for (const p of objetivos.pacotes) assert.ok(p.skills.length >= 2, `pacote ${p.id} com menos de 2 skills`);
  for (const p of objetivos.pacotes) for (const id of p.skills) assert.ok(catalogo.has(id), `pacote ${p.id}: skill ${id} não existe`);
  for (const id of objetivos.paraComecar) assert.ok(catalogo.has(id), `para começar: ${id}`);
});

test('trecho: passos e checklist sempre; exemplo e erros só se couberem; erros primeiro quando a mensagem fala de erro', () => {
  const s = parseSkill(`---\nid: t\nnome: T\n---\n## Passos\n1. ${'p'.repeat(300)}\n## Checklist\n- ${'c'.repeat(300)}\n## Exemplo\n${'e'.repeat(500)}\n## Erros comuns\n- ${'x'.repeat(500)}`);
  const normal = trechoDaSkill(s, 'como faço', 1300);
  assert.deepEqual(normal.secoes, ['Passos', 'Checklist', 'Exemplo']);
  assert.ok(normal.texto.length <= 1300);
  const comErro = trechoDaSkill(s, 'deu erro aqui', 1300);
  assert.deepEqual(comErro.secoes, ['Passos', 'Checklist', 'Erros comuns']);
  const apertado = trechoDaSkill(s, 'x', 700);
  assert.deepEqual(apertado.secoes, ['Passos', 'Checklist']);
  for (const sk of catalogo.values()) assert.ok(trechoDaSkill(sk, 'qualquer coisa').texto.length <= LIMITE_SKILL, `${sk.id} passa do limite`);
  const semSecoes = parseSkill(`---\nnome: Livre\n---\n${'a'.repeat(3000)}`);
  assert.ok(trechoDaSkill(semSecoes, '').texto.length <= LIMITE_SKILL + 10, 'skill própria sem seções também é cortada');
});

test('escolha: comando primeiro, no máximo 2 skills, soma dentro do limite; sem instalada que sirva, sugere do catálogo', () => {
  const todas = [...catalogo.values()];
  const inst = todas.map((s) => ({ ...s, instalada: true }));
  const porComando = escolherSkills(inst, '/regex me ajuda com esse leitor de tela e acessibilidade');
  assert.deepEqual(porComando.map((s) => s.id), ['regex']);
  const muitas = escolherSkills(inst, 'acessibilidade leitor de tela wcag aria média mediana desvio padrão changelog versão semver');
  assert.ok(muitas.length <= 2);
  assert.ok(muitas.reduce((n, s) => n + s.trecho.texto.length, 0) <= LIMITE_TOTAL);
  assert.deepEqual(escolherSkills(inst, 'oi, tudo bem?'), [], 'conversa: nenhuma skill');
  assert.equal(sugerirSkill(todas, 'qual a próxima versão pelo semver depois de corrigir um bug?')?.id, 'changelog-versoes');
  assert.equal(sugerirSkill(todas, 'bom dia'), null);
});

test('ícones gerados estão atualizados com o Lucide e as skills', async () => {
  const { gerar } = await import('../../../ferramentas/gerar-icones.mjs');
  const saidas = await gerar();
  const raiz = path.resolve(RAIZ_SERVIDOR, '../..');
  for (const [rel, conteudo] of Object.entries(saidas)) {
    assert.equal(readFileSync(path.join(raiz, rel), 'utf8').replace(/\r\n/g, '\n'), conteudo, `${rel} desatualizado: rode node ferramentas/gerar-icones.mjs`);
  }
});
