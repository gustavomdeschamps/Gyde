// Ruas de dependência da Cidade e saúde do projeto, sem rodar nada do projeto (só lendo o texto dos arquivos):
//  - quem importa quem: JS e TS (import, export ... from, require, import()), Python (import e from ... import),
//    CSS (@import) e HTML (src e href locais). Só caminhos do próprio projeto; pacotes de fora não viram rua.
//  - saúde: arquivos muito grandes, dependências em ciclo, arquivos de código que ninguém usa, testes e os mais alterados.
// Leve de propósito: até 1.500 arquivos lidos, até 300 KB cada, e no máximo LIMITE_RUAS ruas (a cena tem de rodar
// numa placa integrada).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const LIMITE_RUAS = 1500;
const MAX_LER = 300_000;
const CODIGO = /\.(m?[jt]sx?|cjs|svelte|vue|py)$/i;
const LIDOS = /\.(m?[jt]sx?|cjs|svelte|vue|py|css|scss|html?|json)$/i;
// código de terceiros copiado para o projeto (vendor, minificado): não entra na saúde
const TERCEIROS = /(^|\/)(vendor|vendors|third[_-]party|externos)\/|\.min\.[a-z]+$/i;
const EXT_JS = ['', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.svelte', '.vue', '.json', '/index.ts', '/index.js', '/index.tsx', '/index.jsx', '/index.mjs'];

/** Os destinos que um arquivo cita (ainda não conferidos contra os arquivos que existem). */
export function citacoes(caminho: string, texto: string): string[] {
  const dir = path.posix.dirname(caminho);
  const rel = (spec: string) => path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, spec));
  const saida: string[] = [];
  if (/\.(m?[jt]sx?|cjs|svelte|vue)$/i.test(caminho)) {
    const semComentario = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    for (const m of semComentario.matchAll(/(?:\bimport\s+(?:[^'"`;]*?\s+from\s+)?|\bexport\s+[^'"`;]*?\s+from\s+|\brequire\s*\(\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const spec = m[1]!;
      if (spec.startsWith('./') || spec.startsWith('../')) saida.push(rel(spec));
      // atalhos comuns de projeto: "@/x" e "~/x" (Vite, Next) apontam para src/x; "$lib/x" (SvelteKit) para src/lib/x
      else if (/^[@~]\//.test(spec)) saida.push(`src/${spec.slice(2)}`);
      else if (spec.startsWith('$lib/')) saida.push(`src/lib/${spec.slice(5)}`);
    }
  } else if (/\.py$/i.test(caminho)) {
    for (const m of texto.matchAll(/^\s*from\s+(\.*)([\w.]*)\s+import\s+([\w*, ()]+)|^\s*import\s+([\w.]+)/gm)) {
      if (m[4]) { saida.push(`py:${m[4]}`); continue; }
      const pontos = m[1]!.length, mod = m[2]!;
      if (pontos) {
        let base = dir === '.' ? '' : dir;
        for (let i = 1; i < pontos; i++) base = path.posix.dirname(base) === '.' ? '' : path.posix.dirname(base);
        const alvo = [base, mod.replaceAll('.', '/')].filter(Boolean).join('/');
        saida.push(`pyrel:${alvo}`);
        if (!mod) for (const nome of m[3]!.replace(/[()]/g, '').split(',').map((x) => x.trim()).filter(Boolean)) saida.push(`pyrel:${[base, nome].filter(Boolean).join('/')}`);
      } else saida.push(`py:${mod}`);
    }
  } else if (/\.s?css$/i.test(caminho)) {
    for (const m of texto.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g)) if (!/^(https?:)?\/\//.test(m[1]!)) saida.push(rel(m[1]!));
  } else if (/\.json$/i.test(caminho)) {
    // package.json ("main", scripts "node x.mjs"), manifest.json (service_worker, content_scripts...): caminhos com extensão
    for (const m of texto.matchAll(/["\s]((?:\.{1,2}\/)?[\w@][\w./-]*\.(?:m?[jt]sx?|cjs|py|css|html?))(?=["\s])/g)) if (!m[1]!.startsWith('..')) saida.push(rel(m[1]!));
  } else if (/\.html?$/i.test(caminho)) {
    for (const m of texto.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)/gi)) {
      const spec = m[1]!;
      if (/^([a-z]+:|\/\/|#)/i.test(spec)) continue;
      saida.push(spec.startsWith('/') ? path.posix.normalize(spec.slice(1)) : rel(spec));
    }
  }
  return saida;
}

/** Liga uma citação a um arquivo que existe (ou null). */
export function resolver(cit: string, existe: Set<string>, origem: string): string | null {
  if (cit.startsWith('py:') || cit.startsWith('pyrel:')) {
    const mod = cit.startsWith('py:') ? cit.slice(3).replaceAll('.', '/') : cit.slice(6);
    const candidatos = cit.startsWith('py:')
      ? [`${mod}.py`, `${mod}/__init__.py`, ...(path.posix.dirname(origem) !== '.' ? [`${path.posix.dirname(origem)}/${mod}.py`] : [])]
      : [`${mod}.py`, `${mod}/__init__.py`];
    return candidatos.find((c) => existe.has(c)) ?? null;
  }
  if (cit.startsWith('..')) return null; // fora da pasta conectada
  for (const ext of EXT_JS) if (existe.has(cit + ext)) return cit + ext;
  // TypeScript no estilo NodeNext: importa "./x.js" e o arquivo é x.ts (ou x.tsx, x.mts)
  const semExt = cit.replace(/\.(m?js|jsx)$/, '');
  if (semExt !== cit) for (const ext of ['.ts', '.tsx', '.mts']) if (existe.has(semExt + ext)) return semExt + ext;
  return null;
}

/** Ruas (de, para) como índices na lista de arquivos, sem repetir e sem rua de um arquivo para ele mesmo. */
export async function ruasDaCidade(pasta: string, arquivos: { caminho: string; bytes: number; binario: boolean }[], limite = LIMITE_RUAS): Promise<{ ruas: [number, number][]; cortadas: number; terceiros: number[] }> {
  const terceiros: number[] = []; // arquivos com cabeçalho de licença de outra biblioteca (copiados para o projeto)
  const existe = new Set(arquivos.map((a) => a.caminho));
  const indice = new Map(arquivos.map((a, i) => [a.caminho, i]));
  const ruas = new Set<string>();
  for (const a of arquivos) {
    if (a.binario || a.bytes > MAX_LER || !LIDOS.test(a.caminho)) continue;
    let texto: string;
    try { texto = await readFile(path.join(pasta, a.caminho), 'utf8'); } catch { continue; }
    if (/^\s*\/\*[!*][\s\S]{0,400}?@license/.test(texto.slice(0, 600))) terceiros.push(indice.get(a.caminho)!);
    for (const c of citacoes(a.caminho, texto)) {
      const alvo = resolver(c, existe, a.caminho);
      if (alvo && alvo !== a.caminho) ruas.add(`${indice.get(a.caminho)}>${indice.get(alvo)}`);
    }
  }
  const todas = [...ruas].map((r) => r.split('>').map(Number) as [number, number]);
  return { ruas: todas.slice(0, limite), cortadas: Math.max(0, todas.length - limite), terceiros };
}

export interface Saude {
  arquivosDeCodigo: number; linhasDeCodigo: number; arquivosDeTeste: number;
  grandes: { caminho: string; linhas: number }[];
  ciclos: string[][];
  semUso: { total: number; exemplos: string[] };
  maisAlterados: { caminho: string; mudancas: number }[];
}
const TESTE = /(^|\/)(tests?|__tests__|spec|testes?)\/|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$|_test\.py$|(^|\/)(tests?|testes?)\.[a-z]+$/i;
// pontos de entrada e configurações: ninguém importa, e está certo assim
const ENTRADA = /(^|\/)(index|main|app|server|servidor|cli|manage|setup|conftest|__main__|vite\.config|next\.config|svelte\.config|eslint\.config|tailwind\.config|postcss\.config|webpack\.config|jest\.config|vitest\.config|playwright\.config)\.[a-z.]+$|(^|\/)(pages|app|routes|ferramentas|scripts|bin)\//i;

/** Saúde do projeto a partir dos prédios e das ruas (tudo contado, nada estimado). */
export function saudeDoProjeto(arquivos: { caminho: string; linhas: number; binario: boolean; mudancas: number }[], ruas: [number, number][], terceiros: number[] = []): Saude {
  const deFora = new Set(terceiros);
  const codigo = arquivos.map((a, i) => ({ ...a, i })).filter((a) => !a.binario && CODIGO.test(a.caminho) && !TERCEIROS.test(a.caminho) && !deFora.has(a.i));
  const ehCodigo = new Set(codigo.map((a) => a.i));
  const testes = codigo.filter((a) => TESTE.test(a.caminho));
  const grandes = codigo.filter((a) => a.linhas > 500).sort((a, b) => b.linhas - a.linhas).slice(0, 5).map((a) => ({ caminho: a.caminho, linhas: a.linhas }));
  const entra = new Map<number, number>();
  const sai = new Map<number, number[]>();
  for (const [de, para] of ruas) {
    entra.set(para, (entra.get(para) ?? 0) + 1);
    if (ehCodigo.has(de) && ehCodigo.has(para)) (sai.get(de) ?? sai.set(de, []).get(de)!).push(para); // ciclo só entre arquivos de código
  }
  const semUso = codigo.filter((a) => !entra.get(a.i) && !TESTE.test(a.caminho) && !ENTRADA.test(a.caminho) && !/\.d\.ts$/.test(a.caminho));
  // ciclos: busca em profundidade, guarda até 3 ciclos curtos (até 6 arquivos), sem repetir o mesmo ciclo
  const ciclos: string[][] = [];
  const vistos = new Set<string>();
  const cor = new Map<number, number>(); // 1 = na pilha, 2 = terminado
  const pilha: number[] = [];
  const anda = (n: number) => {
    if (ciclos.length >= 3) return;
    cor.set(n, 1); pilha.push(n);
    for (const m of sai.get(n) ?? []) {
      if (cor.get(m) === 1) {
        const ciclo = pilha.slice(pilha.indexOf(m));
        const chave = [...ciclo].sort((a, b) => a - b).join(',');
        if (ciclo.length <= 6 && !vistos.has(chave)) { vistos.add(chave); ciclos.push(ciclo.map((i) => arquivos[i]!.caminho)); }
      } else if (!cor.get(m)) anda(m);
      if (ciclos.length >= 3) break;
    }
    pilha.pop(); cor.set(n, 2);
  };
  for (const a of codigo) if (!cor.get(a.i)) anda(a.i);
  return {
    arquivosDeCodigo: codigo.length,
    linhasDeCodigo: codigo.reduce((n, a) => n + a.linhas, 0),
    arquivosDeTeste: testes.length,
    grandes,
    ciclos,
    semUso: { total: semUso.length, exemplos: semUso.slice(0, 5).map((a) => a.caminho) },
    maisAlterados: [...arquivos].filter((a) => a.mudancas > 0).sort((a, b) => b.mudancas - a.mudancas).slice(0, 3).map((a) => ({ caminho: a.caminho, mudancas: a.mudancas })),
  };
}
