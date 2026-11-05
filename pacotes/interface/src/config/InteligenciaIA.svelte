<script lang="ts">
  // Configurações > IA e modelos: como o Gyde decide responder. Tudo opcional; o padrão é o automático equilibrado.
  // Os números vêm das avaliações e do uso neste computador; "não medido" não é nota baixa.
  import * as C from '$contratos';
  import type { TModelosIA, TPreferenciasIA } from '$contratos';
  import { pedir, enviar, corpo, mensagemDe } from '../api.ts';

  let { toast, pessoal }: { toast: (t: string) => void; pessoal: boolean } = $props();
  let prefs = $state<TPreferenciasIA | null>(null);
  let dados = $state<TModelosIA | null>(null);
  let aberto = $state(false);
  let erro = $state('');

  const MODOS: { id: TPreferenciasIA['modo']; nome: string; texto: string }[] = [
    { id: 'rapido', nome: 'Rápido', texto: 'Um modelo por resposta. A Forja não pede revisão.' },
    { id: 'equilibrado', nome: 'Equilibrado', texto: 'Um modelo por resposta; um segundo confere o que você disser que é importante e o que a Forja mudar.' },
    { id: 'capricho', nome: 'Capricho', texto: 'Um segundo modelo confere código, contas e dúvidas. Mais lento e gasta mais da sua cota.' },
  ];
  const NOME_ESTRATEGIA: Record<string, string> = { direta: 'Um modelo', revisada: 'Com revisão', comparada: 'Dois modelos comparados', especialistas: 'Análise, escrita e revisão' };
  const descricao = $derived(MODOS.find((m) => m.id === prefs?.modo)?.texto ?? '');
  const ordenados = $derived([...(dados?.modelos ?? [])].sort((a, b) => b.acertos / (b.respondidas || 1) - a.acertos / (a.respondidas || 1) || a.id.localeCompare(b.id)));

  pedir('/api/ia/preferencias', C.PreferenciasIA).then((p) => { prefs = p; }).catch((e) => { erro = mensagemDe(e); });

  async function salvar(mudanca: Partial<TPreferenciasIA>) {
    try { prefs = C.PreferenciasIA.parse(await enviar('/api/ia/preferencias', { method: 'PUT', body: corpo(mudanca).body })); } catch (e) { toast(mensagemDe(e)); }
  }
  async function abrir(e: Event) {
    aberto = (e.currentTarget as HTMLDetailsElement).open;
    if (aberto && !dados) { try { dados = await pedir('/api/ia/modelos', C.ModelosIA); } catch (err) { erro = mensagemDe(err); } }
  }
  const alternar = (id: string, ligado: boolean) => salvar({ desligados: ligado ? (prefs?.desligados ?? []).filter((m) => m !== id) : [...(prefs?.desligados ?? []), id] });
  const mil = (n: number | null) => (n == null ? 'não informado' : `${Math.round(n / 1000)} mil tokens`);
  const pct = (a: number, t: number) => (t ? `${a} de ${t}` : 'não medido');
</script>

{#if erro}<p class="msg-error">{erro}</p>{/if}
{#if prefs}
  <div class="config-linha">
    <div><b>Como responder</b><small>{descricao}</small></div>
    <select aria-label="Como responder" value={prefs.modo} onchange={(e) => salvar({ modo: (e.currentTarget as HTMLSelectElement).value as TPreferenciasIA['modo'] })}>
      {#each MODOS as m (m.id)}<option value={m.id}>{m.nome}</option>{/each}
    </select>
  </div>
  <div class="config-linha">
    <div><b>Usar especialistas em projetos grandes</b><small>No modo Capricho, quando você pede um sistema inteiro: um modelo analisa, outro escreve e outro confere.</small></div>
    <label class="switch"><input type="checkbox" aria-label="Usar especialistas" checked={prefs.especialistas} onchange={(e) => salvar({ especialistas: (e.currentTarget as HTMLInputElement).checked })}><span></span></label>
  </div>
  <details class="ia-detalhes" ontoggle={abrir}>
    <summary>Como o Gyde funciona</summary>
    <p class="config-nota">O Gyde lê o seu pedido, escolhe o modelo que foi melhor naquele tipo de tarefa nas avaliações e troca sozinho se ele falhar ou estiver no limite. Todos recebem as mesmas instruções e a mesma memória. Modelos gratuitos têm limites definidos por cada provedor: grátis não quer dizer ilimitado.</p>
    {#if dados}
      {#if dados.aviso}<p class="msg-error">{dados.aviso}</p>{/if}
      {#if dados.estrategias.length}
        <p class="config-nota"><b>Nas suas conversas:</b> {dados.estrategias.map((e) => `${NOME_ESTRATEGIA[e.estrategia] ?? e.estrategia}: ${e.pedidos}${e.mudou ? ` (${e.mudou} corrigidas)` : ''}`).join(' · ')}</p>
      {/if}
      <p class="config-nota">{dados.medidoEm ? `Acertos medidos em ${new Date(dados.medidoEm).toLocaleDateString('pt-BR')}, com poucas tentativas: servem para comparar, não são um ranking geral. Quem atende por trás de um nome pode mudar.` : 'Ainda sem medições.'}</p>
      <div class="ia-tabela-rolagem">
        <table class="ia-tabela">
          <thead><tr>{#if pessoal}<th>Ligado</th>{/if}<th>Modelo</th><th>Acertos</th><th>Contexto</th><th>Imagens</th><th>Agora</th></tr></thead>
          <tbody>
            {#each ordenados as m (m.id)}
              <tr>
                {#if pessoal}<td><input type="checkbox" aria-label="Usar {m.id}" checked={!prefs.desligados.includes(m.id)} onchange={(e) => alternar(m.id, (e.currentTarget as HTMLInputElement).checked)}></td>{/if}
                <td><code>{m.id}</code></td>
                <td>{pct(m.acertos, m.respondidas)}{#if m.limites}<small> ({m.limites} no limite)</small>{/if}</td>
                <td>{mil(m.contexto)}</td>
                <td>{m.visao === null ? 'não medido' : m.visao ? 'sim' : 'não'}</td>
                <td>{m.descansando ? 'descansando' : m.observado ? `${Math.round(m.observado.taxaOk * 100)}% ok` : 'sem uso ainda'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else if aberto}<p class="config-nota">Carregando…</p>{/if}
  </details>
{/if}
