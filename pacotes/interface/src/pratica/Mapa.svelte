<script lang="ts">
  // Mapa de habilidades: para cada linguagem, os itens da Prática em três trilhas (básico, intermediário, avançado),
  // acesos conforme o progresso real. Clicar leva ao exercício, ao projeto ou à lista de exercícios guiados.
  import * as C from '$contratos';
  import type { TMapaHabilidades } from '$contratos';
  import { pedir, mensagemDe } from '../api.ts';
  import { NIVEL_NOME } from './icones.ts';

  let { inicial }: { inicial: string } = $props();
  let mapa = $state<TMapaHabilidades | null>(null);
  let erro = $state('');
  // valor inicial de propósito: a linguagem do plano da pessoa; depois ela troca pelas abas
  let escolhida = $state('');
  $effect(() => { if (!escolhida) escolhida = inicial; });

  async function carregar() {
    erro = '';
    try { mapa = await pedir('/api/pratica/mapa', C.MapaHabilidades); } catch (e) { erro = mensagemDe(e); }
  }
  carregar();

  const NIVEIS = ['basico', 'intermediario', 'avancado'] as const;
  const atual = $derived(mapa?.tecnologias.find((t) => t.tecnologia === escolhida) ?? mapa?.tecnologias[0]);
  const ROTULO = { dominado: 'dominado', praticando: 'praticando', novo: 'ainda não feito' } as const;
  const TIPO = { exercicio: 'exercício com testes', guiado: 'exercício guiado', etapa: 'etapa de projeto' } as const;
  const pct = (d: number, t: number) => (t ? Math.round((d / t) * 100) : 0);
</script>

<div class="skills-inner mapa">
  <nav class="crumbs"><a href="#/pratica">Prática</a><span>›</span><span>Mapa de habilidades</span></nav>
  <header class="skills-hero"><div><h1>Mapa de habilidades</h1><p>Tudo o que a Prática tem de cada linguagem, aceso conforme você domina. Clique num ponto para praticar.</p></div></header>

  {#if erro}
    <div class="estado-erro" role="alert"><h2>Não deu para abrir o mapa</h2><p>{erro}</p><button type="button" class="btn primary" onclick={carregar}>Tentar de novo</button></div>
  {:else if !mapa || !atual}
    <div aria-busy="true"><p class="sr-only">Carregando o mapa…</p><div class="skeleton" style="height:56px;margin-top:20px"></div><div class="skeleton" style="height:320px"></div></div>
  {:else}
    <div class="mapa-abas" role="tablist" aria-label="Linguagens">
      {#each mapa.tecnologias as t (t.tecnologia)}
        <button type="button" role="tab" aria-selected={t.tecnologia === atual.tecnologia} onclick={() => (escolhida = t.tecnologia)} style="--p:{pct(t.dominados, t.total)}">
          <span class="mapa-anel" aria-hidden="true"></span>{t.tecnologia}<small>{t.dominados}/{t.total}</small>
        </button>
      {/each}
    </div>

    <div class="mapa-legenda" aria-hidden="true">
      <span><i class="mapa-no dominado"></i>dominado</span><span><i class="mapa-no praticando"></i>praticando</span><span><i class="mapa-no novo"></i>ainda não feito</span>
    </div>

    {#key atual.tecnologia}
      <div class="mapa-trilhas" role="tabpanel" aria-label="Mapa de {atual.tecnologia}">
        {#each NIVEIS as nivel, k}
          {@const nos = atual.nos.filter((n) => n.nivel === nivel)}
          <section class="mapa-trilha" style="--k:{k}">
            <h2>{NIVEL_NOME[nivel]} <small>{nos.filter((n) => n.estado === 'dominado').length}/{nos.length}</small></h2>
            {#if nos.length}
              <ol>
                {#each nos as n, i (n.id)}
                  {@const novoGrupo = i === 0 || nos[i - 1]!.grupo !== n.grupo}
                  {#if novoGrupo}<li class="mapa-grupo" aria-hidden="true">{n.grupo}</li>{/if}
                  <li class="mapa-item {n.estado}" style="--i:{i}">
                    <a href={n.link} title="{n.titulo}: {TIPO[n.tipo]}, {ROTULO[n.estado]}">
                      <span class="mapa-no {n.estado}" aria-hidden="true"></span>
                      <span class="mapa-titulo">{n.titulo}<small>{TIPO[n.tipo]} · {ROTULO[n.estado]}</small></span>
                    </a>
                  </li>
                {/each}
              </ol>
            {:else}<p class="mapa-vazio">Ainda não há itens neste nível.</p>{/if}
          </section>
        {/each}
      </div>
    {/key}
  {/if}
</div>
