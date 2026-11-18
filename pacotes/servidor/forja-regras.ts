// Regras da Forja que valem mesmo que o modelo tente outra coisa, separadas para dar para testar sem IA:
//  - argumentos das ferramentas conferidos antes de rodar (com um exemplo do jeito certo);
//  - quebra de laço: a mesma ação falhando de novo e de novo vira um aviso e, se continuar, a tarefa para com honestidade;
//  - resumo conferido pelo Gyde: o que mudou e se foi verificado vem do que aconteceu de verdade, não do texto do modelo.

const EXEMPLOS: Record<string, string> = {
  listar: '{"caminho": ".", "profundidade": 2}',
  ler: '{"caminho": "src/app.js", "inicio": 1, "fim": 200}',
  buscar: '{"texto": "function login", "caminho": "."}',
  escrever: '{"caminho": "src/novo.js", "conteudo": "..."}',
  editar: '{"caminho": "src/app.js", "procurar": "trecho exato atual", "substituir": "trecho novo"}',
  apagar: '{"caminho": "src/velho.js"}',
  executar: '{"comando": "npm test"}',
  desfazer: '{}',
};

const texto = (v: unknown) => typeof v === 'string';
const cheio = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const inteiro = (v: unknown) => v === undefined || (Number.isInteger(Number(v)) && Number(v) >= 1);

/** Confere os argumentos de uma ação. Devolve o problema (para o modelo corrigir) ou null se estão certos. */
export function problemaNosArgs(ferramenta: string, args: unknown): string | null {
  if (!(ferramenta in EXEMPLOS)) return `A ferramenta "${ferramenta}" não existe. Use uma destas: ${Object.keys(EXEMPLOS).join(', ')}.`;
  if (args !== undefined && (args === null || typeof args !== 'object' || Array.isArray(args))) return `Os argumentos de "${ferramenta}" precisam ser um objeto JSON. Exemplo: ${EXEMPLOS[ferramenta]}`;
  const a = (args ?? {}) as Record<string, unknown>;
  const faltas: string[] = [];
  const exige = (campo: string, ok: (v: unknown) => boolean, como: string) => { if (!ok(a[campo])) faltas.push(`"${campo}" ${como}`); };
  const opcional = (campo: string, ok: (v: unknown) => boolean, como: string) => { if (a[campo] !== undefined && !ok(a[campo])) faltas.push(`"${campo}" ${como}`); };
  switch (ferramenta) {
    case 'listar': opcional('caminho', texto, 'precisa ser texto'); opcional('profundidade', (v) => Number(v) >= 1 && Number(v) <= 5, 'vai de 1 a 5'); break;
    case 'ler': exige('caminho', cheio, 'é obrigatório (caminho do arquivo)'); opcional('inicio', inteiro, 'é um número de linha a partir de 1'); opcional('fim', inteiro, 'é um número de linha a partir de 1'); break;
    case 'buscar': exige('texto', cheio, 'é obrigatório (o que procurar)'); opcional('caminho', texto, 'precisa ser texto'); break;
    case 'escrever': exige('caminho', cheio, 'é obrigatório'); exige('conteudo', texto, 'é obrigatório (o arquivo inteiro, como texto)'); break;
    case 'editar': exige('caminho', cheio, 'é obrigatório'); exige('procurar', cheio, 'é obrigatório (o trecho exato que existe hoje no arquivo)'); opcional('substituir', texto, 'precisa ser texto (pode ser vazio para apagar o trecho)'); break;
    case 'apagar': exige('caminho', cheio, 'é obrigatório'); break;
    case 'executar': exige('comando', cheio, 'é obrigatório'); opcional('comando', (v) => String(v).length <= 2000, 'é longo demais'); break;
  }
  return faltas.length ? `Argumentos inválidos para "${ferramenta}": ${faltas.join('; ')}. Exemplo: ${EXEMPLOS[ferramenta]}` : null;
}

/** Arquivos citados no pedido com @ (ex.: "corrija @src/app.js"). No máximo 5, sem repetir. */
export function mencoesDoPedido(pedido: string): string[] {
  const achados = [...pedido.matchAll(/(?:^|[\s(,])@([\w][\w./\\-]*\.[\w]+|[\w][\w./\\-]*\/)/g)].map((m) => m[1]!.replaceAll('\\', '/').replace(/[.,;:]+$/, ''));
  return [...new Set(achados)].slice(0, 5);
}

/** Assinatura de uma ação (mesma ferramenta com os mesmos argumentos = mesma tentativa). */
export function assinatura(ferramenta: string, args: unknown): string {
  const ordenado = (v: unknown): unknown => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenado((v as Record<string, unknown>)[k])])) : v);
  return `${ferramenta}:${JSON.stringify(ordenado(args ?? {}))}`;
}

/**
 * Quebra de laço. Conta as falhas de cada tentativa idêntica e as rodadas seguidas sem nada novo.
 * - a mesma ação falhou antes: o resultado leva um aviso para mudar de abordagem;
 * - REPETIDAS rodadas seguidas só com ações repetidas que falham (ou leituras idênticas sem mudança no meio): parar.
 * Uma mudança de arquivo zera as leituras (ler de novo depois de editar é normal).
 */
