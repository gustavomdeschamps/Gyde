// Abre o Passo a passo de um trecho de Python (diálogo Svelte, desmontado ao fechar).
import { mount, unmount } from 'svelte';
import PassoAPasso from './passo/PassoAPasso.svelte';

export function openTrace(codigo: string) {
  const alvo = document.createElement('div');
  document.body.append(alvo);
  const componente = mount(PassoAPasso, { target: alvo, props: { codigo, onfechar: () => { unmount(componente); alvo.remove(); } } });
}
