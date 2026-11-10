// Adaptadores de provedor: tudo o que muda de um provedor para outro fica aqui (endereço, autenticação, parâmetros aceitos e
// como ler os erros). O orquestrador e o resto do Gyde só falam o formato da API da OpenAI e não sabem quem está do outro lado.
// Para ligar um provedor novo, basta o arquivo modelos-extras.json na pasta de dados (veja lerExtras); a chave fica no .env.
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

export type TipoErroIA = 'limite' | 'tamanho' | 'chave' | 'indisponivel' | 'outro';
export interface CorpoChat { model?: string; stream?: boolean; stream_options?: unknown; [campo: string]: unknown }

export interface Adaptador {
  id: string;
  url(caminho: string): string;
  cabecalhos(): Record<string, string>;
  corpo(j: CorpoChat): CorpoChat;
  mensagemErro(status: number, detalhe: string): string;
  temChave(): boolean;
}

export function tipoDoErro(status: number): TipoErroIA {
  if (status === 429) return 'limite';
  if (status === 413) return 'tamanho'; // pedido maior que a cota de tokens do minuto ou que o contexto do modelo
  if (status === 401 || status === 403) return 'chave';
  if (status === 404 || status >= 500) return 'indisponivel';
  return 'outro';
}

// streaming com o consumo real no fim (quem não aceita o parâmetro declara em naoAceita)
const comUso = (j: CorpoChat): CorpoChat => (j.stream ? { ...j, stream_options: { include_usage: true } } : j);

export function adaptadorFreeLLMAPI({ url, chave }: { url: string; chave: () => string }): Adaptador {
  return {
    id: 'freellmapi',
    url: (c) => url + c,
    cabecalhos: () => ({ Authorization: `Bearer ${chave()}` }),
    corpo: comUso,
    mensagemErro: (status, d) => (status === 401 ? 'O FreeLLMAPI recusou a chave. No ícone do FreeLLMAPI, clique em "Copy Key" e cole de novo em Configurações > IA e modelos.' : `FreeLLMAPI respondeu ${status}${d ? `: ${d}` : ''}`),
    temChave: () => Boolean(chave()),
  };
}

export function adaptadorOllama({ url, modelo }: { url: string; modelo: string }): Adaptador {
  return {
    id: 'ollama',
    url: (c) => `${url}/v1${c.replace(/^\/v1/, '')}`,
    cabecalhos: () => ({}),
    corpo: (j) => comUso({ ...j, model: modelo }), // no modo offline qualquer modelo pedido vira o modelo local
    mensagemErro: (status, d) => `O modelo local respondeu ${status}${d ? `: ${d}` : ''}`,
    temChave: () => true,
  };
}

// Qualquer provedor no formato da API da OpenAI (Groq, OpenRouter, Mistral...). O modelo é pedido como "<id>:<modelo>".
export function adaptadorOpenAI({ id, url, chaveEnv, naoAceita = [] }: { id: string; url: string; chaveEnv: string; naoAceita?: string[] }): Adaptador {
  const base = url.replace(/\/$/, '');
  return {
    id,
    url: (c) => `${base}${c.replace(/^\/v1/, '')}`,
    cabecalhos: () => ({ Authorization: `Bearer ${process.env[chaveEnv] ?? ''}` }),
    corpo: (j) => {
      const c = comUso({ ...j, ...(j.model ? { model: j.model.slice(id.length + 1) } : {}) });
      for (const campo of naoAceita) delete c[campo];
      return c;
    },
    mensagemErro: (status, d) => `O provedor ${id} respondeu ${status}${d ? `: ${d}` : ''}`,
    temChave: () => Boolean(process.env[chaveEnv]),
  };
}

// modelos-extras.json: só o NOME da variável com a chave fica no arquivo, nunca a chave.
const ModeloExtra = z.object({ id: z.string().min(1), contexto: z.number().int().positive().optional(), visao: z.boolean().optional(), ferramentas: z.boolean().optional() });
const ProvedorExtra = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,30}$/), url: z.string().regex(/^https?:\/\//), chaveEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  naoAceita: z.array(z.string()).optional(), modelos: z.array(ModeloExtra).min(1),
});
export const ArquivoExtras = z.object({ provedores: z.array(ProvedorExtra) });
export type ProvedorExtraLido = z.infer<typeof ProvedorExtra>;

export function lerExtras(arquivo: string): { provedores: ProvedorExtraLido[]; erro: string | null } {
  if (!existsSync(arquivo)) return { provedores: [], erro: null };
  try {
    return { provedores: ArquivoExtras.parse(JSON.parse(readFileSync(arquivo, 'utf8'))).provedores, erro: null };
  } catch (e) { // arquivo errado não derruba o Gyde: os provedores extras só não entram, e o relatório conta por quê
    return { provedores: [], erro: `modelos-extras.json ignorado: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}` };
  }
}
