<script lang="ts">
  // Caixa de envio: texto, anexos (arquivos, pasta, .zip, colar e arrastar), modo imagem, ditado e o menu "/" das skills.
  import { icone as svgIcone } from '../icones.ts';
  import { tick } from 'svelte';
  import { chat, enviar, parar, podeEnviar, adicionarArquivos, adicionarPasta, adicionarZip, type SkillInstalada } from './estado.svelte.ts';
  import { toast } from '../util.ts';
  import { temDitado, ditar } from '../voz.ts';

  const icone = {
    arquivo: svgIcone('file'),
    pasta: svgIcone('folder'),
    zip: svgIcone('file-archive'),
    fechar: svgIcone('x'),
  };
  const PADRAO = 'Pergunte ao Gyde ou cole seu código';

  let campo: HTMLTextAreaElement | undefined = $state();
  let entradaArquivos: HTMLInputElement | undefined = $state();
  let entradaPasta: HTMLInputElement | undefined = $state();
  let entradaZip: HTMLInputElement | undefined = $state();
  let menuAnexo = $state<{ x: number; y: number } | null>(null);
  let arrastando = $state(0);
  let ouvindo = $state<{ parar: () => void } | null>(null);
  let slashIndice = $state(0);
  let slashFechado = $state(false);

  const desabilitado = $derived(!podeEnviar());
  // menu "/" só aparece enquanto o texto é exatamente "/algo"
  const slash = $derived.by((): SkillInstalada[] | null => {
    const m = chat.texto.match(/^\/([\w-]*)$/);
    if (!m || slashFechado) return null;
    const q = m[1]!.toLowerCase();
    return chat.skills.filter((s) => s.comando && (s.comando.slice(1).startsWith(q) || s.nome.toLowerCase().includes(q)));
  });

  // ajusta a altura sempre que o texto muda (digitado, sugestão, ditado ou limpo depois de enviar)
  $effect(() => {
    void chat.texto;
    if (!campo) return;
    campo.style.height = 'auto';
    campo.style.height = `${Math.min(campo.scrollHeight, 220)}px`;
  });

  function aoDigitar() { slashIndice = 0; slashFechado = false; }
  function escolher(s: SkillInstalada) {
    chat.texto = `${s.comando} `;
    tick().then(() => campo?.focus());
  }
  function tecla(e: KeyboardEvent) {
    if (slash) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        slashIndice = (slashIndice + (e.key === 'ArrowDown' ? 1 : -1) + slash.length) % Math.max(1, slash.length);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && slash.length) { e.preventDefault(); escolher(slash[Math.min(slashIndice, slash.length - 1)]!); return; }
      if (e.key === 'Escape') { e.preventDefault(); slashFechado = true; return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!desabilitado && !chat.transmitindo) enviar(); }
  }
  function submeter(e: SubmitEvent) { e.preventDefault(); if (chat.transmitindo) parar(); else enviar(); }
  function colar(e: ClipboardEvent) {
    const arquivos = [...(e.clipboardData?.files ?? [])];
    if (arquivos.length) { e.preventDefault(); adicionarArquivos(arquivos); }
  }
  function abrirMenuAnexo(e: MouseEvent) {
    e.stopPropagation();
    if (menuAnexo) { menuAnexo = null; return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    menuAnexo = { x: r.left, y: r.top - 8 };
  }
  function escolherAnexo(qual: 'arquivos' | 'pasta' | 'zip') {
    menuAnexo = null;
    ({ arquivos: entradaArquivos, pasta: entradaPasta, zip: entradaZip })[qual]?.click();
  }
  function modoImagem() {
    if (!chat.imagensAtivas) { toast('Imagens ainda não ligadas: configure em Configurações > IA e modelos'); return; }
    chat.modoImagem = !chat.modoImagem;
    campo?.focus();
  }
  function microfone() {
    if (ouvindo) { ouvindo.parar(); return; }
    ouvindo = ditar({
      inicial: chat.texto,
      aoMudar: (t) => { chat.texto = t; },
      aoEnviar: (t) => { chat.texto = t; if (t) enviar(); },
      aoErro: toast,
      aoTerminar: () => { ouvindo = null; },
    });
  }
  const temArquivos = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));
</script>

<svelte:window onclick={() => (menuAnexo = null)} onkeydown={(e) => { if (e.key === 'Escape') menuAnexo = null; }} />
<svelte:document
  ondragenter={(e) => { if (temArquivos(e)) arrastando++; }}
  ondragleave={() => { arrastando = Math.max(0, arrastando - 1); }}
  ondragover={(e) => e.preventDefault()}
  ondrop={(e) => { e.preventDefault(); arrastando = 0; if (e.dataTransfer?.files.length) adicionarArquivos([...e.dataTransfer.files]); }} />

