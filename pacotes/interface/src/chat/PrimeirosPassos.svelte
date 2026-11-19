<script lang="ts">
  // Primeiros passos, na tela inicial do chat: conta, Conectar IA (com o teste da chave), pasta de um projeto e a
  // primeira pergunta. Cada passo é marcado pelo estado de verdade (não por clique). Some quando tudo está feito ou
  // quando a pessoa fecha (fica lembrado neste navegador).
  import { onMount } from 'svelte';
  import * as C from '$contratos';
  import { pedir } from '../api.ts';
  import { icone as svgIcone } from '../icones.ts';
  import { chat } from './estado.svelte.ts';

  let { onpergunta }: { onpergunta: (texto: string) => void } = $props();
  const CHAVE = 'gyde-primeiros-passos';
  const EXEMPLO = 'Me explica o que é uma variável, com um exemplo curto em Python.';

  let fechado = $state(true);
  let carregado = $state(false);
  let iaPronta = $state(false);
  let pessoal = $state(true);
  let temPasta = $state(false);
  const fezPergunta = $derived(chat.conversas.length > 0);

  async function atualizar() {
    try { const s = await pedir('/api/status', C.Status); iaPronta = s.keyConfigured || s.routerOnline || s.iaAtiva === 'offline'; pessoal = s.pessoal; } catch { /* sem servidor: tenta de novo depois */ }
    // fetch direto (sem pedir): na tela de login a resposta é 401, e pedir() recarregaria a página (virava um ciclo)
    if (pessoal) {
      try {
        const r = await fetch('/api/codigo/sessoes', { headers: { 'x-gyde': '1' } });
        if (r.ok) temPasta = C.ListaSessoes.parse(await r.json()).sessoes.length > 0;
      } catch { /* a Forja pode estar fechada */ }
    }
    carregado = true;
  }
  onMount(() => {
    try { fechado = localStorage.getItem(CHAVE) === 'fechado'; } catch { fechado = false; }
    if (fechado) return;
    atualizar();
    // a pessoa conecta a IA nas Configurações ou uma pasta na Forja e volta: confere de novo
    const aoVoltar = () => { if (document.visibilityState === 'visible') atualizar(); };
    addEventListener('focus', aoVoltar); addEventListener('gyde:estado', atualizar); addEventListener('hashchange', atualizar);
    return () => { removeEventListener('focus', aoVoltar); removeEventListener('gyde:estado', atualizar); removeEventListener('hashchange', atualizar); };
  });
  const passos = $derived([
    { id: 'conta', titulo: 'Criar sua conta', feito: true, texto: 'Pronto: suas conversas ficam só neste computador.' },
    { id: 'ia', titulo: 'Conectar a IA', feito: iaPronta, texto: 'Uma chave grátis (NVIDIA ou Groq). O Gyde testa a chave antes de usar.' },
    ...(pessoal ? [{ id: 'pasta', titulo: 'Conectar a pasta de um projeto', feito: temPasta, texto: 'Na Forja, o Gyde lê, corrige e testa o código de verdade.' }] : []),
    { id: 'pergunta', titulo: 'Fazer a primeira pergunta', feito: fezPergunta, texto: 'Pode começar por um exemplo.' },
  ]);
  const feitos = $derived(passos.filter((p) => p.feito).length);
  const visivel = $derived(!fechado && carregado && feitos < passos.length);
  function fechar() { fechado = true; try { localStorage.setItem(CHAVE, 'fechado'); } catch { /* sem armazenamento: some só agora */ } }
  const abrirConfig = (aba: string) => dispatchEvent(new CustomEvent('gyde:config', { detail: aba }));
</script>

{#if visivel}
  <section class="primeiros-passos" aria-labelledby="ppTitulo">
    <div class="pp-topo">
      <h2 id="ppTitulo">Primeiros passos <small>{feitos} de {passos.length}</small></h2>
      <button type="button" class="icon-btn" aria-label="Fechar os primeiros passos" onclick={fechar}>{@html svgIcone('x')}</button>
    </div>
    <ol>
      {#each passos as p (p.id)}
        <li class:feito={p.feito}>
          <span class="pp-marca" aria-hidden="true">{@html svgIcone(p.feito ? 'circle-check' : 'circle')}</span>
          <div><b>{p.titulo}</b><span class="sr-only">{p.feito ? ' (feito)' : ' (falta)'}</span><small>{p.texto}</small></div>
          {#if !p.feito}
            {#if p.id === 'ia'}
              <span class="pp-acoes"><button type="button" class="btn small primary" onclick={() => abrirConfig('conectar')}>Conectar</button><button type="button" class="btn small ghost" onclick={() => abrirConfig('geral')}>Diagnóstico</button></span>
            {:else if p.id === 'pasta'}
              <a class="btn small" href="#/agente">Abrir a Forja</a>
            {:else if p.id === 'pergunta'}
              <button type="button" class="btn small" disabled={!iaPronta} title={iaPronta ? '' : 'Conecte a IA primeiro'} onclick={() => onpergunta(EXEMPLO)}>Usar um exemplo</button>
            {/if}
          {/if}
        </li>
      {/each}
    </ol>
  </section>
{/if}
