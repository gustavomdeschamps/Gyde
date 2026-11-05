// Núcleo da decisão, parte 1: entende o tipo de pedido sem chamar IA nenhuma (rápido, grátis, previsível e testável).
// São regras simples sobre o texto. Errar aqui custa pouco: só muda qual modelo é tentado primeiro e o complemento das instruções.
export type Tarefa = 'conversa' | 'objetiva' | 'raciocinio' | 'codigo' | 'sql' | 'frontend' | 'backend' | 'escrita' | 'analise' | 'etapas' | 'visao';
export interface Classificacao { tarefa: Tarefa; complexidade: 1 | 2 | 3; importante: boolean; incerta: boolean; motivos: string[] }

const SQL = /\b(sql|select\s.+\sfrom|join|group by|postgres|mysql|sqlite|consulta no banco|tabelas?\b.*\b(banco|colunas?)|chave estrangeira)\b/i;
const FRONT = /\b(html|css|react|svelte|vue|angular|tailwind|flexbox|dom\b|bot[ãa]o|tela|layout|responsiv|front-?end|interface)\b/i;
const BACK = /\b(api|rota|endpoint|express|fastapi|flask|django|spring|node\.?js|servidor|back-?end|middleware|autentica[çc][ãa]o|jwt|docker|webhook)\b/i;
// sinais fortes: o pedido é sobre código mesmo. "código", "erro" e "bug" sozinhos não bastam ("código de status", "erro de português")
const CODIGO_FORTE = /```|\b(fun[çc][ãa]o|traceback|stack trace|python|javascript|typescript|java|c\+\+|c#|php|kotlin|rust|golang|programa|script|algoritmo|compil\w*|vari[áa]ve(l|is)|loop|la[çc]o|classe|refator\w*|git|npm|pip|\w+Error|\w+Exception)(?![\p{L}\p{N}_])/iu;
const CODIGO_FRACO = /\b(c[óo]digo|bug|erro|exce[çc][ãa]o)\b/i;
const PEDE_TEXTO = /\b(escrev[aeo]|redija|crie|fa[çc]a|elabore|reescreva) (um|uma|o|a|meu|minha)? ?(poema|conto|hist[óo]ria|texto|reda[çc][ãa]o|carta|e-?mail|post|artigo|legenda|slogan|mensagem)\b/i;
const ESCRITA = /\b(poema|conto|hist[óo]ria|reda[çc][ãa]o|carta|e-?mail|legenda|slogan|mensagem para|reescreva|resuma em tom)\b/i;
const ANALISE = /\b(analis[ea]|an[áa]lise|compare|interprete|com base (n[oa]|nesse|neste|s[óo])|resum[ae]|logs?\b|o que (esse|este) (documento|texto|log|relat[óo]rio))\b/i;
const RACIOCINIO = /\b(quantos?|quantas?|calcule|prove|demonstre|l[óo]gica|probabilidade|equa[çc][ãa]o|m[úu]ltiplos?|vem antes|qual [ée] a ordem|por que .{20,}|qual (a|[ée] a) (melhor|diferen[çc]a))\b/i;
const CONVERSA = /^(oi|ol[áa]|e a[íi]|opa|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|tudo bem|beleza|tchau|kk+|haha|ok\b|show)/i;
const PERGUNTA = /\?\s*$|^(o que|qual|quem|quando|onde|como|quanto)\b/i;
const IMPORTANTE = /\b(importante|cr[íi]tico|produ[çc][ãa]o|n[ãa]o pode (falhar|errar|ter erro)|revise com cuidado|com muito cuidado|tenha certeza|prova amanh[ãa]|entrega final|dinheiro|pagamento|seguran[çc]a)\b/i;
const INCERTA = /\b(tem certeza|qual est[áa] certo|n[ãa]o sei qual|depende|vale a pena|melhor op[çc][ãa]o|devo usar|qual escolher|compara[çc][ãa]o)\b/i;
const ETAPAS = /(^|\s)1[.)]\s.+(\s|;)2[.)]\s|(^|\n)\s*primeiro[,:].+\b(depois|segundo)[,:]|\bsiga exatamente\b/is;
const SISTEMA = /\b(sistema|aplica[çc][ãa]o|aplicativo|plataforma|arquitetura|do zero|completo|m[óo]dulos?|microsservi[çc]os?)\b/i;

export function classificar(texto: string, { comImagem = false, comArquivo = false, tamanhoAnexos = 0 } = {}): Classificacao {
  const t = texto.trim();
  const palavras = t ? t.split(/\s+/).length : 0;
  const motivos: string[] = [];
  const marca = (m: string) => { motivos.push(m); return true; };
  const forte = CODIGO_FORTE.test(t);
  const software = forte || CODIGO_FRACO.test(t);
  const material = palavras > 300 && !t.includes('```'); // texto colado grande, sem ser código

  let tarefa: Tarefa;
  if (comImagem) { tarefa = 'visao'; marca('tem imagem'); }
  else if (ETAPAS.test(t) && marca('pedido em etapas')) tarefa = 'etapas';
  else if (material && marca('analisa material colado')) tarefa = 'analise';
  else if (CONVERSA.test(t) && palavras <= 25 && !forte && marca('conversa')) tarefa = 'conversa';
  else if (SQL.test(t) && marca('fala de SQL')) tarefa = 'sql';
  else if (PEDE_TEXTO.test(t) && !t.includes('```') && marca('pede um texto')) tarefa = 'escrita';
  else if (ESCRITA.test(t) && !software && !t.includes('```') && marca('pede um texto')) tarefa = 'escrita';
  else if (RACIOCINIO.test(t) && !forte && marca('pede raciocínio')) tarefa = 'raciocinio';
  else if (palavras <= 25 && PERGUNTA.test(t) && !forte && !BACK.test(t) && !FRONT.test(t) && marca('pergunta curta')) tarefa = 'objetiva';
  else if (FRONT.test(t) && (software || /\b(crie|fa[çc]a|como|arrume|centraliz)/i.test(t)) && marca('fala de interface')) tarefa = 'frontend';
  else if (BACK.test(t) && marca('fala de servidor')) tarefa = 'backend';
  else if (software && marca('fala de código')) tarefa = 'codigo';
  else if ((comArquivo || tamanhoAnexos > 2000 || ANALISE.test(t)) && marca('analisa material')) tarefa = 'analise';
  else tarefa = palavras <= 12 ? 'conversa' : 'analise';

  // complexidade: tamanho do pedido e do material, e quantos sistemas ou requisitos ele envolve
  const requisitos = (t.match(/(^|\n)\s*([-*•]|\d+[.)])\s/g) || []).length;
  const pedeSistema = SISTEMA.test(t) && /\b(crie|construa|desenvolva|projete|implemente|fa[çc]a)\b/i.test(t);
  let complexidade: 1 | 2 | 3 = 1;
  if (palavras > 40 || requisitos >= 2 || tamanhoAnexos > 4000 || tarefa === 'raciocinio' || tarefa === 'etapas') complexidade = 2;
  if (palavras > 150 || requisitos >= 5 || tamanhoAnexos > 30_000 || pedeSistema) complexidade = 3;
  if (tarefa === 'conversa') complexidade = 1;
  if (pedeSistema) marca('pede um sistema inteiro');

  const importante = IMPORTANTE.test(t);
  if (importante) marca('a pessoa disse que é importante');
  const incerta = INCERTA.test(t);
  if (incerta) marca('pergunta com decisão ou dúvida');
  return { tarefa, complexidade, importante, incerta, motivos };
}
