<script module lang="ts">
  export type Ref = { v: string } | { r: number };
  export interface Caixa { tipo: 'lista' | 'tupla' | 'conjunto' | 'dicionario' | 'objeto'; itens?: Ref[]; pares?: [Ref, Ref][]; total: number; classe?: string }
  export interface Mem { quadros: { nome: string; vars: Record<string, Ref> }[]; heap: Record<string, Caixa> }
</script>

<script lang="ts">
  // Desenho da memória num passo: quadros da pilha (cada chamada de função empilhada) à esquerda e os objetos (listas,
  // dicionários, conjuntos, objetos) à direita, com setas das variáveis até a caixa. Duas variáveis no mesmo objeto
  // apontam para a mesma caixa. O que mudou desde o passo anterior pisca; caixa nova aparece com um leve deslize.
  import { tick } from 'svelte';


  let { mem, antes, passo }: { mem: Mem; antes: Mem | null; passo: number } = $props();

  const NOME: Record<string, string> = { lista: 'lista', tupla: 'tupla', conjunto: 'conjunto', dicionario: 'dicionário', objeto: 'objeto' };
  const ehRef = (x: Ref): x is { r: number } => 'r' in x;
  const igual = (a: Ref | undefined, b: Ref | undefined) => JSON.stringify(a) === JSON.stringify(b);
  // só objetos alcançáveis, na ordem em que aparecem (as setas ficam mais curtas)
  const ordem = $derived.by(() => {
    const vistos: string[] = [];
    const visitar = (x: Ref) => {
      if (!ehRef(x)) return;
      const k = String(x.r);
      if (vistos.includes(k) || !mem.heap[k]) return;
      vistos.push(k);
      const c = mem.heap[k]!;
      (c.itens ?? []).forEach(visitar);
      (c.pares ?? []).forEach(([a, b]) => { visitar(a); visitar(b); });
    };
    for (const q of mem.quadros) Object.values(q.vars).forEach(visitar);
    return vistos;
  });
  const quadroAntes = (i: number) => (antes && antes.quadros[i]?.nome === mem.quadros[i]?.nome ? antes.quadros[i] : null);
  const caixaNova = (k: string) => Boolean(antes) && !antes!.heap[k];
  const celulaMudou = (k: string, j: number) => {
    const a = antes?.heap[k], c = mem.heap[k];
    if (!a || !c) return false;
    return c.itens ? !igual(a.itens?.[j], c.itens[j]) : !igual(a.pares?.[j]?.[1], c.pares?.[j]?.[1]) || !igual(a.pares?.[j]?.[0], c.pares?.[j]?.[0]);
  };

  // setas: do ponto da variável (ou da célula) até a borda esquerda da caixa
  let area: HTMLDivElement | undefined = $state();
  let setas = $state<{ d: string; id: string }[]>([]);
  function desenhar() {
    if (!area) return;
    const base = area.getBoundingClientRect();
    const lista: { d: string; id: string }[] = [];
    for (const ponto of area.querySelectorAll<HTMLElement>('[data-aponta]')) {
      const alvo = area.querySelector<HTMLElement>(`[data-caixa="${ponto.dataset.aponta}"]`);
      if (!alvo) continue;
      const a = ponto.getBoundingClientRect(), b = alvo.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - base.left, y1 = a.top + a.height / 2 - base.top;
      const paraTras = b.left - base.left < x1; // célula apontando para uma caixa à esquerda (ou acima)
      const x2 = paraTras ? b.right - base.left : b.left - base.left, y2 = b.top + 14 - base.top;
      const meio = Math.max(30, Math.abs(x2 - x1) / 2);
      lista.push({ id: `${ponto.dataset.aponta}-${lista.length}`, d: `M${x1},${y1} C${x1 + meio},${y1} ${paraTras ? x2 + meio : x2 - meio},${y2} ${x2},${y2}` });
    }
    setas = lista;
  }
  $effect(() => { void passo; void mem; tick().then(() => requestAnimationFrame(desenhar)); });
</script>

<svelte:window onresize={desenhar} />

{#snippet valor(x: Ref)}
  {#if ehRef(x)}<span class="mem-ponto" data-aponta={x.r} title="aponta para o objeto {x.r}"></span>{:else}<code>{x.v}</code>{/if}
{/snippet}

<div class="mem" bind:this={area}>
  <div class="mem-col">
    <h4>Pilha de chamadas</h4>
    {#each mem.quadros as q, i (i + q.nome)}
      {@const qa = quadroAntes(i)}
      <div class="mem-quadro" class:topo={i === mem.quadros.length - 1} class:novo={antes && !qa}>
        <div class="mem-quadro-nome">{q.nome}</div>
        {#each Object.entries(q.vars) as [k, v] (k)}
          {#key `${passo}-${JSON.stringify(v)}`}
            <div class="mem-var" class:mudou={qa && !igual(qa.vars[k], v)}><span class="mem-nome">{k}</span>{@render valor(v)}</div>
          {/key}
        {:else}<div class="mem-vazio">sem variáveis</div>{/each}
      </div>
    {/each}
  </div>
  <div class="mem-col mem-heap">
    <h4>Objetos</h4>
    {#each ordem as k (k)}
      {@const c = mem.heap[k]!}
      <div class="mem-caixa" class:nova={caixaNova(k)} data-caixa={k}>
        <div class="mem-caixa-cab">{c.classe ?? NOME[c.tipo]} <small>#{k}</small></div>
        {#if c.itens}
          <div class="mem-celulas" class:conjunto={c.tipo === 'conjunto'}>
            {#each c.itens as it, j (j)}
              {#key `${passo}-${JSON.stringify(it)}`}
                <div class="mem-celula" class:mudou={celulaMudou(k, j)}>{#if c.tipo !== 'conjunto'}<small>{j}</small>{/if}{@render valor(it)}</div>
              {/key}
            {:else}<div class="mem-vazio">vazia</div>{/each}
            {#if c.total > c.itens.length}<div class="mem-mais">+{c.total - c.itens.length}</div>{/if}
          </div>
        {:else}
          {#each c.pares ?? [] as [a, b], j (j)}
            {#key `${passo}-${JSON.stringify(b)}`}
              <div class="mem-par" class:mudou={celulaMudou(k, j)}>{@render valor(a)}<span class="mem-seta-txt">{c.tipo === 'objeto' ? '=' : ':'}</span>{@render valor(b)}</div>
            {/key}
          {:else}<div class="mem-vazio">vazio</div>{/each}
        {/if}
      </div>
    {:else}<p class="mem-vazio">Nenhuma lista, dicionário ou objeto ainda. Números e textos ficam direto nas variáveis.</p>{/each}
  </div>
  <svg class="mem-setas" aria-hidden="true">
    <defs><marker id="mem-ponta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" /></marker></defs>
    {#each setas as s (s.id)}<path d={s.d} marker-end="url(#mem-ponta)" />{/each}
  </svg>
</div>
