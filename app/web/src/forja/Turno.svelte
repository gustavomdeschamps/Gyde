<script lang="ts">
  // Um turno da Forja: o pedido do usuário, a atividade (abre e fecha) e a resposta com o resumo das mudanças.
  import { ic, verbo } from './icones.ts';
  import { duracao, relogio, type Turno, type EtapaAcao } from './estado.ts';

  let { turno, agora, urlAnexo, renderMarkdown, onconfirmar }: {
    turno: Turno; agora: number; urlAnexo: (arquivo: string) => string;
    renderMarkdown: (texto: string) => string; onconfirmar: (id: string, aprovado: boolean) => void;
  } = $props();

  // aberto enquanto trabalha; fecha sozinho quando termina (dá para abrir de novo)
  let abertoManual = $state<boolean | null>(null);
  const aberto = $derived(abertoManual ?? !turno.fim);

  const alvo = (a: EtapaAcao) => {
    const x = a.args;
    if (a.nome === 'executar') return String(x.comando ?? '');
    if (a.nome === 'buscar') return `"${String(x.texto ?? '')}"`;
    const c = String(x.caminho ?? '');
    return !c || c === '.' || c === './' ? 'a pasta do projeto' : c;
  };
  const icone = (nome: string) => ic[nome === 'apagar' ? 'lixo' : nome] ?? ic.executar;
  const linhas = (t: unknown) => String(t ?? '').split('\n');
  const rotulo = $derived(!turno.fim ? 'Trabalhando' : turno.fim.estado === 'ok' ? 'Trabalhou' : turno.fim.estado === 'parado' ? 'Parado' : 'Não terminou');
</script>

