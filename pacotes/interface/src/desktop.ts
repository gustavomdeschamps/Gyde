// Ponte do app de desktop (pacotes/desktop/preload.cjs). No navegador ela não existe e `desktop` fica undefined.
type Resultado = { ok: boolean; cancelado?: boolean; erro?: string };
export interface PonteDesktop {
  escolherPasta: () => Promise<string | null>;
  redefinirSenha: (email: string, senha: string) => Promise<Resultado>;
  importarDados: () => Promise<Resultado>;
  reiniciar: () => Promise<void>;
}
export const desktop = (window as { gydeDesktop?: PonteDesktop }).gydeDesktop;
