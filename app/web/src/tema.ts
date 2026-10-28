// Tema claro/escuro/automático. Fica no navegador (precisa valer antes do login, sem piscar).
export type Tema = 'auto' | 'light' | 'dark';
export const temaSalvo = (): Tema => { try { const t = localStorage.getItem('theme'); return t === 'light' || t === 'dark' ? t : 'auto'; } catch { return 'auto'; } };
export const temaAtual = (): 'light' | 'dark' => (document.documentElement.dataset.theme as 'light' | 'dark' | undefined) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// aplica o tema dos blocos de código e o rótulo do botão do menu
export function aplicarTema() {
  const escuro = temaAtual() === 'dark';
  const css = document.getElementById('hljs-theme') as HTMLLinkElement | null;
  if (css) css.href = `/vendor/hljs/styles/${escuro ? 'github-dark' : 'github'}.min.css`;
  const rotulo = document.getElementById('themeLabel');
  if (rotulo) rotulo.textContent = escuro ? 'Tema claro' : 'Tema escuro';
}
export function definirTema(t: Tema) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { if (t === 'auto') localStorage.removeItem('theme'); else localStorage.setItem('theme', t); } catch { /* sem storage */ }
  aplicarTema();
}
