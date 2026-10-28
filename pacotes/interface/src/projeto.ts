// Transforma uma pasta ou um .zip de projeto num anexo de texto para o Gyde revisar:
// árvore de pastas + conteúdo dos arquivos de código (com limites de tamanho).
import { unzipSync, strFromU8 } from 'fflate';

const MAX_TOTAL = 100_000;   // caracteres enviados no total
const MAX_FILE = 14_000;     // por arquivo
const MAX_FILES = 300;       // arquivos considerados
const SKIP_DIRS = /(^|\/)(node_modules|\.git|\.svn|dist|build|out|target|bin|obj|venv|\.venv|env|__pycache__|\.next|\.nuxt|coverage|\.idea|\.vscode|vendor|\.gradle|\.dart_tool|Pods)(\/|$)/i;
const CODE_EXT = /\.(py|js|mjs|cjs|ts|tsx|jsx|java|kt|c|h|cpp|hpp|cs|go|rs|rb|php|swift|dart|lua|r|sql|html|css|scss|sass|vue|svelte|json|yml|yaml|toml|xml|md|txt|sh|bat|ps1|gradle|properties|ini|env\.example|gitignore|dockerfile)$/i;
const SPECIAL = /(^|\/)(dockerfile|makefile|readme|license|requirements\.txt|package\.json|pom\.xml|build\.gradle|cargo\.toml|go\.mod)$/i;
const LOCKS = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|composer\.lock|Cargo\.lock)$/i;
const SECRET = /(^|\/)\.env$|\.pem$|\.key$|id_rsa/i;

// Arquivos mais importantes primeiro: README, configuração, depois o resto por profundidade.
function priority(path: string) {
  if (/(^|\/)readme/i.test(path)) return 0;
  if (/(^|\/)(package\.json|requirements\.txt|pom\.xml|build\.gradle|cargo\.toml|go\.mod)$/i.test(path)) return 1;
  if (/(^|\/)(main|app|index|server)\.\w+$/i.test(path)) return 2;
  return 3 + path.split('/').length;
}

function tree(paths: string[]) {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const p of [...paths].sort()) {
    const parts = p.split('/');
    for (let i = 0; i < parts.length; i++) {
      const key = parts.slice(0, i + 1).join('/');
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`${'  '.repeat(i)}${parts[i]}${i < parts.length - 1 ? '/' : ''}`);
    }
  }
  return lines.slice(0, 400).join('\n');
}

interface Entrada { path: string; size: number; read: () => Promise<string> }
async function bundle(name: string, entries: Entrada[]) {
  const kept = entries.filter((e) => !SKIP_DIRS.test(e.path) && !SECRET.test(e.path) && !LOCKS.test(e.path) && (CODE_EXT.test(e.path) || SPECIAL.test(e.path)));
  const skipped = entries.length - kept.length;
  kept.sort((a, b) => priority(a.path) - priority(b.path));
  let text = `PROJETO: ${name}\n\nESTRUTURA (${kept.length} arquivos de código${skipped ? `, ${skipped} ignorados: dependências, binários, segredos` : ''}):\n${tree(kept.map((e) => e.path))}\n`;
  let included = 0;
  for (const e of kept.slice(0, MAX_FILES)) {
    if (text.length >= MAX_TOTAL) break;
    let content: string;
    try { content = await e.read(); } catch { continue; }
    // eslint-disable-next-line no-control-regex -- procura o byte nulo de propósito
    if (/\u0000/.test(content.slice(0, 2000))) continue; // binário disfarçado
    const cut = content.length > MAX_FILE ? `${content.slice(0, MAX_FILE)}\n[... arquivo cortado ...]` : content;
    const block = `\n===== ${e.path} =====\n${cut}\n`;
    if (text.length + block.length > MAX_TOTAL) { text += `\n[... outros arquivos não couberam no limite ...]\n`; break; }
    text += block;
    included++;
  }
  return { kind: 'file' as const, name: `Projeto: ${name} (${included} de ${kept.length} arquivos)`, text, sub: `Projeto · ${included} arquivos` };
}

// <input webkitdirectory> -> FileList
export function projectFromFolder(fileList: FileList) {
  const files = [...fileList];
  const root = files[0]?.webkitRelativePath.split('/')[0] || 'projeto';
  return bundle(root, files.map((f) => ({
    path: f.webkitRelativePath.split('/').slice(1).join('/') || f.name,
    size: f.size,
    read: () => (f.size > 2_000_000 ? Promise.reject(new Error('grande')) : f.text()),
  })));
}

export async function projectFromZip(file: File) {
  const data = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (f) => !f.name.endsWith('/') && f.originalSize < 2_000_000 && !SKIP_DIRS.test(f.name),
  });
  const paths = Object.keys(data);
  // Zips costumam ter uma pasta raiz única: tira ela do caminho.
  const first = paths[0]?.split('/')[0];
  const common = first && paths.every((p) => p.startsWith(`${first}/`));
  return bundle(file.name.replace(/\.zip$/i, ''), paths.map((p) => ({
    path: common ? p.slice(first!.length + 1) : p,
    size: data[p]!.length,
    read: async () => strFromU8(data[p]!),
  })));
}
