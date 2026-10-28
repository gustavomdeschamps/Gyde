<script lang="ts">
  // Forja: o chat do Gyde com acesso à pasta de um projeto. Sem sessão (id = null) mostra a tela inicial; com sessão,
  // a conversa daquele projeto. Os dados vêm conferidos pelos contratos ($contratos), os eventos viram itens em estado.ts.
  import { onDestroy, tick } from 'svelte';
  import * as C from '$contratos';
  import type { TSessaoForja } from '$contratos';
  import { pedir, enviar, corpo, mensagemDe } from '../api.ts';
  import { ic } from './icones.ts';
  import { aplicar, fecharPendentes, type Item, type Evento } from './estado.ts';
  import Turno from './Turno.svelte';

  type Recente = { id: string; pasta: string; titulo: string; updated_at: number; disponivel: boolean };
  type AnexoNovo = { nome: string; tipo: 'imagem' | 'arquivo'; dataUrl?: string; texto?: string; tamanho: number };

  let { id, recentes, renderMarkdown, toast, ontrabalho }: {
    id: string | null; recentes: Recente[]; renderMarkdown: (t: string) => string; toast: (t: string) => void;
    ontrabalho: (ocupado: boolean) => void;
  } = $props();

  // a mensagem escrita antes de conectar uma pasta sobrevive à troca de tela (é enviada quando o projeto abre)
  const pendente = (globalThis as { __forjaPendente?: string | null });

  let sessao = $state<TSessaoForja | null>(null);
  let erro = $state('');
  let itens = $state<Item[]>([]);
  let agora = $state(Date.now());
  let texto = $state('');
  let anexos = $state<AnexoNovo[]>([]);
  let arrastando = $state(false);
  let menuAberto = $state(false);
  let arvore = $state<{ aberta: boolean; texto: string; erro: string }>({ aberta: false, texto: '', erro: '' });
  let controle: AbortController | null = null;
  let trabalhando = $state(false);
  let ocupadoBotao = $state(false);
  let rolagem: HTMLElement | undefined = $state();
  let campo: HTMLTextAreaElement | undefined = $state();

  const nomeDaPasta = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() || p;
  const quando = (ms: number) => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const tamanho = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const TEXTO_OK = /\.(txt|md|js|mjs|cjs|ts|tsx|jsx|json|py|java|c|cpp|h|cs|go|rs|rb|php|html|css|scss|sql|xml|ya?ml|toml|ini|csv|log|sh|bat|ps1|kt|swift|dart|vue|svelte)$/i;
  const urlAnexo = (arquivo: string) => `/api/codigo/sessoes/${id}/anexos/${arquivo}`;
  const outros = $derived(recentes.filter((r) => r.id !== sessao?.id).slice(0, 6));

  const relogio = setInterval(() => { if (trabalhando) agora = Date.now(); }, 500);
  onDestroy(() => clearInterval(relogio));

  async function descer() { await tick(); if (rolagem) rolagem.scrollTop = rolagem.scrollHeight; }

  async function carregar() {
    erro = ''; itens = [];
    if (!id) { sessao = null; return; }
    try {
      const s = await pedir(`/api/codigo/sessoes/${id}`, C.SessaoForja);
      const lista: Item[] = [];
      for (const ev of s.eventos) aplicar(lista, ev as Evento);
      fecharPendentes(lista, s.updated_at);
      sessao = s; itens = lista;
      await descer();
      campo?.focus();
      if (pendente.__forjaPendente) { texto = pendente.__forjaPendente; pendente.__forjaPendente = null; await tick(); enviarTarefa(); }
    } catch (e) { erro = mensagemDe(e); sessao = null; }
  }
  $effect(() => { void id; carregar(); });

  async function conectarPasta(): Promise<boolean> {
    ocupadoBotao = true; menuAberto = false;
    try {
      const { pasta } = await enviar<{ pasta: string | null }>('/api/codigo/escolher-pasta', { method: 'POST' });
      if (!pasta) return false; // cancelou a janela
      const r = await enviar<{ id: string }>('/api/codigo/sessoes', corpo({ pasta }));
      location.hash = `#/agente/${r.id}`;
      return true;
    } catch (e) { toast(mensagemDe(e)); return false; } finally { ocupadoBotao = false; }
  }

  async function reconectar() {
    ocupadoBotao = true;
    try {
      const { pasta } = await enviar<{ pasta: string | null }>('/api/codigo/escolher-pasta', { method: 'POST' });
      if (pasta) { await pedir(`/api/codigo/sessoes/${id}/reconectar`, C.Reconexao, corpo({ pasta })); toast('Pasta reconectada. O histórico continua.'); await carregar(); }
    } catch (e) { toast(mensagemDe(e)); } finally { ocupadoBotao = false; }
  }

  async function alternarArvore() {
    arvore.aberta = !arvore.aberta;
    if (!arvore.aberta) return;
    arvore = { aberta: true, texto: '', erro: '' };
    try { arvore.texto = (await enviar<{ arvore: string }>(`/api/codigo/sessoes/${id}/arquivos`)).arvore; } catch (e) { arvore.erro = mensagemDe(e); }
  }

  async function desfazer() {
    if (trabalhando || !sessao) return;
    if (!confirm('Desfazer a última tarefa da Forja? Os arquivos que ela mudou voltam ao que eram antes (os que você editou depois ficam como estão).')) return;
    try {
      const r = await enviar<{ saida: string; podeDesfazer: boolean }>(`/api/codigo/sessoes/${id}/desfazer`, { method: 'POST' });
      aplicar(itens, { tipo: 'desfeito', texto: r.saida }); sessao.podeDesfazer = r.podeDesfazer; descer();
    } catch (e) { toast(mensagemDe(e)); }
  }

  async function apagarConversa() {
    if (!confirm('Apagar esta conversa? Os arquivos do projeto não são apagados.')) return;
    await enviar(`/api/codigo/sessoes/${id}`, { method: 'DELETE' }).catch((e) => toast(mensagemDe(e)));
    location.hash = '#/agente';
  }

  async function responderConfirmacao(idConf: string, aprovado: boolean) {
    try { await enviar(`/api/codigo/sessoes/${id}/confirmar`, corpo({ id: idConf, aprovado })); } catch (e) { toast(mensagemDe(e)); }
  }

  // ---------- anexos ----------
  const ler = (f: File) => new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(r.error); if (f.type.startsWith('image/')) r.readAsDataURL(f); else r.readAsText(f); });
  async function anexar(lista: File[]) {
    for (const f of lista) {
      try {
        if (anexos.length >= 8) { toast('No máximo 8 anexos por mensagem.'); break; }
        if (/^image\/(png|jpeg|webp|gif)$/.test(f.type)) {
          if (f.size > 6 * 1048576) { toast(`${f.name}: imagem maior que 6 MB.`); continue; }
          anexos.push({ nome: f.name || 'print.png', tipo: 'imagem', dataUrl: await ler(f), tamanho: f.size });
        } else if (TEXTO_OK.test(f.name)) {
          if (f.size > 200_000) { toast(`${f.name}: arquivo de texto grande demais (máx. 200 KB).`); continue; }
          anexos.push({ nome: f.name, tipo: 'arquivo', texto: await ler(f), tamanho: f.size });
        } else toast(`${f.name}: tipo não aceito. Anexe imagens (PNG, JPG, WEBP, GIF) ou arquivos de texto/código.`);
      } catch { toast(`Não consegui ler ${f.name}.`); }
    }
  }
  let seletor: HTMLInputElement | undefined = $state();

  function ajustarAltura() { if (!campo) return; campo.style.height = 'auto'; campo.style.height = `${Math.min(campo.scrollHeight, 220)}px`; }

  // ---------- enviar uma tarefa e acompanhar ao vivo ----------
  async function enviarTarefa() {
    if (controle) { controle.abort(); return; } // o botão vira "parar" enquanto trabalha
    if (!id) { // sem projeto: guarda o pedido e abre a escolha de pasta
      const t = texto.trim(); if (!t) return;
      pendente.__forjaPendente = t; toast('Escolha a pasta do projeto para a Forja trabalhar.');
      if (!(await conectarPasta())) pendente.__forjaPendente = null;
      return;
    }
    const t = texto.trim(); if (!t && !anexos.length) return;
    const lista = anexos.map(({ nome, tipo, dataUrl, texto: conteudo }) => ({ nome, tipo, dataUrl, texto: conteudo }));
    texto = ''; anexos = []; await tick(); ajustarAltura();
    controle = new AbortController(); trabalhando = true; ontrabalho(true); agora = Date.now();
    try {
      const res = await fetch(`/api/codigo/sessoes/${id}/tarefa`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gyde': '1' }, body: JSON.stringify({ texto: t, anexos: lista }), signal: controle.signal });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || `Erro ${res.status}`);
      const leitor = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      for (;;) {
        const { value, done } = await leitor.read(); if (done) break;
        buf += value; let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const linha = buf.slice(0, i); buf = buf.slice(i + 2);
          if (!linha.startsWith('data: ')) continue;
          const ev = JSON.parse(linha.slice(6)) as Evento;
          if (ev.tipo === 'fim') { if (sessao) sessao.podeDesfazer = Boolean(ev.podeDesfazer); } else aplicar(itens, ev, true);
          descer();
        }
      }
    } catch (e) {
      const parado = e instanceof DOMException && e.name === 'AbortError';
      const msg = parado ? 'Parado por você.' : mensagemDe(e);
      if (itens.some((x) => x.tipo === 'turno' && !x.fim)) aplicar(itens, { tipo: 'erro', texto: msg });
      else toast(msg);
    }
    fecharPendentes(itens, Date.now());
    controle = null; trabalhando = false; ontrabalho(false); campo?.focus(); descer();
  }

  const sugestoes = $derived(sessao ? ['Explique como este projeto funciona', 'Analise o projeto e corrija os erros que encontrar',
    sessao.projeto?.testes ? 'Rode os testes e corrija os que falharem' : 'Crie testes para o código principal',
    'Explique o que você pretende mudar antes de começar a melhorar o visual'] : []);
