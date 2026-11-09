<script lang="ts">
  // Configurações > Conectar IA: para quem nunca viu uma chave de API. Uma chave grátis basta; o Groq é opcional.
  // A chave colada é testada de verdade antes de salvar e nunca volta para a tela. O FreeLLMAPI fica em "Avançado".
  import * as C from '$contratos';
  import type { TConexoes } from '$contratos';
  import { pedir, enviar, corpo, mensagemDe } from '../api.ts';

  let { toast, aoMudar }: { toast: (t: string) => void; aoMudar: () => void } = $props();
  let dados = $state<TConexoes | null>(null);
  let erro = $state('');
  const campo = $state<Record<string, string>>({});
  const resultado = $state<Record<string, { ok: boolean; texto: string } | undefined>>({});
  const testando = $state<Record<string, boolean>>({});
  let chaveFree = $state('');
  let salvandoFree = $state(false);

  const iniciais = $derived(dados?.provedores.filter((p) => p.papel === 'inicial') ?? []);
  const opcionais = $derived(dados?.provedores.filter((p) => p.papel === 'opcional') ?? []);
  const algumConectado = $derived(Boolean(dados?.provedores.some((p) => p.conectado) || dados?.freellmapi));

  pedir('/api/ia/conexoes', C.Conexoes).then((d) => { dados = d; }).catch((e) => { erro = mensagemDe(e); });

  async function testar(id: string) {
    testando[id] = true;
    resultado[id] = undefined;
    try {
      const r = C.ResultadoTesteChave.parse(await enviar(`/api/ia/conexoes/${id}/testar`, corpo({ chave: campo[id] ?? '' })));
      resultado[id] = { ok: r.ok, texto: r.mensagem };
      dados = r.conexoes;
      if (r.ok) { campo[id] = ''; aoMudar(); } // a chave sai do campo assim que é salva
    } catch (e) { resultado[id] = { ok: false, texto: mensagemDe(e) }; }
    testando[id] = false;
  }
  async function desconectar(id: string, nome: string) {
    if (!confirm(`Desconectar ${nome}? A chave é apagada deste computador.`)) return; // nome já vem com artigo
    try { dados = C.Conexoes.parse(await enviar(`/api/ia/conexoes/${id}`, { method: 'DELETE' })); resultado[id] = undefined; aoMudar(); } catch (e) { toast(mensagemDe(e)); }
  }
  async function salvarFree(e: SubmitEvent) {
    e.preventDefault();
    salvandoFree = true;
    try {
      await enviar('/api/config/chave-freellmapi', { method: 'PUT', body: JSON.stringify({ chave: chaveFree }) });
      chaveFree = '';
      dados = await pedir('/api/ia/conexoes', C.Conexoes);
      toast('Chave do FreeLLMAPI salva neste computador');
      aoMudar();
    } catch (err) { toast(mensagemDe(err)); }
    salvandoFree = false;
  }
</script>

{#snippet cartao(p: TConexoes['provedores'][number])}
  <article class="conexao" class:conectada={p.conectado} aria-labelledby="conexao-{p.id}">
    <header class="conexao-topo">
      <h3 id="conexao-{p.id}">{p.nome}</h3>
      {#if p.conectado}<span class="conexao-selo">✓ Conectado</span>{/if}
    </header>
    <p class="conexao-desc">{p.descricao}</p>
    {#each p.avisos as aviso}<p class="conexao-aviso">{aviso}</p>{/each}
    {#if p.conectado}
      <p class="config-nota">A chave está salva neste computador. Por segurança, ela não aparece mais aqui.</p>
      <div class="conexao-botoes">
        <button type="button" class="btn small" disabled={testando[p.id]} onclick={() => testar(p.id)}>{testando[p.id] ? 'Testando…' : 'Testar de novo'}</button>
        <button type="button" class="btn small ghost" onclick={() => desconectar(p.id, p.artigo)}>Desconectar</button>
      </div>
    {:else}
      <ol class="conexao-passos">
        <li><a href={p.linkChave} target="_blank" rel="noopener noreferrer">Abra o site {p.de} ↗</a> e entre na sua conta (ou crie uma, é grátis).</li>
        <li>Clique para criar uma chave e copie o código que aparecer{#if p.prefixo}{' '}(ele começa com <code>{p.prefixo}</code>){/if}.</li>
        <li>Cole a chave aqui embaixo e clique em <b>Testar chave</b>.</li>
      </ol>
      <form class="conexao-campo" onsubmit={(e) => { e.preventDefault(); testar(p.id); }}>
        <input type="password" autocomplete="off" spellcheck="false" aria-label="Chave {p.de}" placeholder={p.prefixo ? `${p.prefixo}…` : 'cole a chave aqui'} bind:value={campo[p.id]}>
        <button class="btn small primary" disabled={!campo[p.id]?.trim() || testando[p.id]}>{testando[p.id] ? 'Testando…' : 'Testar chave'}</button>
      </form>
    {/if}
    {#if resultado[p.id]}
      <p class="conexao-resultado" class:ok={resultado[p.id]?.ok} role="status">{resultado[p.id]?.ok ? '✓' : '✗'} {resultado[p.id]?.texto}</p>
    {/if}
  </article>
{/snippet}

<div class="conectar">
  {#if erro}<p class="msg-error">{erro}</p>{/if}
  {#if dados}
    <p class="conectar-intro">O Gyde usa inteligência artificial grátis de outras empresas. Para isso, ele precisa de uma <b>chave</b>: um código que a empresa dá de graça, parecido com uma senha, só que para programas. Você cria a chave no site da empresa, copia e cola aqui.</p>
    <p class="conexao-aviso idade" role="note">{dados.avisoIdade}</p>

    <h3 class="conectar-titulo">{algumConectado ? 'Suas chaves' : 'Escolha uma chave para começar'}</h3>
    <p class="config-nota">Uma chave já basta. Escolha a que preferir.</p>
    <div class="conectar-grade">{#each iniciais as p (p.id)}{@render cartao(p)}{/each}</div>

    <h3 class="conectar-titulo">Opcional</h3>
    <div class="conectar-grade">{#each opcionais as p (p.id)}{@render cartao(p)}{/each}</div>

    <details class="conectar-avancado">
      <summary>Avançado: FreeLLMAPI</summary>
      <p class="config-nota">Para quem já usa o FreeLLMAPI, um programa que junta várias chaves num lugar só. Não é preciso para usar o Gyde.</p>
      <form class="config-linha config-chave" onsubmit={salvarFree}>
        <div><b>Chave do FreeLLMAPI</b><small>{dados.freellmapi ? 'Configurada neste computador. Para trocar, cole a nova.' : 'No ícone do FreeLLMAPI na bandeja, clique em "Copy Key" e cole aqui.'}</small></div>
        <span class="config-chave-campo">
          <input type="password" autocomplete="off" spellcheck="false" placeholder={dados.freellmapi ? '••••••••' : 'freellmapi-…'} aria-label="Chave do FreeLLMAPI" bind:value={chaveFree}>
          <button class="btn small primary" disabled={!chaveFree.trim() || salvandoFree}>Salvar</button>
        </span>
      </form>
    </details>
  {:else if !erro}<p class="config-nota">Carregando…</p>{/if}
</div>
