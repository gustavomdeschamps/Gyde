<script lang="ts">
  // Topo do chat: escolha do modelo e o título da conversa aberta.
  import { chat, definirModelo } from './estado.svelte.ts';

  // Só as opções do Gyde. Conversa antiga com um modelo avulso aparece como Gyde 1 (é o que o servidor usa nela).
  const escolhido = $derived(chat.marcas.some((m) => m.id === chat.modelo) ? chat.modelo : (chat.marcas[0]?.id ?? 'gyde-1'));
</script>

<label class="model-picker">
  <span class="sr-only">Modelo</span>
  <select id="model" value={escolhido} title={chat.marcas.find((m) => m.id === escolhido)?.hint ?? ''} onchange={(e) => definirModelo(e.currentTarget.value)}>
    {#each chat.marcas as m (m.id)}<option value={m.id} title={m.hint}>{m.label}</option>{/each}
  </select>
</label>
<span class="topbar-title" id="convTitle">{chat.titulo}</span>
