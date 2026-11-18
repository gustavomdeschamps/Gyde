<script lang="ts">
  // "Comparar respostas": a mesma pergunta respondida por duas versões do Gyde, lado a lado e sem dizer qual é qual.
  // A pessoa vota na melhor; só depois a tela revela as duas. Os votos ficam só no banco deste computador.
  import { onMount } from 'svelte';
  import * as C from '$contratos';
  import { pedir, corpo, mensagemDe } from '../api.ts';
  import { renderMarkdown } from '../markdown.ts';
  import { icone as svgIcone } from '../icones.ts';

  let { onfechar }: { onfechar: () => void } = $props();
  const EXEMPLOS = ['como desfaço o último commit sem perder as mudanças?', 'escreve uma função em javascript que devolve só os números pares de uma lista', 'sou iniciante, me explica recursão de um jeito simples'];

  let dialogo: HTMLDialogElement | undefined = $state();
  let pergunta = $state('');
  let gerando = $state(false);
  let erro = $state<string | null>(null);
  let atual = $state<{ id: string; a: string; b: string } | null>(null);
  let revelado = $state<{ a: string; b: string; voto: string } | null>(null);
  let placar = $state<{ atual: number; anterior: number; empate: number } | null>(null);

  onMount(() => {
    dialogo!.showModal();
    pedir('/api/comparar/placar', C.PlacarComparacao).then((r) => { placar = r.placar; }).catch(() => {});
  });

  async function gerar(e: SubmitEvent) {
    e.preventDefault();
    if (!pergunta.trim() || gerando) return;
    gerando = true; erro = null; atual = null; revelado = null;
    try { atual = await pedir('/api/comparar', C.Comparacao, corpo({ pergunta })); } catch (x) { erro = mensagemDe(x); }
    gerando = false;
  }
  async function votar(voto: 'a' | 'b' | 'empate') {
    if (!atual) return;
    try {
      const r = await pedir(`/api/comparar/${atual.id}/voto`, C.VotoComparacao, corpo({ voto }));
      revelado = { a: r.a, b: r.b, voto }; placar = r.placar;
    } catch (x) { erro = mensagemDe(x); }
  }
</script>

<dialog class="dialog comparar" bind:this={dialogo} onclose={onfechar} aria-labelledby="compararTitulo">
  <div class="comparar-topo">
    <div>
      <h2 id="compararTitulo">Comparar respostas</h2>
      <p>Duas versões do Gyde respondem a mesma pergunta, sem dizer qual é qual. Vote na melhor: o voto fica só neste computador e ajuda a ajustar o jeito de responder.</p>
    </div>
    <button type="button" class="icon-btn" aria-label="Fechar" onclick={() => dialogo?.close()}>{@html svgIcone('x')}</button>
  </div>

  <form class="comparar-pergunta" onsubmit={gerar}>
    <label for="compararTexto" class="sr-only">Pergunta</label>
    <textarea id="compararTexto" rows="2" placeholder="Escreva uma pergunta de programação ou de estudo" bind:value={pergunta}></textarea>
    <button class="btn primary" type="submit" disabled={gerando || !pergunta.trim()}>{@html svgIcone('columns-2')}{gerando ? 'Gerando as duas…' : 'Gerar duas respostas'}</button>
  </form>
  {#if !atual && !gerando}<p class="comparar-exemplos">Exemplos: {#each EXEMPLOS as ex}<button type="button" onclick={() => (pergunta = ex)}>{ex}</button>{/each}</p>{/if}
  {#if erro}<p class="msg-error" role="alert">{erro}</p>{/if}

  {#if atual}
    <div class="comparar-lado">
      {#each [['a', atual.a], ['b', atual.b]] as [lado, texto] (lado)}
        <section class="comparar-resposta" class:escolhida={revelado?.voto === lado} aria-label="Resposta {lado.toUpperCase()}">
          <h3>Resposta {lado.toUpperCase()}{#if revelado}<small>{lado === 'a' ? revelado.a : revelado.b}</small>{/if}</h3>
          <div class="md">{@html renderMarkdown(texto)}</div>
        </section>
      {/each}
    </div>
    {#if !revelado}
      <div class="comparar-votos" role="group" aria-label="Qual resposta foi melhor?">
        <button class="btn" onclick={() => votar('a')}>A é melhor</button>
        <button class="btn" onclick={() => votar('empate')}>Empate</button>
        <button class="btn" onclick={() => votar('b')}>B é melhor</button>
      </div>
    {/if}
  {/if}
  {#if placar && placar.atual + placar.anterior + placar.empate > 0}
    <p class="comparar-placar" role="status">Seus votos até agora: guia atual {placar.atual}, guia anterior {placar.anterior}, empates {placar.empate}.</p>
  {/if}
</dialog>
