<script lang="ts">
  // Tela inicial da Prática: XP, sequência, desafio do dia, revisão, o plano da pessoa, exercícios guiados,
  // trilhas na ordem do plano e o ranking com amigos.
  import * as C from '$contratos';
  import type { TEstadoPratica, TPasso } from '$contratos';
  import { pedir, corpo, mensagemDe } from '../api.ts';
  import { TRACK_ICONS } from '../icones.js';
  import { icons, LANG_LABEL, NIVEL_NOME } from './icones.ts';

  let { dados, toast, onatualizar, abrirNoChat, fazerQuiz }: {
    dados: TEstadoPratica; toast: (t: string) => void; onatualizar: (d: TEstadoPratica) => void;
    abrirNoChat: (texto: string) => void; fazerQuiz: () => void;
  } = $props();

  const ROTULO_TIPO: Record<string, string> = { trilha: 'Trilha', adaptada: 'Plano adaptado', montada: 'Plano montado', inicial: 'Plano inicial' };
  type Trilha = TEstadoPratica['tracks'][number];
  const pl = $derived(dados.plano);
  const feitosDa = (t: Trilha) => t.exercises.filter((e) => dados.progress[e.id]?.done).length;
  const totalEx = $derived(dados.tracks.reduce((s, t) => s + t.exercises.length, 0));
  const feitosEx = $derived(dados.tracks.reduce((s, t) => s + feitosDa(t), 0));
  const acha = (id: string) => { for (const t of dados.tracks) { const ex = t.exercises.find((e) => e.id === id); if (ex) return { t, ex }; } return null; };
  const link = (id: string) => { const f = acha(id); return f ? `#/pratica/${f.t.id}/${f.ex.id}` : '#/pratica'; };
  const ordenar = (lista: Trilha[]) => [...lista].sort((a, b) => pl.ordem.indexOf(a.id) - pl.ordem.indexOf(b.id));
  const desafio = $derived(acha(dados.desafio.exerciseId));
  const revisoesHoje = $derived(dados.revisoes.filter((r) => r.due && acha(r.exerciseId)));
  const proximaRevisao = $derived(dados.revisoes.filter((r) => !r.due).sort((a, b) => a.dueAt - b.dueAt)[0]);
  const reforco = $derived(dados.reforco.slice(0, 4).map(acha).filter((x) => x !== null));
  const seq = $derived(dados.sequencia);
  const motivos = $derived(pl.proximo?.tipo === 'trilha' ? (pl.motivos[pl.proximo.trackId] ?? []).filter((m) => m !== 'concluída') : []);
  const dia = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  // barras de progresso animam ao abrir a tela
  let animar = $state(false);
  $effect(() => { requestAnimationFrame(() => requestAnimationFrame(() => { animar = true; })); });

  let emailAmigo = $state('');
  let marcando = $state('');
  async function adicionarAmigo(email: string) {
    try {
      onatualizar(await pedir('/api/amigos', C.EstadoPratica, corpo({ email })));
      toast('Pedido enviado. Vira amizade quando a outra pessoa te adicionar também.'); emailAmigo = '';
    } catch (e) { toast(mensagemDe(e)); }
  }
  async function marcarGuiado(id: string) {
    marcando = id;
    try {
      const r = await pedir(`/api/pratica/guiado/${encodeURIComponent(id)}`, C.EstadoPraticaComGanhos, { method: 'POST' });
      onatualizar(r);
      if (r.ganhos.length) toast(`+${r.ganhos.reduce((n, g) => n + g.xp, 0)} XP`);
    } catch (e) { toast(mensagemDe(e)); }
    marcando = '';
  }
  function resolverGuiado(id: string) {
    const g = pl.guiados.find((x) => x.id === id); if (!g) return;
    abrirNoChat(`Exercício guiado de ${g.tecnologia} (${g.titulo}):\n${g.enunciado}\n\nNão me dê a resposta. Vou mandar minha solução; corrija, aponte os erros e me dê dicas.`);
  }
  const pedirDesafio = () => abrirNoChat(`Me dê um desafio de ${pl.tecnologias[0]} um pouco acima do meu nível (${pl.nivel}), sem a resposta. Depois eu mando minha solução para você corrigir.`);
</script>

