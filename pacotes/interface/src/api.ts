// Cliente da API do Gyde para as telas: manda o cabeçalho anti-CSRF, trata erros e confere cada resposta com o
// mesmo contrato que o servidor usa ($contratos). Resposta fora do contrato vira um erro claro, não uma tela quebrada.
import type { z } from 'zod';

const CABECALHO = { 'x-gyde': '1' };
// prazo padrão: o servidor é local, mas se ele travar a tela não pode ficar carregando para sempre (os pedidos com IA
// cabem nisso; o chat e a Forja usam streaming, fora daqui)
const PRAZO = 90_000;

export class ErroContrato extends Error {
  url: string;
  problemas: string;
  constructor(url: string, problemas: string) {
    super('O servidor do Gyde respondeu num formato diferente do desta tela. Isso acontece quando o Gyde é atualizado sem reiniciar: feche o Gyde e abra de novo.');
    this.url = url;
    this.problemas = problemas;
  }
}

async function chamar(url: string, init: RequestInit = {}): Promise<Response> {
  const temCorpo = init.body !== undefined && !(init.body instanceof Blob) && !(init.body instanceof FormData);
  const res = await fetch(url, { signal: AbortSignal.timeout(PRAZO), ...init, headers: { ...(temCorpo ? { 'Content-Type': 'application/json' } : {}), ...CABECALHO, ...init.headers } });
  if (res.status === 401 && !url.startsWith('/api/auth')) {
    location.reload(); // sessão expirou: volta para a tela de login
    throw new Error('Sessão expirada.');
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { msg = (await res.json() as { error?: string }).error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return res;
}

// Pedido com resposta conferida pelo contrato.
export async function pedir<S extends z.ZodTypeAny>(url: string, esquema: S, init: RequestInit = {}): Promise<z.output<S>> {
  const dados: unknown = await (await chamar(url, init)).json();
  const r = esquema.safeParse(dados);
  if (!r.success) {
    const problemas = r.error.issues.slice(0, 4).map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`).join('; ');
    console.error(`[Gyde] resposta de ${url} fora do contrato: ${problemas}`);
    throw new ErroContrato(url, problemas);
  }
  return r.data;
}

// Pedido cuja resposta não tem contrato (ex.: { ok: true }).
export async function enviar<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await chamar(url, init);
  return (res.status === 204 ? null : await res.json()) as T;
}

export const corpo = (dados: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(dados) });

// Texto amigável para qualquer erro de rede ou da API.
export const mensagemDe = (e: unknown) => (e instanceof TypeError ? 'Sem conexão com o servidor do Gyde. Confira se o Gyde está aberto.'
  : e instanceof DOMException && e.name === 'TimeoutError' ? 'O servidor do Gyde demorou demais para responder. Tente de novo; se continuar, feche e abra o Gyde.'
  : e instanceof Error ? e.message : String(e));
