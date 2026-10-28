<script lang="ts">
  // Cartão das telas de entrada, com a marca. "direcao" anima a troca de passo (avançar ou voltar).
  import type { Snippet } from 'svelte';
  let { direcao = null, children }: { direcao?: 'next' | 'back' | null; children: Snippet } = $props();
</script>

<div class="gate-card {direcao ? `step-${direcao}` : ''}">
  <div class="gate-brand"><img src="/logo.svg" alt="" width="40" height="40"><span>Gyde</span></div>
  {@render children()}
</div>