{#snippet passo(p: TPasso | null)}
  {#if p?.tipo === 'trilha'}
    {@const f = acha(p.exerciseId)}
    {#if f}<a href={link(f.ex.id)}><b>{f.ex.title}</b></a> em {f.t.title}{/if}
  {:else if p?.tipo === 'guiado'}<b>{p.titulo}</b> ({p.tecnologia}, exercício guiado, logo abaixo)
  {:else if p}<b>{p.titulo}</b>{/if}
{/snippet}

{#snippet cartao(t: Trilha, i: number)}
  {@const feitos = feitosDa(t)}
  {@const pct = Math.round((feitos / t.exercises.length) * 100)}
  <a class="track-card" href="#/pratica/{t.id}" style="--i:{i};--track:{t.color}">
    <div class="track-top"><span class="track-icon">{@html (TRACK_ICONS as Record<string, string>)[t.icon] ?? ''}</span><span class="lang-badge">{LANG_LABEL[t.lang]}</span></div>
    {#if t.id === pl.recomendada && feitos < t.exercises.length}<span class="recommended" title={(pl.motivos[t.id] ?? []).join(', ')}>Recomendada para você</span>{/if}
    <h2>{t.title}</h2>
    <p>{t.description}</p>
    <div class="progress"><span style="width:{animar ? pct : 0}%"></span></div>
    <div class="track-meta"><span>{feitos}/{t.exercises.length} {t.projeto ? 'etapas' : 'exercícios'}</span><span>{pct === 100 ? 'Concluído ✓' : feitos ? 'Continuar →' : 'Começar →'}</span></div>
  </a>
{/snippet}

<div class="skills-inner">
  <header class="skills-hero">
    <div><h1>Prática</h1><p>Aprenda fazendo: escreva o código, rode os testes e ganhe XP. Travou? Peça uma dica ao Gyde — ele te guia sem entregar a resposta.</p></div>
    <div class="hero-stats">
      <div class="xp-card">{@html icons.star}<div><b>{dados.xp} XP</b><small>{feitosEx} de {totalEx} feitos</small></div></div>
      <div class="streak-card" class:on={seq.praticouHoje} title="Dias seguidos praticando">{@html icons.bolt}<div><b>{seq.dias} {seq.dias === 1 ? 'dia' : 'dias'}</b><small>{seq.praticouHoje ? 'sequência garantida hoje' : seq.dias ? 'pratique hoje para manter' : 'comece sua sequência'}</small></div></div>
    </div>
  </header>

  <div class="today-grid">
    {#if desafio}
      <a class="today-card daily" class:done={dados.desafio.rewarded} href={link(dados.desafio.exerciseId)} style="--track:{desafio.t.color}">
        <span class="today-label">{@html icons.target}Desafio do dia</span>
        <b>{desafio.ex.title}</b>
        <small>{desafio.t.title} · {LANG_LABEL[desafio.t.lang]}</small>
        <span class="today-reward">{#if dados.desafio.rewarded}{@html icons.check} Feito hoje{:else}XP em dobro: +{desafio.ex.xp * 2} XP{/if}</span>
      </a>
    {/if}
    <div class="today-card review">
      <span class="today-label">{@html icons.reset}Revisão</span>
      {#if revisoesHoje.length}
        <b>{revisoesHoje.length} para revisar hoje</b>
        <div class="review-list">{#each revisoesHoje.slice(0, 4) as r}<a href={link(r.exerciseId)}>{acha(r.exerciseId)?.ex.title}<span>nível {r.level + 1}/4</span></a>{/each}</div>
      {:else}
        <b>Nada para revisar agora</b><small>{proximaRevisao ? `Próxima revisão em ${dia(proximaRevisao.dueAt)}.` : 'Exercícios em que você errou antes de acertar voltam aqui depois de 1, 3, 7 e 21 dias.'}</small>
      {/if}
    </div>
  </div>

  <section class="plano">
    <div>
      <h2 class="section-title">Seu plano <span class="plano-tipo">{ROTULO_TIPO[pl.tipo] ?? ''}</span> <small>{pl.tecnologias.join(', ')} · nível {pl.nivel}{pl.tecnologiasDeduzidas && pl.temQuiz ? ' (pelo seu objetivo)' : ''}</small></h2>
      <p class="plano-exp">{pl.explicacao}</p>
      {#if pl.proximo}<p>Próximo passo: {@render passo(pl.proximo)}{motivos.length ? `, porque ${motivos.join(', ')}` : ''}.</p>
      {:else}<p>Você concluiu tudo o que o plano indicava. Novo desafio: {@render passo(pl.novoDesafio)}.</p>{/if}
      <p class="plano-obs">{pl.observado.feitos ? `Até agora: ${pl.observado.feitos} exercício(s) feitos${pl.observado.travados.length ? `, ${pl.observado.travados.length} ainda sem acertar` : ''}.` : 'Ainda sem exercícios feitos: o plano se ajusta conforme você pratica.'}</p>
      {#if !pl.temQuiz}<p class="plano-obs">Responder o questionário (uns 3 minutos) personaliza linguagens, nível e objetivo.</p>{/if}
    </div>
    <div class="plano-acoes">
      {#if pl.proximo?.tipo === 'trilha'}<a class="btn primary" href={link(pl.proximo.exerciseId)}>Continuar</a>
      {:else if pl.proximo?.tipo === 'guiado'}{@const id = pl.proximo.id}<button type="button" class="btn primary" onclick={() => resolverGuiado(id)}>Resolver no chat</button>
      {:else if pl.novoDesafio?.tipo === 'chat'}<button type="button" class="btn primary" onclick={pedirDesafio}>Pedir desafio</button>{/if}
      {#if !pl.temQuiz}<button type="button" class="btn ghost" onclick={fazerQuiz}>Responder o questionário</button>{/if}
    </div>
  </section>

  {#if pl.guiados.length}
    <section class="guiados"><h2 class="section-title">Exercícios guiados <small>você resolve no seu editor e o Gyde corrige no chat</small></h2>
      <div class="guiados-lista">
        {#each pl.guiados.slice(0, 6) as g (g.id)}
          <article class="guiado" class:feito={g.feito}>
            <div class="guiado-topo"><span class="lang-badge">{g.tecnologia}</span><small>{g.topico} · {NIVEL_NOME[g.nivel]}</small></div>
            <h3>{g.titulo}</h3><p>{g.enunciado}</p>
            <div class="guiado-acoes">
              {#if g.feito}<span class="guiado-ok">{@html icons.check} Feito</span>
              {:else}
                <button type="button" class="btn small primary" onclick={() => resolverGuiado(g.id)}>Resolver no chat</button>
                <button type="button" class="btn small ghost" disabled={marcando === g.id} onclick={() => marcarGuiado(g.id)}>Marcar como feito</button>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </section>
  {/if}

  {#if reforco.length}
    <section class="reforco"><h2 class="section-title">Para reforçar <small>pelo questionário e pelos exercícios em que você errou</small></h2>
      <div class="chip-row">{#each reforco as f}<a class="chip-link" href="#/pratica/{f.t.id}/{f.ex.id}" style="--track:{f.t.color}"><span class="dot"></span>{f.ex.title}<small>{LANG_LABEL[f.t.lang]}</small></a>{/each}</div>
    </section>
  {/if}

  <h2 class="section-title">Trilhas</h2>
  <div class="track-grid">{#each ordenar(dados.tracks.filter((t) => !t.projeto)) as t, i (t.id)}{@render cartao(t, i)}{/each}</div>

  <h2 class="section-title">Projetos guiados <small>construa algo de verdade, etapa por etapa</small></h2>
  <div class="track-grid">{#each ordenar(dados.tracks.filter((t) => t.projeto)) as t, i (t.id)}{@render cartao(t, i + 3)}{/each}</div>

  <section class="ranking">
    <h2 class="section-title">Ranking da semana <small>XP dos últimos 7 dias</small></h2>
    <div class="ranking-card">
      <ol class="rank-list">{#each dados.ranking as r, i}<li class:me={r.voce} style="--i:{i}"><span class="pos">{i + 1}</span><span class="who">{r.name}{#if r.voce} <small>(você)</small>{/if}</span><span class="seq">{@html icons.bolt}{r.sequencia}</span><b>{r.xpSemana} XP</b></li>{/each}</ol>
      {#if dados.ranking.length === 1}<p class="rank-empty">Adicione amigos para competir. Os dois precisam se adicionar — assim ninguém vê seu XP sem você querer.</p>{/if}
      {#if dados.pedidos.length}<div class="friend-requests"><small>Querem ser seus amigos:</small>{#each dados.pedidos as p}<button class="btn small" onclick={() => adicionarAmigo(p.email)}>{@html icons.plus}{p.name}</button>{/each}</div>{/if}
      {#if dados.aguardando.length}<p class="rank-empty">Aguardando: {dados.aguardando.map((a) => a.name).join(', ')}</p>{/if}
      <form class="friend-form" onsubmit={(e) => { e.preventDefault(); adicionarAmigo(emailAmigo.trim()); }}>
        <input type="email" bind:value={emailAmigo} placeholder="E-mail de um amigo neste Gyde" aria-label="E-mail de um amigo" required><button class="btn">Adicionar</button>
      </form>
    </div>
  </section>
</div>
