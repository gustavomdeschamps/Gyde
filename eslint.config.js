// ESLint do Gyde: regras recomendadas do JavaScript, do TypeScript e do Svelte, para todo o monorepo.
// A formatação fica com o estilo do próprio projeto (não usamos Prettier: reformatar tudo apagaria o histórico do git blame).
import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './pacotes/interface/svelte.config.js';

export default ts.config(
  { ignores: ['**/dist/**', 'dist-desktop/**', 'node_modules/**', 'pacotes/interface/public/runners/**', 'pacotes/extensao-vscode/media/marked.esm.js', 'pacotes/extensao-vscode/media/purify.es.mjs', 'pacotes/extensao-chrome/vendor/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: {
      // variáveis com _ na frente são de propósito (ex.: tirar um campo com desestruturação)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // {@html} só recebe ícones SVG fixos, markdown passado pelo DOMPurify (markdown.ts) ou código colorido pelo
      // highlight.js, que escapa o texto. O teste de navegador do chat confere que HTML perigoso não executa.
      'svelte/no-at-html-tags': 'off',
      // listas estáticas ou recriadas inteiras; as que ganham e perdem itens (conversas, skills, turmas) já têm chave
      'svelte/require-each-key': 'off',
      // {' texto'} é de propósito: o Svelte apaga o espaço do começo de um bloco {#if}
      'svelte/no-useless-mustaches': 'off',
    },
  },
  // TypeScript já confere nomes indefinidos (inclusive tipos globais como RequestInit)
  { files: ['**/*.ts', '**/*.svelte'], rules: { 'no-undef': 'off' } },
  // interface e extensões rodam no navegador
  { files: ['pacotes/interface/**', 'pacotes/extensao-*/**'], languageOptions: { globals: { ...globals.browser } } },
  { files: ['pacotes/extensao-chrome/**'], languageOptions: { globals: { ...globals.webextensions } } },
  { files: ['pacotes/interface/public/sw.js'], languageOptions: { globals: { ...globals.serviceworker } } },
  { files: ['**/*.cjs', 'pacotes/extensao-vscode/*.js'], languageOptions: { sourceType: 'commonjs' }, rules: { '@typescript-eslint/no-require-imports': 'off', 'svelte/no-inner-declarations': 'off' } }, // a regra do Svelte quebra em CommonJS
  { files: ['pacotes/extensao-vscode/media/painel.js'], languageOptions: { globals: { acquireVsCodeApi: 'readonly' } } },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { projectService: false, extraFileExtensions: ['.svelte'], parser: ts.parser, svelteConfig } },
  },
);
