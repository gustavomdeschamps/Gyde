<script lang="ts">
  // Topo do chat: escolha do modelo e o título da conversa aberta.
  import { chat, definirModelo, rotuloModelo } from './estado.svelte.ts';

  const todos = $derived([...chat.marcas, ...chat.modelos]);
  // conversas antigas podem usar um modelo que saiu da lista
  const foraDaLista = $derived(todos.some((m) => m.id === chat.modelo) ? null : chat.modelo);
</script>

<label class="model-picker">
  <span class="sr-only">Modelo</span>
  <select id="model" value={chat.modelo} title={todos.find((m) => m.id === chat.modelo)?.hint ?? ''} onchange={(e) => definirModelo(e.currentTarget.value)}>
    <optgroup label="Gyde">{#each chat.marcas as m (m.id)}<option value={m.id} title={m.hint}>{m.label}</option>{/each}</optgroup>
    {#if chat.modelos.length}
      <optgroup label="Melhores para programar">{#each chat.modelos as m (m.id)}<option value={m.id} title={m.hint}>{m.label}</option>{/each}</optgroup>
    {/if}
    {#if foraDaLista}<option value={foraDaLista}>{rotuloModelo(foraDaLista)}</option>{/if}
  </select>
</label>
<span class="topbar-title" id="convTitle">{chat.titulo}</span>
