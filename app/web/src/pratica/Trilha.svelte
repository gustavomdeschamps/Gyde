<script lang="ts">
  // Página de uma trilha: lista de exercícios com o que já foi feito.
  import type { TEstadoPratica } from '$contratos';
  import { icons, LANG_LABEL } from './icones.ts';

  let { dados, trilhaId }: { dados: TEstadoPratica; trilhaId: string } = $props();
  const t = $derived(dados.tracks.find((x) => x.id === trilhaId));
  const feitos = $derived(t ? t.exercises.filter((e) => dados.progress[e.id]?.done).length : 0);
  let largura = $state(0);
  $effect(() => { if (t) requestAnimationFrame(() => requestAnimationFrame(() => { largura = Math.round((feitos / t.exercises.length) * 100); })); });
</script>

{#if t}
  <div class="skills-inner" style="--track:{t.color}">
    <nav class="crumbs"><a href="#/pratica">Prática</a><span>›</span><span>{t.title}</span></nav>
    <header class="skills-hero"><div><h1>{t.title}</h1><p>{t.description}</p></div>
      <div style="min-width:220px"><div class="track-meta" style="margin-bottom:8px"><span>{feitos}/{t.exercises.length} feitos</span><span>{LANG_LABEL[t.lang]}</span></div><div class="progress"><span style="width:{largura}%"></span></div></div>
    </header>
    <div class="ex-list">
      {#each t.exercises as ex, i (ex.id)}
        {@const feito = dados.progress[ex.id]?.done}
        <a class="ex-item" class:done={feito} href="#/pratica/{t.id}/{ex.id}" style="--i:{i}">
          <span class="ex-num">{#if feito}{@html icons.check}{:else}{i + 1}{/if}</span>
          <span class="ex-title"><b>{ex.title}</b><small>{ex.tests.length} testes · função <code>{ex.fn}</code></small></span>
          <span class="xp-pill">+{ex.xp} XP</span>
        </a>
      {/each}
    </div>
  </div>
{/if}
