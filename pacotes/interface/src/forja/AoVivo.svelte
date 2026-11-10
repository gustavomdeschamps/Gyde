<script lang="ts">
  // Painel "Ao vivo" da Forja: liga o projeto (servidor de desenvolvimento, site pronto ou programa de console).
  // Nada roda antes do clique em "Permitir e iniciar", com o comando exato à vista. Fechar o painel para tudo.
  import { onDestroy, tick } from 'svelte';
  import * as C from '$contratos';
  import type { TEstadoAoVivo, TOpcaoAoVivo, TPlanoAoVivo } from '$contratos';
  import { pedir, enviar, corpo, mensagemDe } from '../api.ts';
  import { ic } from './icones.ts';

  let { id, versao, onfechar, onpedirForja }: { id: string; versao: number; onfechar: () => void; onpedirForja: (texto: string) => void } = $props();

  let plano = $state<TPlanoAoVivo | null>(null);
  let estado = $state<TEstadoAoVivo | null>(null);
  let erro = $state('');
  let escolhida = $state<string>('');
  let outro = $state('');
  let mostrarOutro = $state(false);
  let enviando = $state(false);
  let aba = $state<'pagina' | 'saida'>('pagina');
  let recarga = $state(0);
  let agora = $state(Date.now());
  let caixaSaida: HTMLElement | undefined = $state();
  // saída: só as linhas novas chegam a cada consulta e entram no fim da lista (antes, as 600 linhas eram redesenhadas
  // a cada segundo). Cada linha tem o seu número, então o Svelte só cria os elementos novos.
  let linhas = $state.raw<{ n: number; t: string }[]>([]);
  let proxima = 0;
  const MAX_LINHAS = 600;
  let copiado = $state(false);

  const opcao = $derived(plano?.opcoes.find((o) => o.id === escolhida) ?? null);
  const ligado = $derived(Boolean(estado && ['instalando', 'iniciando', 'pronto', 'rodando'].includes(estado.fase)));
  const segundos = $derived(estado?.desde ? Math.max(0, Math.round((agora - estado.desde) / 1000)) : 0);
  const comPorta = (c: string | null) => (c ?? '').replaceAll('{porta}', '‹porta livre›');
  const FASE: Record<string, string> = { instalando: 'Instalando as dependências', iniciando: 'Ligando o projeto', pronto: 'Pronto', rodando: 'Rodando', terminou: 'Terminou', falhou: 'Não deu certo', parado: 'Parado' };

  async function carregar() {
    erro = '';
    try {
      const r = await pedir(`/api/codigo/sessoes/${id}/ao-vivo`, C.AoVivo);
      plano = r.plano; receber(r.estado);
      escolhida = r.estado.opcao ?? r.plano.recomendada ?? r.plano.opcoes[0]?.id ?? '';
      if (!r.plano.opcoes.length) mostrarOutro = true;
    } catch (e) { erro = mensagemDe(e); }
  }
  void carregar();

  async function iniciar(instalar: boolean, comando = '') {
    enviando = true; erro = '';
    try {
      receber(C.EstadoAoVivo.parse(await enviar(`/api/codigo/sessoes/${id}/ao-vivo/iniciar`, corpo({ opcao: escolhida, instalar, comando }))));
      aba = estado?.url ? 'pagina' : 'saida';
    } catch (e) { erro = mensagemDe(e); }
    enviando = false;
  }
  async function parar() {
    try { receber(C.EstadoAoVivo.parse(await enviar(`/api/codigo/sessoes/${id}/ao-vivo/parar`, { method: 'POST' }))); } catch (e) { erro = mensagemDe(e); }
  }
  const reiniciar = () => iniciar(false, estado?.opcao === 'proprio' ? outro : '');

  // junta o que chegou: linhas novas no fim; o resto do estado só é trocado se mudou (evita redesenhar o painel à toa)
  let chaveEstado = '';
  let ultimaFase = '';
  function receber(novo: TEstadoAoVivo) {
    if (novo.saida.length || novo.primeira !== proxima) {
      const vindas = novo.saida.map((t, i) => ({ n: novo.primeira + i, t }));
      const juntas = novo.primeira === proxima ? [...linhas, ...vindas] : vindas; // pulou ou recomeçou: troca tudo
      linhas = juntas.length > MAX_LINHAS ? juntas.slice(-MAX_LINHAS) : juntas;
      proxima = novo.primeira + novo.saida.length;
    }
    const chave = JSON.stringify({ ...novo, saida: null, primeira: null, total: null });
    if (chave !== chaveEstado) {
      chaveEstado = chave;
      if (novo.fase === 'pronto' && ultimaFase !== 'pronto') aba = 'pagina';
      if (novo.fase === 'falhou' && ultimaFase !== 'falhou') aba = 'saida';
      ultimaFase = novo.fase;
      estado = { ...novo, saida: [] };
    }
  }
  // acompanha o estado (e avisa o servidor que o painel continua aberto: sem notícia dele, o projeto é parado).
  // 1 vez por segundo enquanto algo acontece; a cada 2 s quando está parado ou pronto.
  let vivo = true;
  let espera: ReturnType<typeof setTimeout> | undefined;
  async function acompanhar() {
    if (!vivo) return;
    if (estado) {
      try { receber(await pedir(`/api/codigo/sessoes/${id}/ao-vivo/estado?desde=${proxima}`, C.EstadoAoVivo)); } catch { /* uma falha de rede passageira não muda nada */ }
    }
    const ativo = estado && ['instalando', 'iniciando', 'rodando'].includes(estado.fase);
    espera = setTimeout(acompanhar, ativo ? 1000 : 2000);
  }
  espera = setTimeout(acompanhar, 1000);
  const relogio = setInterval(() => { if (estado?.fase === 'instalando' || estado?.fase === 'iniciando') agora = Date.now(); }, 1000);
  onDestroy(() => { vivo = false; clearTimeout(espera); clearInterval(relogio); if (ligado) void enviar(`/api/codigo/sessoes/${id}/ao-vivo/parar`, { method: 'POST' }).catch(() => {}); });

  // a Forja mudou arquivos: o site pronto recarrega (servidores de desenvolvimento já se atualizam sozinhos)
  let versaoVista: number | null = null;
  $effect(() => {
    const v = versao;
    if (versaoVista !== null && v !== versaoVista && estado?.tipo === 'estatico' && estado.fase === 'pronto') recarga++;
    versaoVista = v;
  });
  // a saída rola sozinha para o fim
  $effect(() => { void linhas; void aba; tick().then(() => { if (caixaSaida) caixaSaida.scrollTop = caixaSaida.scrollHeight; }); });

  async function copiarSaida() {
    try { await navigator.clipboard.writeText(linhas.map((l) => l.t).join('\n')); copiado = true; setTimeout(() => { copiado = false; }, 2000); } catch { /* sem área de transferência */ }
  }
  const descricao = (o: TOpcaoAoVivo) => (o.tipo === 'estatico' ? 'site pronto' : o.tipo === 'web' ? 'servidor de desenvolvimento' : 'programa (mostra a saída)');
