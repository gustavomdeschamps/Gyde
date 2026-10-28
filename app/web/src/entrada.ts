// Telas de entrada (login e questionário) por cima do app, na caixa #gate. Só uma fica montada por vez.
import { mount, unmount } from 'svelte';
import Entrada from './entrada/Entrada.svelte';
import Questionario from './entrada/Questionario.svelte';

const caixa = () => document.getElementById('gate')!;
let atual: Record<string, unknown> | null = null;

function trocar(montar: (alvo: HTMLElement) => Record<string, unknown>) {
  esconderEntrada();
  const alvo = caixa();
  alvo.hidden = false;
  atual = montar(alvo);
}

export function mostrarLogin(opcoes: { modo?: string; modoEmail?: string; onentrar: () => void }) {
  trocar((alvo) => mount(Entrada, { target: alvo, props: opcoes }));
}
export function mostrarQuestionario(opcoes: { nome: string; podePular?: boolean; onfim: () => void }) {
  trocar((alvo) => mount(Questionario, { target: alvo, props: opcoes }));
}
export function esconderEntrada() {
  if (atual) { unmount(atual); atual = null; }
  const alvo = caixa();
  alvo.hidden = true;
  alvo.replaceChildren();
}
