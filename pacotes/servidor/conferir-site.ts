// Conferência rápida de páginas que a Forja mudou, sem navegador (roda no servidor, leve, sem internet):
//  - contraste do texto (cor do texto contra o fundo da mesma regra, ou do body) abaixo de 4,5:1 (WCAG AA);
//  - <html> sem lang, <img> sem alt, página sem meta viewport (no celular a página encolhe).
// É uma aproximação: não sabe o fundo herdado de elementos aninhados. Serve para pegar os casos comuns antes de terminar.

type RGB = [number, number, number];
const NOMES: Record<string, RGB> = { white: [255, 255, 255], black: [0, 0, 0], gray: [128, 128, 128], grey: [128, 128, 128], silver: [192, 192, 192], red: [255, 0, 0], yellow: [255, 255, 0], blue: [0, 0, 255], green: [0, 128, 0], orange: [255, 165, 0], navy: [0, 0, 128] };

export function corDe(v: string, variaveis: Record<string, string> = {}): RGB | null {
  const t = v.trim().toLowerCase().replace(/\s*!important$/, '');
  const varM = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(t);
  if (varM) { const x = variaveis[varM[1]!] ?? varM[2]; return x ? corDe(x, variaveis) : null; }
  if (NOMES[t]) return NOMES[t]!;
  let m = /^#([0-9a-f]{3,8})$/.exec(t);
  if (m) {
    let h = m[1]!;
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
    if (h.length === 8 && parseInt(h.slice(6, 8), 16) < 255) return null; // transparente: o fundo real é outro
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(t);
  if (m) { if (m[4] !== undefined && parseFloat(m[4]) < (m[4].endsWith('%') ? 100 : 1)) return null; return [Number(m[1]), Number(m[2]), Number(m[3])]; }
  return null;
}

const lum = ([r, g, b]: RGB) => { const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
export function contraste(a: RGB, b: RGB): number { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); }

interface Regra { seletor: string; decl: Record<string, string> }
function regras(css: string): Regra[] {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Regra[] = [];
  // regras simples e as de dentro de @media (o conteúdo do bloco é lido do mesmo jeito)
  for (const m of limpo.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const decl: Record<string, string> = {};
    for (const d of m[2]!.split(';')) { const i = d.indexOf(':'); if (i > 0) decl[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim(); }
    out.push({ seletor: m[1]!.trim().replace(/\s+/g, ' '), decl });
  }
  return out;
}
const fundoDe = (d: Record<string, string>, vars: Record<string, string>) => {
  if (d['background-color']) return corDe(d['background-color'], vars);
  if (d.background) { const c = d.background.split(/\s+(?![^(]*\))/).map((p) => corDe(p, vars)).find(Boolean); return c ?? null; }
  return null;
};

export interface ProblemaSite { arquivo: string; problema: string }

/** Problemas nas páginas e estilos. arquivos: caminho -> conteúdo (só .html e .css interessam). */
export function conferirSite(arquivos: Record<string, string>): ProblemaSite[] {
  const problemas: ProblemaSite[] = [];
  const csss = Object.entries(arquivos).filter(([f]) => /\.css$/i.test(f));
  const htmls = Object.entries(arquivos).filter(([f]) => /\.html?$/i.test(f));
  for (const [f, h] of htmls) {
    for (const m of h.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) csss.push([`${f} (<style>)`, m[1]!]);
    if (/<html(?![^>]*\blang=)[^>]*>/i.test(h) || !/<html/i.test(h)) problemas.push({ arquivo: f, problema: 'falta lang no <html> (ex.: <html lang="pt-BR">)' });
    if (!/<meta[^>]+name=["']viewport["'][^>]*width=device-width/i.test(h)) problemas.push({ arquivo: f, problema: 'falta <meta name="viewport" content="width=device-width, initial-scale=1">: no celular a página encolhe' });
    const semAlt = [...h.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/gi)].length;
    if (semAlt) problemas.push({ arquivo: f, problema: `${semAlt} <img> sem alt (use alt="" se for só decoração)` });
  }
  const todas = csss.flatMap(([f, c]) => regras(c).map((r) => ({ ...r, arquivo: f })));
  const vars: Record<string, string> = {};
  for (const r of todas) for (const [k, v] of Object.entries(r.decl)) if (k.startsWith('--')) vars[k] = v;
  const corpo = todas.filter((r) => /(^|,)\s*(body|html|:root)\s*(,|$)/.test(r.seletor));
  const fundoBody = corpo.map((r) => fundoDe(r.decl, vars)).filter(Boolean).at(-1) ?? [255, 255, 255] as RGB;
  for (const r of todas) {
    if (!r.decl.color) continue;
    const texto = corDe(r.decl.color, vars);
    if (!texto) continue;
    const fundo = fundoDe(r.decl, vars) ?? fundoBody;
    const c = contraste(texto, fundo);
    if (c < 4.5) problemas.push({ arquivo: r.arquivo, problema: `contraste ${c.toFixed(1)}:1 em "${r.seletor}" (${r.decl.color} sobre ${fundoDe(r.decl, vars) ? 'o fundo da própria regra' : 'o fundo da página'}); o mínimo para texto é 4,5:1` });
  }
  return problemas.slice(0, 12);
}
