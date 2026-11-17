<script lang="ts">
  // Skills: catálogo por objetivo ("Quero..." com pacotes e busca), instaladas, as próprias, a loja da comunidade e a
  // página de cada skill. Instalar uma skill faz o Gyde seguir os passos e o checklist dela quando o pedido é do assunto.
  import { icone as svgIcone } from '../icones.ts';
  import * as C from '$contratos';
  import type { TSkill, TItemLoja, TObjetivosSkills, TPacoteSkills } from '$contratos';
  import { pedir, corpo, mensagemDe } from '../api.ts';
  import { toast } from '../util.ts';
  import EditorSkill from './EditorSkill.svelte';
  import { skillsState, definirSkills } from './estado.svelte.ts';
  import { corDe, notaPacote, notaSkill, textoDoTeste } from './catalogo.ts';

  let { id, renderMarkdown }: { id: string | null; renderMarkdown: (t: string) => string } = $props();

  type Aba = 'catalogo' | 'instaladas' | 'minhas' | 'loja';
  const ABAS: [Aba, string][] = [['catalogo', 'Catálogo'], ['instaladas', 'Instaladas'], ['minhas', 'Minhas'], ['loja', 'Loja']];
  const EXEMPLOS = ['fazer um site', 'criar um jogo', 'analisar uma planilha', 'aprender a programar', 'deixar meu login seguro'];

  let loja = $state<TItemLoja[]>([]);
  let objetivos = $state<TObjetivosSkills | null>(null);
  let aba = $state<Aba>('catalogo');
  let quero = $state('');
  let categoria = $state<string | null>(null);
  let buscaLoja = $state('');
  let carregado = $state(false);
  let erro = $state<string | null>(null);
  let editor = $state<{ existente: TSkill | null } | null>(null);
  let itemLoja = $state<TItemLoja | null>(null);
  let dialogoLoja: HTMLDialogElement | undefined = $state();
  let entradaArquivo: HTMLInputElement | undefined = $state();
  let ocupada = $state<string | null>(null);

  const skills = $derived(skillsState.lista);
  const porId = $derived(new Map(skills.map((s) => [s.id, s])));
  const catalogo = $derived(skills.filter((s) => s.origem === 'catalogo'));
  const contagem = (a: Aba) => (a === 'loja' ? loja.length : a === 'catalogo' ? catalogo.length : a === 'instaladas' ? skills.filter((s) => s.instalada).length : skills.filter((s) => s.origem === 'minha').length);
  const daLista = (ids: string[]) => ids.map((x) => porId.get(x)).filter((s): s is TSkill => Boolean(s));

  // busca por intenção: pacotes cuja frase de objetivo aparece no texto e skills pelo assunto
  const buscando = $derived(quero.trim().length > 1);
  const pacotesAchados = $derived(buscando && objetivos ? objetivos.pacotes.map((p) => ({ p, nota: notaPacote(p, quero) })).filter((x) => x.nota > 0).sort((a, b) => b.nota - a.nota).slice(0, 2).map((x) => x.p) : []);
  const skillsAchadas = $derived(buscando ? catalogo.map((s) => ({ s, nota: notaSkill(s, quero) })).filter((x) => x.nota > 0).sort((a, b) => b.nota - a.nota).map((x) => x.s) : []);
  const naCategoria = $derived(catalogo.filter((s) => !categoria || s.categoria === categoria));
  const lojaFiltrada = $derived.by(() => {
    const termo = buscaLoja.trim().toLowerCase();
    return loja.filter((s) => !termo || `${s.nome} ${s.descricao} ${s.comando} ${s.autor}`.toLowerCase().includes(termo));
  });
  const atual = $derived(id ? skills.find((s) => s.id === id) : undefined);
  const instalacoes = (n: number) => `${n} ${n === 1 ? 'instalação' : 'instalações'}`;
  const faltam = (p: TPacoteSkills) => p.skills.filter((x) => !porId.get(x)?.instalada).length;

  const carregarLoja = async () => { loja = (await pedir('/api/skills/loja', C.Loja)).loja; };
  async function carregar() {
    erro = null;
    try {
      const [r, o] = await Promise.all([pedir('/api/skills', C.ListaSkills), pedir('/api/skills/objetivos', C.ObjetivosSkills), carregarLoja()]);
      definirSkills(r.skills);
      objetivos = o;
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
      toast(ligar ? `Skill "${s.nome}" instalada${s.comando ? `. Use ${s.comando} ou fale do assunto no chat` : ''}` : `Skill "${s.nome}" removida`);
    });
    ocupada = null;
  }
  async function instalarPacote(p: TPacoteSkills) {
    ocupada = p.id;
    await acao(async () => {
      const n = faltam(p);
      definirSkills((await pedir(`/api/skills/pacotes/${p.id}/install`, C.ListaSkills, { method: 'POST' })).skills);
      toast(`Pacote "${p.nome}" instalado: ${n} ${n === 1 ? 'skill nova' : 'skills novas'}`);
    });
    ocupada = null;
  }
  async function trocarAba(a: Aba) {
    aba = a;
    if (a === 'loja') await acao(carregarLoja);
  }
  async function importar(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const arquivo = el.files?.[0];
    el.value = '';
    if (!arquivo) return;
    await acao(async () => {
      definirSkills((await pedir('/api/skills/import', C.SkillSalva, corpo({ markdown: await arquivo.text() }))).skills);
      toast('Skill importada e instalada');
      aba = 'minhas';
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
      toast(r.semComando ? `Skill instalada sem o comando ${s.comando}, que você já usa. Escolha outro em Editar.` : `Skill "${s.nome}" instalada${s.comando ? `. Use ${s.comando}` : ''}`);
      await carregarLoja();
    });
  }
