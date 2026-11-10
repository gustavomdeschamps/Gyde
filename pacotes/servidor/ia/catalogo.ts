// Catálogo de modelos: o perfil técnico de cada um e a escolha da ordem para uma tarefa.
// De onde vem cada dado, sem nota dada à mão:
// - qualidade por categoria: medicoes.json, gerado de avaliações reais (ferramentas/avaliar-modelos.mjs + gerar-medicoes.mjs);
// - contexto e disponibilidade: o próprio provedor (/v1/models);
// - sucesso e tempo recentes: o que este Gyde observa em uso (desempenho.ts).
// Modelo novo: entra pelo FreeLLMAPI ou por modelos-extras.json e, sem medição, é tentado depois dos que já provaram qualidade.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Router } from '../tipos.ts';
import type { Desempenho } from './desempenho.ts';
import type { ProvedorExtraLido } from './adaptadores.ts';

export interface MedicaoCategoria { acertos: number; respondidas: number; limites: number; ms: number | null }
export interface MedicaoModelo { via: string[]; categorias: Record<string, MedicaoCategoria> }
export interface Medicoes { em: string | null; modelos: Record<string, MedicaoModelo> }
export type ModoResposta = 'rapido' | 'equilibrado' | 'capricho';

export interface OpcoesCadeia {
  modo?: ModoResposta; tamanho?: number; precisaVisao?: boolean; excluir?: string[]; desligados?: string[];
  max?: number; reserva?: string[]; agora?: number;
}

// quanto o tempo de resposta pesa contra a qualidade medida em cada modo
const PESO_TEMPO: Record<ModoResposta, number> = { rapido: 0.5, equilibrado: 0.25, capricho: 0.05 };
const TEMPO_REFERENCIA = 15_000;
const POR_TOKEN = 3.5; // caracteres por token, estimativa para não mandar um pedido que não cabe no contexto
const SO_RESERVA = new Set(['auto', 'fusion']); // o automático fica no fim da fila; o fusion chama vários modelos por pedido e nunca é escolhido sozinho

export function lerMedicoes(arquivo = path.join(import.meta.dirname, 'medicoes.json')): Medicoes {
  if (!existsSync(arquivo)) return { em: null, modelos: {} };
  try { return JSON.parse(readFileSync(arquivo, 'utf8')) as Medicoes; } catch { return { em: null, modelos: {} }; }
}

// provedor real por trás do nome: "groq/qwen/qwen3.8-27b" -> "groq/qwen/qwen3.8-27b" (nomes de slot não dizem quem responde)
export const mesmoModeloReal = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a === b);