</script>

<aside class="forja-previa ao-vivo" aria-label="Ao vivo: o projeto ligado">
  <div class="forja-previa-topo">
    <span class="forja-previa-ponto" class:on={estado?.fase === 'pronto' || estado?.fase === 'rodando'} class:carregando={estado?.fase === 'iniciando' || estado?.fase === 'instalando'} class:erro={estado?.fase === 'falhou'}></span>
    <b>Ao vivo</b>
    <small>{estado && estado.fase !== 'parado' ? `${FASE[estado.fase]}${estado.url ? ` · ${estado.url.replace(/^http:\/\//, '').replace(/\/$/, '')}` : ''}` : ''}</small>
    {#if estado?.url}
      <button type="button" class="icon-btn" title="Recarregar a página" aria-label="Recarregar a página" onclick={() => recarga++}>{@html ic.recarregar}</button>
      <a class="btn small ghost" href={estado.url} target="_blank" rel="noopener noreferrer">Abrir no navegador</a>
    {/if}
    <button type="button" class="icon-btn" title="Fechar (para o projeto)" aria-label="Fechar o Ao vivo e parar o projeto" onclick={onfechar}>{@html ic.fechar}</button>
  </div>

  {#if erro}<p class="ao-vivo-erro" role="alert">{erro}</p>{/if}

  {#if !plano && !erro}
    <p class="forja-previa-info">Olhando o projeto…</p>
  {:else if plano && (!estado || !ligado) && estado?.fase !== 'falhou' && estado?.fase !== 'terminou'}
    <!-- escolha: o que vai rodar, com o comando exato; o clique é a autorização -->
    <div class="ao-vivo-escolha">
      {#if plano.opcoes.length}
        <label class="ao-vivo-campo"><span>Como ligar este projeto</span>
          <select bind:value={escolhida}>
            {#each plano.opcoes as o (o.id)}<option value={o.id}>{o.rotulo}{o.id === plano.recomendada ? ' (recomendado)' : ''}</option>{/each}
          </select>
        </label>
        {#if opcao}
          <p class="ao-vivo-detalhe">{opcao.detalhe} <span class="ao-vivo-tipo">{descricao(opcao)}</span></p>
          {#if opcao.comando}
            <p class="ao-vivo-rotulo">O Gyde vai rodar, na pasta {opcao.pasta || 'do projeto'}:</p>
            {#if opcao.instalar}<pre class="ao-vivo-cmd"><span>1.</span> {opcao.instalar}   <small>(instala as dependências, que ainda não estão na pasta)</small></pre>{/if}
            <pre class="ao-vivo-cmd">{#if opcao.instalar}<span>2.</span> {/if}{comPorta(opcao.comando)}</pre>
          {:else}
            <p class="ao-vivo-rotulo">Nenhum comando: o próprio Gyde serve os arquivos de {opcao.pasta || 'raiz do projeto'}/.</p>
          {/if}
          <p class="ao-vivo-nota">Roda no seu computador, só em 127.0.0.1 (ninguém de fora acessa), sem as chaves do Gyde. Fechar este painel para o projeto.</p>
          <div class="ao-vivo-botoes">
            {#if opcao.instalar}
              <button type="button" class="btn small primary" disabled={enviando} onclick={() => iniciar(true)}>Permitir, instalar e iniciar</button>
              <button type="button" class="btn small ghost" disabled={enviando} onclick={() => iniciar(false)} title="Se as dependências já estiverem instaladas em outro lugar">Iniciar sem instalar</button>
            {:else}
              <button type="button" class="btn small primary" disabled={enviando} onclick={() => iniciar(false)}>{opcao.comando ? 'Permitir e iniciar' : 'Abrir o site'}</button>
            {/if}
          </div>
        {/if}
      {:else}
        <p class="forja-previa-info">{plano.motivo}</p>
      {/if}
      <details class="ao-vivo-outro" bind:open={mostrarOutro}>
        <summary>Outro comando</summary>
        <form onsubmit={(e) => { e.preventDefault(); if (outro.trim()) void iniciar(false, outro); }}>
          <input type="text" bind:value={outro} placeholder="ex.: npm run dev, python app.py" aria-label="Comando para ligar o projeto" spellcheck="false" autocomplete="off">
          <button class="btn small" disabled={!outro.trim() || enviando}>Permitir e rodar</button>
        </form>
        <small>Roda na pasta do projeto. A porta livre vai na variável PORT. Comandos perigosos continuam bloqueados, como na Forja.</small>
      </details>
    </div>
  {:else if estado}
    <!-- ligado (ou terminou/falhou): progresso, página e saída -->
    {#if estado.fase === 'instalando' || estado.fase === 'iniciando'}
      <p class="ao-vivo-progresso" role="status"><span class="ao-vivo-giro" aria-hidden="true"></span>{FASE[estado.fase]}… {segundos}s <code>{estado.comando}</code></p>
    {/if}
    {#if estado.fase === 'falhou' || estado.fase === 'terminou' || estado.mensagem}
      <div class="ao-vivo-aviso" class:falhou={estado.fase === 'falhou'} role={estado.fase === 'falhou' ? 'alert' : 'status'}>
        <p>{estado.mensagem}</p>
        <div class="ao-vivo-botoes">
          {#if estado.erroParaForja}<button type="button" class="btn small primary" onclick={() => onpedirForja(estado!.erroParaForja!)}>Pedir à Forja para consertar</button>{/if}
          {#if estado.fase === 'falhou' && estado.erroParaForja && opcao?.instalar}<button type="button" class="btn small" onclick={() => iniciar(true)}>Instalar e tentar de novo</button>{/if}
          <button type="button" class="btn small ghost" onclick={parar}>Escolher outro jeito</button>
        </div>
      </div>
    {/if}
    <div class="ao-vivo-barra">
      <div class="ao-vivo-abas" role="tablist" aria-label="Ao vivo">
        <button type="button" role="tab" aria-selected={aba === 'pagina'} disabled={!estado.url} onclick={() => (aba = 'pagina')}>Página</button>
        <button type="button" role="tab" aria-selected={aba === 'saida'} onclick={() => (aba = 'saida')}>Saída{linhas.length ? ` (${linhas.length})` : ''}</button>
      </div>
      <span class="ao-vivo-botoes">
        {#if ligado}<button type="button" class="btn small ghost" onclick={parar}>Parar</button>{/if}
        <button type="button" class="btn small ghost" disabled={enviando} onclick={reiniciar}>{ligado ? 'Reiniciar' : 'Iniciar de novo'}</button>
      </span>
    </div>
    {#if aba === 'pagina' && estado.url}
      {#key recarga}<iframe title="Projeto ao vivo" src={estado.url} sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin allow-downloads"></iframe>{/key}
      <p class="forja-previa-nota">A página roda em {estado.url.replace(/\/$/, '')}, separada do Gyde: ela não acessa a sua conta.</p>
    {:else}
      <div class="ao-vivo-saida" bind:this={caixaSaida} role="log" aria-live="off" aria-label="Saída do projeto">
        {#if linhas.length}<pre>{#each linhas as l (l.n)}<span>{l.t}{'\n'}</span>{/each}</pre>{:else}<p>Esperando a saída do comando…</p>{/if}
      </div>
      {#if linhas.length}<button type="button" class="btn small ghost ao-vivo-copiar" onclick={copiarSaida}>{copiado ? 'Saída copiada' : 'Copiar a saída'}</button>{/if}
    {/if}
  {/if}
</aside>
