<script lang="ts">
  // Skills: catálogo, skills próprias, loja da comunidade, importar e exportar, e a página de cada skill.
  import * as C from '$contratos';
  import type { TSkill, TItemLoja } from '$contratos';
  import { pedir, corpo, mensagemDe } from '../api.ts';
  import { toast } from '../util.ts';
  import EditorSkill from './EditorSkill.svelte';
  import { skillsState, definirSkills } from './estado.svelte.ts';

  let { id, renderMarkdown }: { id: string | null; renderMarkdown: (t: string) => string } = $props();

  const icone = {
    mais: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    enviar: '<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"/></svg>',
    baixar: '<svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"/></svg>',
    feito: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    editar: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/></svg>',
    lixo: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    loja: '<svg viewBox="0 0 24 24"><path d="M4 9.5L5.5 4h13L20 9.5M4 9.5h16M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20"/></svg>',
    pessoa: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/></svg>',
  };
  type Filtro = 'todas' | 'instaladas' | 'minhas' | 'loja';
  const ABAS: [Filtro, string][] = [['todas', 'Todas'], ['instaladas', 'Instaladas'], ['minhas', 'Minhas'], ['loja', 'Loja']];

  let loja = $state<TItemLoja[]>([]);
  let filtro = $state<Filtro>('todas');
  let busca = $state('');
  let carregado = $state(false);
  let erro = $state<string | null>(null);
  let editor = $state<{ existente: TSkill | null } | null>(null);
  let itemLoja = $state<TItemLoja | null>(null);
  let dialogoLoja: HTMLDialogElement | undefined = $state();
  let entradaArquivo: HTMLInputElement | undefined = $state();
  let recemTrocadas = $state(new Set<string>()); // cartões que acabaram de mudar (animação)
  let ocupada = $state<string | null>(null);

  const skills = $derived(skillsState.lista);
  const naAba = (f: Filtro, s: TSkill) => f === 'todas' || (f === 'instaladas' ? s.instalada : s.origem === 'minha');
  const contagem = (f: Filtro) => (f === 'loja' ? loja.length : skills.filter((s) => naAba(f, s)).length);
  const lista = $derived(skills.filter((s) => naAba(filtro, s)));
  const lojaFiltrada = $derived.by(() => {
    const termo = busca.trim().toLowerCase();
    return loja.filter((s) => !termo || `${s.nome} ${s.descricao} ${s.comando} ${s.autor}`.toLowerCase().includes(termo));
  });
  const atual = $derived(id ? skills.find((s) => s.id === id) : undefined);
  const origem = (s: TSkill) => (s.loja ? 'Da loja' : s.origem === 'minha' ? (s.publicada ? 'Minha · na loja' : 'Minha skill') : s.categoria);
  const instalacoes = (n: number) => `${n} ${n === 1 ? 'instalação' : 'instalações'}`;

  const carregarLoja = async () => { loja = (await pedir('/api/skills/loja', C.Loja)).loja; };
  async function carregar() {
    erro = null;
    try {
      const [r] = await Promise.all([pedir('/api/skills', C.ListaSkills), carregarLoja()]);
      definirSkills(r.skills);
      carregado = true;
    } catch (e) { erro = mensagemDe(e); }
  }
  $effect(() => { void id; carregar(); });
  // skill que não existe (excluída, link velho): volta para a lista
  $effect(() => { if (carregado && id && !atual) location.hash = '#/skills'; });
  $effect(() => { if (itemLoja) dialogoLoja?.showModal(); });

  async function acao(f: () => Promise<unknown>) { try { await f(); } catch (e) { toast(mensagemDe(e)); } }

  async function alternar(s: TSkill) {
    ocupada = s.id;
    await acao(async () => {
      const ligar = !s.instalada;
      definirSkills((await pedir(`/api/skills/${s.id}/install`, C.ListaSkills, { method: ligar ? 'POST' : 'DELETE' })).skills);
      recemTrocadas = new Set([...recemTrocadas, s.id]);
      toast(ligar ? `Skill "${s.nome}" instalada${s.comando ? ` — use ${s.comando}` : ''}` : `Skill "${s.nome}" removida`);
    });
    ocupada = null;
  }
  async function trocarAba(f: Filtro) {
    filtro = f;
    if (f === 'loja') await acao(carregarLoja);
  }
  async function importar(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const arquivo = el.files?.[0];
    el.value = '';
    if (!arquivo) return;
    await acao(async () => {
      definirSkills((await pedir('/api/skills/import', C.SkillSalva, corpo({ markdown: await arquivo.text() }))).skills);
      toast('Skill importada e instalada');
      filtro = 'minhas';
    });
  }
  function salvo(existente: TSkill | null, r: { id: string; skills: TSkill[] }) {
    definirSkills(r.skills);
    toast(existente ? 'Skill atualizada' : 'Skill criada e instalada');
    location.hash = `#/skills/${r.id}`;
  }
  const tirarDaLoja = (lojaId: string, depois?: () => Promise<void>) => acao(async () => {
    definirSkills((await pedir(`/api/skills/loja/${lojaId}`, C.ListaSkills, { method: 'DELETE' })).skills);
    await depois?.();
    toast('Skill retirada da loja');
  });
  function despublicarItem(s: TItemLoja) {
    if (confirm(`Tirar "${s.nome}" da loja? Quem já instalou continua com a própria cópia.`)) tirarDaLoja(s.id, carregarLoja);
  }
  function publicar(s: TSkill) {
    if (!s.publicada && !confirm(`Publicar "${s.nome}" na loja? Quem usa este Gyde vai ver o nome, a descrição, as instruções e o seu nome.`)) return;
    acao(async () => {
      const r = await pedir(`/api/skills/custom/${s.id}/publicar`, C.SkillPublicada, { method: 'POST' });
      definirSkills(r.skills);
      toast(r.atualizada ? 'Skill atualizada na loja' : 'Skill publicada na loja');
    });
  }
  function excluir(s: TSkill) {
    if (!confirm(`Excluir a skill "${s.nome}"?${s.publicada ? ' Ela também sai da loja.' : ''} Isso não pode ser desfeito.`)) return;
    acao(async () => {
      definirSkills((await pedir(`/api/skills/custom/${s.id}`, C.ListaSkills, { method: 'DELETE' })).skills);
      toast('Skill excluída');
      location.hash = '#/skills';
    });
  }
  // as instruções entram no prompt do Gyde: a pessoa lê antes de instalar
  async function instalarDaLoja(e: SubmitEvent, s: TItemLoja) {
    if ((e.submitter as HTMLButtonElement | null)?.value !== 'install') return;
    e.preventDefault();
    await acao(async () => {
      const r = await pedir(`/api/skills/loja/${s.id}/instalar`, C.SkillDaLoja, { method: 'POST' });
      definirSkills(r.skills);
      dialogoLoja?.close();
      toast(r.semComando ? `Skill instalada sem o comando ${s.comando}, que você já usa. Escolha outro em Editar.` : `Skill "${s.nome}" instalada${s.comando ? ` — use ${s.comando}` : ''}`);
      await carregarLoja();
    });
  }
