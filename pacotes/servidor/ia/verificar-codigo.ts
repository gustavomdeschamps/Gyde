// Verificação antes de mostrar: roda o código JavaScript de uma resposta e diz se deu erro, para o chat pedir a correção
// ao modelo (no máximo 2 vezes) em vez de entregar código quebrado.
//
// Segurança (o código vem do modelo; revisão de 19/11/2026):
//   - roda num processo Node separado com o modelo de permissões ligado (--permission: sem ler nem gravar arquivos,
//     sem criar processos nem workers) e memória limitada;
//   - dentro dele, o código roda num contexto vm VAZIO: não existem require, import, process, fetch, rede, timers nem
//     nada do Node; só a linguagem e um console que guarda o texto. Só texto sai de lá (nenhum objeto do Node entra);
//   - tempo limite de 3 s no vm e 5 s no processo; saída limitada a 100 KB (passou disso: "não verificado");
//   - no app de desktop o servidor roda dentro do Electron: o processo usa o Node do Electron (ELECTRON_RUN_AS_NODE).
//     Uma prova na primeira vez confere que ele de fato executa; se não executar, a verificação fica desligada
//     (nunca diz "rodei" sem ter rodado).
//   - Python NÃO roda sozinho: não há como isolar o Python o suficiente aqui (filtro de texto não basta). O botão
//     Executar da tela continua, porque ali quem decide rodar é a pessoa.
import { spawn } from 'node:child_process';

export interface Bloco { linguagem: 'js'; codigo: string }
/** comUso: blocos que rodaram e chamam ou mostram algo (sem isso, rodar só prova que o código não tem erro de sintaxe) */
export interface Verificacao { rodou: number; comUso: number; erros: { linguagem: string; erro: string }[] }

const JS = new Set(['js', 'javascript', 'node', 'mjs']);
const MAX_SAIDA = 100_000;

