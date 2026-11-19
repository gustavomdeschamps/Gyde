// Apaga uma pasta que o próprio Gyde criou (anexos de uma conversa da Forja, cópia de restauração pendente, pasta
// temporária), e só ela. A mesma ideia de ferramentas/limpeza-segura.mjs, para o código do app:
//  - a pasta precisa ser filha DIRETA de uma base conhecida e ter um nome do padrão esperado (nunca a própria base);
//  - atalhos (link simbólico ou junction) são removidos como atalho: o destino deles nunca é tocado;
//  - não usa rmSync recursivo, que é o tipo de comando que já apagou um projeto seguindo uma junction.
import { chmodSync, lstatSync, readdirSync, realpathSync, rmdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const comparar = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p);
const real = (p: string) => { try { return realpathSync.native(p); } catch { return path.resolve(p); } };

/** Por que não pode apagar (ou null se pode). */
export function motivoParaNaoApagar(alvo: string, base: string, nome: RegExp): string | null {
  if (!alvo || !base) return 'caminho vazio';
  const a = path.resolve(alvo);
  const pai = real(path.dirname(a));
  if (comparar(pai) !== comparar(real(base))) return 'não é uma pasta filha direta da base';
  if (!nome.test(path.basename(a))) return 'nome fora do padrão esperado';
  return null;
}

function apagarSemSeguir(p: string) {
  let st; try { st = lstatSync(p); } catch { return; }
  // atalho (link ou junction do Windows): some só o atalho, o destino nunca é tocado
  if (st.isSymbolicLink()) { try { unlinkSync(p); } catch { rmdirSync(p); } return; }
  if (!st.isDirectory()) { try { unlinkSync(p); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EPERM') throw e; chmodSync(p, 0o666); unlinkSync(p); } return; }
  for (const item of readdirSync(p)) apagarSemSeguir(path.join(p, item));
  rmdirSync(p);
}

/** Apaga a pasta se ela passa nas regras; devolve true se apagou. Recusa com erro o que está fora das regras. */
export function apagarPastaDoGyde(alvo: string, base: string, nome: RegExp): boolean {
  const motivo = motivoParaNaoApagar(alvo, base, nome);
  if (motivo) throw new Error(`Não apaguei ${alvo}: ${motivo}.`);
  try { lstatSync(alvo); } catch { return false; } // não existe
  apagarSemSeguir(path.resolve(alvo));
  return true;
}