</script>

{#snippet marca(icone: string, cat: string, grande = false)}
  <span class="sk-marca" class:grande style:--cat={corDe(cat)}>{@html svgIcone(icone)}</span>
{/snippet}

{#snippet botaoInstalar(s: TSkill, detalhe = false)}
  <button type="button" class="btn sk-instalar" class:small={!detalhe} class:primary={!s.instalada} class:installed={s.instalada} disabled={ocupada === s.id}
    aria-label={s.instalada ? `${s.nome} instalada. Remover` : `Instalar ${s.nome}`} onclick={() => alternar(s)}>
    {#if s.instalada}{@html svgIcone('check')}{detalhe ? 'Instalada. Remover' : 'Instalada'}{:else}{@html svgIcone('plus')}Instalar{/if}
  </button>
{/snippet}

{#snippet cartao(s: TSkill)}
  <article class="sk-cartao" class:on={s.instalada}>
    <div class="sk-cartao-topo">
      {@render marca(s.icone, s.categoria)}
      <span class="sk-selo" style:--cat={corDe(s.categoria)}>{s.origem === 'minha' ? (s.loja ? 'Da loja' : 'Minha') : s.categoria}</span>
    </div>
    <h3><a href="#/skills/{s.id}">{s.nome}</a></h3>
    <p class="sk-desc">{s.descricao}</p>
    <div class="sk-cartao-pe">
      <span class="sk-teste" class:sem-teste={s.teste?.veredito !== 'melhora'}>{@html svgIcone('flask-conical')}{s.origem === 'minha' ? 'Feita por você' : textoDoTeste(s.teste, true)}</span>
      {@render botaoInstalar(s)}
    </div>
  </article>
{/snippet}

{#snippet pacote(p: TPacoteSkills)}
  {@const n = faltam(p)}
  <article class="sk-pacote">
    <div class="sk-pacote-cabeca">
      <span class="sk-marca grande pacote">{@html svgIcone(p.icone)}</span>
      <div><h3>{p.nome}</h3><p>{p.descricao}</p></div>
    </div>
    <ul class="sk-pacote-lista" aria-label="Skills do pacote {p.nome}">
      {#each daLista(p.skills) as s (s.id)}
        <li><a href="#/skills/{s.id}">{@render marca(s.icone, s.categoria)}<span>{s.nome}</span></a>{#if s.instalada}<span class="sk-ok">{@html svgIcone('check', 'instalada')}</span>{/if}</li>
      {/each}
    </ul>
    <button type="button" class="btn small" class:primary={n > 0} class:installed={n === 0} disabled={n === 0 || ocupada === p.id} onclick={() => instalarPacote(p)}>
      {#if n === 0}{@html svgIcone('check')}Todas instaladas{:else}{@html svgIcone('plus')}Instalar {n === p.skills.length ? `as ${n}` : `as ${n} que faltam`}{/if}
    </button>
  </article>
{/snippet}

<div class="skills-inner">
  {#if erro}
    <p class="msg-error">{erro}</p>
  {:else if !carregado}
    <div class="skeleton" style="height:140px;margin-top:24px"></div>
  {:else if id && atual}
    {@const s = atual}
    {@const minha = s.origem === 'minha'}
    <nav class="crumbs" aria-label="Caminho"><a href="#/skills">Skills</a><span class="crumbs-sep">{@html svgIcone('chevron-right')}</span><span>{s.nome}</span></nav>
    <div class="skill-detail">
      <header>{@render marca(s.icone, s.categoria, true)}<div><h1>{s.nome}</h1><p>{s.descricao}</p></div></header>
      <div class="skill-meta">
        <div><small>Categoria</small><b>{minha ? (s.loja ? 'Da loja' : s.publicada ? 'Minha skill, na loja' : 'Minha skill') : s.categoria}</b></div>
        {#if s.comando}<div><small>Comando</small><code class="cmd">{s.comando}</code></div>{/if}
        {#if s.gatilhos.length}<div class="wide"><small>Entra sozinha quando a mensagem fala de</small><span class="chips">{#each s.gatilhos as g}<span>{g}</span>{/each}</span></div>{/if}
      </div>
      {#if !minha}<p class="sk-teste-longo" class:sem-teste={s.teste?.veredito !== 'melhora'}>{@html svgIcone('flask-conical')}<span>{textoDoTeste(s.teste)}</span></p>{/if}
      <div class="detail-actions">
        {@render botaoInstalar(s, true)}
        <a class="btn" href="/api/skills/{encodeURIComponent(s.id)}/export" download>{@html svgIcone('download')}Exportar .md</a>
        {#if minha}<button class="btn" onclick={() => (editor = { existente: s })}>{@html svgIcone('pencil')}Editar</button>{/if}
        {#if minha && !s.loja}<button class="btn" onclick={() => publicar(s)}>{@html svgIcone('store')}{s.publicada ? 'Atualizar na loja' : 'Publicar na loja'}</button>{/if}
        {#if s.publicada}<button class="btn" onclick={() => tirarDaLoja(s.publicada!)}>Tirar da loja</button>{/if}
        {#if minha}<button class="btn danger" onclick={() => excluir(s)}>{@html svgIcone('trash')}Excluir</button>{/if}
      </div>
      <section class="skill-body"><h3>Instruções que o Gyde segue</h3><div class="md">{@html renderMarkdown(s.corpo)}</div></section>
    </div>
  {:else}
    <header class="sk-topo">
      <div class="sk-titulo">
        <h1>Skills</h1>
        <p>Instale o que você vai fazer. Com a skill instalada, o Gyde segue os passos e o checklist dela sempre que o assunto aparecer no chat.</p>
      </div>
      <div class="hero-actions">
        <button class="btn" onclick={() => entradaArquivo?.click()}>{@html svgIcone('upload')}Importar .md</button>
        <button class="btn" onclick={() => (editor = { existente: null })}>{@html svgIcone('plus')}Criar skill</button>
        <input type="file" accept=".md,text/markdown,text/plain" hidden id="skillFile" bind:this={entradaArquivo} onchange={importar}>
      </div>
    </header>

    <div class="tabs" role="tablist" aria-label="Partes da tela de Skills">
      {#each ABAS as [a, rotulo]}
        <button role="tab" class="tab" class:active={aba === a} aria-selected={aba === a} onclick={() => trocarAba(a)}>{#if a === 'loja'}{@html svgIcone('store')}{/if}{rotulo}<span>{contagem(a)}</span></button>
      {/each}
    </div>

    {#if aba === 'catalogo'}
      <form class="sk-quero" role="search" onsubmit={(e) => e.preventDefault()}>
        <label for="skQuero">Quero</label>
        <input id="skQuero" type="search" autocomplete="off" placeholder="fazer um site, um jogo, analisar dados..." bind:value={quero}
          oninput={() => { quero = quero.replace(/^\s*quero\s+/i, ''); }}>
        {#if quero}<button type="button" class="sk-limpar" aria-label="Limpar a busca" onclick={() => (quero = '')}>{@html svgIcone('x')}</button>{/if}
      </form>
      {#if !buscando}
        <p class="sk-exemplos"><span>Por exemplo:</span>{#each EXEMPLOS as ex}<button type="button" onclick={() => (quero = ex)}>{ex}</button>{/each}</p>
      {/if}

      {#if buscando}
        <div aria-live="polite">
          {#if pacotesAchados.length}
            <section class="sk-secao"><h2>Pacote para isso</h2><div class="sk-pacotes">{#each pacotesAchados as p (p.id)}{@render pacote(p)}{/each}</div></section>
          {/if}
          {#if skillsAchadas.length}
            <section class="sk-secao"><h2>{skillsAchadas.length} {skillsAchadas.length === 1 ? 'skill' : 'skills'} sobre isso</h2><div class="sk-grade">{#each skillsAchadas as s (s.id)}{@render cartao(s)}{/each}</div></section>
          {:else if !pacotesAchados.length}
            <div class="empty-state"><p>Nenhuma skill sobre "{quero}". Tente outra palavra, como o nome da linguagem ou do que vai fazer, ou crie a sua.</p>
              <button class="btn primary" onclick={() => (editor = { existente: null })}>Criar uma skill</button></div>
          {/if}
        </div>
      {:else if objetivos}
        {#if objetivos.paraComecar.length}
          <section class="sk-secao"><h2>Para começar</h2><p class="sk-secao-nota">Úteis em quase todo projeto, mesmo para quem está começando.</p>
            <div class="sk-grade">{#each daLista(objetivos.paraComecar) as s (s.id)}{@render cartao(s)}{/each}</div></section>
        {/if}
        {#if objetivos.pacotes.length}
          <section class="sk-secao"><h2>Pacotes por objetivo</h2><p class="sk-secao-nota">Instale de uma vez as skills que trabalham juntas no que você vai fazer.</p>
            <div class="sk-pacotes">{#each objetivos.pacotes as p (p.id)}{@render pacote(p)}{/each}</div></section>
        {/if}
        {#if objetivos.maisUsadas.length >= 3}
          <section class="sk-secao"><h2>Mais instaladas neste Gyde</h2><div class="sk-grade">{#each daLista(objetivos.maisUsadas) as s (s.id)}{@render cartao(s)}{/each}</div></section>
        {/if}
        <section class="sk-secao">
          <h2>Todas as skills</h2>
          <div class="sk-filtros" role="group" aria-label="Filtrar por categoria">
            <button type="button" class:on={!categoria} aria-pressed={!categoria} onclick={() => (categoria = null)}>Todas<span>{catalogo.length}</span></button>
            {#each objetivos.categorias as c (c.nome)}
              {@const n = catalogo.filter((s) => s.categoria === c.nome).length}
              {#if n}<button type="button" class:on={categoria === c.nome} aria-pressed={categoria === c.nome} style:--cat={corDe(c.nome)} onclick={() => (categoria = categoria === c.nome ? null : c.nome)}>{@html svgIcone(c.icone)}{c.nome}<span>{n}</span></button>{/if}
            {/each}
          </div>
          <div class="sk-grade">{#each naCategoria as s (s.id)}{@render cartao(s)}{/each}</div>
        </section>
      {/if}
    {:else if aba === 'loja'}
      <label class="search loja-search">
        {@html svgIcone('search')}
        <input type="search" id="lojaBusca" placeholder="Buscar na loja por nome, comando ou autor" autocomplete="off" bind:value={buscaLoja}>
      </label>
      {#if lojaFiltrada.length}
        <div class="sk-grade">{#each lojaFiltrada as s (s.id)}
          <article class="sk-cartao" class:on={s.instalada}>
            <div class="sk-cartao-topo">{@render marca(s.icone, s.categoria)}<span class="sk-selo">{instalacoes(s.installs)}</span></div>
            <h3><button type="button" class="link-btn" onclick={() => (itemLoja = s)}>{s.nome}</button></h3>
            <p class="sk-desc">{s.descricao}</p>
            <div class="sk-cartao-pe">
              <span class="loja-autor">{@html svgIcone('user')}{s.minha ? 'Você publicou' : s.autor}</span>
              {#if s.minha}<button class="btn small danger" onclick={() => despublicarItem(s)}>Tirar da loja</button>
              {:else if s.instalada}<span class="btn installed small">{@html svgIcone('check')}Instalada</span>
              {:else}<button class="btn primary small" onclick={() => (itemLoja = s)}>{@html svgIcone('plus')}Ver e instalar</button>{/if}
            </div>
          </article>
        {/each}</div>
      {:else if loja.length}
        <div class="empty-state"><p>Nada encontrado com essa busca.</p></div>
      {:else}
        <div class="empty-state"><p>A loja ainda está vazia. Crie uma skill e publique para seus colegas usarem.</p><button class="btn primary" onclick={() => (editor = { existente: null })}>Criar e publicar uma skill</button></div>
      {/if}
    {:else}
      {@const lista = skills.filter((s) => (aba === 'instaladas' ? s.instalada : s.origem === 'minha'))}
      {#if lista.length}
        <div class="sk-grade">{#each lista as s (s.id)}{@render cartao(s)}{/each}</div>
      {:else}
        <div class="empty-state">
          <p>{aba === 'minhas' ? 'Você ainda não criou nenhuma skill.' : 'Nenhuma skill instalada ainda. Escolha pelo que você vai fazer.'}</p>
          {#if aba === 'minhas'}<button class="btn primary" onclick={() => (editor = { existente: null })}>Criar minha primeira skill</button>
          {:else}<button class="btn primary" onclick={() => (aba = 'catalogo')}>Ver o catálogo</button>{/if}
        </div>
      {/if}
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
      <header>{@render marca(s.icone, s.categoria, true)}
        <div><h1>{s.nome}</h1><p>{s.descricao}</p>
          <small class="loja-autor">{@html svgIcone('user')}por {s.minha ? 'você' : s.autor} · {instalacoes(s.installs)}</small></div></header>
      <div class="skill-meta">
        {#if s.comando}<div><small>Comando</small><code class="cmd">{s.comando}</code></div>{/if}
        {#if s.gatilhos.length}<div class="wide"><small>Entra sozinha quando a mensagem fala de</small><span class="chips">{#each s.gatilhos as g}<span>{g}</span>{/each}</span></div>{/if}
      </div>
      <section class="skill-body"><h3>Instruções que o Gyde vai seguir</h3><div class="md">{@html renderMarkdown(s.corpo)}</div></section>
      <p class="loja-aviso">Leia as instruções antes de instalar: elas mudam como o Gyde responde quando a skill está ativa. Você recebe uma cópia sua, que pode editar ou excluir quando quiser.</p>
      <div class="dialog-actions"><button value="cancel" class="btn ghost">Fechar</button>
        {#if !s.minha && !s.instalada}<button value="install" class="btn primary">{@html svgIcone('plus')}Instalar cópia</button>{/if}</div>
    </form>
  </dialog>
{/if}
