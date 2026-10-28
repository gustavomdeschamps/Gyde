<script lang="ts">
  // Indicador do rodapé do chat: qual IA está ativa e quantos pedidos sobram no minuto. Abre "Uso e limites".
  import { uso } from './uso.svelte.ts';
  let { onabrir }: { onabrir: () => void } = $props();
  const d = $derived(uso.dados);
  const texto = $derived(!d ? (uso.erro ? 'IA indisponível' : 'IA') : d.ativo === 'offline' ? `Offline · ${d.offline.modelo}` : d.limiteRoteador ? `Online · ${d.limiteRoteador.restante}/${d.limiteRoteador.total} por min` : 'Online');
</script>

<button type="button" class="uso-chip" id="usoChip" aria-haspopup="dialog" title="Uso e limites da IA" data-estado={!d ? 'erro' : d.ativo} onclick={onabrir}>
  <i class="uso-ponto" aria-hidden="true"></i><span>{texto}</span>
</button>
