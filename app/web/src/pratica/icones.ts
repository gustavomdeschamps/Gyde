// Ícones da Prática e formatação de valores no jeito de cada linguagem.
export const icons: Record<string, string> = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 5v14l11-7z"/></svg>',
  test: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/></svg>',
  bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/></svg>',
  steps: '<svg viewBox="0 0 24 24"><path d="M4 6h10M4 12h6M4 18h10M17 9l3 3-3 3"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};
export const LANG_LABEL: Record<string, string> = { python: 'Python', javascript: 'JavaScript' };
export const FILE_EXT: Record<string, string> = { python: 'py', javascript: 'js' };
export const NIVEL_NOME: Record<string, string> = { basico: 'básico', intermediario: 'intermediário', avancado: 'avançado' };

// Mostra valores no jeito da linguagem (True/None em Python).
export function mostrar(v: unknown, lang: string): string {
  if (v === '__undefined__') return 'undefined';
  const json = JSON.stringify(v);
  if (lang !== 'python' || json === undefined) return json ?? String(v);
  return json.replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None');
}
