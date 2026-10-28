<script lang="ts">
  // Aba "Uso e limites": separa o uso do Gyde (registrado aqui, por pedido), a cota do provedor (o que ele informa),
  // tokens e créditos. O que o provedor não informa aparece escrito assim, sem número inventado nem barra falsa.
  import { uso, numero, nomeModelo, horaCurta, NOME_PROVEDOR } from './uso.svelte.ts';

  const ORIGEM: Record<string, string> = { chat: 'Chat', forja: 'Forja', pratica: 'Dica da Prática', imagem: 'Imagem' };
  const RESULTADO: Record<string, string> = { ok: 'concluído', erro: 'falhou', cancelado: 'cancelado', limite: 'limite atingido' };
  const d = $derived(uso.dados);
  const lim = $derived(d?.limiteRoteador ?? null);
  const pctLivre = $derived(lim && lim.total ? Math.round((lim.restante / lim.total) * 100) : null);
  const porChave = $derived(d?.mes?.porChave ?? []);
  const comLimite = $derived(porChave.filter((k) => k.limitePedidos || k.limiteTokens));
  const dataHora = (v: string | number) => new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
</script>

{#snippet periodo(dados: NonNullable<typeof d>['gyde']['hoje'])}
  {#if !Object.keys(dados).length}<p class="config-nota">Nenhum pedido registrado.</p>{/if}
  {#each Object.entries(dados) as [prov, p]}
    <div class="uso-prov"><b>{NOME_PROVEDOR[prov] ?? prov}</b>
      <dl class="config-dl">
        <div><dt>Pedidos</dt><dd>{numero(p.pedidos)} <small>({p.concluidos} concluídos{p.falhas ? `, ${p.falhas} com falha` : ''}{p.cancelados ? `, ${p.cancelados} cancelados` : ''}{p.limite ? `, ${p.limite} barrados por limite` : ''})</small></dd></div>
        <div><dt>Chamadas ao provedor</dt><dd>{numero(p.chamadas)}{#if p.chamadas > p.pedidos} <small>(inclui {p.chamadas - p.pedidos} trocas de modelo e rodadas da Forja)</small>{/if}</dd></div>
        <div><dt>Tokens</dt><dd>{#if p.tokensEntrada || p.tokensSaida}{numero(p.tokensEntrada)} de entrada · {numero(p.tokensSaida)} de saída{#if p.semTokens} <small>({p.semTokens} pedido(s) sem tokens informados)</small>{/if}{:else}não informados pelo provedor{/if}</dd></div>
      </dl></div>
  {/each}
{/snippet}

<div class="uso-painel">
  {#if !d}
    <p class="msg-error">{uso.erro ? 'Não consegui falar com o servidor do Gyde.' : 'Carregando…'}</p>
  {:else}
    {#if lim && lim.total && lim.restante / lim.total <= 0.1}
      <p class="uso-alerta" role="alert">Restam {lim.restante} pedidos neste minuto no FreeLLMAPI.{lim.renovaEm ? ` Renova às ${horaCurta(lim.renovaEm)}.` : ''}{d.offline.disponivel ? ' Se acabar, dá para usar o modelo local (aba IA e modelos).' : ''}</p>
    {/if}
    <section class="uso-sec">
      <h3 class="config-sub">Uso do Gyde <small>registrado neste computador, por pedido seu</small></h3>
      <div class="uso-periodos"><div><h4>Hoje</h4>{@render periodo(d.gyde.hoje)}</div><div><h4>Últimos 7 dias</h4>{@render periodo(d.gyde.semana)}</div></div>
      {#if d.gyde.internasHoje}<p class="config-nota">Além disso, {d.gyde.internasHoje} chamada(s) internas hoje (títulos de conversas e memória).</p>{/if}
    </section>
    <section class="uso-sec">
      <h3 class="config-sub">Cota do provedor <small>informada por {d.ativo === 'offline' ? 'ninguém: roda no seu PC' : 'FreeLLMAPI'}</small></h3>
      {#if d.ativo === 'offline'}
        <p class="config-nota">O modelo local não tem cota nem custo: o limite é a memória e a velocidade do seu computador.</p>
      {:else}
        <dl class="config-dl">
          <div><dt>Pedidos por minuto</dt><dd>{#if lim}{numero(lim.restante)} de {numero(lim.total)} livres{lim.renovaEm ? ` · renova às ${horaCurta(lim.renovaEm)}` : ''}<span class="uso-barra" role="img" aria-label="{pctLivre}% livres"><i style="width:{pctLivre}%"></i></span>{:else}aparece depois do primeiro pedido{/if}</dd></div>
          {#if d.mes}
            <div><dt>No mês, na conta do FreeLLMAPI</dt><dd>{numero(d.mes.pedidos)} pedidos · {numero(d.mes.tokens)} tokens<small class="uso-sub">Conta tudo que usa a chave do FreeLLMAPI (não só o Gyde). Zera em {dataHora(d.mes.renovaEm)}.</small></dd></div>
            <div><dt>Limite mensal</dt><dd>{comLimite.length ? comLimite.map((k) => `${k.provedor}: ${k.limitePedidos ? `${numero(k.limitePedidos)} pedidos` : `${numero(k.limiteTokens)} tokens`}`).join(' · ') : 'Limite não informado (nenhum definido no FreeLLMAPI)'}</dd></div>
          {/if}
          <div><dt>Créditos e saldo</dt><dd>Saldo não disponibilizado pelo provedor. Os serviços grátis por trás do FreeLLMAPI têm cotas diárias próprias que ele não repassa.</dd></div>
        </dl>
      {/if}
    </section>
    <section class="uso-sec">
      <h3 class="config-sub">Planos do Gyde</h3>
      <p class="config-nota">O Gyde não tem planos, assinatura nem cobrança. Os limites acima são só do provedor de IA.</p>
    </section>
    {#if d.gyde.ultimos.length}
      <section class="uso-sec"><h3 class="config-sub">Últimos pedidos</h3>
        <ul class="uso-ultimos">
          {#each d.gyde.ultimos as r}
            <li class="r-{r.resultado}"><time>{dataHora(r.inicio)}</time>
              <span>{ORIGEM[r.origem] ?? r.origem} · {nomeModelo(r.modelo) || NOME_PROVEDOR[r.provedor ?? ''] || 'sem modelo'}</span>
              <span>{RESULTADO[r.resultado]}{r.tokens_entrada != null ? ` · ${numero(r.tokens_entrada + (r.tokens_saida || 0))} tokens` : ''}{r.chamadas > 1 ? ` · ${r.chamadas} chamadas` : ''}</span></li>
          {/each}
        </ul></section>
    {/if}
    <details class="uso-glossario"><summary>O que significa cada coisa</summary>
      <p><b>Pedido:</b> uma mensagem sua no chat, uma tarefa da Forja ou uma dica da Prática. Conta uma vez só, mesmo que o Gyde tente outro modelo.</p>
      <p><b>Chamada:</b> cada vez que o Gyde fala com o provedor. Trocas de modelo e rodadas da Forja geram várias chamadas num pedido.</p>
      <p><b>Token:</b> pedaço de texto que o modelo lê (entrada) ou escreve (saída). Só aparece quando o provedor informa.</p>
      <p><b>Cota:</b> limite do serviço de IA (por minuto, por dia ou por mês). Quem define é o provedor, não o Gyde.</p>
      <p><b>Créditos:</b> saldo em dinheiro ou unidades. O FreeLLMAPI não tem nem informa saldo.</p>
    </details>
  {/if}
</div>
