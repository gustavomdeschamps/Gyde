// Página da Forja: monta o componente Svelte (forja/Forja.svelte) com a mesma interface que o app.js já usa.
import { mount, unmount } from 'svelte';
import * as C from '$contratos';
import { pedir, mensagemDe } from './api.ts';
import Forja from './forja/Forja.svelte';

interface Opcoes { root: HTMLElement; toast: (t: string) => void; renderMarkdown: (t: string) => string }

export function createAgentePage({ root, toast, renderMarkdown }: Opcoes) {
  let atual: Record<string, unknown> | null = null;
  let ocupado = false;
  const desmontar = () => { if (atual) { unmount(atual); atual = null; } };
  return {
    async show(id?: string) {
      if (ocupado) return; // trabalhando: não troca a tela no meio
      let lista;
      try { lista = await pedir('/api/codigo/sessoes', C.ListaSessoes); } catch (e) {
        desmontar(); root.innerHTML = '';
        const p = document.createElement('p'); p.className = 'msg-error'; p.textContent = mensagemDe(e);
        const caixa = document.createElement('div'); caixa.className = 'skills-inner'; caixa.append(p); root.append(caixa);
        return;
      }
      desmontar(); root.innerHTML = '';
      if (!lista.pessoal) {
        root.innerHTML = '<div class="skills-inner"><p class="msg-error">A Forja só funciona com o Gyde rodando no seu computador (modo pessoal): ela precisa acessar as pastas do PC.</p></div>';
        return;
      }
      atual = mount(Forja, { target: root, props: { id: id ?? null, recentes: lista.sessoes, renderMarkdown, toast, ontrabalho: (o: boolean) => { ocupado = o; } } });
    },
    ocupado: () => ocupado,
  };
}