// extras e apenas aceitam função: a tela Conectar IA liga e desliga provedores sem reiniciar o Gyde.
// aoAtualizar: buscar a lista de modelos ao vivo dos provedores diretos antes de montar a fila.
export function criarCatalogo({ router, desempenho, medicoes = lerMedicoes(), extras: extrasDados = [], offline, apenas: apenasDado = null, aoAtualizar }: {
  router: Router; desempenho?: Desempenho; medicoes?: Medicoes; extras?: ProvedorExtraLido[] | (() => ProvedorExtraLido[]); offline?: () => Promise<boolean>;
  apenas?: string[] | null | (() => string[] | null); aoAtualizar?: () => Promise<void>;
}) {
  const listaExtras = () => (typeof extrasDados === 'function' ? extrasDados() : extrasDados);
  const listaApenas = () => (typeof apenasDado === 'function' ? apenasDado() : apenasDado);
  const doProvedor = new Map<string, { contexto: number | null }>();
  let lidoEm = 0;
  let pendente: Promise<void> | null = null;
  const extraDe = (id: string) => { for (const p of listaExtras()) for (const m of p.modelos) if (`${p.id}:${m.id}` === id) return m; return null; };

  // lista do provedor: lida no máximo a cada 5 minutos e sem pedidos repetidos ao mesmo tempo
  async function atualizar(): Promise<void> {
    await aoAtualizar?.().catch(() => {});
    if (listaApenas()) return; // só provedores diretos: a lista do FreeLLMAPI não importa
    return atualizarFreeLLMAPI();
  }
  function atualizarFreeLLMAPI(): Promise<void> {
    if (Date.now() - lidoEm < 5 * 60_000) return Promise.resolve();
    pendente ??= (async () => {
      try {
        if (await offline?.()) { pendente = null; return; } // no modo offline a lista seria a do Ollama, não a dos modelos online
        const r = await router('/v1/models', { signal: AbortSignal.timeout(5000) });
        const j = await r.json() as { data?: { id: string; available?: boolean; context_length?: number; context_window?: number }[] };
        doProvedor.clear();
        for (const m of j.data ?? []) if (m.available !== false) doProvedor.set(m.id, { contexto: m.context_length ?? m.context_window ?? null });
        lidoEm = Date.now();
      } catch { /* sem a lista: segue com a última (ou só com as medições) */ }
      pendente = null;
    })();
    return pendente;
  }

  // "<provedor>:<modelo>" só existe com aquele provedor ligado; os outros nomes são do FreeLLMAPI
  const conhecido = (id: string) => (id.includes(':') ? Boolean(extraDe(id)) : doProvedor.size === 0 || doProvedor.has(id));
  const contextoDe = (id: string) => doProvedor.get(id)?.contexto ?? extraDe(id)?.contexto ?? null;
  const medido = (id: string, categorias: string[]) => {
    const m = medicoes.modelos[id];
    let acertos = 0, respondidas = 0, limites = 0, msSoma = 0, msN = 0;
    for (const c of categorias) {
      const x = m?.categorias[c];
      if (!x) continue;
      acertos += x.acertos; respondidas += x.respondidas; limites += x.limites;
      if (x.ms != null) { msSoma += x.ms; msN++; }
    }
    return { acertos, respondidas, limites, ms: msN ? msSoma / msN : null };
  };
  const visaoDe = (id: string): boolean | null => {
    const e = extraDe(id);
    if (e?.visao !== undefined) return e.visao;
    const v = medicoes.modelos[id]?.categorias.visao;
    return v && v.respondidas ? v.acertos > 0 : null;
  };

  // Nota para ordenar, não para mostrar: acertos medidos (com a correção de amostra pequena: sem medição vale 0,5, abaixo
  // de quem provou qualidade), vezes a chance de o modelo estar disponível, menos o custo do tempo no modo escolhido.
  function pontuar(id: string, categorias: string[], modo: ModoResposta): number {
    const m = medido(id, categorias);
    const qualidade = (m.acertos + 2) / (m.respondidas + 4);
    const tentativas = m.respondidas + m.limites;
    const dispMedida = tentativas ? m.respondidas / tentativas : 0.7;
    const visto = desempenho?.estatistica(id);
    const disponibilidade = visto && visto.chamadas >= 3 ? (dispMedida + visto.taxaOk * 2) / 3 : dispMedida;
    const tempo = visto?.ms ?? m.ms;
    return qualidade * (0.4 + 0.6 * disponibilidade) - PESO_TEMPO[modo] * Math.min((tempo ?? TEMPO_REFERENCIA) / TEMPO_REFERENCIA, 1);
  }

  function candidatos() {
    const ids = new Set(Object.keys(medicoes.modelos));
    for (const p of listaExtras()) for (const m of p.modelos) ids.add(`${p.id}:${m.id}`);
    // "apenas": só os modelos de um provedor direto (ex.: medir a Forja só com o Groq), sem FreeLLMAPI nem 'auto'
    const apenas = listaApenas();
    return [...ids].filter((id) => !SO_RESERVA.has(id) && (!apenas || apenas.some((p) => id.startsWith(`${p}:`))));
  }

  // Ordem de modelos para uma tarefa. Termina sempre em 'auto', que funciona com qualquer conjunto de chaves.
  function cadeia(categorias: string[], { modo = 'equilibrado', tamanho = 0, precisaVisao = false, excluir = [], desligados = [], max = 5, reserva = [], agora }: OpcoesCadeia = {}): string[] {
    const fora = new Set([...excluir, ...desligados]);
    const cabe = (id: string) => {
      const c = contextoDe(id);
      return c == null || tamanho / POR_TOKEN < c * 0.9;
    };
    const elegivel = (id: string) => !fora.has(id) && conhecido(id) && cabe(id) && (desempenho?.disponivel(id, tamanho, agora) ?? true) && (!precisaVisao || visaoDe(id) === true);
    const provouErrar = (id: string) => { const m = medido(id, categorias); return m.respondidas >= 2 && m.acertos === 0; };
    const ordem = candidatos().filter(elegivel).filter((id) => !provouErrar(id))
      .map((id) => ({ id, nota: pontuar(id, categorias, modo) }))
      .sort((a, b) => b.nota - a.nota || a.id.localeCompare(b.id)).map((x) => x.id).slice(0, max);
    // só um provedor e todos descansando: tenta assim mesmo, em vez de desistir sem chamar ninguém
    if (listaApenas()) return ordem.length ? ordem : candidatos().filter((id) => !fora.has(id) && conhecido(id) && cabe(id) && (!precisaVisao || visaoDe(id) === true)).slice(0, max);
    const lista = ordem.length ? ordem : reserva.filter(elegivel);
    return fora.has('auto') ? lista : [...lista, 'auto'];
  }

  // Tudo o que se sabe de um modelo, para a tela "Como o Gyde funciona". `null` = não medido (não é "ruim").
  function perfis() {
    return candidatos().filter(conhecido).map((id) => {
      const m = medicoes.modelos[id];
      const cats = m?.categorias ?? {};
      const soma = Object.values(cats).reduce((a, c) => ({ acertos: a.acertos + c.acertos, respondidas: a.respondidas + c.respondidas, limites: a.limites + c.limites }), { acertos: 0, respondidas: 0, limites: 0 });
      const f = cats.ferramentas;
      const e = extraDe(id);
      return {
        id, contexto: contextoDe(id), visao: visaoDe(id), ferramentas: e?.ferramentas ?? (f && f.respondidas ? f.acertos > 0 : null),
        via: m?.via ?? [], acertos: soma.acertos, respondidas: soma.respondidas, limites: soma.limites,
        categorias: Object.fromEntries(Object.entries(cats).filter(([c]) => c !== 'ferramentas').map(([c, x]) => [c, { acertos: x.acertos, respondidas: x.respondidas }])),
        observado: desempenho?.estatistica(id) ?? null, descansando: desempenho ? !desempenho.disponivel(id) : false,
      };
    });
  }

  return { atualizar, cadeia, perfis, pontuar, visaoDe, contextoDe, viaMedida: (id: string) => medicoes.modelos[id]?.via ?? [], medidoEm: medicoes.em };
}
export type Catalogo = ReturnType<typeof criarCatalogo>;
