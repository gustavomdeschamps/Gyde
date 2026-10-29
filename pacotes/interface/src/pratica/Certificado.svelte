<script lang="ts">
  // Certificado de um projeto guiado: pronto para imprimir ou salvar em PDF. O código confere neste Gyde quem fez,
  // qual projeto e quando (não há servidor central: a conferência é feita no Gyde onde o projeto foi concluído).
  import * as C from '$contratos';
  import type { TCertificado } from '$contratos';
  import { pedir, mensagemDe } from '../api.ts';

  let { codigo, toast }: { codigo: string; toast: (t: string) => void } = $props();
  let cert = $state<TCertificado | null>(null);
  let erro = $state('');
  let outro = $state('');

  $effect(() => {
    const c = codigo; cert = null; erro = '';
    pedir(`/api/certificados/${encodeURIComponent(c)}`, C.Certificado).then((r) => { cert = r; }, (e) => { erro = mensagemDe(e); });
  });
  const data = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const copiar = () => navigator.clipboard.writeText(cert?.codigo ?? '').then(() => toast('Código copiado.'), () => toast('Não deu para copiar.'));
  const conferir = (e: SubmitEvent) => { e.preventDefault(); const c = outro.trim().toUpperCase(); if (c) location.hash = `#/pratica/certificado/${c}`; };
</script>

<div class="skills-inner cert-pagina">
  <nav class="crumbs nao-imprimir"><a href="#/pratica">Prática</a><span>›</span><span>Certificado</span></nav>
  {#if erro}
    <div class="estado-erro" role="alert"><h2>Certificado não encontrado</h2><p>{erro} Confira se o código foi digitado certo (ex.: GYDE-AB2C-D3EF).</p></div>
  {:else if !cert}
    <div class="skeleton" style="height:420px;margin-top:20px" aria-busy="true"></div>
  {:else}
    <article class="certificado" aria-label="Certificado de {cert.pessoa}">
      <div class="cert-borda">
        <header class="cert-topo">
          <img src="/logo.svg" alt="" width="56" height="56">
          <div><b>Gyde</b><small>seu guia de programação</small></div>
        </header>
        <p class="cert-rotulo">Certificado de conclusão</p>
        <h1 class="cert-nome">{cert.pessoa}</h1>
        <p class="cert-texto">concluiu o projeto guiado <b>{cert.projeto}</b> ({cert.tecnologia}), com as {cert.etapas} etapas conferidas automaticamente pelos critérios do Gyde.</p>
        <footer class="cert-rodape">
          <div><small>Emitido em</small><b>{data(cert.emitidoEm)}</b></div>
          <div class="cert-codigo"><small>Código de verificação</small><b>{cert.codigo}</b></div>
        </footer>
        <p class="cert-nota">Confira este código no Gyde onde o projeto foi feito: Prática › Certificado › Conferir. A conferência é local: o Gyde não tem um servidor central.</p>
      </div>
    </article>
    <div class="cert-acoes nao-imprimir">
      <button type="button" class="btn primary" onclick={() => print()}>Imprimir ou salvar PDF</button>
      <button type="button" class="btn ghost" onclick={copiar}>Copiar código</button>
      <a class="btn ghost" href="#/pratica/projeto/{cert.projetoId}">Ver o projeto</a>
    </div>
  {/if}
  <form class="cert-conferir nao-imprimir" onsubmit={conferir}>
    <label for="certCodigo">Conferir outro certificado</label>
    <input id="certCodigo" bind:value={outro} placeholder="GYDE-XXXX-XXXX" autocomplete="off" spellcheck="false" maxlength="14">
    <button class="btn ghost">Conferir</button>
  </form>
</div>
