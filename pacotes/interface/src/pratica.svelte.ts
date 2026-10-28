// Página da Prática: monta o componente Svelte (pratica/Pratica.svelte) com a mesma interface que o app.js já usa.
import { mount } from 'svelte';
import * as C from '$contratos';
import { pedir } from './api.ts';
import Pratica from './pratica/Pratica.svelte';

interface Opcoes { root: HTMLElement; toast: (t: string) => void; renderMarkdown: (t: string) => string; onXp: (xp: number) => void }

// abre o chat com o texto pronto (o Gyde corrige sem entregar a resposta)
function abrirNoChat(texto: string) {
  location.hash = '#/';
  setTimeout(() => { const campo = document.getElementById('input') as HTMLTextAreaElement | null; if (!campo) return; campo.value = texto; campo.dispatchEvent(new Event('input')); campo.focus(); }, 300);
}
const fazerQuiz = () => document.getElementById('redoQuiz')?.click();

export function createPractice({ root, toast, renderMarkdown, onXp }: Opcoes) {
  const props = $state({ partes: [] as string[], toast, renderMarkdown, onXp, abrirNoChat, fazerQuiz });
  let app: ReturnType<typeof mount> | null = null;
  return {
    show(partes: string[]) {
      props.partes = partes;
      if (!app) { root.innerHTML = ''; app = mount(Pratica, { target: root, props }); }
      root.scrollTop = 0;
    },
    refreshXp: () => pedir('/api/pratica', C.EstadoPratica).then((d) => onXp(d.xp)).catch(() => {}),
  };
}