<form class="composer" class:dragging={arrastando > 0} id="composer" onsubmit={submeter}>
  <div class="drop-hint" id="dropHint">Solte os arquivos para anexar</div>
  <div class="attachments" id="attachments">
    {#each chat.pendentes as a, i}
      <div class="chip" class:loading={a.carregando}>
        {#if a.kind === 'image' && a.dataUrl}<img src={a.dataUrl} alt="">{:else}<span class="chip-icon">{@html icone.arquivo}</span>{/if}
        <span><span class="chip-name">{a.name}</span><span class="chip-sub">{a.carregando ? 'Lendo…' : a.kind === 'image' ? 'Imagem' : a.sub || 'Arquivo'}</span></span>
        <button type="button" class="chip-x" aria-label="Remover anexo" onclick={() => chat.pendentes.splice(i, 1)}>{@html icone.fechar}</button>
      </div>
    {/each}
  </div>
  {#if slash}
    <div class="slash-menu" role="listbox">
      {#if slash.length}
        <div class="slash-title">Skills instaladas</div>
        {#each slash as s, i}
          <button type="button" role="option" aria-selected={i === slashIndice} class="slash-item" class:active={i === slashIndice} onmousedown={(e) => { e.preventDefault(); escolher(s); }}>
            <span class="skill-symbol">{@html svgIcone(s.icone)}</span><span class="slash-text"><b>{s.nome}</b><small>{s.descricao}</small></span><code>{s.comando}</code>
          </button>
        {/each}
      {:else}
        <div class="slash-empty">{chat.skills.length ? 'Nenhuma skill com esse comando.' : 'Você ainda não instalou nenhuma skill.'} <a href="#/skills">Abrir Skills</a></div>
      {/if}
    </div>
  {/if}
  <div class="composer-row">
    <button type="button" class="icon-btn" id="attachBtn" aria-label="Anexar arquivo" aria-haspopup="menu" aria-expanded={Boolean(menuAnexo)} title="Anexar imagens, PDFs ou arquivos de texto" onclick={abrirMenuAnexo}>
      {@html svgIcone('paperclip')}
    </button>
    <button type="button" class="mode-btn" id="imageBtn" aria-pressed={chat.modoImagem} title="Criar uma imagem a partir do que você escrever" onclick={modoImagem}>
      {@html svgIcone('image')}
      <span>Imagem</span>
    </button>
    <input type="file" id="folderInput" webkitdirectory hidden bind:this={entradaPasta}
      onchange={(e) => { const el = e.currentTarget; if (el.files) adicionarPasta(el.files); el.value = ''; }}>
    <input type="file" id="zipInput" accept=".zip,application/zip" hidden bind:this={entradaZip}
      onchange={(e) => { const el = e.currentTarget; const f = el.files?.[0]; if (f) adicionarZip(f); el.value = ''; }}>
    <input type="file" id="fileInput" multiple hidden bind:this={entradaArquivos}
      accept="image/*,.pdf,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.cs,.html,.css,.sql,.xml,.yml,.yaml,.log"
      onchange={(e) => { const el = e.currentTarget; adicionarArquivos([...(el.files ?? [])]); el.value = ''; }}>
    <textarea id="input" rows="1" autocomplete="off" bind:this={campo} bind:value={chat.texto}
      placeholder={chat.modoImagem ? 'Descreva a imagem (ex.: um diagrama de um loop for em Python)' : PADRAO}
      oninput={aoDigitar} onkeydown={tecla} onpaste={colar} onblur={() => setTimeout(() => (slashFechado = true), 120)} onfocus={() => (slashFechado = false)}></textarea>
    {#if temDitado}
      <button type="button" class="icon-btn mic" class:listening={ouvindo} id="micBtn" aria-label={ouvindo ? 'Parar de ouvir' : 'Falar'} title={'Falar (diga "enviar" no fim para mandar)'} onclick={microfone}>
        {@html svgIcone('mic')}
      </button>
    {/if}
    <button type="submit" class="send" class:streaming={chat.transmitindo} id="sendBtn" aria-label={chat.transmitindo ? 'Parar resposta' : 'Enviar'} disabled={desabilitado}>
      {@html svgIcone('arrow-up', undefined, 'i-send')}
      {@html svgIcone('square', undefined, 'i-stop')}
    </button>
  </div>
</form>

{#if menuAnexo}
  <div class="menu" role="menu" tabindex="-1" style="left:{menuAnexo.x}px;bottom:{innerHeight - menuAnexo.y}px" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
    <button role="menuitem" onclick={() => escolherAnexo('arquivos')}>{@html icone.arquivo}Arquivos, imagens ou PDF</button>
    <button role="menuitem" onclick={() => escolherAnexo('pasta')}>{@html icone.pasta}Pasta de projeto</button>
    <button role="menuitem" onclick={() => escolherAnexo('zip')}>{@html icone.zip}Projeto .zip</button>
  </div>
{/if}
