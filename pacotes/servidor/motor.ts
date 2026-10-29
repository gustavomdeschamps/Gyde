// Motor do Gyde: cada modo usa uma cadeia dos melhores modelos do FreeLLMAPI para programar.
// Atenção: os nomes são apelidos do FreeLLMAPI; quem responde de fato vem no cabeçalho x-routed-via
// (ex.: "claude-sonnet-4-5" foi atendido pelo Qwen 3.8 via Groq nos testes). A tela mostra o modelo real.
// No modo offline (provedores.ts) todo nome de modelo vira o modelo local do Ollama.
// Se um modelo falhar (fora do ar, cota, resposta inválida), o próximo assume sem o usuário ver erro.
// Toda cadeia termina em 'auto' para funcionar com qualquer conjunto de chaves que a pessoa tiver no FreeLLMAPI.

import type { Router, Registro, MensagemIA } from './tipos.ts';
import { comoErro } from './tipos.ts';

// Ordem medida com ferramentas/avaliar-modelos.mjs (resultados em docs/avaliacao/): qwen3.8-27b e gpt-oss-120b acertaram
// código, correção de bug, explicação sem entregar a resposta e o formato da Forja, em menos de 1 s; os slots
// "claude-*" foram roteados para um modelo que errou código e o formato JSON e levou 13 a 15 s, então ficam de reserva
// no chat. Na Forja os pedidos são grandes (estrutura do projeto, arquivos, histórico): os modelos que passam pelo Groq
// (qwen3.8-27b, gpt-oss-120b) recusam esse tamanho (413/429) e a avaliação da Forja mostrou a ordem original melhor.
export const CADEIAS: Record<string, string[]> = {
  'gyde-1': ['qwen3.8-27b', 'gpt-oss-120b', 'codestral', 'claude-sonnet-4-5', 'auto'],
  'gyde-1-pro': ['gpt-oss-120b', 'qwen3.8-27b', 'fusion', 'claude-opus-4-5', 'auto'],
  agente: ['claude-sonnet-4-5', 'claude-opus-4-5', 'codestral', 'mistral-code', 'qwen3.8-27b', 'gpt-oss-120b', 'auto'],
  util: [process.env.UTIL_MODEL || 'mistral-code', 'qwen3.8-27b', 'auto'],
  // com imagens: só modelos que enxergam (o FreeLLMAPI recusa os que não têm visão e o 'auto' escolhe um que tenha)
  visao: ['qwen3.8-27b', 'gemini-3.8-flash', 'auto'],
};

// Modelos que o usuário escolhe pelo nome direto continuam funcionando (cadeia de um modelo + automático).
export const cadeiaDe = (id: string): string[] => CADEIAS[id] || [id, 'auto'];

// Chamada sem streaming com troca automática de modelo. Devolve { texto, modelo }.
// `valida(texto)` pode recusar a resposta (ex.: JSON inválido) para tentar o próximo modelo.
export interface PedidoCompletar {
  cadeia: string[]; messages: MensagemIA[]; max_tokens?: number; temperature?: number;
  signal?: AbortSignal; valida?: (texto: string) => boolean; registro?: Registro | undefined;
}
export async function completar(router: Router, { cadeia, messages, max_tokens = 1500, temperature = 0.2, signal, valida, registro }: PedidoCompletar): Promise<{ texto: string; modelo: string }> {
  let ultimoErro = new Error('Nenhum modelo respondeu.');
  for (const model of cadeia) {
    try {
      const r = await router('/v1/chat/completions', { method: 'POST', signal: signal ?? null, registro, body: JSON.stringify({ model, messages, max_tokens, temperature }) });
      const j = await r.json() as { usage?: import('./tipos.ts').UsoInformado; choices?: { message?: { content?: string } }[] };
      registro?.tokens(j.usage);
      const texto = j.choices?.[0]?.message?.content || '';
      if (!texto.trim()) throw new Error(`${model} respondeu vazio`);
      if (valida && !valida(texto)) throw new Error(`${model} respondeu num formato inválido`);
      return { texto, modelo: r.headers.get('x-routed-via') || model };
    } catch (e) {
      const err = comoErro(e);
      if (err.name === 'AbortError' || err.final || err.status === 429) throw err; // offline ou limite: outro modelo não resolve
      ultimoErro = err;
    }
  }
  throw ultimoErro;
}

// Extrai o último objeto JSON de um texto (aceita ```json, texto em volta e vírgula sobrando).
export function extrairJson(texto: unknown): Record<string, unknown> | null {
  const limpo = String(texto); // cercas ``` fora do objeto não atrapalham; dentro dos textos precisam ficar
  let achado: Record<string, unknown> | null = null, prof = 0, ini = -1, dentroStr = false, esc = false;
  for (let i = 0; i < limpo.length; i++) { // percorre os objetos de nível mais alto e guarda o último que for JSON válido
    const c = limpo[i];
    if (dentroStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') dentroStr = false; continue; }
    if (c === '"' && prof > 0) dentroStr = true;
    else if (c === '{') { if (prof === 0) ini = i; prof++; }
    else if (c === '}' && prof > 0 && --prof === 0) {
      const trecho = limpo.slice(ini, i + 1);
      try { achado = JSON.parse(trecho); } catch { try { achado = JSON.parse(trecho.replace(/,\s*([}\]])/g, '$1')); } catch { /* ignora */ } }
    }
  }
  return achado;
}
