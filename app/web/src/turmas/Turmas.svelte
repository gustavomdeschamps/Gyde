<script lang="ts">
  // Turmas: criar ou entrar com código, as tarefas do aluno e o painel do professor (aluno x tarefa).
  import * as C from '$contratos';
  import type { TListaTurmas, TTurmaProfessor, TTurmaAluno } from '$contratos';
  import { pedir, enviar, corpo, mensagemDe } from '../api.ts';
  import { toast } from '../util.ts';

  let { id }: { id: string | null } = $props();

  const icone = {
    mais: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    entrar: '<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/></svg>',
    copiar: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    lixo: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    feito: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    pessoas: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .5 3.2 2 3.5 5"/></svg>',
  };
  const data = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '');
  const hoje = () => new Date().toLocaleDateString('sv-SE');

  let lista = $state<TListaTurmas | null>(null);
  let turma = $state<TTurmaProfessor | TTurmaAluno | null>(null);
  let trilhas = $state<C.TEstadoPratica['tracks']>([]);
  let erro = $state<string | null>(null);
  let nome = $state(''), codigo = $state(''), exercicio = $state(''), prazo = $state('');
  let copiado = $state(false);

  async function carregar(alvo: string | null) {
    erro = null;
    try {
      if (!alvo) { turma = null; lista = await pedir('/api/turmas', C.ListaTurmas); return; }
      try { turma = await pedir(`/api/turmas/${alvo}`, C.Turma); } catch (e) { toast(mensagemDe(e)); location.hash = '#/turmas'; return; }
      if (turma.professor && !trilhas.length) trilhas = (await pedir('/api/pratica', C.EstadoPratica)).tracks;
    } catch (e) { erro = mensagemDe(e); }
  }
  $effect(() => { carregar(id); });

  async function acao(f: () => Promise<unknown>) { try { await f(); } catch (e) { toast(mensagemDe(e)); } }
  const criar = (e: SubmitEvent) => { e.preventDefault(); acao(async () => { location.hash = `#/turmas/${(await pedir('/api/turmas', C.IdCriado, corpo({ name: nome }))).id}`; nome = ''; }); };
  const entrar = (e: SubmitEvent) => { e.preventDefault(); acao(async () => { const r = await pedir('/api/turmas/entrar', C.IdCriado, corpo({ code: codigo })); toast('Você entrou na turma'); codigo = ''; location.hash = `#/turmas/${r.id}`; }); };
  const passarTarefa = (e: SubmitEvent, t: TTurmaProfessor) => { e.preventDefault(); acao(async () => {
    await enviar(`/api/turmas/${t.id}/tarefas`, corpo({ exerciseId: exercicio, prazo }));
    toast('Tarefa passada para a turma'); exercicio = ''; prazo = ''; await carregar(t.id);
  }); };
  const remover = (pergunta: string, url: string, depois: () => unknown) => { if (confirm(pergunta)) acao(async () => { await enviar(url, { method: 'DELETE' }); await depois(); }); };
  async function copiarCodigo(c: string) {
    try { await navigator.clipboard.writeText(c); copiado = true; setTimeout(() => (copiado = false), 1800); } catch { toast('Não consegui copiar'); }
  }
</script>

