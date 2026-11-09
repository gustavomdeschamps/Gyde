<script lang="ts">
  // Cidade do código: a pasta conectada como cidade (pasta = bairro, arquivo = prédio, altura = tamanho,
  // vermelho = mais alterado no git). Esta é a lista em texto, que funciona sem 3D e serve de alternativa acessível.
  import * as C from '$contratos';
  import type { TCidade, TPredio } from '$contratos';
  import { pedir, mensagemDe } from '../api.ts';

  let { id }: { id: string } = $props();

  let cidade = $state<TCidade | null>(null);
  let erro = $state('');
  let carregando = $state(false);
  let ordem = $state<'nome' | 'tamanho' | 'mudancas'>('mudancas');
  let filtro = $state('');

  async function carregar() {
    carregando = true; erro = '';
    try { cidade = await pedir(`/api/codigo/sessoes/${id}/cidade`, C.Cidade); } catch (e) { erro = mensagemDe(e); }
    carregando = false;
  }
  $effect(() => { void id; cidade = null; carregar(); });

  const bairroDe = (caminho: string) => (caminho.includes('/') ? caminho.slice(0, caminho.lastIndexOf('/')) : '');
  const nomeDe = (caminho: string) => caminho.slice(caminho.lastIndexOf('/') + 1);
  const numero = (n: number) => n.toLocaleString('pt-BR');
  const data = (ms: number | null) => (ms == null ? '' : new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }));
  const tamanhoTexto = (p: TPredio) => (p.binario ? `${Math.max(1, Math.round(p.bytes / 1024))} KB (arquivo binário)` : `${numero(p.linhas)} ${p.linhas === 1 ? 'linha' : 'linhas'}`);
  const maxMudancas = $derived(Math.max(1, ...(cidade?.arquivos.map((a) => a.mudancas) ?? [1])));
  // mesma escala de calor da cidade 3D: 0 = nunca mudou, 1 = o mais alterado
  const calor = (p: TPredio) => p.mudancas / maxMudancas;

  const comparar = (a: TPredio, b: TPredio) => ordem === 'nome' ? a.caminho.localeCompare(b.caminho)
    : ordem === 'tamanho' ? (b.linhas || b.bytes / 40) - (a.linhas || a.bytes / 40) : b.mudancas - a.mudancas || a.caminho.localeCompare(b.caminho);
  // bairros (pastas) com seus prédios; os bairros seguem a mesma ordem escolhida (pelo total do bairro)
  const bairros = $derived.by(() => {
    if (!cidade) return [];
    const termo = filtro.trim().toLowerCase();
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- mapa temporário, só para agrupar dentro deste cálculo
    const grupos = new Map<string, TPredio[]>();
    for (const a of cidade.arquivos) {
      if (termo && !a.caminho.toLowerCase().includes(termo)) continue;
      const b = bairroDe(a.caminho);
      (grupos.get(b) ?? grupos.set(b, []).get(b)!).push(a);
    }
    const lista = [...grupos].map(([nome, arquivos]) => ({ nome, arquivos: arquivos.sort(comparar),
      linhas: arquivos.reduce((n, a) => n + a.linhas, 0), mudancas: arquivos.reduce((n, a) => n + a.mudancas, 0) }));
    return lista.sort((a, b) => ordem === 'nome' ? a.nome.localeCompare(b.nome) : ordem === 'tamanho' ? b.linhas - a.linhas : b.mudancas - a.mudancas || a.nome.localeCompare(b.nome));
  });
  const mostrados = $derived(bairros.reduce((n, b) => n + b.arquivos.length, 0));
</script>

<section class="cidade" aria-labelledby="cidadeTitulo">
  <header class="cidade-topo">
    <div>
      <h2 id="cidadeTitulo">Cidade do código</h2>
      <p class="cidade-legenda">Cada pasta é um bairro e cada arquivo é um prédio. Quanto maior o arquivo, mais alto o prédio; quanto mais vezes ele mudou no git, mais vermelho.</p>
    </div>
    <button type="button" class="btn small ghost" disabled={carregando} onclick={carregar}>{carregando ? 'Lendo a pasta…' : 'Atualizar'}</button>
  </header>

  {#if erro}<p class="msg-error" role="alert">{erro}</p>
  {:else if !cidade}<p class="cidade-info" role="status">Lendo a pasta do projeto…</p>
  {:else}
    <p class="cidade-resumo" role="status">
      {numero(cidade.arquivos.length)} {cidade.arquivos.length === 1 ? 'prédio' : 'prédios'} em {numero(new Set(cidade.arquivos.map((a) => bairroDe(a.caminho))).size)} bairros.
      {#if cidade.git.ativo}Mudanças contadas nos últimos {numero(cidade.git.commits)} commits.{:else}Esta pasta não usa git, então todos os prédios ficam sem cor de mudança.{/if}
    </p>
    {#if cidade.cortados > 0}
      <p class="cidade-aviso">O projeto tem {numero(cidade.total)} arquivos. Para a cidade não ficar pesada, aparecem os {numero(cidade.limite)} mais alterados e maiores; {numero(cidade.cortados)} ficaram de fora.</p>
    {/if}
    {#if cidade.incompleta}<p class="cidade-aviso">A pasta é muito grande: a leitura parou antes do fim, então alguns arquivos não foram vistos.</p>{/if}

    <div class="cidade-controles">
      <label class="cidade-filtro"><span>Procurar arquivo</span><input type="search" bind:value={filtro} placeholder="ex.: server.ts" autocomplete="off" spellcheck="false"></label>
      <label class="cidade-ordem"><span>Ordenar por</span>
        <select bind:value={ordem}>
          <option value="mudancas">Mais alterados</option>
          <option value="tamanho">Maiores</option>
          <option value="nome">Nome</option>
        </select>
      </label>
    </div>

    {#if !mostrados}<p class="cidade-info">{filtro ? 'Nenhum arquivo com esse nome.' : 'A pasta não tem arquivos para mostrar.'}</p>{/if}
    <div class="cidade-lista">
      {#each bairros as b (b.nome)}
        <section class="cidade-bairro" aria-label="Bairro {b.nome || 'raiz do projeto'}">
          <h3><span class="cidade-bairro-nome">{b.nome ? `${b.nome}/` : 'Raiz do projeto'}</span>
            <small>{numero(b.arquivos.length)} {b.arquivos.length === 1 ? 'arquivo' : 'arquivos'} · {numero(b.linhas)} linhas{#if cidade.git.ativo}{' · '}{numero(b.mudancas)} mudanças{/if}</small></h3>
          <table>
            <thead><tr><th scope="col">Arquivo</th><th scope="col">Tamanho</th>{#if cidade.git.ativo}<th scope="col">Mudanças no git</th><th scope="col">Última mudança</th>{/if}</tr></thead>
            <tbody>
              {#each b.arquivos as a (a.caminho)}
                <tr>
                  <th scope="row"><span class="cidade-calor" style:--calor={calor(a)} aria-hidden="true"></span><span class="cidade-arquivo" title={a.caminho}>{nomeDe(a.caminho)}</span></th>
                  <td>{tamanhoTexto(a)}</td>
                  {#if cidade.git.ativo}<td>{a.mudancas ? `${numero(a.mudancas)} ${a.mudancas === 1 ? 'vez' : 'vezes'}` : 'nunca'}</td><td>{data(a.ultima)}</td>{/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </section>
      {/each}
    </div>
  {/if}
</section>
