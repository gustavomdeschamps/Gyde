// Gera pacotes/extensao-chrome/gyde-chrome.zip (o que a Chrome Web Store recebe). Para usar sem a loja, carregue
// esta pasta em chrome://extensions > "Carregar sem compactação"; o .zip não é necessário.
// Uso: npm run empacotar -w @gyde/extensao-chrome (ou node pacotes/extensao-chrome/empacotar.mjs)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const FORA = new Set(['package.json', 'empacotar.mjs', 'node_modules']); // só desenvolvimento, não vai para a loja
const manifesto = JSON.parse(readFileSync(path.join(raiz, 'manifest.json'), 'utf8'));

const arquivos = {};
(function andar(dir) {
  for (const nome of readdirSync(dir)) {
    const cheio = path.join(dir, nome);
    const rel = path.relative(raiz, cheio).replaceAll('\\', '/');
    if (FORA.has(rel) || rel.endsWith('.zip')) continue;
    if (statSync(cheio).isDirectory()) andar(cheio);
    else arquivos[rel] = readFileSync(cheio);
  }
})(raiz);

// tudo que o manifesto cita precisa estar no pacote
const citados = [manifesto.background?.service_worker, manifesto.side_panel?.default_path, ...Object.values(manifesto.icons ?? {}),
  ...Object.values(manifesto.action?.default_icon ?? {})].filter(Boolean);
const faltando = citados.filter((f) => !arquivos[f]);
if (faltando.length) { console.error(`Faltam arquivos citados no manifest.json: ${faltando.join(', ')}`); process.exit(1); }

const saida = path.join(raiz, 'gyde-chrome.zip');
writeFileSync(saida, zipSync(arquivos, { level: 9 }));
console.log(`Gerado ${path.relative(process.cwd(), saida)} (${Object.keys(arquivos).length} arquivos, versão ${manifesto.version})`);
