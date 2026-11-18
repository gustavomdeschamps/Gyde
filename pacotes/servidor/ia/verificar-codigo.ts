// Verificação antes de mostrar: roda o código JavaScript ou Python de uma resposta e diz se deu erro, para o chat pedir a
// correção ao modelo (no máximo 2 vezes) em vez de entregar código quebrado.
//
// Segurança: o código vem do modelo, então só roda o que é "puro" e com limites.
//   - JavaScript: num processo Node com o modelo de permissões ligado (--permission): sem ler nem gravar arquivos, sem
//     criar processos nem workers. Tempo limite de 4 s. Código que usa require/import, rede, DOM ou entrada do teclado
//     não roda (não daria para rodar fora do projeto da pessoa, e não é seguro).
//   - Python: só se houver Python no computador, em modo isolado (-I), e só código sem import de módulos que mexem no
//     sistema (os, sys, subprocess, shutil, pathlib, socket...), sem open(), input() nem exec/eval. Tempo limite de 4 s.
// O resto (outras linguagens, trechos que não são programa completo) não roda: a verificação fica "não verificado".
import { spawn, spawnSync } from 'node:child_process';

export interface Bloco { linguagem: 'js' | 'python'; codigo: string }
/** comUso: blocos que rodaram e chamam ou mostram algo (sem isso, rodar só prova que o código não tem erro de sintaxe) */
export interface Verificacao { rodou: number; comUso: number; erros: { linguagem: string; erro: string }[] }

const JS = new Set(['js', 'javascript', 'node', 'mjs']);
const PY = new Set(['python', 'py', 'python3']);
const PY_PERMITIDOS = new Set(['math', 'random', 'statistics', 'itertools', 'collections', 'functools', 're', 'json', 'datetime', 'decimal', 'fractions', 'string', 'typing', 'dataclasses', 'heapq', 'bisect', 'enum', 'operator', 'copy', 'textwrap', 'unicodedata']);

/** Por que um bloco não deve rodar (ou null se pode). */
export function motivoParaNaoRodar(b: Bloco): string | null {
  const c = b.codigo;
  if (c.trim().split('\n').length < 2 && !/console\.log|print\(/.test(c)) return 'trecho curto demais para ser um programa';
  if (b.linguagem === 'js') {
    if (/\b(require\s*\(|import\s|export\s)/.test(c)) return 'usa módulos';
    if (/\b(document|window|localStorage|fetch|XMLHttpRequest|process\.stdin|readline|prompt\s*\(|alert\s*\()/.test(c)) return 'precisa de navegador, rede ou teclado';
    if (/:\s*(string|number|boolean|void)\b|\binterface\s+\w+|<\w+>\(/.test(c)) return 'parece TypeScript';
    return null;
  }
  for (const m of c.matchAll(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))/gm)) {
    const mods = (m[1] ?? m[2] ?? '').split(',').map((x) => x.trim().split(/\s+/)[0]!.split('.')[0]!);
    if (mods.some((x) => !PY_PERMITIDOS.has(x))) return 'usa módulo que mexe no sistema ou não vem com o Python';
  }
  if (/\b(open|input|exec|eval|__import__|compile)\s*\(/.test(c)) return 'lê arquivo, teclado ou roda código dinâmico';
  return null;
}

/** Blocos de código da resposta que dá para rodar com segurança (no máximo 3). */
export function blocosRodaveis(texto: string): Bloco[] {
  const r: Bloco[] = [];
  for (const m of texto.matchAll(/```([\w+-]*)[^\n]*\n([\s\S]*?)```/g)) {
    const l = m[1]!.toLowerCase();
    const linguagem = JS.has(l) ? 'js' : PY.has(l) ? 'python' : null;
    if (!linguagem) continue;
    const b: Bloco = { linguagem, codigo: m[2]! };
    // o tutor mostra de propósito o código com problema antes da correção: esse não é para "consertar"
    const antes = texto.slice(Math.max(0, (m.index ?? 0) - 180), m.index).split('\n').slice(-3).join(' ');
    if (/\b(d[áa] erro|com erro|errad|original|antes da corre|problema|n[ãa]o fa[çc]a|evite|bug|quebra|vulner[áa]vel|inseguro)/i.test(antes)) continue;
    if (!motivoParaNaoRodar(b)) r.push(b);
  }
  return r.slice(0, 3);
}

let python: string | null | undefined;
function comandoPython(): string | null {
  if (python !== undefined) return python;
  for (const c of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    try { if (spawnSync(c, ['--version'], { timeout: 4000 }).status === 0) return (python = c); } catch { /* não tem */ }
  }
  return (python = null);
}

/** A última linha útil do erro (sem caminhos do computador). */
function resumoDoErro(saida: string): string {
  const linhas = saida.split('\n').map((l) => l.trim()).filter(Boolean);
  const util = linhas.reverse().find((l) => /\w+(Error|Exception)\b|Error:|Erro/.test(l)) ?? linhas[0] ?? 'erro desconhecido';
  return util.replace(/[A-Za-z]:\\[^\s:]+|\/(?:Users|home|tmp)\/[^\s:]+/g, '<arquivo>').slice(0, 200);
}

function rodar(comando: string, args: string[], codigo: string, tempo = 4000): Promise<{ ok: boolean; erro: string } | null> {
  return new Promise((ok) => {
    const p = spawn(comando, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' } });
    let err = '', out = '';
    const relogio = setTimeout(() => { p.kill(); ok({ ok: false, erro: 'o código não terminou em 4 segundos (laço infinito ou espera)' }); }, tempo);
    p.stdout.on('data', (d) => { out += d; if (out.length > 100_000) p.kill(); });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', () => { clearTimeout(relogio); ok(null); }); // sem o programa: não dá para verificar (não é erro do código)
    p.on('close', (status) => { clearTimeout(relogio); ok(status === 0 ? { ok: true, erro: '' } : { ok: false, erro: resumoDoErro(err || out) }); });
    p.stdin.end(codigo);
  });
}

export async function rodarBloco(b: Bloco): Promise<{ ok: boolean; erro: string } | null> {
  if (b.linguagem === 'js') return rodar(process.execPath, ['--permission', '-'], b.codigo);
  const py = comandoPython();
  if (!py) return null;
  return rodar(py, ['-I', '-X', 'utf8', '-'], b.codigo);
}

/** Roda os blocos da resposta e devolve quantos rodaram e os erros. */
export async function verificarCodigo(texto: string): Promise<Verificacao> {
  const v: Verificacao = { rodou: 0, comUso: 0, erros: [] };
  for (const b of blocosRodaveis(texto)) {
    const r = await rodarBloco(b);
    if (!r) continue;
    v.rodou++;
    if (/console\.\w+\s*\(|\bprint\s*\(|\bassert\b/.test(b.codigo)) v.comUso++;
    if (!r.ok) v.erros.push({ linguagem: b.linguagem === 'js' ? 'JavaScript' : 'Python', erro: r.erro });
  }
  return v;
}
