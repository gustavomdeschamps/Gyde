<script lang="ts">
  // Faixa do duelo no exercício: oponente, relógio ao vivo e o resultado assim que alguém passa nos testes.
  // O relógio usa a hora do servidor (agora - início) e anda sozinho entre as conferências.
  import { onDestroy } from 'svelte';
  import * as C from '$contratos';
  import type { TDuelo } from '$contratos';
  import { pedir } from '../api.ts';
  import { icons } from './icones.ts';

  let { exercicioId }: { exercicioId: string } = $props();
  let duelo = $state<TDuelo | null>(null);
  let diferenca = $state(0); // relógio do servidor menos o local
  let agora = $state(Date.now());

  async function atualizar() {
    try {
      const r = await pedir('/api/duelos', C.ListaDuelos);
      duelo = r.duelos.find((d) => d.exercicio.exerciseId === exercicioId && (d.estado === 'andamento' || d.estado === 'fim')) ?? null;
      if (duelo) diferenca = duelo.agora - Date.now();
    } catch { /* tenta de novo */ }
  }
  atualizar();
  const ciclo = setInterval(() => { if (!document.hidden && duelo?.estado !== 'fim') atualizar(); }, 1500);
  const relogio = setInterval(() => { agora = Date.now(); }, 250);
  onDestroy(() => { clearInterval(ciclo); clearInterval(relogio); });
  // quando a pessoa acerta, o servidor fecha o duelo: confere na hora (o banner de sucesso dispara este evento)
  $effect(() => { const f = () => atualizar(); addEventListener('gyde:acertou', f); return () => removeEventListener('gyde:acertou', f); });

  const mmss = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
</script>

{#if duelo}
  <div class="duelo-faixa {duelo.estado}" class:venci={duelo.resultado === 'venci'} role="status">
    <span class="duelo-faixa-raio" aria-hidden="true">{@html icons.bolt}</span>
    {#if duelo.estado === 'andamento'}
      <span>Duelo contra <b>{duelo.oponente}</b>: passe em todos os testes antes.</span>
      <span class="duelo-relogio">{mmss(agora + diferenca - (duelo.inicio ?? agora))}</span>
    {:else if duelo.resultado === 'venci'}
      <span><b>Você venceu o duelo</b> contra {duelo.oponente} em {mmss(duelo.meuTempo ?? 0)}.</span>
    {:else}
      <span><b>{duelo.oponente} venceu</b> em {mmss(duelo.tempoOponente ?? 0)}.{#if duelo.meuTempo !== null} Você terminou em {mmss(duelo.meuTempo)}.{:else} Termine mesmo assim: o seu tempo também fica registrado.{/if}</span>
    {/if}
  </div>
{/if}
