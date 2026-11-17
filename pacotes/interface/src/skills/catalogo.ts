// Catálogo de skills por objetivo: a cor de cada categoria e a busca por intenção ("quero fazer um site").
import type { TSkill, TPacoteSkills } from '$contratos';

// Tom de cada categoria: usado só no quadrado do ícone, para a cor dizer a categoria (funciona no claro e no escuro).
export const COR_CATEGORIA: Record<string, string> = {
  'Sites e design': '#d9488f',
  'Aplicativos e APIs': '#2563eb',
  Jogos: '#7c3aed',
  'Dados e planilhas': '#0d9488',
  'Banco de dados': '#b45309',
  'Testes e qualidade': '#16a34a',
  Segurança: '#dc2626',
  'Git e publicação': '#ea580c',
  Documentação: '#0891b2',
  'Estudar e aprender': '#ca8a04',
  'Automação e scripts': '#64748b',
};
export const corDe = (categoria: string) => COR_CATEGORIA[categoria] ?? 'var(--accent)';

// Palavras que não dizem o assunto: "quero fazer um site" vira só "site"
const VAZIAS = new Set(('quero queria preciso gostaria vou como fazer faço criar crio montar um uma uns umas o a os as de da do das dos em no na nos nas ' +
  'para pra por com e ou que meu minha meus minhas seu sua eu me te se ao aos à às sobre algo coisa ajuda ajudar aprender usar ter tem é ser está').split(' '));
export const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const termosDe = (busca: string) => normalizar(busca).split(/[^a-z0-9.#+/-]+/).filter((p) => p.length > 1 && !VAZIAS.has(p));

/** Nota de um pacote para a busca: a frase inteira do objetivo vale mais que palavra solta. */
export function notaPacote(p: TPacoteSkills, busca: string): number {
  const b = normalizar(busca);
  const termos = termosDe(busca);
  if (!termos.length) return 0;
  let nota = 0;
  for (const f of p.frases) { const nf = normalizar(f); if (b.includes(nf)) nota += 6 + nf.split(' ').length; else if (termos.some((t) => nf.split(' ').includes(t))) nota += 2; }
  const texto = normalizar(`${p.nome} ${p.descricao}`);
  for (const t of termos) if (texto.includes(t)) nota += 1;
  return nota;
}

/** Nota de uma skill para a busca: palavra do assunto (gatilho) e nome valem mais que a descrição. */
export function notaSkill(s: TSkill, busca: string): number {
  const termos = termosDe(busca);
  if (!termos.length) return 0;
  const b = normalizar(busca);
  const gatilhos = s.gatilhos.map(normalizar);
  let nota = 0;
  for (const g of gatilhos) if (g.length > 2 && b.includes(g)) nota += 4;
  const nome = normalizar(s.nome), resto = normalizar(`${s.descricao} ${s.categoria} ${s.comando}`);
  for (const t of termos) {
    if (gatilhos.some((g) => g.split(' ').includes(t))) nota += 2;
    if (nome.includes(t)) nota += 3;
    if (resto.includes(t)) nota += 1;
  }
  return nota;
}

/** Texto honesto do teste: % de critérios cumpridos com e sem a skill e o tamanho da amostra. */
export function textoDoTeste(t: TSkill['teste'], curto = false): string {
  if (!t || t.com == null || t.sem == null) return curto ? 'Ainda não testada' : 'Esta skill ainda não passou pela avaliação com e sem ela.';
  if (curto) return `Testada: ${t.com}% com ela, ${t.sem}% sem`;
  return `Na avaliação, a mesma tarefa cumpriu ${t.com}% dos critérios com a skill e ${t.sem}% sem ela (${t.criterios} critérios, ${t.n} ${t.n === 1 ? 'execução' : 'execuções'} de cada lado). Amostra pequena: serve para comparar, não é garantia.`;
}
