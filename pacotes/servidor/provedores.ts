// Provedores de IA do Gyde: online (FreeLLMAPI) ou offline (Ollama, modelo rodando no próprio computador).
// Todos os módulos chamam `router(caminho, init)` no formato da API da OpenAI; aqui se decide para onde vai.
// Também guarda o consumo REAL informado pelo provedor (cabeçalhos e campo usage). Nada é estimado aqui.
import { z } from 'zod';
import type { Uso } from './uso.ts';
import type { Registro, RouterInit, Provedor, UsoInformado } from './tipos.ts';
import { erroGyde, comoErro } from './tipos.ts';
import { adaptadorFreeLLMAPI, adaptadorOllama, adaptadorOpenAI, tipoDoErro, type Adaptador, type CorpoChat, type ProvedorExtraLido } from './ia/adaptadores.ts';
import type { Desempenho } from './ia/desempenho.ts';

const SEGUNDO = 1000;

export type ModoIA = 'online' | 'offline' | 'auto';
const MODOS: ModoIA[] = ['online', 'offline', 'auto'];
const ehModo = (m: unknown): m is ModoIA => MODOS.includes(m as ModoIA);

export interface LimiteRoteador { total: number; restante: number; renovaEm: string | null }
export interface PorChave { provedor: string; pedidos: number; tokens: number; limitePedidos: number | null; limiteTokens: number | null }
export interface UsoMes { mes: string; renovaEm: string; pedidos: number; tokens: number; porChave: PorChave[] }
export interface ResumoProvedores {
  modo: ModoIA;
  ativo: Provedor;
  online: { disponivel: boolean; url: string };
  offline: { disponivel: boolean; modelo: string; instalados: string[] };
  gratis: true;
  limiteRoteador: LimiteRoteador | null;
  mes: UsoMes | null;
}
// resposta da rota /v1/usage do FreeLLMAPI (só os campos usados)
// resposta do /v1/usage do FreeLLMAPI. Conferida antes de usar: outro formato (versão diferente do FreeLLMAPI)
// vira "não informado" na tela em vez de números quebrados
const UsoFreeLLMAPI = z.object({
  month: z.string(), resetsAt: z.string(), requests: z.number(), tokens: z.number(),
  byKey: z.array(z.object({ enabled: z.boolean(), platform: z.string(), requests: z.number(), tokens: z.number(), requestCap: z.number().nullable(), tokenCap: z.number().nullable() })).optional(),
});

// Chamada que o modelo tentou fazer como "ferramenta nativa" -> ação da Forja. Só ferramentas da Forja passam (nomes que alguns
// modelos abreviam são aceitos); ferramentas que vêm de fábrica no modelo, como container.exec, continuam sendo falha.
const FERRAMENTAS_FORJA = new Set(['listar', 'ler', 'buscar', 'escrever', 'editar', 'apagar', 'executar', 'desfazer']);
const APELIDOS_FERRAMENTA: Record<string, string> = { lista: 'listar', list: 'listar', read: 'ler', search: 'buscar', write: 'escrever', edit: 'editar', delete: 'apagar', run: 'executar', exec: 'executar' };
export function acaoDaChamadaRecusada(tentativa: unknown): string | null {
  let o: { name?: unknown; arguments?: unknown };
  try { o = JSON.parse(String(tentativa ?? '')) as typeof o; } catch { return null; }
  const nome = String(o?.name ?? '').toLowerCase();
  const ferramenta = FERRAMENTAS_FORJA.has(nome) ? nome : APELIDOS_FERRAMENTA[nome];
  if (!ferramenta) return null;
  let args = o.arguments;
  if (typeof args === 'string') { try { args = JSON.parse(args); } catch { return null; } }
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null;
  return JSON.stringify({ pensamento: '', acoes: [{ ferramenta, args }] });
}

