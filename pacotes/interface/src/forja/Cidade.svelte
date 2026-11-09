<script lang="ts">
  // Cidade do código: a pasta conectada como cidade (pasta = bairro, arquivo = prédio, altura = tamanho,
  // vermelho = mais alterado no git). Duas formas de ver: a cidade em 3D (o Three.js só é baixado quando ela abre)
  // e a lista em texto, que funciona sem 3D e é a alternativa acessível.
  import * as C from '$contratos';
  import type { TCidade, TPredio } from '$contratos';
  import { pedir, mensagemDe } from '../api.ts';
  import { bairroDe, nomeDe, calorDe } from './cidade-comum.ts';
  import type { Cidade3D } from './cidade3d.ts';

  let { id }: { id: string } = $props();

  let cidade = $state<TCidade | null>(null);
  let erro = $state('');
  let carregando = $state(false);
  let ordem = $state<'nome' | 'tamanho' | 'mudancas'>('mudancas');
  let filtro = $state('');
  // forma de ver escolhida (fica salva neste navegador)
  const modoSalvo = (() => { try { return localStorage.getItem('cidadeModo') === 'lista' ? 'lista' : '3d'; } catch { return '3d'; } })();
  let modo = $state<'3d' | 'lista'>(modoSalvo);
  function trocarModo(m: '3d' | 'lista') { modo = m; try { localStorage.setItem('cidadeModo', m); } catch { /* sem storage */ } }
  let caixa: HTMLElement | undefined = $state();
  let estado3d = $state<'carregando' | 'pronto' | 'falhou'>('carregando');
  let dica = $state<{ p: TPredio; x: number; y: number } | null>(null);
  let escolhido = $state<TPredio | null>(null);
  let cena: Cidade3D | null = null;

  async function carregar() {
    carregando = true; erro = '';
    try { cidade = await pedir(`/api/codigo/sessoes/${id}/cidade`, C.Cidade); } catch (e) { erro = mensagemDe(e); }
    carregando = false;
  }
  $effect(() => { void id; cidade = null; escolhido = null; carregar(); });

  // monta a cena 3D quando a aba está em 3D e os dados chegaram; desmonta ao sair (libera a placa de vídeo)
  $effect(() => {
    if (modo !== '3d' || !cidade || !caixa) return;
    const dados = cidade, alvo = caixa;
    let cancelado = false;
    estado3d = 'carregando';
    import('./cidade3d.ts').then(({ criarCidade3D }) => {
      if (cancelado) return;
      cena = criarCidade3D(alvo, dados.arquivos, {
        aoEscolher: (p) => { escolhido = p; },
        aoPassar: (p, x, y) => { dica = p ? { p, x, y } : null; },
      });
      if (escolhido) cena.selecionar(escolhido.caminho);
      estado3d = 'pronto';
    }).catch(() => { if (!cancelado) estado3d = 'falhou'; });
    return () => { cancelado = true; cena?.destruir(); cena = null; dica = null; };
  });
  const numero = (n: number) => n.toLocaleString('pt-BR');
  const data = (ms: number | null) => (ms == null ? '' : new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }));
  const tamanhoTexto = (p: TPredio) => (p.binario ? `${Math.max(1, Math.round(p.bytes / 1024))} KB (arquivo binário)` : `${numero(p.linhas)} ${p.linhas === 1 ? 'linha' : 'linhas'}`);
  const maxMudancas = $derived(Math.max(1, ...(cidade?.arquivos.map((a) => a.mudancas) ?? [1])));
  // mesma escala de calor da cidade 3D: 0 = nunca mudou, 1 = o mais alterado
  const calor = (p: TPredio) => calorDe(p.mudancas, maxMudancas);

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
    <div class="cidade-botoes">
      <div class="cidade-modo" role="group" aria-label="Forma de ver">
        <button type="button" aria-pressed={modo === '3d'} onclick={() => trocarModo('3d')}>Cidade 3D</button>
        <button type="button" aria-pressed={modo === 'lista'} onclick={() => trocarModo('lista')}>Lista</button>
      </div>
      <button type="button" class="btn small ghost" disabled={carregando} onclick={carregar}>{carregando ? 'Lendo a pasta…' : 'Atualizar'}</button>
    </div>
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

    {#if modo === '3d'}
      <div class="cidade-palco">
        <div class="cidade-3d" bind:this={caixa} role="img" aria-label="Cidade em 3D com {cidade.arquivos.length} prédios. Para ler os mesmos dados em texto, use o botão Lista."></div>
        {#if estado3d === 'carregando'}<p class="cidade-palco-info" role="status">Montando a cidade…</p>{/if}
        {#if estado3d === 'falhou'}
          <div class="cidade-palco-info" role="alert"><p>Este computador não conseguiu desenhar a cidade em 3D.</p><button type="button" class="btn small primary" onclick={() => trocarModo('lista')}>Ver como lista</button></div>
        {/if}
        <div class="cidade-legenda-3d" aria-hidden="true">
          <span>Altura = tamanho do arquivo</span>
          <span class="cidade-escala"><i></i>nunca mudou → mais alterado</span>
        </div>
      </div>
      <p class="cidade-ajuda">Arraste para girar. Use a roda do mouse (ou dois dedos) para aproximar e o botão direito para mover. Clique num prédio para ver o arquivo.</p>
      {#if escolhido}
        <p class="cidade-escolhido" role="status"><span class="cidade-calor" style:--calor={calor(escolhido)} aria-hidden="true"></span><b class="cidade-arquivo">{escolhido.caminho}</b>
          <span>{tamanhoTexto(escolhido)}{#if cidade.git.ativo}{' · '}{escolhido.mudancas ? `mudou ${numero(escolhido.mudancas)} ${escolhido.mudancas === 1 ? 'vez' : 'vezes'}` : 'nunca mudou'}{/if}</span></p>
      {/if}
    {:else}
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
  {/if}
</section>

{#if dica}
  <div class="cidade-dica" style:left="{dica.x + 14}px" style:top="{dica.y + 14}px" aria-hidden="true">
    <b>{nomeDe(dica.p.caminho)}</b><small>{bairroDe(dica.p.caminho) || 'raiz do projeto'}</small>
    <span>{tamanhoTexto(dica.p)}{#if cidade?.git.ativo}{' · '}{dica.p.mudancas ? `${numero(dica.p.mudancas)} mudanças` : 'nunca mudou'}{/if}</span>
  </div>
{/if}