</script>

<svelte:window onclick={(e) => { if (!(e.target as Element).closest?.('.forja-proj')) menuAberto = false; }} />

<div class="forja-chat">
  <header class="forja-topo">
    <div class="forja-proj">
      <button type="button" class="forja-proj-btn" aria-haspopup="true" aria-expanded={menuAberto} aria-controls="forjaMenu" onclick={() => (menuAberto = !menuAberto)}>
        <span class="forja-proj-ic" class:on={sessao}>{@html ic.pasta}</span>
        <span class="forja-proj-txt"><b>{sessao ? nomeDaPasta(sessao.pasta) : 'Nenhum projeto conectado'}</b>
          <small>{sessao ? sessao.pasta : 'A Forja só mexe na pasta que você escolher'}</small></span>
        <span class="forja-proj-seta">{@html ic.baixo}</span>
      </button>
      {#if menuAberto}
        <div class="forja-menu" id="forjaMenu">
          <button type="button" onclick={conectarPasta}>{@html ic.pasta}<span><b>{sessao ? 'Abrir outra pasta…' : 'Conectar uma pasta…'}</b><small>Abre o Explorador de Arquivos</small></span></button>
          {#if outros.length}
            <p class="forja-menu-rot">Recentes</p>
            {#each outros as r (r.id)}<a href="#/agente/{r.id}">{@html ic.pasta}<span><b>{r.titulo}</b><small>{r.disponivel ? '' : 'pasta indisponível · '}{r.pasta}</small></span></a>{/each}
          {/if}
        </div>
      {/if}
    </div>
    {#if sessao?.projeto?.tecnologias.length}
      <span class="forja-tecs" title="Detectado nos arquivos do projeto">{#each sessao.projeto.tecnologias.slice(0, 4) as t}<span>{t}</span>{/each}</span>
    {/if}
    {#if sessao}
      <span class="forja-acoes">
        {#if sessao.podeDesfazer}<button type="button" class="btn small ghost" title="Volta os arquivos ao que eram antes da última tarefa da Forja" onclick={desfazer}>{@html ic.desfazer}Desfazer</button>{/if}
        <button type="button" class="icon-btn" title="Arquivos que a Forja pode ver" aria-label="Arquivos do projeto" aria-expanded={arvore.aberta} onclick={alternarArvore}>{@html ic.arquivos}</button>
        <button type="button" class="icon-btn" title="Apagar esta conversa (os arquivos do projeto ficam)" aria-label="Apagar esta conversa" onclick={apagarConversa}>{@html ic.lixo}</button>
      </span>
    {/if}
  </header>

  {#if arvore.aberta}
    <div class="forja-arvore">
      {#if arvore.erro}<p class="msg-error">{arvore.erro}</p>
      {:else if !arvore.texto}<p class="forja-arvore-info">Carregando…</p>
      {:else}<p class="forja-arvore-info">A Forja só enxerga esta pasta. Arquivos de senhas e chaves (.env, chaves SSH...) ficam de fora. <a href="#/agente">Trocar de projeto</a></p><pre>{arvore.texto}</pre>{/if}
    </div>
  {/if}

  {#if erro}
    <div class="forja-aviso erro" role="alert"><span>{erro}</span><span class="forja-aviso-acoes"><button type="button" class="btn small primary" onclick={carregar}>Tentar de novo</button></span></div>
  {/if}
  {#if sessao && !sessao.pastaEstado.ok}
    <div class="forja-aviso erro" role="alert"><span>{sessao.pastaEstado.texto} O histórico desta conversa continua salvo.</span>
      <span class="forja-aviso-acoes">
        {#if sessao.pastaEstado.temporario}<button type="button" class="btn small ghost" onclick={carregar}>Verificar de novo</button>{/if}
        <button type="button" class="btn small primary" disabled={ocupadoBotao} onclick={reconectar}>Reconectar pasta</button>
      </span></div>
  {/if}
  {#if sessao?.trabalhando && !trabalhando}
    <p class="forja-aviso">A Forja ainda está trabalhando nesta conversa (em outra aba ou depois de recarregar). Espere ela terminar para mandar outra mensagem.</p>
  {/if}

  <div class="forja-rolagem" bind:this={rolagem}><div class="messages">
    {#if !id}
      <div class="ag-vazio"><span class="forja-marca grande">{@html ic.forja}</span>
        <h2>Forja: o Gyde trabalhando no seu projeto</h2>
        <p>Converse como no chat. A diferença é que aqui o Gyde lê, edita e testa os arquivos de verdade, só dentro da pasta que você conectar. Antes de apagar arquivos, instalar pacotes ou acessar a internet, ele pergunta.</p>
        <button type="button" class="btn primary" class:esperando={ocupadoBotao} disabled={ocupadoBotao} onclick={conectarPasta}>{@html ic.pasta}Conectar pasta do projeto</button>
        {#if recentes.length}
          <div class="forja-recentes"><p>Continuar em um projeto</p>
            {#each recentes.slice(0, 4) as r (r.id)}<a href="#/agente/{r.id}">{@html ic.pasta}<span><b>{nomeDaPasta(r.pasta)}</b><small>{r.titulo}</small></span><time>{quando(r.updated_at)}</time></a>{/each}
          </div>
        {/if}
      </div>
    {:else if sessao && !itens.length}
      <div class="ag-vazio"><span class="forja-marca grande">{@html ic.forja}</span>
        <h2>Projeto conectado: {nomeDaPasta(sessao.pasta)}</h2>
        <p>{#if sessao.projeto}{sessao.projeto.arquivos} arquivos{#if sessao.projeto.tecnologias.length} · {sessao.projeto.tecnologias.join(', ')}{/if}{#if sessao.projeto.testes} · testes: <code>{sessao.projeto.testes}</code>{:else} · nenhum comando de testes encontrado{/if}.{/if} O que a Forja deve fazer?</p>
        <div class="ag-sugestoes">{#each sugestoes as s}<button type="button" onclick={() => { texto = s; enviarTarefa(); }}>{s}</button>{/each}</div>
      </div>
    {/if}
    {#each itens as it (it.chave)}
      {#if it.tipo === 'turno'}
        <Turno turno={it} {agora} {urlAnexo} {renderMarkdown} onconfirmar={responderConfirmacao} />
      {:else if it.tipo === 'desfeito'}
        <div class="forja-desfeito" role="status">{@html ic.desfazer}<span><b>Desfeito</b> {it.texto}</span></div>
      {:else}
        <div class="forja-desfeito" role="status">{@html ic.pasta}<span><b>Pasta reconectada</b> {it.para}</span></div>
      {/if}
    {/each}
  </div></div>

  <form class="composer forja-composer" class:dragging={arrastando} onsubmit={(e) => { e.preventDefault(); enviarTarefa(); }}
    ondragover={(e) => { if (!id) return; e.preventDefault(); arrastando = true; }}
    ondragleave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) arrastando = false; }}
    ondrop={(e) => { if (!id) return; e.preventDefault(); arrastando = false; anexar([...(e.dataTransfer?.files ?? [])]); }}>
    {#if id}<div class="drop-hint">Solte as imagens ou arquivos para anexar</div>{/if}
    {#if anexos.length}
      <div class="forja-anexos">
        {#each anexos as a, i}
          <span class="forja-anexo">{#if a.tipo === 'imagem'}<img src={a.dataUrl} alt="">{:else}{@html ic.ler}{/if}<span>{a.nome}<small>{tamanho(a.tamanho)}</small></span><button type="button" aria-label="Tirar {a.nome}" onclick={() => anexos.splice(i, 1)}>✕</button></span>
        {/each}
      </div>
    {/if}
    <div class="composer-row">
      {#if id}
        <button type="button" class="icon-btn" aria-label="Anexar imagens ou arquivos" title="Anexar imagens (prints, referências) ou arquivos de texto" onclick={() => seletor?.click()}>{@html ic.clipe}</button>
        <input type="file" bind:this={seletor} multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.js,.mjs,.ts,.tsx,.jsx,.json,.py,.java,.c,.cpp,.cs,.go,.rs,.php,.html,.css,.sql,.xml,.yml,.yaml,.csv,.log"
          onchange={(e) => { const el = e.currentTarget as HTMLInputElement; anexar([...(el.files ?? [])]); el.value = ''; }}>
      {/if}
      <textarea rows="1" bind:this={campo} bind:value={texto} aria-label="Mensagem para a Forja"
        placeholder={id ? 'Peça qualquer coisa para este projeto (cole prints com Ctrl+V)' : 'Diga o que fazer. Ao enviar, você escolhe a pasta do projeto.'}
        oninput={ajustarAltura}
        onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarTarefa(); } }}
        onpaste={(e) => { const fs = [...(e.clipboardData?.files ?? [])]; if (fs.length && id) { e.preventDefault(); anexar(fs); } }}></textarea>
      <button type="submit" class="send" class:streaming={trabalhando} aria-label={trabalhando ? 'Parar' : 'Enviar'}>{@html ic.enviar}</button>
    </div>
  </form>
</div>
