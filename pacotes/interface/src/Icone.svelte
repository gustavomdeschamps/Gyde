<script lang="ts">
  // Ícone do conjunto do Gyde. Sem "rotulo" é decorativo (escondido do leitor de tela); com "rotulo" tem nome acessível.
  import { icone } from './icones.ts';
  let { nome, rotulo, classe = '' }: { nome: string; rotulo?: string; classe?: string } = $props();
</script>

{@html icone(nome, rotulo, classe)}
