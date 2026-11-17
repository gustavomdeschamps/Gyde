// Ícones do Gyde: um conjunto só (Lucide, gerado em icones-lucide.ts), com o mesmo traço, tamanho e alinhamento em
// todo o app. A cor vem do texto (currentColor), então funcionam nos temas claro e escuro sem nada a mais.
// Acessibilidade: sem rótulo, o ícone é decorativo e fica escondido do leitor de tela (o texto ao lado já diz tudo);
// num botão só com ícone, passe o rótulo, que vira o nome acessível.
import { ICONES } from './icones-lucide.ts';

export type NomeIcone = keyof typeof ICONES;

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const existeIcone = (nome: string): boolean => Object.hasOwn(ICONES, nome);

/** SVG do ícone em texto (para {@html}). Nome desconhecido vira o ícone de interrogação, nunca um caractere solto. */
export function icone(nome: string, rotulo?: string, classe = ''): string {
  const corpo = ICONES[nome] ?? ICONES['circle-question-mark'];
  const a11y = rotulo ? `role="img" aria-label="${escapar(rotulo)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="icone${classe ? ` ${classe}` : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${corpo}</svg>`;
}
