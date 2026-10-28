<script lang="ts">
  // A conversa: tela vazia com sugestões, mensagens, a resposta chegando ao vivo e as ações de cada mensagem.
  import { tick } from 'svelte';
  import type { TMensagem } from '$contratos';
  import { chat, enviar, tentarDeNovo, rotuloModelo, type Anexo } from './estado.svelte.ts';
  import { renderMarkdown, tratarCliqueNaResposta } from '../markdown.ts';
  import { copiarTexto } from '../util.ts';
  import { falar, temVoz } from '../voz.ts';

  const icone = {
    copiar: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    editar: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/></svg>',
    repetir: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>',
    falar: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    arquivo: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  };
  const SUGESTOES = [
    ['Explicar um erro', 'Meu código deu este erro. Me explique o que significa e como corrigir, passo a passo:\n\n'],
    ['Revisar meu código', 'Revise meu código: aponte bugs, más práticas e como melhorar, explicando o porquê:\n\n'],
    ['Aprender do zero', 'Quero aprender lógica de programação do zero. Me explique o que são variáveis com um exemplo e me passe um exercício.'],
    ['Me passa um exercício', 'Me dê um exercício de programação no meu nível, sem a resposta. Depois eu te mando minha solução para você corrigir.'],
  ];

  let thread: HTMLElement | undefined = $state();
  let respostaMd: HTMLElement | undefined = $state();
  let editando = $state<string | null>(null); // id da mensagem em edição
  let textoEdicao = $state('');
  const temMensagens = $derived(chat.mensagens.length > 0 || Boolean(chat.temporaria) || Boolean(chat.resposta));
  const ultimaResposta = $derived([...chat.mensagens].reverse().find((m) => m.role === 'assistant')?.id);
  const htmlResposta = $derived(chat.resposta?.texto ? renderMarkdown(chat.resposta.texto) : '');

  // descer até o fim: forçado quando pedido (chat.rolar), e acompanhando a resposta se a pessoa já estava lá embaixo
  $effect(() => { void chat.rolar; tick().then(() => { if (thread) thread.scrollTop = thread.scrollHeight; }); });
  $effect(() => {
    void htmlResposta;
    tick().then(() => {
      respostaMd?.lastElementChild?.classList.add('cursor');
      if (thread && thread.scrollHeight - thread.scrollTop - thread.clientHeight < 160) thread.scrollTop = thread.scrollHeight;
    });
  });

  function sugestao(texto: string) {
    chat.texto = texto;
    tick().then(() => { const campo = document.getElementById('input') as HTMLTextAreaElement | null; campo?.focus(); campo?.dispatchEvent(new Event('input')); });
  }
  function salvarEdicao(m: TMensagem) {
    if (!textoEdicao.trim()) return;
    const texto = textoEdicao; editando = null;
    enviar({ mode: 'edit', messageId: m.id, content: texto, attachments: m.attachments as Anexo[] });
  }
  const autoAjuste = (el: HTMLTextAreaElement) => { const f = () => { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 220)}px`; }; f(); el.focus(); el.addEventListener('input', f); };
</script>

{#snippet anexos(lista: Anexo[] | undefined)}
  {#if lista?.length}
    <div class="msg-attachments">{#each lista as a}{#if a.kind === 'image'}<img src={a.dataUrl} alt={a.name}>{:else}<span class="file-pill">{@html icone.arquivo}<span>{a.name}</span></span>{/if}{/each}</div>
  {/if}
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<section class="thread" class:has-messages={temMensagens} id="thread" aria-live="polite" bind:this={thread} onclick={tratarCliqueNaResposta}>
  <div class="empty" id="empty">
    <img class="empty-logo" src="/logo.svg" alt="" width="68" height="68">
    <h1 id="greeting">Bora <span class="accent">programar</span>{chat.nome ? `, ${chat.nome}` : ''}?</h1>
    <p class="empty-sub">Cole um erro, mande seu código ou pergunte qualquer coisa de programação. O Gyde te guia passo a passo.</p>
    <div class="suggestions" id="suggestions">
      {#each SUGESTOES as [rotulo, texto], i}<button style="--i:{i}" onclick={() => sugestao(texto!)}>{rotulo}</button>{/each}
    </div>
  </div>
  <div class="messages" id="messages">
    {#each chat.mensagens as m (m.id)}
      <article class="msg {m.role}" data-id={m.id}>
        {#if m.role === 'user'}
          {#if editando === m.id}
            <div class="edit-box"><textarea bind:value={textoEdicao} use:autoAjuste aria-label="Editar mensagem"></textarea>
              <div class="dialog-actions"><button class="btn ghost" onclick={() => (editando = null)}>Cancelar</button><button class="btn primary" onclick={() => salvarEdicao(m)}>Enviar</button></div></div>
          {:else}
            {@render anexos(m.attachments as Anexo[])}
            {#if m.content}<div class="bubble">{m.content}</div>{/if}
            <div class="msg-actions">
              <button title="Copiar" onclick={(e) => copiarTexto(m.content, e.currentTarget)}>{@html icone.copiar}</button>
              <button title="Editar" onclick={() => { if (!chat.transmitindo) { textoEdicao = m.content; editando = m.id; } }}>{@html icone.editar}</button>
            </div>
          {/if}
        {:else}
          {#if chat.metaSkills[m.id]}<div class="skill-chips">{#each chat.metaSkills[m.id]! as s}<span class="skill-chip"><b>{s.simbolo}</b>{s.nome}</span>{/each}</div>{/if}
          <div class="md">{@html renderMarkdown(m.content)}</div>
          <div class="msg-actions">
            <button title="Copiar" onclick={(e) => copiarTexto(m.content, e.currentTarget)}>{@html icone.copiar}</button>
            {#if temVoz}<button title="Ouvir resposta" onclick={(e) => falar(m.content, e.currentTarget)}>{@html icone.falar}</button>{/if}
            {#if m.id === ultimaResposta}<button title="Gerar de novo" onclick={() => enviar({ mode: 'regenerate', messageId: m.id })}>{@html icone.repetir}</button>{/if}
            <span class="msg-meta" title={chat.metaExtra[m.id] ? 'Modelo que respondeu e tokens usados, informados pelo provedor' : ''}>{[m.model ? rotuloModelo(m.model) : '', chat.metaExtra[m.id] ?? ''].filter(Boolean).join(' · ')}</span>
          </div>
        {/if}
      </article>
    {/each}
    {#if chat.temporaria}
      <article class="msg user" data-id="temp">{@render anexos(chat.temporaria.attachments)}{#if chat.temporaria.content}<div class="bubble">{chat.temporaria.content}</div>{/if}</article>
    {/if}
    {#if chat.resposta}
      <article class="msg assistant">
        {#if chat.resposta.erro}
          <div class="msg-error"><span>{chat.resposta.erro}</span><button type="button" onclick={tentarDeNovo}>Tentar de novo</button></div>
        {:else}
          {#if chat.resposta.skills.length}<div class="skill-chips">{#each chat.resposta.skills as s}<span class="skill-chip"><b>{s.simbolo}</b>{s.nome}</span>{/each}</div>{/if}
          <div class="md" bind:this={respostaMd}>
            {#if htmlResposta}{@html htmlResposta}
            {:else if chat.resposta.status}<div class="status-line"><div class="thinking"><i></i><i></i><i></i></div><span>{chat.resposta.status}</span></div>
            {:else}<div class="thinking"><i></i><i></i><i></i></div>{/if}
          </div>
        {/if}
      </article>
    {/if}
  </div>
</section>
