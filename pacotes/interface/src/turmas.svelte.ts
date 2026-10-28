// Página de Turmas: monta o componente Svelte (turmas/Turmas.svelte) e troca só o id quando a rota muda.
import { mount } from 'svelte';
import Turmas from './turmas/Turmas.svelte';

export function createTurmasPage({ root }: { root: HTMLElement }) {
  const props = $state({ id: null as string | null });
  let app: ReturnType<typeof mount> | null = null;
  return {
    show(id?: string) {
      props.id = id ?? null;
      if (!app) { root.innerHTML = ''; app = mount(Turmas, { target: root, props }); }
      root.scrollTop = 0;
    },
  };
}
