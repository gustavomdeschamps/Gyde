// Confere se uma página do projeto abre como site pronto (HTML, CSS e JavaScript), sem compilar. O Ao vivo
// (ao-vivo.ts) usa isto para oferecer "Site de HTML" ou "Site pronto em dist/" só quando a página funciona assim.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const COMPILAR = /\.(ts|tsx|jsx|vue|svelte|mts|cts)$/i;

// Por que esta página não abre como site pronto (ou null se abre).
export function problemaDaPagina(pasta: string, entrada: string): string | null {
  let html: string;
  try { html = readFileSync(path.join(pasta, entrada), 'utf8').slice(0, 200_000); } catch { return 'não deu para ler o arquivo'; }
  const dir = path.dirname(path.join(pasta, entrada));
  // só o que a página precisa para funcionar: scripts e folhas de estilo (ícones e afins não impedem a prévia)
  const refs = [...html.matchAll(/<(script|link)\b[^>]*>/gi)]
    .filter((m) => m[1]!.toLowerCase() === 'script' || /\brel\s*=\s*["']?stylesheet/i.test(m[0]))
    .map((m) => /\b(?:src|href)\s*=\s*["']([^"'#?]+)/i.exec(m[0])?.[1]?.trim() ?? '')
    .filter((r) => r && !/^(https?:)?\/\//i.test(r) && !/^(data|blob|mailto):/i.test(r));
  for (const r of refs) {
    if (COMPILAR.test(r)) return `carrega ${r}, que precisa ser compilado antes (TypeScript, JSX, Vue ou Svelte)`;
    if (r.startsWith('/')) return `usa o caminho ${r}, que começa com "/" (o Ao vivo serve o site com a raiz certa, então isso funciona lá)`;
    if (!existsSync(path.join(dir, r))) return `carrega ${r}, que ainda não existe (normalmente é gerado pelo build)`;
  }
  if (/\bimport\s+[^'"]*?from\s+["'](?![./])[^"']+["']/.test(html)) return 'importa pacotes pelo nome (ex.: import ... from "vue"), o que só funciona depois do build';
  return null;
}
