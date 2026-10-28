<script lang="ts">
  // Página de um exercício: enunciado, testes, editor, executar/verificar no navegador, dica do Gyde e passo a passo.
  import * as C from '$contratos';
  import type { TEstadoPratica } from '$contratos';
  import { pedir, enviar, corpo, mensagemDe } from '../api.ts';
  import { execute, confetti } from '../runner.ts';
  import { openTrace } from '../passo-a-passo.ts';
  import { icons, LANG_LABEL, FILE_EXT, mostrar } from './icones.ts';
  import Editor from './Editor.svelte';

  type Resultado = { args: unknown[]; expected?: unknown; pass?: boolean; got?: unknown; error?: string };
  let { dados, trilhaId, exercicioId, renderMarkdown, toast, onatualizar }: {
    dados: TEstadoPratica; trilhaId: string; exercicioId: string; renderMarkdown: (t: string) => string;
    toast: (t: string) => void; onatualizar: (d: TEstadoPratica) => void;
  } = $props();

  // rascunhos não salvos ficam enquanto a página está aberta (trocar de exercício não perde o que foi escrito)
  const rascunhos = ((globalThis as { __rascunhos?: Record<string, string> }).__rascunhos ??= {});

  const t = $derived(dados.tracks.find((x) => x.id === trilhaId)!);
  const idx = $derived(t.exercises.findIndex((e) => e.id === exercicioId));
  const ex = $derived(t.exercises[idx]!);
  const seguinte = $derived(t.exercises[idx + 1]);
  const feito = $derived(Boolean(dados.progress[ex.id]?.done));
  const desafioDoDia = $derived(dados.desafio.exerciseId === ex.id && !dados.desafio.rewarded);
  const revisao = $derived(dados.revisoes.find((r) => r.exerciseId === ex.id && r.due));

  // revisão começa do zero (para praticar de verdade); projeto continua o código da etapa anterior
  function codigoInicial(): string {
    let c: string | undefined = rascunhos[ex.id] ?? (revisao ? undefined : dados.progress[ex.id]?.code);
    if (!c && t.projeto && idx > 0) {
      const anterior = t.exercises[idx - 1]!;
      const codigoAnterior = rascunhos[anterior.id] ?? dados.progress[anterior.id]?.code ?? '';
      c = codigoAnterior ? `${codigoAnterior.replace(/\s+$/, '')}\n${ex.starter}` : undefined;
    }
    return c || ex.starter;
  }
  let codigo = $state(codigoInicial());
  $effect(() => { rascunhos[ex.id] = codigo; });

  let ocupado = $state(false);
  let carregandoLinguagem = $state(false);
  let consoleLinhas = $state<{ texto: string; tipo?: 'err' | 'ok' }[]>([]);
  let resultados = $state<Resultado[] | null>(null);
  let ultimosResultados: Resultado[] = [];
  let sucesso = $state<{ total: number; ganhos: { motivo: string; xp: number }[]; testes: number } | null>(null);
  let dica = $state<{ carregando: boolean; texto: string } | null>(null);
  let botaoVerificar: HTMLButtonElement | undefined = $state();
  let editor: Editor | undefined = $state();
  $effect(() => { editor?.focar(); });

  const linhasDe = (r: { logs?: string[]; error?: string }) => [...(r.logs ?? []).map((texto) => ({ texto })), ...(r.error ? [{ texto: r.error, tipo: 'err' as const }] : [])];
  const chamada = (tc: { args: unknown[] }) => `${ex.fn}(${tc.args.map((a) => mostrar(a, t.lang)).join(', ')})`;

  async function executar() {
    ocupado = true; consoleLinhas = [];
    const r = await execute(t.lang, { mode: 'run', code: codigo, fn: ex.fn, tests: [] }, () => { carregandoLinguagem = true; });
    carregandoLinguagem = false;
    consoleLinhas = linhasDe(r);
    if (r.ok && !r.logs?.length) consoleLinhas = [{ texto: 'Rodou sem erros. Use print/console.log para ver valores, ou clique em Verificar.', tipo: 'ok' }];
    ocupado = false;
  }

  async function verificar() {
    ocupado = true; consoleLinhas = []; sucesso = null; resultados = null;
    const r = await execute(t.lang, { mode: 'check', code: codigo, fn: ex.fn, tests: $state.snapshot(ex.tests) }, () => { carregandoLinguagem = true; });
    carregandoLinguagem = false;
    consoleLinhas = linhasDe(r);
    if (!r.ok || !r.results) {
      const falhos: Resultado[] = ex.tests.map((tc) => ({ ...tc, pass: false, error: r.error }));
      resultados = falhos; ultimosResultados = falhos; ocupado = false; return;
    }
    const lista = r.results as Resultado[];
    resultados = lista; ultimosResultados = lista;
    const passou = lista.every((x) => x.pass);
    const quantos = lista.filter((x) => x.pass).length;
    if (!r.logs?.length) consoleLinhas = passou ? [{ texto: 'Todos os testes passaram!', tipo: 'ok' }] : [{ texto: `${quantos} de ${lista.length} testes passaram.` }];
    try {
      const novo = await pedir('/api/pratica/progress', C.EstadoPraticaComGanhos, corpo({ exerciseId: ex.id, code: codigo, passed: passou }));
      onatualizar(novo);
      if (passou) {
        const total = novo.ganhos.reduce((s, g) => s + g.xp, 0);
        if (botaoVerificar) { const b = botaoVerificar.getBoundingClientRect(); confetti(b.left + b.width / 2, b.top); }
        sucesso = { total, ganhos: novo.ganhos, testes: lista.length };
      }
    } catch (e) { toast(mensagemDe(e)); }
    ocupado = false;
  }

  // o exercício só define a função: chama com a entrada do 1º teste para ter o que acompanhar
  function passoAPasso() {
    const args = (ex.tests[0]?.args ?? []).map((a) => mostrar(a, 'python')).join(', ');
    openTrace(`${codigo.replace(/\s+$/, '')}\n\n# chamada de exemplo (1º teste)\nprint(${ex.fn}(${args}))\n`);
  }

  async function pedirDica() {
    dica = { carregando: true, texto: '' };
    try {
      const { hint } = await enviar<{ hint: string }>('/api/pratica/hint', corpo({ exerciseId: ex.id, code: codigo, results: ultimosResultados }));
      dica = { carregando: false, texto: hint };
    } catch (e) { dica = null; toast(mensagemDe(e)); }
  }

  function recomecar() { if (confirm('Voltar para o código inicial? O que você escreveu será perdido.')) codigo = ex.starter; }
