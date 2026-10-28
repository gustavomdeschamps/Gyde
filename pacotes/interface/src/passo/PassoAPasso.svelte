<script lang="ts">
  // Passo a passo visual (estilo Python Tutor): a linha que vai rodar, as variáveis, a pilha e a saída.
  import { onMount, tick } from 'svelte';
  import hljs from '@highlightjs/cdn-assets/es/highlight.min.js';
  import { execute } from '../runner.ts';

  interface Passo { line: number | null; event: string; vars: Record<string, string>; globals: Record<string, string> | null; stack: string[]; out?: string; error?: string; ret?: string }
  let { codigo, onfechar }: { codigo: string; onfechar: () => void } = $props();

  const icone = {
    inicio: '<svg viewBox="0 0 24 24"><path d="M6 5v14M18 6l-8 6 8 6z"/></svg>',
    anterior: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    proximo: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    fim: '<svg viewBox="0 0 24 24"><path d="M18 5v14M6 6l8 6-8 6z"/></svg>',
    tocar: '<svg viewBox="0 0 24 24"><path d="M7 5v14l11-7z"/></svg>',
    pausar: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
    fechar: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  let dialogo: HTMLDialogElement | undefined = $state();
  let caixaCodigo: HTMLElement | undefined = $state();
  let carregando = $state('Executando e gravando cada passo…');
  let erro = $state<string | null>(null);
  let passos = $state<Passo[]>([]);
  let i = $state(0);
  let tocando: ReturnType<typeof setInterval> | null = $state(null);

  const linhas = $derived(codigo.replace(/\n$/, '').split('\n').map((l) => hljs.highlight(l || ' ', { language: 'python', ignoreIllegals: true }).value));
  const atual = $derived(passos[i]);
  const anterior = $derived(passos[i - 1]);
  // só destaca mudança se continua na mesma função
  const varsAnteriores = $derived(anterior && anterior.stack.at(-1) === atual?.stack.at(-1) ? anterior.vars : null);

  onMount(() => {
    dialogo!.showModal();
    (async () => {
      const r = await execute('python', { mode: 'trace', code: codigo }, () => { carregando = 'Preparando o Python no navegador… (só demora na primeira vez)'; }) as { ok?: boolean; steps?: Passo[]; out?: string; error?: string };
      if (!r.ok && !r.steps?.length) { erro = r.error || 'Não consegui executar.'; return; }
      const lista = [...(r.steps ?? [])];
      // passo final sintético: o estado depois da última linha
      lista.push({ line: null, event: 'end', vars: lista.at(-1)?.vars || {}, globals: null, stack: [], out: r.out, error: r.error });
      passos = lista;
    })();
    return parar;
  });

  $effect(() => { void i; tick().then(() => caixaCodigo?.querySelector('.tl.current')?.scrollIntoView({ block: 'nearest' })); });

  function ir(n: number) { i = Math.max(0, Math.min(passos.length - 1, n)); }
  function parar() { if (tocando) clearInterval(tocando); tocando = null; }
  function tocar() {
    if (tocando) return parar();
    if (i >= passos.length - 1) ir(0);
    tocando = setInterval(() => { if (i >= passos.length - 1) parar(); else ir(i + 1); }, 700);
  }
  const passo = (n: number) => { parar(); ir(n); };
  function tecla(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); passo(i + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); passo(i - 1); }
  }
</script>

<dialog class="dialog trace-dialog" bind:this={dialogo} onclose={() => { parar(); onfechar(); }} onkeydown={tecla}>
  <div class="trace-head"><h2>Passo a passo</h2><span class="trace-sub">Python</span>
    <button class="icon-btn" aria-label="Fechar" onclick={() => dialogo?.close()}>{@html icone.fechar}</button></div>
  <div class="trace-body">
    {#if erro}
      <p class="msg-error">{erro}</p>
    {:else if !atual}
      <div class="loading-line"><div class="thinking"><i></i><i></i><i></i></div>{carregando}</div>
    {:else}
      <div class="trace-grid">
        <div class="trace-code" aria-label="Código" bind:this={caixaCodigo}>
          {#each linhas as h, k}
            <div class="tl" class:current={k + 1 === atual.line} class:was={anterior && k + 1 === anterior.line && k + 1 !== atual.line} data-line={k + 1}><span class="ln">{k + 1}</span><code class="hljs">{@html h}</code></div>
          {/each}
        </div>
        <div class="trace-side">
          <section><h3>Variáveis</h3><div class="trace-vars">
            {@render tabela(atual.vars, varsAnteriores)}
            {#if atual.globals && Object.keys(atual.globals).length}<h4>Do programa principal</h4>{@render tabela(atual.globals, null)}{/if}
          </div></section>
          <section><h3>Pilha de chamadas</h3><div class="trace-stack">
            {#each atual.stack as f, k}<div class="frame" class:top={k === atual.stack.length - 1}>{f}</div>{:else}<p class="trace-empty">Programa terminou.</p>{/each}
          </div></section>
          <section><h3>Saída</h3><pre class="trace-out">{atual.out || ''}</pre></section>
        </div>
      </div>
      <div class="trace-explain" class:error={atual.event === 'end' && Boolean(atual.error)} role="status">
        {#if atual.event === 'end'}
          {#if atual.error}<b>Erro:</b> {atual.error}{:else}<b>Fim.</b> O programa terminou sem erros.{/if}
        {:else if atual.event === 'return'}
          A função <code>{atual.stack.at(-1)}</code> termina e devolve <code>{atual.ret}</code>.
        {:else}
          A linha <b>{atual.line}</b> é a próxima a rodar{#if atual.stack.length > 1}, dentro de <code>{atual.stack.at(-1)}</code>{/if}.
        {/if}
      </div>
      <div class="trace-controls">
        <button class="icon-btn" title="Início" onclick={() => passo(0)}>{@html icone.inicio}</button>
        <button class="icon-btn" title="Passo anterior (seta para a esquerda)" onclick={() => passo(i - 1)}>{@html icone.anterior}</button>
        <button class="btn primary small" onclick={tocar}>{@html tocando ? icone.pausar : icone.tocar}<span>{tocando ? 'Pausar' : 'Reproduzir'}</span></button>
        <button class="icon-btn" title="Próximo passo (seta para a direita)" onclick={() => passo(i + 1)}>{@html icone.proximo}</button>
        <button class="icon-btn" title="Fim" onclick={() => passo(passos.length - 1)}>{@html icone.fim}</button>
        <input type="range" min="0" max={passos.length - 1} value={i} aria-label="Passo" oninput={(e) => passo(Number(e.currentTarget.value))}>
        <span class="trace-count">{i + 1} de {passos.length}</span>
      </div>
    {/if}
  </div>
</dialog>

{#snippet tabela(vars: Record<string, string>, antes: Record<string, string> | null)}
  {#if Object.keys(vars).length}
    <table><tbody>{#each Object.entries(vars) as [k, v]}<tr class:changed={antes && antes[k] !== v}><th>{k}</th><td><code>{v}</code></td></tr>{/each}</tbody></table>
  {:else}<p class="trace-empty">Nenhuma variável ainda.</p>{/if}
{/snippet}
