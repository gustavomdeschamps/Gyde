// Prévia ao vivo da Forja: acha a página do projeto que dá para abrir como site pronto (HTML, CSS e JavaScript).
// Projetos grandes costumam ter páginas em subpastas, e muitas precisam ser compiladas antes (TypeScript, Vite,
// arquivos que só existem depois do build). Quando nenhuma serve, o motivo diz qual é o limite e o que fazer.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// lugares comuns, na ordem de preferência (as pastas de saída do build trazem o site já pronto)
const DIRETOS = ['index.html', 'public/index.html', 'src/index.html', 'docs/index.html', 'site/index.html', 'dist/index.html', 'build/index.html', 'out/index.html', '_site/index.html'];
const PULAR = new Set(['node_modules', '.git', '.cache', 'coverage', '__pycache__', '.venv', 'venv', 'target', 'obj', 'bin']);
const PROFUNDIDADE = 4;
const MAX_PASTAS = 4000; // projeto enorme: para de procurar aqui (e diz)
const COMPILAR = /\.(ts|tsx|jsx|vue|svelte|mts|cts)$/i;

export type ResultadoPrevia = { entrada: string; motivo: null; candidatas: string[] } | { entrada: null; motivo: string; candidatas: string[] };

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
    if (r.startsWith('/')) return `usa o caminho ${r}, que começa com "/" e só funciona com o servidor do próprio projeto`;
    if (!existsSync(path.join(dir, r))) return `carrega ${r}, que ainda não existe (normalmente é gerado pelo build)`;
  }
  if (/\bimport\s+[^'"]*?from\s+["'](?![./])[^"']+["']/.test(html)) return 'importa pacotes pelo nome (ex.: import ... from "vue"), o que só funciona depois do build';
  return null;
}

export function acharEntradaPrevia(pasta: string): ResultadoPrevia {
  const achadas = DIRETOS.filter((f) => existsSync(path.join(pasta, f)));
  // procura também em subpastas (monorepos, exemplos, playgrounds)
  let pastas = 0, cortou = false;
  const anda = (rel: string, nivel: number) => {
    if (nivel > PROFUNDIDADE) return;
    let itens;
    try { itens = readdirSync(path.join(pasta, rel), { withFileTypes: true }); } catch { return; }
    for (const it of itens) {
      if (!it.isDirectory() || it.isSymbolicLink() || PULAR.has(it.name) || it.name.startsWith('.')) continue;
      if (++pastas > MAX_PASTAS) { cortou = true; return; }
      const sub = rel ? `${rel}/${it.name}` : it.name;
      const arq = `${sub}/index.html`;
      if (!achadas.includes(arq) && existsSync(path.join(pasta, arq)) && statSync(path.join(pasta, arq)).isFile()) achadas.push(arq);
      anda(sub, nivel + 1);
    }
  };
  anda('', 1);
  // prefere as do topo e as pastas de saída do build; depois as mais rasas
  const ordem = (f: string) => (DIRETOS.includes(f) ? DIRETOS.indexOf(f) - 100 : f.split('/').length);
  achadas.sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b));
  const problemas: string[] = [];
  for (const f of achadas) {
    const p = problemaDaPagina(pasta, f);
    if (!p) return { entrada: f, motivo: null, candidatas: achadas };
    problemas.push(`${f}: ${p}`);
  }
  const build = scriptDeBuild(pasta);
  const comoFazer = build
    ? `O que fazer: rode "${build}" (ou peça à Forja para rodar) e abra o Ao vivo de novo. Ele procura a página pronta em dist/, build/ ou out/.`
    : 'O que fazer: compile o projeto (o comando de build dele) e abra o Ao vivo de novo. Ele procura a página pronta em dist/, build/ ou out/.';
  if (achadas.length) {
    const lista = problemas.slice(0, 3).map((p) => `• ${p}`).join('\n');
    const mais = problemas.length > 3 ? `\n• e mais ${problemas.length - 3} página(s) com o mesmo tipo de problema` : '';
    return { entrada: null, candidatas: achadas, motivo: `A prévia ao vivo só abre páginas prontas de HTML, CSS e JavaScript. Achei ${achadas.length} página(s) neste projeto, mas nenhuma abre assim:\n${lista}${mais}\n${comoFazer}` };
  }
  return {
    entrada: null, candidatas: [],
    motivo: `A prévia ao vivo mostra sites feitos com HTML, CSS e JavaScript, e não achei nenhuma página index.html neste projeto (procurei na raiz, em public/, src/, docs/, site/, dist/, build/, out/ e em subpastas até ${PROFUNDIDADE} níveis${cortou ? `; o projeto é grande e parei depois de ${MAX_PASTAS} pastas` : ''}). Ele parece ser de outro tipo (biblioteca, servidor ou aplicativo). Se ele gera um site, ${build ? `rode "${build}" e abra o Ao vivo de novo` : 'compile o projeto e abra o Ao vivo de novo'}.`,
  };
}

// comando de build do package.json, se houver (só o nome do script; nada é executado aqui)
function scriptDeBuild(pasta: string): string | null {
  try {
    const pkg = JSON.parse(readFileSync(path.join(pasta, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
    if (pkg.scripts?.build) return 'npm run build';
  } catch { /* sem package.json */ }
  return null;
}