/** Por que um bloco não deve rodar (ou null se pode). O isolamento não depende disto: é só para não rodar à toa. */
export function motivoParaNaoRodar(b: Bloco): string | null {
  const c = b.codigo;
  if (c.trim().split('\n').length < 2 && !/console\.log/.test(c)) return 'trecho curto demais para ser um programa';
  if (/\b(require\s*\(|import\s|export\s|import\s*\()/.test(c)) return 'usa módulos';
  if (/\b(document|window|localStorage|fetch|XMLHttpRequest|process\.|readline|prompt\s*\(|alert\s*\()/.test(c)) return 'precisa de navegador, rede, teclado ou do Node';
  if (/:\s*(string|number|boolean|void)\b|\binterface\s+\w+|<\w+>\(/.test(c)) return 'parece TypeScript';
  return null;
}

/** Blocos de código JavaScript da resposta que dá para rodar (no máximo 3). */
export function blocosRodaveis(texto: string): Bloco[] {
  const r: Bloco[] = [];
  for (const m of texto.matchAll(/```([\w+-]*)[^\n]*\n([\s\S]*?)```/g)) {
    if (!JS.has(m[1]!.toLowerCase())) continue;
    const b: Bloco = { linguagem: 'js', codigo: m[2]! };
    // o tutor mostra de propósito o código com problema antes da correção: esse não é para "consertar"
    const antes = texto.slice(Math.max(0, (m.index ?? 0) - 180), m.index).split('\n').slice(-3).join(' ');
    if (/\b(d[áa] erro|com erro|errad|original|antes da corre|problema|n[ãa]o fa[çc]a|evite|bug|quebra|vulner[áa]vel|inseguro)/i.test(antes)) continue;
    if (!motivoParaNaoRodar(b)) r.push(b);
  }
  return r.slice(0, 3);
}

// Programa que roda no processo filho: lê o código da entrada e roda num contexto vm vazio. Só textos atravessam.
const EXECUTOR = `
const vm = require('node:vm');
let codigo = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { codigo += d; });
process.stdin.on('end', () => {
  const ctx = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext("globalThis.__saida = []; globalThis.__n = 0; const __f = (...a) => { if (__n < 100000) { const t = a.map((x) => typeof x === 'string' ? x.slice(0, 2000) : String(JSON.stringify(x) ?? x).slice(0, 2000)).join(' '); __n += t.length + 1; __saida.push(t); } }; globalThis.console = { log: __f, error: __f, warn: __f, info: __f, table: __f, debug: __f };", ctx);
  try {
    vm.runInContext(codigo, ctx, { timeout: 3000, filename: 'resposta.js' });
    const s = vm.runInContext("__saida.join('\\\\n').slice(0, 100000)", ctx);
    process.stdout.write(typeof s === 'string' ? s : '');
    process.exitCode = 0;
  } catch (e) {
    let nome = 'Error', msg = '';
    try { nome = String(e && e.name); msg = String(e && e.message); } catch {}
    process.stderr.write((nome + ': ' + msg).slice(0, 2000));
    process.exitCode = 1;
  }
});`;

/** A última linha útil do erro (sem caminhos do computador). */
function resumoDoErro(saida: string): string {
  const linhas = saida.split('\n').map((l) => l.trim()).filter(Boolean);
  const util = linhas.reverse().find((l) => /\w+(Error|Exception)\b|Error:|Erro/.test(l)) ?? linhas[0] ?? 'erro desconhecido';
  return util.replace(/[A-Za-z]:\\[^\s:]+|\/(?:Users|home|tmp)\/[^\s:]+/g, '<arquivo>').slice(0, 200);
}

type Resultado = { ok: boolean; erro: string; saida: string } | null;
function rodar(codigo: string, tempo = 5000): Promise<Resultado> {
  return new Promise((ok) => {
    const env: Record<string, string> = { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' };
    if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = '1'; // no app de desktop, o "Node" é o Gyde.exe
    let p;
    try { p = spawn(process.execPath, ['--permission', '--max-old-space-size=128', '-e', EXECUTOR], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env }); }
    catch { ok(null); return; }
    let err = '', out = '', acabou = false, grande = false;
    const fim = (r: Resultado) => { if (!acabou) { acabou = true; clearTimeout(relogio); ok(r); } };
    const relogio = setTimeout(() => { p.kill(); fim({ ok: false, erro: 'o código não terminou em 3 segundos (laço infinito ou espera)', saida: '' }); }, tempo);
    // saída limitada: passou do limite, para tudo e fica "não verificado" (código certo pode imprimir muito)
    const juntar = (qual: 'out' | 'err') => (d: Buffer) => {
      try {
        if (qual === 'out') out += d; else err += d;
        if (out.length + err.length > MAX_SAIDA) { grande = true; p.kill(); }
      } catch { grande = true; p.kill(); }
    };
    p.stdout.on('data', juntar('out'));
    p.stderr.on('data', juntar('err'));
    p.stdin.on('error', () => { /* o processo saiu antes de ler tudo */ });
    p.on('error', () => fim(null)); // sem o programa: não dá para verificar (não é erro do código)
    p.on('close', (status) => {
      if (grande) return fim(null);
      if (status === 0) return fim({ ok: true, erro: '', saida: out });
      const e = err || out;
      if (/timed out|Script execution timed out/i.test(e)) return fim({ ok: false, erro: 'o código não terminou em 3 segundos (laço infinito ou espera)', saida: '' });
      // usou algo que só existe fora da linguagem (Node, navegador, timers): não dá para dizer se o código está certo
      if (/^ReferenceError: (require|process|module|exports|setTimeout|setInterval|setImmediate|fetch|Buffer|structuredClone|queueMicrotask|globalThis\.process|document|window|__dirname|__filename)\b/.test(e)) return fim(null);
      if (status === null || !e) return fim(null); // morto por outro motivo (memória, sistema): não é erro do código
      fim({ ok: false, erro: resumoDoErro(e), saida: out });
    });
    p.stdin.end(codigo);
  });
}

// prova na primeira vez: o processo executa mesmo? (no app de desktop, sem isso o Gyde.exe abriria como app e
// "terminaria sem erro" sem ter rodado nada)
let funciona: Promise<boolean> | null = null;
export function verificacaoDisponivel(): Promise<boolean> {
  funciona ??= rodar('console.log(6 * 7);\nconsole.log("ok");').then((r) => Boolean(r?.ok && r.saida === '42\nok'));
  return funciona;
}

export async function rodarBloco(b: Bloco): Promise<{ ok: boolean; erro: string } | null> {
  if (!(await verificacaoDisponivel())) return null;
  const r = await rodar(b.codigo);
  return r && { ok: r.ok, erro: r.erro };
}

/** Roda os blocos da resposta e devolve quantos rodaram e os erros. */
export async function verificarCodigo(texto: string): Promise<Verificacao> {
  const v: Verificacao = { rodou: 0, comUso: 0, erros: [] };
  for (const b of blocosRodaveis(texto)) {
    const r = await rodarBloco(b);
    if (!r) continue;
    v.rodou++;
    if (/console\.\w+\s*\(/.test(b.codigo)) v.comUso++;
    if (!r.ok) v.erros.push({ linguagem: 'JavaScript', erro: r.erro });
  }
  return v;
}
