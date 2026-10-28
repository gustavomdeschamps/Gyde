// Página de Skills: monta o componente Svelte (skills/Skills.svelte) e troca só o id quando a rota muda.
import { mount } from 'svelte';
import Skills from './skills/Skills.svelte';
import { recarregarSkills } from './skills/estado.svelte.ts';

export function createSkillsPage({ root, renderMarkdown }: { root: HTMLElement; renderMarkdown: (t: string) => string }) {
  const props = $state({ id: null as string | null, renderMarkdown });
  let app: ReturnType<typeof mount> | null = null;
  return {
    show(id?: string) {
      props.id = id ?? null;
      if (!app) { root.innerHTML = ''; app = mount(Skills, { target: root, props }); }
      root.scrollTop = 0;
    },
    refresh: recarregarSkills,
  };
}