export const LIMITE_REPETICAO = 3;
export function criarDetectorDeLaco() {
  const falhas = new Map<string, number>();
  const leituras = new Map<string, number>();
  let rodadasPresas = 0;
  let ultimo = '';
  return {
    /** Registra o resultado de uma ação. Devolve um aviso para juntar ao resultado (ou null). */
    registrar(ferramenta: string, args: unknown, ok: boolean, mudou: boolean): string | null {
      const a = assinatura(ferramenta, args);
      if (mudou) leituras.clear();
      if (!ok) {
        const n = (falhas.get(a) ?? 0) + 1;
        falhas.set(a, n);
        if (n >= 2) { ultimo = `${ferramenta} ${resumoArgs(args)}`; return `ATENÇÃO: você já tentou exatamente esta ação ${n} vezes e ela falhou em todas. Não repita: leia o erro, confira o arquivo ou o comando e tente outro caminho. Se não houver como, responda explicando o que bloqueou.`; }
        return null;
      }
      if (['ler', 'listar', 'buscar'].includes(ferramenta)) {
        const n = (leituras.get(a) ?? 0) + 1;
        leituras.set(a, n);
        if (n >= 3) { ultimo = `${ferramenta} ${resumoArgs(args)}`; return `ATENÇÃO: você já fez esta mesma leitura ${n} vezes sem mudar nada no meio. O conteúdo é o mesmo; siga com o trabalho ou responda.`; }
      }
      return null;
    },
    /** Fim da rodada: novo = houve alguma ação que não é repetição presa. Devolve true quando é hora de parar. */
    fimDaRodada(teveAvanco: boolean): boolean {
      rodadasPresas = teveAvanco ? 0 : rodadasPresas + 1;
      return rodadasPresas >= LIMITE_REPETICAO;
    },
    /** A ação que estava se repetindo (para a mensagem final). */
    get repetida() { return ultimo; },
    /** Esta ação seria uma repetição presa? (falhou 2+ vezes ou é leitura idêntica 3+ vezes) */
    presa(ferramenta: string, args: unknown, ok: boolean): boolean {
      const a = assinatura(ferramenta, args);
      return ok ? (leituras.get(a) ?? 0) >= 3 : (falhas.get(a) ?? 0) >= 2;
    },
  };
}
function resumoArgs(args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  return String(a.caminho ?? a.comando ?? a.texto ?? '').slice(0, 120);
}

export interface Mudancas { criados: string[]; modificados: string[]; apagados: string[]; comandos: { comando: string; ok: boolean; codigo: number | null }[] }
export interface Verificacao { estado: 'verificado' | 'falhou' | 'nao-verificado' | 'sem-mudanca'; texto: string }

/**
 * O que o Gyde pode afirmar sobre a tarefa, pelo que aconteceu (não pelo que o modelo escreveu).
 * comandosDepois: comandos rodados depois da última mudança de arquivo (na ordem).
 */
export function verificacaoDaTarefa(m: Mudancas, comandosDepois: { comando: string; ok: boolean }[]): Verificacao {
  const mudou = m.criados.length + m.modificados.length + m.apagados.length > 0;
  if (!mudou) return { estado: 'sem-mudanca', texto: m.comandos.length ? `Nenhum arquivo mudou. Comandos rodados: ${m.comandos.length}.` : 'Nenhum arquivo mudou.' };
  const ultimo = comandosDepois.at(-1);
  if (!ultimo) return { estado: 'nao-verificado', texto: 'Não verificado: nenhum comando (teste, build ou lint) rodou depois da última mudança.' };
  if (!ultimo.ok) return { estado: 'falhou', texto: `Verificação falhou: \`${ultimo.comando}\` deu erro depois da última mudança.` };
  return { estado: 'verificado', texto: `Verificado: \`${ultimo.comando}\` rodou sem erro depois da última mudança.` };
}

// frases em que o modelo afirma que testou ou que passou
const AFIRMA_TESTES = /\b(todos os testes (passaram|passam|est[ãa]o passando)|(os )?testes? (passaram|passou|passando|verdes?)|tudo (passou|funcionando|funciona)|build (passou|ok)|rodei (os )?testes)\b/i;
const AFIRMA_NADA = /\b(n[ãa]o (alterei|mudei|modifiquei) (nenhum|nada)|nenhum arquivo (foi )?(alterado|modificado))\b/i;

/** Afirmações da resposta que não batem com o que aconteceu. Cada item vira um aviso visível embaixo da resposta. */
export function afirmacoesSemBase(resposta: string, m: Mudancas, v: Verificacao): string[] {
  const avisos: string[] = [];
  if (AFIRMA_TESTES.test(resposta) && v.estado !== 'verificado' && !(v.estado === 'sem-mudanca' && m.comandos.some((c) => c.ok))) {
    avisos.push(m.comandos.length ? 'A resposta diz que os testes passaram, mas o último comando depois das mudanças não passou (veja os comandos acima).' : 'A resposta diz que testou, mas nenhum comando rodou nesta tarefa.');
  }
  const mudou = m.criados.length + m.modificados.length + m.apagados.length > 0;
  if (AFIRMA_NADA.test(resposta) && mudou) avisos.push('A resposta diz que nada mudou, mas arquivos foram alterados (veja a lista acima).');
  return avisos;
}
