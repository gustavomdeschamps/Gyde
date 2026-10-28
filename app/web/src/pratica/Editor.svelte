<script lang="ts">
  // Editor de código com cores (highlight.js por baixo de uma textarea), números de linha e indentação automática.
  import hljs from '@highlightjs/cdn-assets/es/highlight.min.js';

  let { valor = $bindable(''), lang }: { valor: string; lang: string } = $props();

  let area: HTMLDivElement | undefined = $state();
  let campo: HTMLTextAreaElement | undefined = $state();
  const indent = $derived(lang === 'python' ? '    ' : '  ');
  const colorido = $derived(hljs.highlight(valor + (valor.endsWith('\n') ? ' ' : ''), { language: lang, ignoreIllegals: true }).value);
  const numeros = $derived(Array.from({ length: valor.split('\n').length }, (_, i) => i + 1).join('\n'));

  // a textarea cresce junto com o conteúdo; quem rola é o .editor
  $effect(() => {
    void valor;
    if (!campo || !area) return;
    campo.style.height = 'auto'; campo.style.height = `${Math.max(campo.scrollHeight, area.clientHeight)}px`;
    campo.style.width = 'auto'; campo.style.width = `${Math.max(campo.scrollWidth, area.clientWidth)}px`;
  });

  function tecla(e: KeyboardEvent) {
    const ta = e.currentTarget as HTMLTextAreaElement;
    const { selectionStart: s, selectionEnd: fim, value } = ta;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const inicioLinha = value.lastIndexOf('\n', s - 1) + 1;
        if (value.startsWith(indent, inicioLinha)) ta.setRangeText('', inicioLinha, inicioLinha + indent.length, 'preserve');
      } else ta.setRangeText(indent, s, fim, 'end');
      valor = ta.value;
    } else if (e.key === 'Enter' && !e.ctrlKey) {
      // mantém a indentação da linha anterior (e aumenta depois de ":" ou "{")
      e.preventDefault();
      const inicioLinha = value.lastIndexOf('\n', s - 1) + 1;
      const linha = value.slice(inicioLinha, s);
      let espaco = linha.match(/^\s*/)?.[0] ?? '';
      if (/[:{[(]\s*$/.test(linha)) espaco += indent;
      ta.setRangeText('\n' + espaco, s, fim, 'end');
      valor = ta.value;
    }
  }
  export function focar() { campo?.focus(); }
</script>

<div class="editor">
  <div class="gutter" aria-hidden="true">{numeros}</div>
  <div class="area" bind:this={area}>
    <pre aria-hidden="true"><code class="hljs">{@html colorido}</code></pre>
    <textarea bind:this={campo} bind:value={valor} spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Editor de código" onkeydown={tecla}></textarea>
  </div>
</div>