<div class="skills-inner">
  {#if erro}
    <p class="msg-error">{erro}</p>
  {:else if !id}
    {#if !lista}
      <div class="skeleton" style="height:140px;margin-top:24px"></div>
    {:else}
      <header class="skills-hero"><div><h1>Turmas</h1>
        <p>Professor: crie uma turma, passe exercícios da Prática e acompanhe cada aluno. Aluno: entre com o código que o professor passar.</p></div></header>
      <div class="turma-forms">
        <form class="turma-form" onsubmit={criar}><h2>{@html icone.mais}Criar turma</h2>
          <div class="row"><input name="name" maxlength="60" placeholder="Ex.: 2º ano Informática — manhã" required bind:value={nome}><button class="btn primary">Criar</button></div></form>
        <form class="turma-form" onsubmit={entrar}><h2>{@html icone.entrar}Entrar numa turma</h2>
          <div class="row"><input name="code" maxlength="8" placeholder="Código (ex.: K7PX2M)" required autocomplete="off" style="text-transform:uppercase;letter-spacing:.12em" bind:value={codigo}><button class="btn">Entrar</button></div></form>
      </div>
      {#if lista.ensino.length}
        <h2 class="section-title">Turmas que eu ensino</h2>
        <div class="track-grid">{#each lista.ensino as t, i (t.id)}
          <a class="track-card" href="#/turmas/{t.id}" style="--i:{i}">
            <div class="track-top"><span class="track-icon">{@html icone.pessoas}</span><span class="lang-badge">Professor</span></div>
            <h2>{t.name}</h2><p>Código <b class="turma-code-inline">{t.code}</b></p>
            <div class="track-meta"><span>{t.alunos} {t.alunos === 1 ? 'aluno' : 'alunos'} · {t.tarefas} tarefas</span><span>Abrir →</span></div></a>
        {/each}</div>
      {/if}
      {#if lista.participo.length}
        <h2 class="section-title">Turmas em que estou</h2>
        <div class="track-grid">{#each lista.participo as t, i (t.id)}
          <a class="track-card" href="#/turmas/{t.id}" style="--i:{i}">
            <div class="track-top"><span class="track-icon">{@html icone.pessoas}</span><span class="lang-badge">Aluno</span></div>
            <h2>{t.name}</h2><p>Professor: {t.professor}</p>
            <div class="progress"><span style="width:{t.tarefas ? Math.round((t.feitas / t.tarefas) * 100) : 0}%"></span></div>
            <div class="track-meta"><span>{t.feitas}/{t.tarefas} tarefas feitas</span><span>Abrir →</span></div></a>
        {/each}</div>
      {/if}
      {#if !lista.ensino.length && !lista.participo.length}<div class="empty-state" style="margin-top:22px"><p>Você ainda não está em nenhuma turma.</p></div>{/if}
    {/if}
  {:else if turma}
    <nav class="crumbs"><a href="#/turmas">Turmas</a><span>›</span><span>{turma.name}</span></nav>
    {#if !turma.professor}
      {@const t = turma}
      <header class="skills-hero"><div><h1>{t.name}</h1><p>Professor: {t.professorNome ?? ''} · {t.tarefas.filter((k) => k.feita).length} de {t.tarefas.length} tarefas feitas</p></div>
        <button class="btn danger" onclick={() => remover('Sair desta turma?', `/api/turmas/${t.id}`, () => { location.hash = '#/turmas'; })}>Sair da turma</button></header>
      <div class="ex-list">
        {#each t.tarefas as k, i (k.id)}
          <a class="ex-item" class:done={k.feita} href="#/pratica/{k.trackId}/{k.exerciseId}" style="--i:{i}">
            <span class="ex-num">{#if k.feita}{@html icone.feito}{:else}{i + 1}{/if}</span>
            <span class="ex-title"><b>{k.title}</b><small>{k.track ?? ''}{k.prazo ? ` · prazo ${data(k.prazo)}` : ''}</small></span>
            {#if k.feita}<span class="xp-pill">feita</span>{:else if k.prazo && k.prazo < hoje()}<span class="badge late">atrasada</span>{/if}
          </a>
        {:else}<div class="empty-state"><p>O professor ainda não passou tarefas.</p></div>{/each}
      </div>
    {:else}
      {@const t = turma}
      <header class="skills-hero"><div><h1>{t.name}</h1><p>{t.alunos.length} {t.alunos.length === 1 ? 'aluno' : 'alunos'} · {t.tarefas.length} tarefas</p></div>
        <div class="turma-code"><small>Código da turma</small><b>{t.code}</b><button class="btn small" onclick={() => copiarCodigo(t.code)}>{@html copiado ? icone.feito : icone.copiar}{copiado ? 'Copiado' : 'Copiar'}</button></div></header>

      <form class="turma-form wide" onsubmit={(e) => passarTarefa(e, t)}><h2>{@html icone.mais}Passar tarefa</h2>
        <div class="row"><select name="exerciseId" required bind:value={exercicio}><option value="">Escolha um exercício da Prática…</option>
          {#each trilhas as tr (tr.id)}<optgroup label={tr.title}>{#each tr.exercises as ex (ex.id)}<option value={ex.id}>{ex.title}</option>{/each}</optgroup>{/each}</select>
        <input type="date" name="prazo" title="Prazo (opcional)" bind:value={prazo}><button class="btn primary">Adicionar</button></div></form>

      <h2 class="section-title">Painel da turma <small>quem fez cada tarefa</small></h2>
      {#if t.alunos.length && t.tarefas.length}
        <div class="turma-table-wrap"><table class="turma-table">
          <thead><tr><th>Aluno</th>
            {#each t.tarefas as k, j (k.id)}<th title={k.title}><span>{j + 1}. {k.title}</span>{#if k.prazo}<small>até {data(k.prazo)}</small>{/if}<button class="x" title="Remover tarefa" onclick={() => remover('Remover esta tarefa da turma?', `/api/turmas/${t.id}/tarefas/${k.id}`, () => carregar(t.id))}>×</button></th>{/each}
            <th>Feitas</th><th>XP</th></tr></thead>
          <tbody>{#each t.alunos as a, i (a.id)}
            <tr style="--i:{i}"><td><b>{a.name}</b><small>{a.ultimoDia ? `ativo em ${data(a.ultimoDia)}` : 'ainda não praticou'}</small></td>
              {#each a.feitas as f}<td class="cell" class:ok={f}>{#if f}{@html icone.feito}{:else}–{/if}</td>{/each}
              <td><b>{a.feitas.filter(Boolean).length}/{t.tarefas.length}</b></td><td>{a.xp}</td></tr>
          {/each}</tbody></table></div>
      {:else}
        <div class="empty-state"><p>{#if !t.alunos.length}Nenhum aluno ainda. Passe o código <b>{t.code}</b> para a turma entrar em Turmas → Entrar numa turma.{:else}Passe a primeira tarefa para começar a acompanhar.{/if}</p></div>
      {/if}
      {#if t.alunos.length}
        <details class="turma-alunos"><summary>Alunos ({t.alunos.length})</summary><ul>
          {#each t.alunos as a (a.id)}<li>{a.name} <small>{a.email}</small><button class="btn small danger" onclick={() => remover('Remover este aluno da turma?', `/api/turmas/${t.id}/alunos/${a.id}`, () => carregar(t.id))}>Remover</button></li>{/each}
        </ul></details>
      {/if}
      <button class="btn danger" style="margin-top:22px" onclick={() => remover(`Apagar a turma "${t.name}"? Os alunos saem dela e as tarefas somem.`, `/api/turmas/${t.id}`, () => { location.hash = '#/turmas'; })}>{@html icone.lixo}Apagar turma</button>
    {/if}
  {/if}
</div>
