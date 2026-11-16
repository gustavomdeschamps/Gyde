// Limpeza segura para as ferramentas do repositório: só apaga o que está numa LISTA EXPLÍCITA de caminhos permitidos,
// e nunca segue atalhos (junction ou link simbólico). Em 16/11/2026 uma remoção recursiva seguiu a junction de
// node_modules de uma cópia de comparação e apagou arquivos do projeto; esta função existe para isso não se repetir.
//
// Regras:
//  - cada caminho a apagar precisa estar DENTRO de uma das raízes da lista (nunca a própria raiz) e o nome do item
//    de primeiro nível precisa casar com o padrão da raiz (ex.: "gyde-*" na pasta temporária);
//  - nada da lista de protegidos (.env, data, banco, %APPDATA%\Gyde, a pasta do projeto) é apagado, nem o que contém
//    um protegido;
//  - atalhos dentro do que é apagado são removidos como atalho: o destino deles nunca é tocado.
import { lstatSync, readdirSync, rmdirSync, unlinkSync, realpathSync, chmodSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Caminhos que nunca são apagados (nem o que os contém). */
export function protegidos() {
  const lista = [PROJETO, path.join(PROJETO, '.env'), path.join(PROJETO, 'data'), path.join(homedir(), '.claude')];
  if (process.env.APPDATA) lista.push(path.join(process.env.APPDATA, 'Gyde'));
  return lista;
}

/** Lista padrão das ferramentas: pastas temporárias com nome gyde-* (testes, avaliações, capturas). */
export function listaPadrao() {
  return [{ raiz: tmpdir(), padrao: 'gyde-*' }];
}

const real = (p) => { try { return realpathSync.native(p); } catch { return path.resolve(p); } };
const comparar = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
const dentro = (filho, pai) => { const r = path.relative(comparar(pai), comparar(filho)); return !!r && !r.startsWith('..') && !path.isAbsolute(r); };
const igual = (a, b) => comparar(path.resolve(a)) === comparar(path.resolve(b));
const casa = (nome, padrao) => new RegExp('^' + padrao.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i').test(nome);

/** Diz por que um caminho não pode ser apagado (ou null se pode). */
export function motivoParaRecusar(caminho, lista = listaPadrao(), protegidosExtra = []) {
  if (!caminho || typeof caminho !== 'string') return 'caminho vazio';
  const alvo = path.resolve(caminho);
  // compara pelo caminho real do PAI (o próprio item pode ser um atalho, e aí o atalho é o que se apaga)
  const alvoReal = path.join(real(path.dirname(alvo)), path.basename(alvo));
  for (const p of [...protegidos(), ...protegidosExtra]) {
    for (const x of new Set([path.resolve(p), real(p)])) {
      if (igual(alvo, x) || igual(alvoReal, x) || dentro(alvo, x) || dentro(alvoReal, x) || dentro(x, alvo) || dentro(x, alvoReal)) return `protegido (${x})`;
    }
  }
  for (const { raiz, padrao } of lista) {
    for (const r of new Set([path.resolve(raiz), real(raiz)])) {
      for (const a of [alvo, alvoReal]) {
        if (!dentro(a, r)) continue;
        const primeiro = path.relative(r, a).split(/[\\/]/)[0];
        if (casa(primeiro, padrao)) return null;
      }
    }
  }
  return 'fora da lista de caminhos permitidos';
}

function apagarSemSeguir(p) {
  let st;
  try { st = lstatSync(p); } catch { return; }
  if (st.isSymbolicLink()) { try { unlinkSync(p); } catch { rmdirSync(p); } return; } // atalho: some só o atalho
  if (st.isDirectory()) {
    for (const nome of readdirSync(p)) apagarSemSeguir(path.join(p, nome));
    for (let i = 0; ; i++) {
      try { rmdirSync(p); return; } catch (e) { if (i >= 9 || !['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(e.code)) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); }
    }
  }
  try { unlinkSync(p); } catch (e) { if (e.code !== 'EPERM') throw e; chmodSync(p, 0o666); unlinkSync(p); } // arquivos do .git são só leitura no Windows
}

/** Apaga um caminho que está na lista; recusa (com erro) qualquer outro. */
export function apagarSeguro(caminho, lista = listaPadrao(), protegidosExtra = []) {
  const motivo = motivoParaRecusar(caminho, lista, protegidosExtra);
  if (motivo) throw new Error(`Limpeza recusada: ${caminho}: ${motivo}`);
  apagarSemSeguir(path.resolve(caminho));
}