</script>

<div class="skills-inner" style="--track:{t.color}">
  <nav class="crumbs"><a href="#/pratica">Prática</a><span>›</span><a href="#/pratica/{t.id}">{t.title}</a><span>›</span><span>{idx + 1}. {ex.title}</span></nav>
  <div class="ex-layout">
    <section class="ex-panel">
      <div class="badges">
        <span class="xp-pill">+{ex.xp} XP{feito && !revisao ? ' · feito ✓' : ''}</span>
        {#if desafioDoDia}<span class="badge daily">{@html icons.target}Desafio do dia · XP em dobro</span>{/if}
        {#if revisao}<span class="badge review">{@html icons.reset}Revisão · nível {revisao.level + 1}/4</span>{/if}
        {#if t.projeto}<span class="badge">Etapa {idx + 1} de {t.exercises.length}</span>{/if}
      </div>
      {#if revisao}<p class="gate-note">Revisão: escreva a solução de novo, sem olhar a antiga. É assim que o conteúdo fixa.</p>{/if}
      <h1>{ex.title}</h1>
      <div class="md">{@html renderMarkdown(ex.statement)}</div>
      <div class="ex-tests"><h3>Testes</h3>
        {#each ex.tests as tc, i}
          {@const res = resultados?.[i]}
          <div class="test-row" class:pass={res?.pass} class:fail={res && !res.pass} style="--i:{i}">
            <span class="test-icon">{#if res}{@html res.pass ? icons.check : icons.x}{/if}</span>
            <span><code>{chamada(tc)}</code><span class="test-detail">esperado: <code>{mostrar(tc.expected, t.lang)}</code>{#if res && !res.pass}{#if res.error} · <span>{res.error}</span>{:else} · recebido: <code>{mostrar(res.got, t.lang)}</code>{/if}{/if}</span></span>
          </div>
        {/each}
      </div>
      {#if dica}
        <div class="hint-box"><h3>{@html icons.bulb}Dica do Gyde</h3>
          {#if dica.carregando}<div class="thinking"><i></i><i></i><i></i></div>{:else}<div class="md">{@html renderMarkdown(dica.texto)}</div>{/if}
        </div>
      {/if}
      {#if sucesso}
        <div class="success-banner">
          <div><b>Mandou bem! {sucesso.total ? `+${sucesso.total} XP` : 'Exercício já concluído antes.'}</b>
            <small>{sucesso.ganhos.length ? sucesso.ganhos.map((g) => `${g.motivo}: +${g.xp}`).join(' · ') : `Todos os ${sucesso.testes} testes passaram.`}</small></div>
          {#if seguinte}<a class="btn primary" href="#/pratica/{t.id}/{seguinte.id}">{t.projeto ? 'Próxima etapa' : 'Próximo'} {@html icons.arrow}</a>
          {:else}<a class="btn primary" href="#/pratica">{t.projeto ? 'Projeto concluído' : 'Trilha concluída'} {@html icons.check}</a>{/if}
        </div>
      {/if}
    </section>
    <section class="editor-card">
      <div class="editor-head"><span class="file">solucao.{FILE_EXT[t.lang]}</span><span class="spacer"></span>
        <button class="icon-btn" title="Recomeçar do código inicial" aria-label="Recomeçar" onclick={recomecar}>{@html icons.reset}</button></div>
      <Editor bind:this={editor} bind:valor={codigo} lang={t.lang} />
      <div class="editor-actions">
        <button class="btn" disabled={ocupado} onclick={executar}>{@html icons.play}Executar</button>
        <button class="btn primary" disabled={ocupado} bind:this={botaoVerificar} onclick={verificar}>{@html icons.test}Verificar</button>
        <button class="btn ghost" disabled={ocupado || dica?.carregando} onclick={pedirDica}>{@html icons.bulb}Dica do Gyde</button>
        {#if t.lang === 'python'}<button class="btn ghost" disabled={ocupado} onclick={passoAPasso}>{@html icons.steps}Passo a passo</button>{/if}
      </div>
      <div class="console" role="log">{#if carregandoLinguagem}<div class="loading-line"><div class="thinking"><i></i><i></i><i></i></div>Preparando o {LANG_LABEL[t.lang]} no seu navegador… (só demora na primeira vez)</div>{:else}{#each consoleLinhas as l, i}{#if i}{'\n'}{/if}<span class={l.tipo ?? ''}>{l.texto}</span>{/each}{/if}</div>
    </section>
  </div>
</div>
