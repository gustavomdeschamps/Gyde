<script lang="ts">
  // "Mostrar o erro": o print com a região do problema destacada (estimada por um modelo com visão) e a explicação.
  import { onMount } from 'svelte';
  import * as C from '$contratos';
  import type { TApontamento } from '$contratos';
  import { pedir, corpo, mensagemDe } from '../api.ts';

  let { imagem, nome, pergunta, onfechar }: { imagem: string; nome: string; pergunta: string; onfechar: () => void } = $props();
  let dialogo: HTMLDialogElement | undefined = $state();
  let r = $state<TApontamento | null>(null);
  let erro = $state('');

  async function analisar() {
    r = null; erro = '';
    try { r = await pedir('/api/apontar', C.Apontamento, corpo({ imagem, pergunta })); } catch (e) { erro = mensagemDe(e); }
  }
  onMount(() => { dialogo?.showModal(); analisar(); });
</script>

<dialog class="dialog apontar" bind:this={dialogo} onclose={onfechar} aria-label="Onde está o erro">
  <div class="apontar-topo"><h2>Onde está o erro</h2>
    <button type="button" class="icon-btn" aria-label="Fechar" onclick={() => dialogo?.close()}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
  <div class="apontar-imagem" class:analisando={!r && !erro}>
    <img src={imagem} alt={nome}>
    {#if r?.regiao}
      <div class="apontar-regiao" style="left:{r.regiao.x}%;top:{r.regiao.y}%;width:{r.regiao.largura}%;height:{r.regiao.altura}%"></div>
    {/if}
  </div>
  {#if erro}
    <p class="msg-error">{erro}</p><button type="button" class="btn small primary" onclick={analisar}>Tentar de novo</button>
  {:else if !r}
    <div class="loading-line"><div class="thinking"><i></i><i></i><i></i></div>Procurando o erro no print…</div>
  {:else}
    <p class="apontar-texto">{r.explicacao}</p>
    <p class="apontar-nota">{r.achou ? 'A posição do destaque é uma estimativa do modelo e pode não ser exata.' : 'Nenhum erro visível foi encontrado.'} Analisado por {r.modelo}.</p>
  {/if}
</dialog>
