<script lang="ts">
  // Prática: escolhe a tela (início, trilha ou exercício) e cuida dos estados de carregamento e erro.
  // Os dados vêm conferidos pelo contrato (EstadoPratica): servidor desatualizado vira mensagem clara, não tela vazia.
  import { untrack } from 'svelte';
  import * as C from '$contratos';
  import type { TEstadoPratica } from '$contratos';
  import { pedir, mensagemDe } from '../api.ts';
  import Inicio from './Inicio.svelte';
  import Trilha from './Trilha.svelte';
  import Exercicio from './Exercicio.svelte';

  let { partes, toast, renderMarkdown, onXp, abrirNoChat, fazerQuiz }: {
    partes: string[]; toast: (t: string) => void; renderMarkdown: (t: string) => string; onXp: (xp: number) => void;
    abrirNoChat: (texto: string) => void; fazerQuiz: () => void;
  } = $props();

  let dados = $state<TEstadoPratica | null>(null);
  let erro = $state('');

  export async function carregar() {
    erro = '';
    try { atualizar(await pedir('/api/pratica', C.EstadoPratica)); } catch (e) { console.error('[Gyde] Prática:', e); erro = mensagemDe(e); }
  }
  function atualizar(novo: TEstadoPratica) { dados = novo; onXp(novo.xp); }
  // a tela inicial sempre busca de novo (XP, desafio e plano podem ter mudado); trilha e exercício usam o que já tem
  $effect(() => { const p = partes; untrack(() => { if (!p.length || !dados) carregar(); }); });

  const trilha = $derived(dados && partes[0] ? dados.tracks.find((t) => t.id === partes[0]) : undefined);
  const existe = $derived(!partes.length || (trilha && (!partes[1] || trilha.exercises.some((e) => e.id === partes[1]))));
  $effect(() => { if (dados && !existe) location.hash = '#/pratica'; });
</script>

{#if erro}
  <div class="skills-inner"><div class="estado-erro" role="alert">
    <h2>Não deu para abrir a Prática</h2><p>{erro}</p>
    <button type="button" class="btn primary" onclick={carregar}>Tentar de novo</button>
  </div></div>
{:else if !dados}
  <div class="skills-inner" aria-busy="true"><p class="sr-only">Carregando a Prática…</p><div class="skeleton" style="height:120px;margin-top:24px"></div><div class="skeleton" style="height:180px"></div></div>
{:else if !partes.length}
  <Inicio {dados} {toast} onatualizar={atualizar} {abrirNoChat} {fazerQuiz} />
{:else if existe && partes[1]}
  {#key partes[1]}<Exercicio {dados} trilhaId={partes[0]!} exercicioId={partes[1]} {renderMarkdown} {toast} onatualizar={atualizar} />{/key}
{:else if existe}
  <Trilha {dados} trilhaId={partes[0]!} />
{/if}
