<script lang="ts">
  // Duelos na Prática: desafiar alguém deste Gyde pelo e-mail, aceitar ou recusar convites e ver os resultados.
  // Confere de novo a cada 3 s enquanto há duelo em aberto (o convite do outro lado aparece sozinho).
  import { onDestroy } from 'svelte';
  import * as C from '$contratos';
  import type { TDuelo } from '$contratos';
  import { pedir, corpo, mensagemDe } from '../api.ts';

  let { toast }: { toast: (t: string) => void } = $props();
  let duelos = $state<TDuelo[]>([]);
  let email = $state('');
  let ocupado = $state(false);

  async function atualizar() { try { duelos = (await pedir('/api/duelos', C.ListaDuelos)).duelos; } catch { /* tenta de novo no próximo ciclo */ } }
  atualizar();
  const ciclo = setInterval(() => { if (!document.hidden) atualizar(); }, 3000);
  onDestroy(() => clearInterval(ciclo));

  async function acao(url: string, dados?: unknown) {
    ocupado = true;
    try { duelos = (await pedir(url, C.ListaDuelos, corpo(dados ?? {}))).duelos; return true; } catch (e) { toast(mensagemDe(e)); return false; } finally { ocupado = false; }
  }
  async function desafiar(e: SubmitEvent) {
    e.preventDefault();
    if (await acao('/api/duelos', { email: email.trim() })) { email = ''; toast('Desafio enviado. O duelo começa quando a outra pessoa aceitar.'); }
  }
  async function aceitar(d: TDuelo) { if (await acao(`/api/duelos/${d.id}/aceitar`)) location.hash = `#/pratica/${d.exercicio.trackId}/${d.exercicio.exerciseId}`; }
  const seg = (ms: number | null) => (ms === null ? '' : `${Math.round(ms / 1000)} s`);
  const LANG = { python: 'Python', javascript: 'JavaScript' } as const;
  const visiveis = $derived(duelos.filter((d) => d.estado !== 'recusado' && d.estado !== 'cancelado').slice(0, 5));
</script>

<section class="duelos">
  <h2 class="section-title">Duelo <small>o mesmo exercício para os dois; vence quem passar nos testes primeiro</small></h2>
  <div class="duelos-card">
    <form class="friend-form" onsubmit={desafiar}>
      <input type="email" bind:value={email} placeholder="E-mail de alguém neste Gyde" aria-label="E-mail de quem desafiar" required>
      <button class="btn primary" disabled={ocupado}>Desafiar</button>
    </form>
    {#if visiveis.length}
      <ul class="duelos-lista">
        {#each visiveis as d (d.id)}
          <li class="duelo {d.estado}" class:venci={d.resultado === 'venci'}>
            <span class="duelo-quem"><b>{d.souDesafiante ? `Você desafiou ${d.oponente}` : `${d.oponente} desafiou você`}</b>
              <small>{d.exercicio.titulo} · {LANG[d.exercicio.lang]}</small></span>
            {#if d.estado === 'convite' && !d.souDesafiante}
              <span class="duelo-acoes"><button type="button" class="btn small primary" disabled={ocupado} onclick={() => aceitar(d)}>Aceitar</button>
                <button type="button" class="btn small ghost" disabled={ocupado} onclick={() => acao(`/api/duelos/${d.id}/recusar`)}>Recusar</button></span>
            {:else if d.estado === 'convite'}
              <span class="duelo-status">esperando aceitar <button type="button" class="link" onclick={() => acao(`/api/duelos/${d.id}/recusar`)}>cancelar</button></span>
            {:else if d.estado === 'andamento'}
              <a class="btn small primary" href="#/pratica/{d.exercicio.trackId}/{d.exercicio.exerciseId}">Ir para o duelo</a>
            {:else}
              <span class="duelo-status resultado">{d.resultado === 'venci' ? `Você venceu em ${seg(d.meuTempo)}` : `${d.oponente} venceu em ${seg(d.tempoOponente)}`}{#if d.resultado === 'perdi' && d.meuTempo !== null} · você: {seg(d.meuTempo)}{/if}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}<p class="rank-empty">Desafie alguém que também usa este Gyde (por exemplo, no servidor da turma). O exercício é sorteado entre os que têm testes automáticos.</p>{/if}
  </div>
</section>
