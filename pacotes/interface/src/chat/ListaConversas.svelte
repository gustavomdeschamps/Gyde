<script lang="ts">
  // Lista de conversas da barra lateral, agrupadas por data, com menu (renomear, fixar, exportar, excluir).
  import type { TResumoConversa } from '$contratos';
  import { chat, renomear, fixar, excluir, exportar } from './estado.svelte.ts';
  import { toast } from '../util.ts';
  import { mensagemDe } from '../api.ts';

  const icone = {
    pontos: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
    fixar: '<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 4 4H6l4-4-1-6zM12 14v6"/></svg>',
    editar: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/></svg>',
    exportar: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7 9l5-5 5 5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>',
    lixo: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  };

  function grupo(ts: number) {
    const d = new Date(ts);
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- data temporária só para a conta, não é estado da tela
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias = (hoje.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000;
    if (dias <= 0) return 'Hoje';
    if (dias === 1) return 'Ontem';
    if (dias < 7) return 'Últimos 7 dias';
    if (dias < 30) return 'Últimos 30 dias';
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }
  const grupos = $derived.by(() => {
    const lista: { nome: string; itens: TResumoConversa[] }[] = [];
    for (const c of chat.conversas) {
      const nome = c.pinned ? 'Fixadas' : grupo(c.updated_at);
      if (lista.at(-1)?.nome !== nome) lista.push({ nome, itens: [] });
      lista.at(-1)!.itens.push(c);
    }
    return lista;
  });

  // a lista só anima na primeira vez (ela recarrega a cada mensagem)
  let animar = $state(true);
  $effect(() => { if (chat.conversas.length) setTimeout(() => { animar = false; }, 800); });
  $effect(() => { document.getElementById('convList')?.classList.toggle('no-anim', !animar); });

  let menu = $state<{ conversa: TResumoConversa; x: number; y: number } | null>(null);
  let renomeando = $state<string | null>(null);
  let novoTitulo = $state('');

  function abrirMenu(e: MouseEvent, c: TResumoConversa) {
    e.stopPropagation();
    if (menu?.conversa.id === c.id) { menu = null; return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    menu = { conversa: c, x: Math.min(r.left, innerWidth - 200), y: Math.min(r.bottom + 4, innerHeight - 190) };
  }
  async function acao(qual: 'renomear' | 'fixar' | 'exportar' | 'excluir') {
    const c = menu!.conversa; menu = null;
    try {
      if (qual === 'renomear') { renomeando = c.id; novoTitulo = c.title; }
      if (qual === 'fixar') await fixar(c);
      if (qual === 'exportar') await exportar(c.id);
      if (qual === 'excluir') await excluir(c);
    } catch (e) { toast(mensagemDe(e)); }
  }
  let terminado = false;
  async function terminarRenomear(salvar: boolean, c: TResumoConversa) {
    if (terminado) return; terminado = true;
    const titulo = novoTitulo.trim();
    renomeando = null;
    if (salvar && titulo && titulo !== c.title) await renomear(c.id, titulo);
    terminado = false;
  }
  const focar = (el: HTMLInputElement) => { el.focus(); el.select(); };
</script>

<svelte:window onclick={() => (menu = null)} onkeydown={(e) => { if (e.key === 'Escape') menu = null; }} />

  {#if !chat.listaCarregada}
    <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
  {:else if !chat.conversas.length}
    <p class="empty-list">{chat.busca.trim() ? 'Nenhuma conversa encontrada.' : 'Suas conversas aparecem aqui.'}</p>
  {:else}
    {#each grupos as g, gi (g.nome)}
      <div class="conv-group">{g.nome}</div>
      {#each g.itens as c, i (c.id)}
        <div class="conv" class:active={c.id === chat.convId} style="--i:{Math.min(gi * 4 + i, 24)}">
          {#if renomeando === c.id}
            <input class="conv-rename" bind:value={novoTitulo} use:focar aria-label="Novo título"
              onkeydown={(e) => { if (e.key === 'Enter') terminarRenomear(true, c); if (e.key === 'Escape') terminarRenomear(false, c); }}
              onblur={() => terminarRenomear(true, c)}>
          {:else}
            <a href="#/c/{c.id}" title={c.title}>{c.title}</a>
            {#if c.pinned}{@html icone.fixar.replace('<svg', '<svg class="pin"')}{/if}
            <button class="conv-menu-btn" aria-label="Opções da conversa" aria-haspopup="menu" aria-expanded={menu?.conversa.id === c.id} onclick={(e) => abrirMenu(e, c)}>{@html icone.pontos}</button>
          {/if}
        </div>
      {/each}
    {/each}
  {/if}

{#if menu}
  <div class="menu" role="menu" style="top:{menu.y}px;left:{menu.x}px" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} tabindex="-1">
    <button role="menuitem" onclick={() => acao('renomear')}>{@html icone.editar}Renomear</button>
    <button role="menuitem" onclick={() => acao('fixar')}>{@html icone.fixar}{menu.conversa.pinned ? 'Desafixar' : 'Fixar'}</button>
    <button role="menuitem" onclick={() => acao('exportar')}>{@html icone.exportar}Exportar (.md)</button>
    <button role="menuitem" class="danger" onclick={() => acao('excluir')}>{@html icone.lixo}Excluir</button>
  </div>
{/if}
