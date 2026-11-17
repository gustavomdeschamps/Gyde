// Gera o conjunto único de ícones do Gyde a partir do Lucide (licença ISC, em node_modules/lucide), só com os ícones
// usados: os da interface (lista abaixo), os das skills (campo "icone" de cada .md) e os das categorias e pacotes.
// Saídas (não edite à mão; rode de novo depois de mudar a lista ou uma skill):
//   pacotes/interface/src/icones-lucide.ts      app (navegador e desktop)
//   pacotes/extensao-vscode/media/icones.js      painel do VS Code
//   pacotes/extensao-chrome/icones.js            painel do Chrome
//   pacotes/compartilhado/icones-nomes.ts        só os nomes (o servidor confere o ícone de uma skill)
//   node ferramentas/gerar-icones.mjs [--conferir]   (--conferir: só diz se os arquivos estão atualizados; sai com 1 se não)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.join(import.meta.dirname, '..');
const LUCIDE = path.join(RAIZ, 'node_modules/lucide');
const VERSAO = JSON.parse(readFileSync(path.join(LUCIDE, 'package.json'), 'utf8')).version;

// ícones da interface (app e extensões). Nome do Lucide: https://lucide.dev/icons
export const ICONES_UI = [
  // ações
  'plus', 'check', 'x', 'pencil', 'trash', 'copy', 'download', 'upload', 'share', 'search', 'refresh-cw', 'rotate-cw', 'undo-2',
  'send', 'arrow-up', 'square', 'play', 'pause', 'skip-back', 'skip-forward', 'chevron-left', 'chevron-right', 'chevron-down',
  'chevron-up', 'ellipsis', 'pin', 'external-link', 'log-out', 'settings', 'menu', 'list', 'text-wrap', 'eye', 'eye-off',
  // objetos
  'file', 'file-text', 'file-archive', 'file-code', 'folder', 'folder-open', 'folder-tree', 'paperclip', 'image', 'mic', 'volume-2', 'volume-x',
  'terminal', 'monitor', 'monitor-play', 'store', 'user', 'users', 'message-square', 'messages-square', 'book-open', 'house',
  'key-round', 'lock-keyhole', 'globe', 'link', 'building', 'map', 'calendar', 'clock', 'history', 'package',
  // estados e sinais
  'circle-check', 'circle-x', 'circle-alert', 'triangle-alert', 'info', 'circle-question-mark', 'shield-check', 'shield-alert',
  'sparkles', 'star', 'zap', 'loader-circle', 'wifi-off', 'plug', 'bot', 'brain', 'lightbulb', 'anvil', 'hammer', 'wand-sparkles',
  'graduation-cap', 'compass', 'route', 'layers', 'list-checks', 'mouse-pointer-click', 'puzzle', 'gauge', 'sun', 'moon',
  // agentes
  'bug', 'flask-conical', 'search-code', 'file-pen-line', 'palette', 'map-pin', 'notebook-pen',
  // extensões
  'file-check', 'dumbbell', 'text-cursor', 'scan', 'mouse-pointer-2', 'circle-stop',
  // escolha de ícone ao criar uma skill (EditorSkill.svelte)
  'puzzle', 'database', 'globe', 'smartphone', 'gamepad-2', 'chart-column', 'sheet', 'key-round', 'git-branch', 'rocket', 'square-terminal', 'workflow',
];

const ALIASES = { history: 'rotate-ccw-clock' }; // nome antigo → arquivo do Lucide

function iconesDasSkills() {
  const pasta = path.join(RAIZ, 'pacotes/servidor/skills-catalogo');
  const nomes = [];
  for (const f of readdirSync(pasta).filter((f) => f.endsWith('.md'))) {
    const m = readFileSync(path.join(pasta, f), 'utf8').match(/^icone:\s*([a-z0-9-]+)\s*$/m);
    if (m) nomes.push(m[1]);
  }
  const objetivos = path.join(pasta, 'objetivos.json');
  if (existsSync(objetivos)) {
    const o = JSON.parse(readFileSync(objetivos, 'utf8'));
    for (const x of [...(o.categorias ?? []), ...(o.pacotes ?? [])]) if (x.icone) nomes.push(x.icone);
  }
  return nomes;
}

const escapar = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const marcacao = (no) => no.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${escapar(v)}"`).join(' ')}/>`).join('');

export async function montarIcones() {
  const nomes = [...new Set([...ICONES_UI, ...iconesDasSkills()])].sort();
  const mapa = {};
  for (const nome of nomes) {
    const arquivo = path.join(LUCIDE, 'dist/esm/icons', `${ALIASES[nome] ?? nome}.mjs`);
    if (!existsSync(arquivo)) throw new Error(`Ícone "${nome}" não existe no Lucide ${VERSAO}. Veja os nomes em https://lucide.dev/icons`);
    mapa[nome] = marcacao((await import(pathToFileURL(arquivo).href)).default);
  }
  return mapa;
}

const CABECALHO = (onde) => `// Gerado por ferramentas/gerar-icones.mjs a partir do Lucide ${VERSAO} (licença ISC, veja LICENCAS-DE-TERCEIROS.md).
// Não edite à mão: mude a lista em gerar-icones.mjs (ou o "icone" de uma skill) e rode o gerador.${onde ? ` ${onde}` : ''}
`;
// ícone decorativo: escondido do leitor de tela; ícone com função (sem texto ao lado): nome acessível pelo rótulo
const FUNCAO = `
const escapar = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/** SVG do ícone. Sem rótulo, é decorativo (aria-hidden); com rótulo, vira imagem com nome acessível. */
export function icone(nome, rotulo) {
  const corpo = ICONES[nome] ?? ICONES['circle-question-mark'];
  const a11y = rotulo ? \`role="img" aria-label="\${escapar(rotulo)}"\` : 'aria-hidden="true" focusable="false"';
  return \`<svg class="icone" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" \${a11y}>\${corpo}</svg>\`;
}
`;

export async function gerar() {
  const mapa = await montarIcones();
  const json = JSON.stringify(mapa, null, 1);
  const ts = `${CABECALHO('Use icone() de ./icones.ts.')}export const ICONES: Record<string, string> = ${json};\n`;
  const js = `${CABECALHO('')}export const ICONES = ${json};\n${FUNCAO}`;
  return {
    'pacotes/interface/src/icones-lucide.ts': ts,
    'pacotes/extensao-vscode/media/icones.js': js,
    'pacotes/extensao-chrome/icones.js': js,
    'pacotes/compartilhado/icones-nomes.ts': `${CABECALHO('')}export const NOMES_ICONES: readonly string[] = ${JSON.stringify(Object.keys(mapa))};
`,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const saidas = await gerar();
  const conferir = process.argv.includes('--conferir');
  let desatualizado = false;
  for (const [rel, conteudo] of Object.entries(saidas)) {
    const p = path.join(RAIZ, rel);
    const atual = existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '';
    if (atual === conteudo) continue;
    desatualizado = true;
    if (conferir) console.log(`desatualizado: ${rel}`); else { writeFileSync(p, conteudo); console.log(`gerado: ${rel}`); }
  }
  if (conferir && desatualizado) process.exit(1);
  console.log(`${Object.keys(await montarIcones()).length} ícones do Lucide ${VERSAO}`);
}