<div class="msg user">
  {#if turno.anexos.length}
    <div class="forja-anexos-msg">
      {#each turno.anexos as a (a.id)}
        {#if a.tipo === 'imagem'}
          <a href={urlAnexo(a.arquivo)} target="_blank" rel="noopener" class="forja-anexo-img" title={a.nome}><img src={urlAnexo(a.arquivo)} alt={a.nome} loading="lazy"></a>
        {:else}
          <span class="forja-anexo-arq" title={a.nome}>{@html ic.ler}{a.nome}</span>
        {/if}
      {/each}
    </div>
  {/if}
  {#if turno.texto}<div class="bubble">{turno.texto}</div>{/if}
</div>

<div class="msg assistant forja-turno" class:trabalhando={!turno.fim} class:fechado={!aberto} class:sem-atividade={turno.fim && !turno.fim.acoes}>
  <button type="button" class="forja-cab" aria-expanded={aberto} onclick={() => (abertoManual = !aberto)}>
    <span class="forja-marca">{@html ic.forja}</span>
    <span class="forja-status">
      <b>{rotulo}</b>
      {#if turno.fim}por {duracao(turno.fim.duracaoMs)}{:else}<span class="forja-tempo">{relogio(agora - turno.inicio)}</span>{/if}
    </span>
    {#if turno.fim}
      <span class="forja-chips">
        {#if turno.fim.acoes}<span>{turno.fim.acoes} {turno.fim.acoes === 1 ? 'ação' : 'ações'}</span>{/if}
        {#if turno.fim.arquivos}<span>{turno.fim.arquivos} {turno.fim.arquivos === 1 ? 'arquivo alterado' : 'arquivos alterados'}</span>{/if}
        {#if turno.fim.comandos}<span>{turno.fim.comandos} {turno.fim.comandos === 1 ? 'comando' : 'comandos'}</span>{/if}
      </span>
    {:else}<span class="forja-chips"></span>{/if}
    <span class="forja-seta">{@html ic.seta}</span>
  </button>

  <div class="forja-atividade"><div class="forja-passos">
    {#each turno.etapas as e, i (i)}
      {#if e.tipo === 'acao'}
        <div class="ag-passo" class:rodando={e.estado === 'rodando'} class:ok={e.estado === 'ok'} class:falhou={e.estado === 'falhou'} data-nome={e.nome}>
          <div class="ag-cab">
            <span class="ag-ic">{@html icone(e.nome)}</span>
            <span class="ag-tit"><b>{verbo[e.nome] || e.nome}</b> <code>{alvo(e)}</code></span>
            <span class="ag-estado">{e.estado === 'ok' ? '✓' : e.estado === 'falhou' ? '✕' : e.estado === 'interrompido' ? '•' : ''}</span>
          </div>
          {#if e.pensamento}<p class="ag-pens">{e.pensamento}</p>{/if}
          {#if e.estado !== 'rodando' && e.estado !== 'interrompido'}
            {#if e.diff?.antes !== undefined}
              <details><summary>Ver a mudança</summary><pre class="ag-diff">{#each linhas(e.diff.antes) as l}<span class="menos">- {l}</span>{/each}{#each linhas(e.diff.depois) as l}<span class="mais">+ {l}</span>{/each}</pre></details>
            {:else if e.diff?.novo !== undefined}
              <details><summary>{e.diff.criado ? 'Arquivo criado' : 'Arquivo reescrito'}</summary><pre class="ag-diff">{#each linhas(e.diff.novo) as l}<span class="mais">+ {l}</span>{/each}</pre></details>
            {:else}
              <details open={e.estado === 'falhou'}><summary>{e.resumo || (e.estado === 'ok' ? 'Pronto' : 'Falhou')}</summary><pre class="ag-saida">{e.saida}</pre></details>
            {/if}
          {/if}
        </div>
      {:else}
        <div class="forja-confirmar" class:aprovado={e.resposta === true} class:recusado={e.resposta === false} role="group" aria-label="Confirmação">
          <span class="forja-confirmar-ic">{@html ic.escudo}</span>
          <div><b>A Forja quer: {e.acao}</b><small>Precisa da sua autorização porque {e.motivo}.</small></div>
          <div class="forja-confirmar-botoes">
            {#if e.resposta === true}<span class="forja-confirmar-estado">✓ Permitido</span>
            {:else if e.resposta === false}<span class="forja-confirmar-estado">✕ Não permitido</span>
            {:else if e.aoVivo}
              <button type="button" class="btn small" onclick={() => onconfirmar(e.id, false)}>Não permitir</button>
              <button type="button" class="btn primary small" onclick={() => onconfirmar(e.id, true)}>Permitir</button>
            {:else}<span class="forja-confirmar-estado">sem resposta</span>{/if}
          </div>
        </div>
      {/if}
    {/each}
    {#if turno.pensando}<div class="ag-pensando"><i></i><i></i><i></i> pensando</div>{/if}
  </div></div>

  <div class="forja-resposta md">
    {#if turno.fim?.estado === 'ok'}
      {#if turno.fim.mudancas && (turno.fim.mudancas.criados.length || turno.fim.mudancas.modificados.length || turno.fim.mudancas.apagados.length || turno.fim.mudancas.comandos.length)}
        {@const m = turno.fim.mudancas}
        <div class="forja-resumo" aria-label="Resumo das mudanças">
          {#each [['Criados', 'criados', m.criados], ['Alterados', 'alterados', m.modificados], ['Apagados', 'apagados', m.apagados]] as [rot, cls, itens]}
            {#if (itens as string[]).length}<div class="forja-mud {cls}"><b>{rot}</b>{#each itens as string[] as f}<code>{f}</code>{/each}</div>{/if}
          {/each}
          {#if m.comandos.length}<div class="forja-mud comandos"><b>Comandos</b>{#each m.comandos as c}<code class={c.ok ? 'ok' : 'falhou'}>{c.ok ? '✓' : '✕'} {c.comando}</code>{/each}</div>{/if}
        </div>
      {/if}
      {@html renderMarkdown(turno.fim.texto)}
    {:else if turno.fim}
      <p class="msg-error">{turno.fim.texto}</p>
    {/if}
  </div>
</div>
