<script lang="ts">
  // Diagnóstico: roda as conferências do servidor (banco, pasta de dados, espaço, IA respondendo de verdade, Python e
  // git) e mostra o estado de cada uma com o que fazer. Nada sai do computador além do pedido mínimo de teste à IA.
  import * as C from '$contratos';
  import { pedir, mensagemDe } from '../api.ts';
  import { icone as svgIcone } from '../icones.ts';

  let rodando = $state(false);
  let erro = $state<string | null>(null);
  let itens = $state<C.TItemVerificacao[] | null>(null);
  const ICONE = { ok: 'circle-check', aviso: 'triangle-alert', erro: 'circle-x' } as const;
  const ROTULO = { ok: 'Certo', aviso: 'Atenção', erro: 'Problema' } as const;

  async function rodar() {
    rodando = true; erro = null;
    try { itens = (await pedir('/api/diagnostico/verificar', C.Verificacoes)).itens; } catch (e) { erro = mensagemDe(e); }
    rodando = false;
  }
  const problemas = $derived(itens?.filter((i) => i.estado !== 'ok').length ?? 0);
</script>

<div class="config-linha">
  <div><b>Diagnóstico</b><small>Confere o banco, a pasta de dados, o espaço livre, se a IA responde de verdade (um pedido mínimo), o Python e o git, e diz o que fazer em cada caso.</small></div>
  <button type="button" class="btn ghost" id="rodarDiagnostico" disabled={rodando} onclick={rodar}>{rodando ? 'Conferindo…' : itens ? 'Conferir de novo' : 'Rodar diagnóstico'}</button>
</div>
{#if erro}<p class="msg-error" role="alert">{erro}</p>{/if}
{#if itens}
  <div class="diagnostico" role="status">
    <p class="diagnostico-resumo">{problemas ? `${problemas} ${problemas === 1 ? 'item pede' : 'itens pedem'} atenção.` : 'Tudo certo.'}</p>
    <ul>
      {#each itens as i (i.id)}
        <li class={i.estado}>
          <span class="diag-ic">{@html svgIcone(ICONE[i.estado], ROTULO[i.estado])}</span>
          <div><b>{i.nome}</b><span>{i.detalhe}</span>{#if i.acao}<small>{i.acao}</small>{/if}</div>
        </li>
      {/each}
    </ul>
  </div>
{/if}
