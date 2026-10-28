// Skills do usuário, compartilhadas entre a tela de Skills, o menu "/" do chat e o número no menu lateral.
import * as C from '$contratos';
import type { TSkill } from '$contratos';
import { pedir } from '../api.ts';
import { chat } from '../chat/estado.svelte.ts';

export const skillsState = $state({ lista: [] as TSkill[] });

export function definirSkills(lista: TSkill[]) {
  skillsState.lista = lista;
  const instaladas = lista.filter((s) => s.instalada);
  chat.skills = instaladas;
  const selo = document.getElementById('skillsBadge');
  if (selo) selo.textContent = instaladas.length ? String(instaladas.length) : '';
}

export const recarregarSkills = () => pedir('/api/skills', C.ListaSkills).then((r) => definirSkills(r.skills)).catch(() => {});
