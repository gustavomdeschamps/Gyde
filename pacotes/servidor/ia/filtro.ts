// Camada final da resposta, a mesma para todo modelo e estratégia: tira o raciocínio cru (<think>), a introdução vazia e os
// emojis. Funciona em streaming: recebe pedaços e devolve o que já pode ir para a tela.
const ABRE = /<think(?:ing)?>/i;
const FECHA = /<\/think(?:ing)?>/i;
const INTRO = /^\s*(claro|com certeza|certamente|[óo]tima pergunta|boa pergunta|excelente pergunta)\s*[!.,:]+\s*/i;
const PERMITIDOS = new Set(['✓', '✗', '→', '•', '⚠', '★', '©', '®', '™', '↔', '↩', '▶', '◀']);
const EMOJI = /\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*/gu;
const ESPERA_INTRO = 40; // caracteres guardados no começo para reconhecer a introdução

const semEmoji = (t: string) => t.replace(EMOJI, (e) => (PERMITIDOS.has(e[0]!) ? e : '')).replace(/[ \t]{2,}$/gm, ' ');

export function criarFiltro() {
  let bruto = '', dentroThink = false, inicio = true, inicial = '', emCodigo = false;

  const saida = (texto: string): string => {
    if (!texto) return '';
    // emoji dentro de bloco de código é conteúdo pedido: fica como está
    const partes = texto.split('```');
    let r = '';
    partes.forEach((p, i) => {
      if (i > 0) { r += '```'; emCodigo = !emCodigo; }
      r += emCodigo ? p : semEmoji(p);
    });
    return r;
  };

  const emitir = (texto: string, fim: boolean): string => {
    if (!inicio) return saida(texto);
    inicial += texto;
    if (!fim && inicial.length < ESPERA_INTRO) return '';
    inicio = false;
    const pronto = inicial.replace(INTRO, '').replace(/^\s+/, '');
    inicial = '';
    return saida(pronto ? pronto[0]!.toUpperCase() + pronto.slice(1) : '');
  };

  function passar(pedaco: string): string {
    bruto += pedaco;
    let fora = '';
    for (;;) {
      if (dentroThink) {
        const f = FECHA.exec(bruto);
        if (!f) { bruto = bruto.slice(-10); return emitir(fora, false); } // ainda dentro: só guarda o fim, onde a tag pode estar pela metade
        bruto = bruto.slice(f.index + f[0].length);
        dentroThink = false;
        continue;
      }
      const a = ABRE.exec(bruto);
      if (a) {
        fora += bruto.slice(0, a.index);
        bruto = bruto.slice(a.index + a[0].length);
        dentroThink = true;
        continue;
      }
      // segura o que pode ser o começo de uma tag ou de uma cerca de código cortada entre dois pedaços
      const corte = bruto.search(/(<t?h?i?n?k?i?n?g?|`{1,2})$/i);
      if (corte >= 0) { fora += bruto.slice(0, corte); bruto = bruto.slice(corte); } else { fora += bruto; bruto = ''; }
      return emitir(fora, false);
    }
  }

  function terminar(): string {
    const resto = dentroThink ? '' : bruto;
    bruto = '';
    return emitir(resto, true);
  }

  return { passar, terminar };
}

export function limparResposta(texto: string): string {
  const f = criarFiltro();
  return (f.passar(texto) + f.terminar()).trim();
}