export interface OpcoesProvedores { routerUrl: string; routerKey: string; ollamaUrl: string; ollamaModelo: string; modo: string; uso?: Uso; desempenho?: Desempenho; extras?: ProvedorExtraLido[] }
export function criarProvedores({ routerUrl, routerKey: chaveInicial, ollamaUrl, ollamaModelo, modo, uso, desempenho, extras = [] }: OpcoesProvedores) {
  let routerKey = chaveInicial; // pode mudar sem reiniciar (Configurações > IA)
  const online = adaptadorFreeLLMAPI({ url: routerUrl, chave: () => routerKey });
  const local = adaptadorOllama({ url: ollamaUrl, modelo: ollamaModelo });
  const externos = new Map<string, Adaptador>(extras.map((e) => [e.id, adaptadorOpenAI(e)]));
  // modo: 'online' (só FreeLLMAPI), 'offline' (só Ollama) ou 'auto' (FreeLLMAPI; se ele não responder, Ollama)
  const cfg: { modo: ModoIA } = { modo: ehModo(modo) ? modo : 'auto' };
  const saude = { online: false, offline: false, em: 0, modelosLocais: [] as string[] };
  const ultimo: { limite: LimiteRoteador | null } = { limite: null };
  let usoMes: { dados: UsoMes | null; em: number } = { dados: null, em: 0 };

  async function checar() {
    if (Date.now() - saude.em < 15 * SEGUNDO) return saude;
    const tenta = async (url: string) => { try { const r = await fetch(url, { signal: AbortSignal.timeout(2500) }); return r.ok ? r : null; } catch { return null; } };
    const [on, off] = await Promise.all([
      tenta(`${routerUrl}/health`),
      tenta(`${ollamaUrl}/api/tags`),
    ]);
    saude.online = Boolean(on && routerKey);
    const tags = off ? await off.json().catch(() => ({})) as { models?: { name: string }[] } : {};
    saude.modelosLocais = (tags.models || []).map((m) => m.name);
    saude.offline = saude.modelosLocais.includes(ollamaModelo);
    saude.em = Date.now();
    return saude;
  }

  // Qual provedor atende agora.
  async function ativo(): Promise<Provedor> {
    if (cfg.modo === 'online') return 'online';
    if (cfg.modo === 'offline') return 'offline';
    const s = await checar();
    return s.online || !s.offline ? 'online' : 'offline';
  }

  function registrar(res: Response, provedor: Provedor) {
    const h = (n: string) => res.headers.get(n);
    if (provedor === 'online' && h('x-ratelimit-limit')) {
      const reset = Number(h('x-ratelimit-reset'));
      ultimo.limite = { total: Number(h('x-ratelimit-limit')), restante: Number(h('x-ratelimit-remaining')), renovaEm: reset ? new Date(reset * 1000).toISOString() : null };
    }
  }

  // `init.registro` (uso.ts) recebe cada ida ao provedor; chamadas sem dono (títulos, memória) viram registro "interno".
  async function router(pathname: string, { registro, recuperarAcao = false, ...init }: RouterInit = {}): Promise<Response> {
    const avulso = !registro && uso && /completions|images/.test(pathname) ? uso.iniciar(null, 'interno') : null;
    const reg = registro || avulso;
    try {
      const res = await chamar(pathname, init, reg, recuperarAcao);
      avulso?.fim('ok');
      return res;
    } catch (err) {
      if (avulso && uso) avulso.fim(uso.resultadoDe(err), comoErro(err).message);
      throw err;
    }
  }

  // Quem atende: modelo "<provedor>:<id>" vai para o provedor extra; o resto, para o FreeLLMAPI ou para o Ollama.
  function adaptadorDe(provedor: Provedor, modelo: string | undefined): Adaptador {
    if (provedor === 'offline') return local;
    const extra = modelo?.includes(':') ? externos.get(modelo.slice(0, modelo.indexOf(':'))) : undefined;
    return extra ?? online;
  }

  async function chamar(pathname: string, init: RequestInit, reg: Registro | null, recuperarAcao = false): Promise<Response> {
    const provedor = await ativo();
    const offline = provedor === 'offline';
    const pedido = typeof init.body === 'string' ? JSON.parse(init.body) as CorpoChat : null;
    const adaptador = adaptadorDe(provedor, pedido?.model);
    if (!adaptador.temChave()) {
      throw erroGyde(adaptador === online ? 'Chave do FreeLLMAPI não configurada. Cole a chave em Configurações > IA e modelos.' : `Chave do provedor ${adaptador.id} não configurada no .env.`, { status: 503 });
    }
    const body = pedido ? JSON.stringify(adaptador.corpo(pedido)) : init.body;
    const inicio = Date.now();
    // só o que passa pelo roteador conta para escolher modelos (o Ollama é um modelo só)
    const observar = (ok: boolean, tipo: ReturnType<typeof tipoDoErro> | null, via: string | null) => {
      if (offline || !pedido?.model || !/completions/.test(pathname)) return;
      desempenho?.observar({ modelo: pedido.model, via, ok, tipo, ms: Date.now() - inicio, tamanho: typeof body === 'string' ? body.length : 0 });
    };
    let res: Response;
    try {
      res = await fetch(adaptador.url(pathname), {
        ...init,
        body: body ?? null,
        headers: { 'Content-Type': 'application/json', ...adaptador.cabecalhos(), ...(init.headers as Record<string, string> | undefined) },
      });
    } catch (cause) {
      reg?.chamada({ provedor, ok: false });
      const nome = comoErro(cause).name;
      const prazoEstourou = nome === 'TimeoutError' || (init.signal?.aborted && init.signal.reason instanceof Error && init.signal.reason.name !== 'AbortError');
      if (nome === 'AbortError' && !prazoEstourou) throw cause;
      observar(false, 'indisponivel', null);
      if (prazoEstourou) throw erroGyde('O modelo demorou demais para responder.', { status: 504 });
      saude.em = 0; // força nova checagem: pode ter caído a internet ou o programa
      const msg = offline
        ? 'Não consegui falar com o Ollama (o modelo local). Abra o Ollama e tente de novo.'
        : adaptador === online ? 'Não consegui falar com o FreeLLMAPI. Ele está aberto na bandeja do Windows?' : `Não consegui falar com o provedor ${adaptador.id}.`;
      throw erroGyde(msg, { status: 502, final: offline });
    }
    registrar(res, provedor);
    const via = res.headers.get('x-routed-via');
    reg?.chamada({ provedor, ok: res.ok, modelo: offline ? ollamaModelo : via });
    if (!res.ok) {
      let detail = '';
      let erro: { error?: { message?: string; code?: string; failed_generation?: string }; message?: string } = {};
      try { erro = await res.json() as typeof erro; detail = erro.error?.message || erro.message || ''; } catch { /* corpo vazio */ }
      const acao = recuperarAcao && res.status === 400 && erro.error?.code === 'tool_use_failed' ? acaoDaChamadaRecusada(erro.error.failed_generation) : null;
      if (acao) { // o modelo agiu, só que pelo caminho errado: vira a resposta em JSON que a Forja entende
        observar(true, null, via);
        return new Response(JSON.stringify({ model: pedido?.model, choices: [{ message: { role: 'assistant', content: acao } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      observar(false, tipoDoErro(res.status), null);
      // 429 do roteador inteiro (acabaram os pedidos do minuto) para tudo; 429 de um modelo só deixa tentar outro
      if (res.status === 429 && ultimo.limite?.restante === 0) {
        throw erroGyde(await mensagemLimite(), { status: 429, limite: 'roteador-minuto' });
      }
      // nunca 401 para a tela: lá 401 quer dizer "sessão do Gyde expirou" e a página volta para o login
      throw erroGyde(adaptador.mensagemErro(res.status, detail), { status: 502, final: offline });
    }
    observar(true, null, via);
    return res;
  }

  // Mensagem quando o limite por minuto do FreeLLMAPI acaba: qual limite, quem limita, quando volta e o que funciona.
  async function mensagemLimite() {
    const l = ultimo.limite;
    const volta = l?.renovaEm ? `Ele renova às ${new Date(l.renovaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (informado pelo FreeLLMAPI).` : 'O FreeLLMAPI não informou quando renova.';
    const s = await checar();
    const alternativa = s.offline
      ? ` Enquanto isso, dá para usar o modelo local (${ollamaModelo}, mais simples e sem internet): Configurações > IA e modelos > modo "Só offline".`
      : ' Espere a renovação e tente de novo.';
    return `Limite atingido: os ${l?.total ?? ''} pedidos por minuto do FreeLLMAPI acabaram. ${volta}${alternativa}`.replace('os  pedidos', 'os pedidos');
  }

  // Tokens de uma resposta (campo usage da API, quando o provedor manda).
  const tokensDe = (usage?: UsoInformado | null) => (usage ? { entrada: usage.prompt_tokens ?? null, saida: usage.completion_tokens ?? null, total: usage.total_tokens ?? null } : null);

  // Resumo para a tela: só dados que o provedor informou de verdade.
  // mostrarConta=false (modo público) esconde o consumo do mês, que é da conta do dono do FreeLLMAPI.
  async function resumo({ mostrarConta = true } = {}): Promise<ResumoProvedores> {
    const s = await checar();
    const agora = await ativo();
    let mes: UsoMes | null = null;
    if (mostrarConta && agora === 'online' && s.online) {
      if (Date.now() - usoMes.em > 30 * SEGUNDO) {
        try {
          const r = await fetch(`${routerUrl}/v1/usage`, { headers: { Authorization: `Bearer ${routerKey}` }, signal: AbortSignal.timeout(3000) });
          const lido = r.ok ? UsoFreeLLMAPI.safeParse(await r.json()) : null;
          if (lido?.success) {
            const u = lido.data;
            const caps = (u.byKey || []).filter((k) => k.enabled).map((k) => ({ provedor: k.platform, pedidos: k.requests, tokens: k.tokens, limitePedidos: k.requestCap, limiteTokens: k.tokenCap }));
            usoMes = { dados: { mes: u.month, renovaEm: u.resetsAt, pedidos: u.requests, tokens: u.tokens, porChave: caps }, em: Date.now() };
          }
        } catch { /* fica sem o dado */ }
      }
      mes = usoMes.dados;
    }
    return {
      modo: cfg.modo,
      ativo: agora,
      online: { disponivel: s.online, url: routerUrl },
      offline: { disponivel: s.offline, modelo: ollamaModelo, instalados: s.modelosLocais },
      gratis: true,
      limiteRoteador: agora === 'online' ? ultimo.limite : null,
      mes,
    };
  }

  return {
    router, resumo, ativo, tokensDe,
    cota: () => (ultimo.limite?.renovaEm && new Date(ultimo.limite.renovaEm).getTime() < Date.now() ? null : ultimo.limite),
    definirModo(m: unknown): ModoIA { if (ehModo(m)) { cfg.modo = m; saude.em = 0; } return cfg.modo; },
    definirChave(chave: string) { routerKey = chave; saude.em = 0; },
    temChave: () => Boolean(routerKey),
  };
}
export type Provedores = ReturnType<typeof criarProvedores>;
