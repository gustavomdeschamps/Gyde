// Nenhum emoji nem caractere solto usado como ícone (✓, ★, ◆, ¶...) no app, nas extensões, no site, no instalador e
// nos textos: os ícones vêm do conjunto do Gyde (Lucide). Exceções conscientes ficam listadas abaixo, com o motivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const EXCECOES = new Map([
  ['pacotes/servidor/ia/filtro.ts', 'o filtro que tira emoji das respostas precisa citá-los'],
  ['pacotes/servidor/ia/prompts.ts', 'a instrução diz ao modelo quais símbolos NÃO usar'],
  ['pacotes/servidor/testes/ia.test.mjs', 'teste do filtro de emoji'],
  ['pacotes/interface/testes/sem-emoji.test.mjs', 'este teste'],
  ['ferramentas/avaliar-estrategias.mjs', 'reproduz o prompt antigo, para comparar antes e depois'],
  ['ferramentas/avaliacao-tarefas.mjs', 'idem: tarefas da avaliação antiga'],
  ['.github/workflows/testes.yml', 'procura as marcas de falha que o node:test imprime'],
  ['LICENCAS-DE-TERCEIROS.md', 'o símbolo de copyright das licenças'],
  ['LICENSE', 'o símbolo de copyright da licença'],
]);
const EMOJI = /\p{Extended_Pictographic}/u;
const GLIFO_ICONE = /[✓✔✗✘✕✖★☆⚠◆◇●○■□▲◉◎¶⌘⎋⏎↻↗]/u;

test('nenhum emoji nem caractere solto como ícone nos arquivos do projeto', () => {
  const arquivos = execSync('git ls-files', { cwd: RAIZ, encoding: 'utf8' }).split('\n')
    .filter((f) => f && /\.(svelte|ts|js|mjs|html|css|md|json|yml|nsh|txt)$/.test(f) && !EXCECOES.has(f))
    .filter((f) => !/package-lock|^docs\/avaliacao\/|\/vendor\/|marked\.esm|purify\.es|icones-lucide|icones\.js$|icones-nomes/.test(f));
  const achados = [];
  for (const f of arquivos) {
    let texto;
    try { texto = readFileSync(path.join(RAIZ, f), 'utf8'); } catch { continue; }
    texto.split('\n').forEach((linha, i) => {
      const m = linha.match(EMOJI) ?? linha.match(GLIFO_ICONE);
      if (m) achados.push(`${f}:${i + 1}: ${m[0]}`);
    });
  }
  assert.deepEqual(achados, [], `Troque por um ícone do conjunto (icone('nome')) ou por palavras:\n${achados.join('\n')}`);
});
