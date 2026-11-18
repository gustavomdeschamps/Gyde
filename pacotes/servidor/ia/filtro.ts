// Camada final da resposta, a mesma para todo modelo e estratégia: tira o raciocínio cru (<think>), a introdução vazia e os
// emojis. Funciona em streaming: recebe pedaços e devolve o que já pode ir para a tela.
const ABRE = /<think(?:ing)?>/i;
const FECHA = /<\/think(?:ing)?>/i;
const INTRO = /^\s*(claro|com certeza|certamente|[óo]tima pergunta|boa pergunta|excelente pergunta)\s*[!.,:]+\s*/i;
// fora de bloco de código, só ficam símbolos tipográficos (setas e marcas registradas); ✓, ✗, ★ e ⚠ saem como emoji
const PERMITIDOS = new Set(['→', '•', '©', '®', '™', '↔', '↩']);
const EMOJI = /\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*/gu;
const ESPERA_INTRO = 40; // caracteres guardados no começo para reconhecer a introdução

// símbolos que viram "ícone solto" na tela: não são emoji para o Unicode, mas fazem o mesmo papel
const SIMBOLOS = /[✓✔✗✘★☆◆◇●○■□▲△►▶◀¶◉◎]︎?/gu;
const semEmoji = (t: string) => t.replace(EMOJI, (e) => (PERMITIDOS.has(e[0]!) ? e : '')).replace(SIMBOLOS, '').replace(/[ \t]{2,}$/gm, ' ');

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

// ---------- acabamento (na resposta inteira, no fim) ----------
// Tira o que o guia de estilo proíbe e escapou do modelo, sem mudar conteúdo técnico: código dentro de bloco nunca muda.
const DESCULPA = /^(?:(?:peço|pe[çc]o) desculpas|desculpe(?: pela confus[ãa]o| o erro)?|lamento(?: pelo erro| a confus[ãa]o)?|me desculpe)\b[^.!\n]*[.!]?\s*/i;
const FECHO = /^(?:espero (?:ter ajudado|que (?:isso|isto|essa explica[çc][ãa]o) (?:ajude|tenha ajudado|esclare[çc]a))|se (?:voc[êe] )?(?:tiver|precisar|quiser)[^.\n]{0,40}(?:d[úu]vidas?|ajuda|saber mais)|qualquer d[úu]vida|fico [àa] disposi[çc][ãa]o|bons estudos|boa sorte|bom c[óo]digo|happy coding)\b[^\n]*$/i;

// "Peço desculpas pela confusão." sai inteira; "Desculpe, mas o certo é X" perde só a desculpa (o resto é conteúdo)
function semDesculpa(linha: string): string {
  const m = DESCULPA.exec(linha);
  if (!m) return linha;
  const frase = m[0];
  const virgula = frase.search(/,\s*(mas|por[ée]m|na verdade|o certo|a resposta)\b/i);
  if (virgula >= 0) { const resto = linha.slice(virgula).replace(/^,\s*(mas|por[ée]m)\s*/i, ''); return resto.charAt(0).toUpperCase() + resto.slice(1); }
  return /[:]/.test(frase) || frase.length > 90 ? linha : linha.slice(frase.length);
}

/** Acabamento final da resposta: tira desculpas e fechos vazios, parágrafos repetidos, arruma o Markdown. */
export function acabamento(texto: string): string {
  let t = texto.replace(/\r\n/g, '\n');
  // bloco de código aberto e nunca fechado (resposta cortada): fecha
  if ((t.match(/^```/gm) ?? []).length % 2 === 1) t = `${t.trimEnd()}\n\`\`\``;
  const partes = t.split(/(^```[\s\S]*?^```)/m);
  const prosa = (p: string) => {
    let s = p
      .replace(/^(#{1,6})([^#\s])/gm, '$1 $2') // "##Título" vira "## Título"
      .split('\n').map(semDesculpa).join('\n')
      .replace(/\n{3,}/g, '\n\n');
    // parágrafo igual ao anterior (o modelo repetiu): sai
    const ps = s.split(/\n\n/);
    s = ps.filter((x, i) => i === 0 || x.trim() === '' || x.trim() !== ps[i - 1]!.trim()).join('\n\n');
    return s;
  };
  for (let i = 0; i < partes.length; i += 2) partes[i] = prosa(partes[i]!);
  t = partes.join('');
  // fechos vazios no fim ("Espero ter ajudado", "Se tiver dúvidas..."), fora de bloco de código
  for (let k = 0; k < 3; k++) {
    const linhas = t.trimEnd().split('\n');
    const ultima = linhas.at(-1)?.trim() ?? '';
    if (!ultima || /^```/.test(ultima) || !FECHO.test(ultima.replace(/^[*_]+|[*_]+$/g, ''))) break;
    linhas.pop();
    t = linhas.join('\n');
  }
  return t.trim();
}

export function limparResposta(texto: string): string {
  const f = criarFiltro();
  return (f.passar(texto) + f.terminar()).trim();
}
