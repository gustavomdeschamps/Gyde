// Cidade do código: a pasta conectada da Forja vista como uma cidade. Pasta = bairro, arquivo = prédio,
// altura = tamanho (linhas), cor = quantas vezes o arquivo mudou no git. Só nomes e números saem daqui:
// o conteúdo dos arquivos nunca vai para a tela, e arquivos de segredo (.env, chaves) ficam de fora.
import { spawn } from 'node:child_process';
import { open, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { ARQUIVO_SECRETO, ambienteLimpo } from './seguranca.ts';

export const IGNORAR_CIDADE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv', '.cache', 'coverage', '.idea', '.vs', 'bin', 'obj', 'target']);
export const LIMITE_PREDIOS = 1500; // acima disso a cena fica pesada em computador simples; o resto é contado e avisado
const MAX_VARRIDOS = 20_000; // arquivos olhados no máximo (pastas enormes param aqui, com aviso)
const MAX_PROFUNDIDADE = 12;
const MAX_LER = 2_000_000; // arquivos maiores não são lidos para contar linhas: a altura vem do tamanho em bytes
const COMMITS = 500;

export interface Predio { caminho: string; linhas: number; bytes: number; binario: boolean; mudancas: number; ultima: number | null }
export interface MapaCidade {
  arquivos: Predio[];
  total: number; // arquivos encontrados (antes do limite de prédios)
  cortados: number; // ficaram de fora por causa do limite
  incompleta: boolean; // a varredura parou antes do fim (pasta enorme)
  git: { ativo: boolean; commits: number };
}

// Conta linhas lendo o arquivo em pedaços; um byte zero no começo marca arquivo binário (imagem, zip...).
async function medir(arquivo: string, bytes: number): Promise<{ linhas: number; binario: boolean }> {
  if (bytes === 0) return { linhas: 0, binario: false };
  if (bytes > MAX_LER) return { linhas: Math.round(bytes / 40), binario: false };
  const f = await open(arquivo, 'r');
  try {
    const buf = Buffer.alloc(64 * 1024);
    let linhas = 0, lidos = 0, ultimo = 10;
    for (;;) {
      const { bytesRead } = await f.read(buf, 0, buf.length, lidos);
      if (!bytesRead) break;
      if (lidos === 0 && buf.subarray(0, Math.min(bytesRead, 8000)).includes(0)) return { linhas: 0, binario: true };
      for (let i = 0; i < bytesRead; i++) if (buf[i] === 10) linhas++;
      ultimo = buf[bytesRead - 1]!;
      lidos += bytesRead;
    }
    return { linhas: linhas + (ultimo === 10 ? 0 : 1), binario: false };
  } finally { await f.close(); }
}

function rodarGit(pasta: string, args: string[], tempo = 15_000, entrada?: string): Promise<string | null> {
  return new Promise((ok) => {
    let saida = '';
    const p = spawn('git', args, { cwd: pasta, windowsHide: true, env: ambienteLimpo({ GIT_TERMINAL_PROMPT: '0' }) });
    p.stdin.on('error', () => { /* git saiu antes de ler tudo */ });
    p.stdin.end(entrada ?? '');
    const t = setTimeout(() => { p.kill(); ok(null); }, tempo);
    p.stdout.setEncoding('utf8').on('data', (d: string) => { saida += d; if (saida.length > 20_000_000) p.kill(); });
    p.on('error', () => { clearTimeout(t); ok(null); });
    p.on('close', (c) => { clearTimeout(t); ok(c === 0 || (c === 1 && entrada != null) ? saida : null); }); // check-ignore sai com 1 quando nada é ignorado
  });
}

// Quantas vezes cada arquivo mudou nos últimos commits, com caminhos relativos à pasta conectada
// (funciona também quando a pasta é uma subpasta do repositório).
export async function historicoGit(pasta: string): Promise<{ ativo: boolean; commits: number; porArquivo: Map<string, { mudancas: number; ultima: number }> }> {
  const porArquivo = new Map<string, { mudancas: number; ultima: number }>();
  const dentro = await rodarGit(pasta, ['rev-parse', '--is-inside-work-tree'], 5000);
  if (dentro?.trim() !== 'true') return { ativo: false, commits: 0, porArquivo };
  const log = await rodarGit(pasta, ['-c', 'core.quotepath=off', 'log', `-n${COMMITS}`, '--no-merges', '--no-renames', '--relative', '--name-only', '--format=%x01%ct']);
  if (log == null) return { ativo: true, commits: 0, porArquivo };
  let commits = 0, quando = 0;
  for (const linha of log.split(/\r?\n/)) {
    if (linha.startsWith('\x01')) { commits++; quando = Number(linha.slice(1)) * 1000; continue; }
    const c = linha.trim();
    if (!c) continue;
    const atual = porArquivo.get(c);
    if (atual) atual.mudancas++; else porArquivo.set(c, { mudancas: 1, ultima: quando }); // o log vem do mais novo para o mais velho
  }
  return { ativo: true, commits, porArquivo };
}

export async function mapaDaCidade(pasta: string, { limite = LIMITE_PREDIOS }: { limite?: number } = {}): Promise<MapaCidade> {
  const achados: { caminho: string; bytes: number; completo: string }[] = [];
  let incompleta = false;
  const anda = async (dir: string, rel: string, nivel: number) => {
    if (nivel > MAX_PROFUNDIDADE) { incompleta = true; return; }
    let itens;
    try { itens = await readdir(dir, { withFileTypes: true }); } catch { return; }
    itens.sort((a, b) => a.name.localeCompare(b.name));
    for (const it of itens) {
      if (achados.length >= MAX_VARRIDOS) { incompleta = true; return; }
      if (IGNORAR_CIDADE.has(it.name) || it.name.startsWith('.') || it.isSymbolicLink()) continue;
      const r = rel ? `${rel}/${it.name}` : it.name;
      if (ARQUIVO_SECRETO.test(r)) continue;
      const completo = path.join(dir, it.name);
      if (it.isDirectory()) await anda(completo, r, nivel + 1);
      else if (it.isFile()) {
        try { achados.push({ caminho: r, bytes: (await stat(completo)).size, completo }); } catch { /* sumiu ou sem acesso */ }
      }
    }
  };
  await anda(pasta, '', 1);
  const git = await historicoGit(pasta);
  // com git, o que o .gitignore manda ignorar (builds, caches, saídas) não vira prédio
  if (git.ativo && achados.length) {
    const ignorados = await rodarGit(pasta, ['-c', 'core.quotepath=off', 'check-ignore', '--stdin'], 15_000, achados.map((a) => a.caminho).join('\n'));
    if (ignorados) {
      const fora = new Set(ignorados.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
      for (let i = achados.length - 1; i >= 0; i--) if (fora.has(achados[i]!.caminho)) achados.splice(i, 1);
    }
  }
  // limite de prédios: ficam os mais alterados e os maiores (o que mais interessa ver), o resto é contado
  const nota = (a: { caminho: string; bytes: number }) => (git.porArquivo.get(a.caminho)?.mudancas ?? 0) * 1_000_000 + a.bytes;
  const escolhidos = achados.length > limite ? [...achados].sort((a, b) => nota(b) - nota(a)).slice(0, limite) : achados;
  const arquivos: Predio[] = [];
  for (const a of escolhidos) {
    let m = { linhas: 0, binario: false };
    try { m = await medir(a.completo, a.bytes); } catch { /* arquivo em uso: fica sem linhas */ }
    const h = git.porArquivo.get(a.caminho);
    arquivos.push({ caminho: a.caminho, bytes: a.bytes, linhas: m.linhas, binario: m.binario, mudancas: h?.mudancas ?? 0, ultima: h?.ultima ?? null });
  }
  arquivos.sort((a, b) => a.caminho.localeCompare(b.caminho));
  return { arquivos, total: achados.length, cortados: achados.length - escolhidos.length, incompleta, git: { ativo: git.ativo, commits: git.commits } };
}
