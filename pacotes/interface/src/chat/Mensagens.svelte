<script lang="ts">
  // A conversa: tela vazia com sugestões, mensagens, a resposta chegando ao vivo e as ações de cada mensagem.
  import { icone as svgIcone } from '../icones.ts';
  import { tick } from 'svelte';
  import type { TMensagem } from '$contratos';
  import { chat, enviar, tentarDeNovo, rotuloModelo, votar, type Anexo, type SkillAtiva, type AgenteAtivo, type SugestaoSkill } from './estado.svelte.ts';
  import { renderMarkdown, tratarCliqueNaResposta } from '../markdown.ts';
  import { copiarTexto } from '../util.ts';
  import { falar, temVoz } from '../voz.ts';
  import Apontar from './Apontar.svelte';
  // "Mostrar o erro" num print enviado
  let apontando = $state<{ imagem: string; nome: string; pergunta: string } | null>(null);

  const icone = {
    copiar: svgIcone('copy'),
    editar: svgIcone('pencil'),
    repetir: svgIcone('refresh-cw'),
    falar: svgIcone('volume-2'),
    arquivo: svgIcone('file'),
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

  // longe do fim (a pessoa subiu para ler): aparece o botão "Ir para o fim", em vez de a tela pular sozinha
  let longeDoFim = $state(false);
  const medirFim = () => { if (thread) longeDoFim = thread.scrollHeight - thread.scrollTop - thread.clientHeight > 320; };
  const irParaOFim = () => { thread?.scrollTo({ top: thread.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };

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

<!-- quem ajudou nesta resposta: o agente especializado (se o pedido precisou), as skills que entraram e, sem skill
     instalada que sirva, uma do catálogo que ajudaria -->
{#snippet quemAjudou(skills: SkillAtiva[], agente: AgenteAtivo | null, sugestao: SugestaoSkill | null)}
  {#if skills.length || agente || sugestao}
    <div class="skill-chips">
      {#if agente}<span class="skill-chip agente-chip" title="Agente especializado escolhido para este pedido">{@html svgIcone('bot')}<span>Agente {agente.nome}: {agente.fazendo}</span></span>{/if}
      {#each skills as s (s.id)}<a class="skill-chip" href="#/skills/{s.id}" title={s.secoes?.length ? `Partes da skill usadas: ${s.secoes.join(', ')}` : ''}>{@html svgIcone(s.icone)}<span>Usando a skill {s.nome}</span></a>{/each}
      {#if sugestao}<a class="skill-chip sugestao-chip" href="#/skills/{sugestao.id}">{@html svgIcone(sugestao.icone)}<span>A skill {sugestao.nome} ajudaria nisso. Ver e instalar</span></a>{/if}
    </div>
  {/if}
{/snippet}

{#snippet anexos(lista: Anexo[] | undefined, pergunta: string | null = null)}
  {#if lista?.length}
    <div class="msg-attachments">{#each lista as a}{#if a.kind === 'image'}
      {#if pergunta !== null && a.dataUrl}
        <span class="anexo-imagem"><img src={a.dataUrl} alt={a.name}><button type="button" class="btn small apontar-btn" onclick={() => (apontando = { imagem: a.dataUrl!, nome: a.name, pergunta })}>Mostrar o erro</button></span>
      {:else}<img src={a.dataUrl} alt={a.name}>{/if}
    {:else}<span class="file-pill">{@html icone.arquivo}<span>{a.name}</span></span>{/if}{/each}</div>
  {/if}
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<section class="thread" class:has-messages={temMensagens} id="thread" aria-live="polite" bind:this={thread} onclick={tratarCliqueNaResposta} onscroll={medirFim}>
  <div class="empty" id="empty">
    <img class="empty-logo" src="/logo.svg" alt="" width="68" height="68">
    <h1 id="greeting">Bora <span class="accent">programar</span>{chat.nome ? `, ${chat.nome}` : ''}?</h1>
    <p class="empty-sub">Cole um erro, mande seu código ou pergunte qualquer coisa de programação. O Gyde te guia passo a passo.</p>
    <div class="suggestions" id="suggestions">
      {#each SUGESTOES as [rotulo, texto], i}<button style="--i:{i}" onclick={() => sugestao(texto!)}>{rotulo}</button>{/each}
    </div>
    <p class="atalhos">Atalhos: <kbd>Enter</kbd> envia · <kbd>Shift</kbd>+<kbd>Enter</kbd> quebra a linha · <kbd>Esc</kbd> para a resposta · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> copia a última resposta · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> nova conversa</p>
  </div>
  <div class="messages" id="messages">
    {#each chat.mensagens as m (m.id)}
      <article class="msg {m.role}" data-id={m.id}>
        {#if m.role === 'user'}
          {#if editando === m.id}
            <div class="edit-box"><textarea bind:value={textoEdicao} use:autoAjuste aria-label="Editar mensagem"></textarea>
              <div class="dialog-actions"><button class="btn ghost" onclick={() => (editando = null)}>Cancelar</button><button class="btn primary" onclick={() => salvarEdicao(m)}>Enviar</button></div></div>
          {:else}
            {@render anexos(m.attachments as Anexo[], m.content)}
            {#if m.content}<div class="bubble">{m.content}</div>{/if}
            <div class="msg-actions">
              <button title="Copiar" onclick={(e) => copiarTexto(m.content, e.currentTarget)}>{@html icone.copiar}</button>
              <button title="Editar" onclick={() => { if (!chat.transmitindo) { textoEdicao = m.content; editando = m.id; } }}>{@html icone.editar}</button>
            </div>
          {/if}
        {:else}
          {@render quemAjudou(chat.metaSkills[m.id] ?? [], chat.metaAgente[m.id] ?? null, chat.metaSugestao[m.id] ?? null)}
          <div class="md">{@html renderMarkdown(m.content)}</div>
          <div class="msg-actions">
            <button title="Copiar" onclick={(e) => copiarTexto(m.content, e.currentTarget)}>{@html icone.copiar}</button>
            {#if temVoz}<button title="Ouvir resposta" onclick={(e) => falar(m.content, e.currentTarget)}>{@html icone.falar}</button>{/if}
            {#if m.id === ultimaResposta}<button title="Gerar de novo" onclick={() => enviar({ mode: 'regenerate', messageId: m.id })}>{@html icone.repetir}</button>{/if}
            <button title="Boa resposta" aria-label="Boa resposta" aria-pressed={chat.votos[m.id] === 1} class:votado={chat.votos[m.id] === 1} onclick={() => votar(m.id, 1)}>{@html svgIcone('thumbs-up')}</button>
            <button title="Resposta ruim" aria-label="Resposta ruim" aria-pressed={chat.votos[m.id] === -1} class:votado={chat.votos[m.id] === -1} onclick={() => votar(m.id, -1)}>{@html svgIcone('thumbs-down')}</button>
            <span class="msg-meta" title={chat.metaExtra[m.id] ? 'Modelo que respondeu e tokens usados, informados pelo provedor' : ''}>{chat.metaExtra[m.id] ?? (m.model ? rotuloModelo(m.model) : '')}</span>
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
          {@render quemAjudou(chat.resposta.skills, chat.resposta.agente, chat.resposta.sugestao)}
          <div class="md" bind:this={respostaMd}>
            {#if htmlResposta}{@html htmlResposta}
            {:else if chat.resposta.status}<div class="status-line"><div class="thinking"><i></i><i></i><i></i></div><span>{chat.resposta.status}</span></div>
            {:else}<div class="thinking"><i></i><i></i><i></i></div>{/if}
          </div>
          <!-- depois do texto: o que o Gyde ainda está fazendo (ex.: conferindo o código), para a pessoa saber que não terminou -->
          {#if htmlResposta && chat.resposta.status}<div class="status-line depois" role="status"><div class="thinking"><i></i><i></i><i></i></div><span>{chat.resposta.status}</span></div>{/if}
        {/if}
      </article>
    {/if}
  </div>
  {#if temMensagens && longeDoFim}<button type="button" class="ir-fim" onclick={irParaOFim} aria-label="Ir para o fim da conversa">{@html svgIcone('chevron-down')}</button>{/if}
</section>

{#if apontando}<Apontar {...apontando} onfechar={() => (apontando = null)} />{/if}