</script>

{#snippet botaoInstalar(s: TSkill, pequeno: boolean)}
  <button class="btn {s.instalada ? 'installed' : 'primary'}" class:small={pequeno} disabled={ocupada === s.id} onclick={() => alternar(s)}>
    {#if s.instalada}{@html icone.feito}{pequeno ? 'Instalada' : 'Instalada — remover'}{:else}{@html icone.mais}Instalar{/if}
  </button>
{/snippet}

<div class="skills-inner">
  {#if erro}
    <p class="msg-error">{erro}</p>
  {:else if !carregado}
    <div class="skeleton" style="height:140px;margin-top:24px"></div>
  {:else if id && atual}
    {@const s = atual}
    {@const minha = s.origem === 'minha'}
    <nav class="crumbs"><a href="#/skills">Skills</a><span>›</span><span>{s.nome}</span></nav>
    <div class="skill-detail">
      <header><span class="skill-symbol big" aria-hidden="true">{s.simbolo}</span><div><h1>{s.nome}</h1><p>{s.descricao}</p></div></header>
      <div class="skill-meta">
        {#if s.comando}<div><small>Comando</small><code class="cmd">{s.comando}</code></div>{/if}
        <div><small>Categoria</small><b>{origem(s)}</b></div>
        {#if s.gatilhos.length}<div class="wide"><small>Ativa sozinha quando a mensagem tiver</small><span class="chips">{#each s.gatilhos as g}<span>{g}</span>{/each}</span></div>{/if}
      </div>
      <div class="detail-actions">
        {@render botaoInstalar(s, false)}
        <a class="btn" href="/api/skills/{encodeURIComponent(s.id)}/export" download>{@html icone.baixar}Exportar .md</a>
        {#if minha}<button class="btn" onclick={() => (editor = { existente: s })}>{@html icone.editar}Editar</button>{/if}
        {#if minha && !s.loja}<button class="btn" onclick={() => publicar(s)}>{@html icone.loja}{s.publicada ? 'Atualizar na loja' : 'Publicar na loja'}</button>{/if}
        {#if s.publicada}<button class="btn" onclick={() => tirarDaLoja(s.publicada!)}>Tirar da loja</button>{/if}
        {#if minha}<button class="btn danger" onclick={() => excluir(s)}>{@html icone.lixo}Excluir</button>{/if}
      </div>
      <section class="skill-body"><h3>Instruções que o Gyde segue</h3><div class="md">{@html renderMarkdown(s.corpo)}</div></section>
    </div>
  {:else}
    <header class="skills-hero">
      <div><h1>Skills</h1>
        <p>Habilidades que você instala no Gyde. Cada skill ensina um jeito especializado de ajudar e entra em ação pelo <b>comando</b> (como <code>/revisar</code>) ou sozinha, quando sua mensagem tiver as palavras certas. Na <b>Loja</b> ficam as skills que outras pessoas publicaram.</p></div>
      <div class="hero-actions">
        <button class="btn" onclick={() => entradaArquivo?.click()}>{@html icone.enviar}Importar .md</button>
        <button class="btn primary" onclick={() => (editor = { existente: null })}>{@html icone.mais}Criar skill</button>
        <input type="file" accept=".md,text/markdown,text/plain" hidden id="skillFile" bind:this={entradaArquivo} onchange={importar}>
      </div>
    </header>
    <div class="tabs" role="tablist">
      {#each ABAS as [f, rotulo]}
        <button role="tab" class="tab" class:active={filtro === f} aria-selected={filtro === f} onclick={() => trocarAba(f)}>{#if f === 'loja'}{@html icone.loja}{/if}{rotulo}<span>{contagem(f)}</span></button>
      {/each}
    </div>

    {#if filtro === 'loja'}
      <label class="search loja-search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>
        <input type="search" id="lojaBusca" placeholder="Buscar na loja por nome, comando ou autor" autocomplete="off" bind:value={busca}>
      </label>
      {#if lojaFiltrada.length}
        <div class="skill-grid">{#each lojaFiltrada as s, i (s.id)}
          <article class="skill-card loja-card" class:on={s.instalada} style="--i:{i}">
            <div class="skill-top"><span class="skill-symbol" aria-hidden="true">{s.simbolo}</span><span class="skill-cat">{instalacoes(s.installs)}</span></div>
            <h2><button type="button" class="link-btn" onclick={() => (itemLoja = s)}>{s.nome}</button></h2>
            <p>{s.descricao}</p>
            <span class="loja-autor">{@html icone.pessoa}{s.minha ? 'Você publicou' : s.autor}</span>
            <div class="skill-foot">
              {#if s.comando}<code class="cmd">{s.comando}</code>{:else}<span></span>{/if}
              {#if s.minha}<button class="btn small danger" onclick={() => despublicarItem(s)}>Tirar da loja</button>
              {:else if s.instalada}<span class="btn installed small">{@html icone.feito}Instalada</span>
              {:else}<button class="btn primary small" onclick={() => (itemLoja = s)}>{@html icone.mais}Ver e instalar</button>{/if}
            </div>
          </article>
        {/each}</div>
      {:else if loja.length}
        <div class="empty-state"><p>Nada encontrado com essa busca.</p></div>
      {:else}
        <div class="empty-state"><p>A loja ainda está vazia. Crie uma skill e publique para seus colegas usarem.</p><button class="btn primary" onclick={() => (editor = { existente: null })}>Criar e publicar uma skill</button></div>
      {/if}
    {:else if lista.length}
      <div class="skill-grid">{#each lista as s, i (s.id)}
        <article class="skill-card" class:on={s.instalada} class:just-toggled={recemTrocadas.has(s.id)} style="--i:{i}">
          <div class="skill-top"><span class="skill-symbol" aria-hidden="true">{s.simbolo}</span><span class="skill-cat">{origem(s)}</span></div>
          <h2><a href="#/skills/{s.id}">{s.nome}</a></h2>
          <p>{s.descricao}</p>
          <div class="skill-foot">{#if s.comando}<code class="cmd">{s.comando}</code>{:else}<span></span>{/if}{@render botaoInstalar(s, true)}</div>
        </article>
      {/each}</div>
    {:else}
      <div class="empty-state">
        <p>{filtro === 'minhas' ? 'Você ainda não criou nenhuma skill.' : 'Nenhuma skill instalada ainda.'}</p>
        {#if filtro === 'minhas'}<button class="btn primary" onclick={() => (editor = { existente: null })}>Criar minha primeira skill</button>
        {:else}<button class="btn primary" onclick={() => (filtro = 'todas')}>Ver o catálogo</button>{/if}
      </div>
    {/if}
  {/if}
</div>

{#if editor}
  {@const existente = editor.existente}
  <EditorSkill {existente} onsalvo={(r) => salvo(existente, r)} onfechar={() => (editor = null)} />
{/if}

{#if itemLoja}
  {@const s = itemLoja}
  <dialog class="dialog wide-dialog" bind:this={dialogoLoja} onclose={() => (itemLoja = null)}>
    <form method="dialog" class="skill-detail loja-detail" onsubmit={(e) => instalarDaLoja(e, s)}>
      <header><span class="skill-symbol big" aria-hidden="true">{s.simbolo}</span>
        <div><h1>{s.nome}</h1><p>{s.descricao}</p>
          <small class="loja-autor">{@html icone.pessoa}por {s.minha ? 'você' : s.autor} · {instalacoes(s.installs)}</small></div></header>
      <div class="skill-meta">
        {#if s.comando}<div><small>Comando</small><code class="cmd">{s.comando}</code></div>{/if}
        {#if s.gatilhos.length}<div class="wide"><small>Ativa sozinha quando a mensagem tiver</small><span class="chips">{#each s.gatilhos as g}<span>{g}</span>{/each}</span></div>{/if}
      </div>
      <section class="skill-body"><h3>Instruções que o Gyde vai seguir</h3><div class="md">{@html renderMarkdown(s.corpo)}</div></section>
      <p class="loja-aviso">Leia as instruções antes de instalar: elas mudam como o Gyde responde quando a skill está ativa. Você recebe uma cópia sua, que pode editar ou excluir quando quiser.</p>
      <div class="dialog-actions"><button value="cancel" class="btn ghost">Fechar</button>
        {#if !s.minha && !s.instalada}<button value="install" class="btn primary">{@html icone.mais}Instalar cópia</button>{/if}</div>
    </form>
  </dialog>
{/if}
