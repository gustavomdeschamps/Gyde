// Configurações e indicador de uso: monta os componentes Svelte e devolve o que o main.ts usa.
import { mount } from 'svelte';
import Configuracoes from './config/Configuracoes.svelte';
import UsoChip from './config/UsoChip.svelte';

type Aba = 'geral' | 'ia' | 'uso' | 'pratica' | 'dados' | 'extensoes';
interface Opcoes {
  toast: (t: string) => void; copiar: (texto: string, botao: HTMLElement) => void; verAbertura: () => void;
  refazerQuiz: () => void; restaurarModelo: () => void; recarregarConversas: () => Promise<void>;
}

export function montarConfiguracoes(opcoes: Opcoes) {
  const alvo = document.createElement('div');
  document.body.append(alvo);
  const config = mount(Configuracoes, { target: alvo, props: opcoes }) as { abrir: (aba?: Aba) => Promise<void> };
  const raizChip = document.getElementById('usoChipRaiz');
  if (raizChip) mount(UsoChip, { target: raizChip, props: { onabrir: () => config.abrir('uso') } });
  return { abrir: (aba?: Aba) => config.abrir(aba) };
}
