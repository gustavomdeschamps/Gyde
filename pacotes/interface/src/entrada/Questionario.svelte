<script lang="ts">
  // Questionário de boas-vindas: perfil e mini desafio de código, depois o resultado com a nota.
  import { onMount, tick } from 'svelte';
  import hljs from '@highlightjs/cdn-assets/es/highlight.min.js';
  import * as C from '$contratos';
  import type { TPergunta, TResultadoQuestionario } from '$contratos';
  import { pedir, enviar, corpo, mensagemDe } from '../api.ts';
  import { confetti } from '../runner.ts';
  import Cartao from './Cartao.svelte';

  let { nome, podePular = true, onfim }: { nome: string; podePular?: boolean; onfim: () => void } = $props();

  const LINGUAGEM: Record<string, 'python' | 'javascript' | 'java'> = { Python: 'python', JavaScript: 'javascript', Java: 'java' };
  const NOME_LINGUAGEM = { python: 'Python', javascript: 'JavaScript', java: 'Java' };

  let perguntas = $state<TPergunta[]>([]);
  let respostas = $state<Record<string, string | string[]>>({});
  let i = $state(0);
  let direcao = $state<'next' | 'back' | null>(null);
  let escolhendo = $state(false); // resposta única: mostra a seleção antes de trocar
  let resultado = $state<TResultadoQuestionario | null>(null);
  let erro = $state<string | null>(null);
  let nota = $state(0);
  let barra = $state(0);
  let caixa: HTMLElement | undefined = $state();

  const q = $derived(perguntas[i]);
  const primeiraDeCodigo = $derived(perguntas.findIndex((x) => x.kind === 'knowledge'));
  // as perguntas de código aparecem na primeira linguagem escolhida que o questionário cobre (senão, Python)
  const linguagem = $derived(((respostas.languages as string[] | undefined) ?? []).map((l) => LINGUAGEM[l]).find(Boolean) ?? 'python');
  const codigo = $derived(q?.kind === 'knowledge' ? q.code?.[linguagem] ?? q.code?.python ?? '' : '');
  const erradas = $derived(resultado ? resultado.results.filter((r) => !r.correct) : []);

  onMount(async () => {
    try { perguntas = (await pedir('/api/quiz', C.Questionario)).questions; } catch (e) { erro = mensagemDe(e); }
  });
  // a barra anima da posição anterior até a nova; o foco vai para a primeira opção
  $effect(() => {
    if (!perguntas.length || resultado) return;
    barra = Math.round((i / perguntas.length) * 100);
    const alvo = Math.round(((i + 1) / perguntas.length) * 100);
    requestAnimationFrame(() => { barra = alvo; });
    tick().then(() => caixa?.querySelector<HTMLElement>('.quiz-option')?.focus({ preventScroll: true }));
  });

  const marcada = (o: string) => (q?.multi ? ((respostas[q.id] as string[] | undefined) ?? []).includes(o) : respostas[q!.id] === o);
  function escolher(o: string) {
    if (!q) return;
    if (q.multi) {
      const lista = new Set((respostas[q.id] as string[] | undefined) ?? []);
      if (lista.has(o)) lista.delete(o); else lista.add(o);
      respostas[q.id] = [...lista];
      return;
    }
    respostas[q.id] = o;
    escolhendo = true;
    setTimeout(() => { escolhendo = false; avancar(); }, 260);
  }
  function avancar() {
    if (i < perguntas.length - 1) { direcao = 'next'; i++; return; }
    concluir();
  }
  function voltar() { direcao = 'back'; i--; }
  async function pular() {
    await enviar('/api/profile/skip', corpo({})).catch(() => {});
    onfim();
  }
  async function concluir() {
    try { resultado = await pedir('/api/profile', C.ResultadoQuestionario, corpo({ answers: respostas })); } catch (e) { erro = mensagemDe(e); return; }
    const { score, total } = resultado.profile;
    const t0 = performance.now();
    const contar = (t: number) => { const p = Math.min(1, (t - t0) / 700); nota = Math.round(score * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(contar); };
    requestAnimationFrame(contar);
    await tick();
    caixa?.querySelector<HTMLElement>('.btn.primary')?.focus({ preventScroll: true });
    if (score >= Math.ceil(total / 2)) {
      const r = caixa?.querySelector('.quiz-score')?.getBoundingClientRect();
      if (r) setTimeout(() => confetti(r.left + 30, r.top + 10), 500);
    }
  }
  const comoCodigo = (o: string) => q?.kind === 'knowledge' && o !== 'Não sei ainda' && /^[\d\s]+$/.test(o);
</script>

<div bind:this={caixa} style="display:contents">
  {#if erro}
    <Cartao><p class="gate-error" role="alert">{erro}</p>
      <button type="button" class="btn primary wide" onclick={pular}>Pular por agora</button></Cartao>
  {:else if resultado}
    {@const p = resultado.profile}
    <Cartao direcao="next">
      <p class="quiz-step">Resultado</p>
      <h1>Prontinho, {nome.split(' ')[0]}!</h1>
      <p class="quiz-score"><span>{nota}</span><small>de {p.total} no mini desafio</small></p>
      <p class="gate-sub">O Gyde vai te tratar como <b>{p.levelLabel}</b>{#if p.languages.length}{' e usar exemplos em '}<b>{p.languages.slice(0, 3).join(', ')}</b>{/if}.</p>
      {#if erradas.length}
        <div class="quiz-review"><p>Vale reforçar:</p><ul>{#each erradas as w (w.id)}<li><b>{w.topic}</b> — a resposta era <code>{w.answer}</code></li>{/each}</ul>
          <p class="gate-note">Pergunte ao Gyde sobre qualquer um desses, ou pratique na área Prática. Dá para refazer o questionário em Configurações > Prática.</p></div>
      {:else}<p class="gate-sub">Acertou tudo! Vamos para desafios mais difíceis.</p>{/if}
      <button type="button" class="btn primary wide" onclick={onfim}>Começar a usar o Gyde</button>
    </Cartao>
  {:else if q}
    {#key i}
      <Cartao {direcao}>
        <div class="quiz-progress" aria-hidden="true"><span style="width:{barra}%"></span></div>
        <p class="quiz-step">{q.kind === 'knowledge' ? 'Mini desafio' : 'Sobre você'} · {i + 1} de {perguntas.length}</p>
        {#if i === 0}<p class="gate-sub">Oi, {nome}! Responda rapidinho para o Gyde explicar do seu jeito.</p>{/if}
        {#if i === primeiraDeCodigo}<p class="gate-note">Agora umas perguntas de código em <b>{NOME_LINGUAGEM[linguagem]}</b>. Sem pressão: "Não sei ainda" também é resposta — isso ajuda o Gyde a saber por onde começar.</p>{/if}
        <h1 class="quiz-title">{q.title}</h1>
        {#if codigo}<div class="quiz-code"><span class="code-lang">{NOME_LINGUAGEM[linguagem]}</span><pre><code class="hljs">{@html hljs.highlight(codigo, { language: linguagem }).value}</code></pre></div>{/if}
        {#if q.multi}<p class="gate-note">Pode marcar mais de uma.</p>{/if}
        <div class="quiz-options" role={q.multi ? 'group' : 'radiogroup'}>
          {#each q.options as o, k}
            <button type="button" class="quiz-option" class:selected={marcada(o)} style="--i:{k}" role={q.multi ? 'checkbox' : 'radio'} aria-checked={marcada(o)} disabled={escolhendo} onclick={() => escolher(o)}>
              {#if comoCodigo(o)}<code>{o}</code>{:else}{o}{/if}
            </button>
          {/each}
        </div>
        <div class="quiz-nav">
          {#if i > 0}<button type="button" class="btn ghost" onclick={voltar}>Voltar</button>
          {:else if podePular}<button type="button" class="btn ghost" onclick={pular}>Pular por agora</button>
          {:else}<span></span>{/if}
          {#if q.multi}<button type="button" class="btn primary" onclick={avancar}>{i === perguntas.length - 1 ? 'Concluir' : 'Continuar'}</button>{/if}
        </div>
      </Cartao>
    {/key}
  {/if}
</div>
