// Núcleo do Gyde: decide como responder a cada pedido e executa a estratégia, sempre com uma voz só.
//   direta         um modelo escolhido para a tarefa (o padrão: é o mais rápido e gasta menos cota)
//   revisada       um modelo escreve, outro procura erros, o primeiro corrige
//   comparada      dois modelos respondem sem ver um ao outro e o Gyde compara e escreve uma resposta só
//   especialistas  um modelo analisa os requisitos, outro implementa, um terceiro verifica
// A troca de modelo quando um falha vale em todas. Falha num papel de apoio nunca derruba a resposta: a pessoa recebe o
// melhor que existir até ali. Revisão só é anunciada se veio de outro modelo real (x-routed-via), não de outro apelido.
import type { MensagemIA, Registro, Router } from '../tipos.ts';
import { comoErro, erroGyde } from '../tipos.ts';
import { CADEIAS, completar, extrairJson } from '../motor.ts';
import type { Provedores } from '../provedores.ts';
import type { Catalogo, ModoResposta } from './catalogo.ts';
import { mesmoModeloReal } from './catalogo.ts';
import type { Desempenho } from './desempenho.ts';
import type { Classificacao, Tarefa } from './classificar.ts';
import { textoRecente } from './contexto.ts';
import { criarFiltro, limparResposta } from './filtro.ts';
import { ajusteDoModelo, PROMPT_ANALISTA, PROMPT_REESCRITA, PROMPT_REVISOR, PROMPT_SINTESE } from './prompts.ts';

export type Estrategia = 'direta' | 'revisada' | 'comparada' | 'especialistas';
export interface Problema { gravidade: string; onde: string; erro: string; correcao: string }
export interface Consumo { provedor: string; modelo: string | null; tokens: ReturnType<Provedores['tokensDe']> }
export interface Resposta {
  texto: string; modelo: string | null; estrategia: Estrategia; motivo: string; chamadas: number; modelos: string[];
  revisadaPorOutro: boolean; mudou: boolean; consumo: Consumo | null;
}
export interface Plano { estrategia: Estrategia; motivo: string; principal: string[]; apoio: string[]; categorias: string[]; classificacao: Classificacao }
interface Execucao {
  mensagens: MensagemIA[]; signal: AbortSignal; registro?: Registro | undefined;
  aoEscrever: (texto: string) => void; aoStatus?: (texto: string) => void;
}

export const CATEGORIAS: Record<Tarefa, string[]> = {
  conversa: ['conversa', 'contexto'], objetiva: ['objetiva'], raciocinio: ['raciocinio'],
  codigo: ['codigo', 'tutor'], sql: ['sql', 'codigo'], frontend: ['frontend', 'codigo'], backend: ['backend', 'codigo'],
  escrita: ['escrita'], analise: ['analise'], etapas: ['etapas', 'instrucoes'], visao: ['visao'],
};
const SOFTWARE = new Set<Tarefa>(['codigo', 'sql', 'frontend', 'backend']);
const NOMES: Record<Estrategia, number> = { direta: 1, revisada: 3, comparada: 3, especialistas: 4 }; // chamadas que cada estratégia precisa

const PRAZO_PRIMEIRO_TEXTO = 45_000, PRAZO_ENTRE_PEDACOS = 60_000, PRAZO_APOIO = 60_000, PRAZO_RASCUNHO = 120_000;
const MAX_TENTATIVAS = 6; // nunca fica trocando de modelo para sempre
const MAX_SIMULTANEAS = 8;
const PRAZO_COLABORACAO = 150_000; // a colaboração inteira; passou disso, um modelo só responde

// A decisão é uma função pura: mesma entrada, mesma estratégia. Ver testes em testes/ia.test.mjs.
export function decidirEstrategia(c: Classificacao, { modo, especialistas = false, offline = false, fixo = false, cotaRestante = null }: { modo: ModoResposta; especialistas?: boolean; offline?: boolean; fixo?: boolean; cotaRestante?: number | null }): { estrategia: Estrategia; motivo: string } {
  const direta = (motivo: string) => ({ estrategia: 'direta' as const, motivo });
  if (offline) return direta('modo offline: um modelo só, no computador');
  if (fixo) return direta('a pessoa escolheu o modelo');
  if (c.tarefa === 'visao') return direta('imagem: poucos modelos enxergam');
  if (modo === 'rapido') return direta('modo rápido');
  if (c.tarefa === 'conversa' || (c.tarefa === 'objetiva' && !c.incerta && !c.importante)) return direta('pedido simples');

  let pedida: { estrategia: Estrategia; motivo: string } | null = null;
  if (modo === 'capricho') {
    if (especialistas && c.complexidade === 3 && SOFTWARE.has(c.tarefa)) pedida = { estrategia: 'especialistas', motivo: 'sistema grande: análise, implementação e verificação' };
    else if (c.incerta || c.tarefa === 'raciocinio') pedida = { estrategia: 'comparada', motivo: 'dúvida ou raciocínio: duas respostas independentes' };
    else if (c.complexidade >= 2 || SOFTWARE.has(c.tarefa) || c.importante) pedida = { estrategia: 'revisada', motivo: 'modo capricho: revisão independente' };
  } else if (c.importante && c.complexidade >= 2) {
    pedida = { estrategia: 'revisada', motivo: 'a pessoa disse que é importante' };
  }
  if (!pedida) return direta('um modelo basta');
  // sem cota no minuto para a estratégia inteira, é melhor uma resposta boa agora que uma colaboração pela metade
  if (cotaRestante != null && cotaRestante < NOMES[pedida.estrategia] + 2) return direta('pouca cota neste minuto');
  return pedida;
}

export function lerRevisao(texto: string): Problema[] | null {
  const o = extrairJson(texto);
  if (!o || !Array.isArray(o.problemas)) return null;
  return (o.problemas as Partial<Problema>[]).filter((p) => p && typeof p.erro === 'string' && p.erro.trim() && p.gravidade !== 'baixa')
    .slice(0, 8).map((p) => ({ gravidade: String(p.gravidade ?? 'media'), onde: String(p.onde ?? '').slice(0, 300), erro: String(p.erro).slice(0, 600), correcao: String(p.correcao ?? '').slice(0, 800) }));
}
const formatarProblemas = (ps: Problema[]) => ps.map((p, i) => `${i + 1}. [${p.gravidade}] ${p.onde ? `"${p.onde}": ` : ''}${p.erro}${p.correcao ? ` Correção sugerida: ${p.correcao}` : ''}`).join('\n');

// fila simples: no máximo N chamadas de IA ao mesmo tempo neste servidor
function criarFila(max: number) {
  let ocupadas = 0;
  const espera: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (ocupadas >= max) await new Promise<void>((r) => espera.push(r));
    ocupadas++;
    try { return await fn(); } finally { ocupadas--; espera.shift()?.(); }
  };
}

interface PedacoStream { error?: { message?: string }; model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; choices?: { delta?: { content?: string } }[] }

export function criarOrquestrador({ router, provedores, catalogo, desempenho }: { router: Router; provedores: Provedores; catalogo: Catalogo; desempenho?: Desempenho }) {
  const fila = criarFila(MAX_SIMULTANEAS);

  async function planejar(c: Classificacao, opcoes: { modo: ModoResposta; especialistas?: boolean; fixo?: string[]; desligados?: string[]; tamanho: number; reserva: string[] }): Promise<Plano> {
    await catalogo.atualizar();
    const offline = await provedores.ativo() === 'offline';
    const categorias = CATEGORIAS[c.tarefa];
    const decisao = decidirEstrategia(c, { modo: opcoes.modo, especialistas: opcoes.especialistas ?? false, offline, fixo: Boolean(opcoes.fixo), cotaRestante: provedores.cota()?.restante ?? null });
    const base = { modo: opcoes.modo, tamanho: opcoes.tamanho, desligados: opcoes.desligados ?? [], reserva: opcoes.reserva };
    const principal = opcoes.fixo ?? (offline ? ['auto'] : catalogo.cadeia(categorias, { ...base, precisaVisao: c.tarefa === 'visao' }));
    const apoio = decisao.estrategia === 'direta' ? [] : catalogo.cadeia(['revisao'], { ...base, tamanho: Math.min(opcoes.tamanho, 20_000), excluir: [principal[0]!], max: 3 }).filter((m) => m !== 'auto');
    // sem um segundo modelo não há colaboração de verdade
    if (decisao.estrategia !== 'direta' && !apoio.length) return { ...decisao, estrategia: 'direta', motivo: 'só um modelo disponível agora', principal, apoio, categorias, classificacao: c };
    return { ...decisao, principal, apoio, categorias, classificacao: c };
  }

  // lembrete específico de um modelo, sem mudar a identidade comum
  const paraModelo = (mensagens: MensagemIA[], modelo: string): MensagemIA[] => {
    const ajuste = ajusteDoModelo(modelo);
    if (!ajuste || mensagens[0]?.role !== 'system') return mensagens;
    return [{ role: 'system', content: `${String(mensagens[0].content)}\n\n${ajuste}` }, ...mensagens.slice(1)];
  };

  // Resposta em streaming com troca de modelo: enquanto nada foi para a tela, um modelo que falha ou não responde é trocado.
  async function transmitir(cadeia: string[], mensagens: MensagemIA[], ex: Execucao, conta: { chamadas: number; modelos: string[] }): Promise<{ texto: string; modelo: string | null; consumo: Consumo | null }> {
    let ultimoErro: Error = erroGyde('Nenhum modelo respondeu.', { status: 502 });
    for (const modelo of cadeia.slice(0, MAX_TENTATIVAS)) {
      const prazo = new AbortController();
      let relogio = setTimeout(() => prazo.abort(erroGyde('O modelo demorou demais para começar a responder.', { status: 504 })), PRAZO_PRIMEIRO_TEXTO);
      const sinal = AbortSignal.any([ex.signal, prazo.signal]);
      const filtro = criarFiltro();
      let texto = '', mostrou = false;
      const fim: { consumo: Consumo | null } = { consumo: null };
      const mostrar = (s: string) => { if (s) { texto += s; mostrou = true; ex.aoEscrever(s); } };
      try {
        conta.chamadas++;
        await fila(async () => {
          const r = await router('/v1/chat/completions', { method: 'POST', signal: sinal, registro: ex.registro, body: JSON.stringify({ model: modelo, stream: true, messages: paraModelo(mensagens, modelo) }) });
          if (!r.body) throw erroGyde('O provedor respondeu sem conteúdo.', { status: 502 });
          const consumo: Consumo = { provedor: await provedores.ativo(), modelo: r.headers.get('x-routed-via'), tokens: null };
          const decoder = new TextDecoder();
          let buffer = '';
          for await (const chunk of r.body) {
            clearTimeout(relogio);
            relogio = setTimeout(() => prazo.abort(erroGyde('O modelo parou de responder no meio.', { status: 504 })), PRAZO_ENTRE_PEDACOS);
            buffer += decoder.decode(chunk, { stream: true });
            let nl;
            while ((nl = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (data === '[DONE]') continue;
              let json: PedacoStream;
              try { json = JSON.parse(data) as PedacoStream; } catch { continue; }
              if (json.error) throw erroGyde(json.error.message || 'Erro no provedor.', { status: 502 });
              if (json.model && !consumo.modelo) consumo.modelo = json.model;
              if (json.usage) { consumo.tokens = provedores.tokensDe(json.usage); ex.registro?.tokens(json.usage); }
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) mostrar(filtro.passar(delta));
            }
          }
          mostrar(filtro.terminar());
          fim.consumo = consumo;
        });
        clearTimeout(relogio);
        if (texto.trim()) { conta.modelos.push(fim.consumo?.modelo ?? modelo); return { texto, modelo: fim.consumo?.modelo ?? modelo, consumo: fim.consumo }; }
        ultimoErro = erroGyde(`${modelo} respondeu vazio`, { status: 502 });
      } catch (e) {
        clearTimeout(relogio);
        const err = comoErro(e);
        // o que já apareceu na tela não some: fica como resposta (cortada) em vez de recomeçar com outro modelo
        if (mostrou && !ex.signal.aborted) { conta.modelos.push(modelo); return { texto: `${texto}\n\n*(A resposta foi interrompida pelo provedor. Peça para continuar.)*`, modelo, consumo: null }; }
        if (ex.signal.aborted || err.name === 'AbortError' && !prazo.signal.aborted || err.final || err.status === 429) throw err;
        ultimoErro = err;
      }
    }
    throw ultimoErro;
  }
  // chamada interna, sem streaming: o texto não vai direto para a tela
  async function chamarInterno(cadeia: string[], mensagens: MensagemIA[], ex: Execucao, conta: { chamadas: number; modelos: string[] }, opcoes: { max_tokens?: number; prazo?: number; valida?: (t: string) => boolean; temperature?: number } = {}) {
    const lista = cadeia.slice(0, 4);
    return fila(() => completar(router, {
      aoTentar: () => { conta.chamadas++; },
      cadeia: lista, messages: mensagens, max_tokens: opcoes.max_tokens ?? 4000, temperature: opcoes.temperature ?? 0.3, signal: ex.signal, registro: ex.registro,
      tempoLimite: opcoes.prazo ?? PRAZO_APOIO, ...(opcoes.valida ? { valida: opcoes.valida } : {}),
    }));
  }
  const entregar = (ex: Execucao, texto: string) => { const limpo = limparResposta(texto); ex.aoEscrever(limpo); return limpo; };

  // pede a um segundo modelo real que procure erros. null = sem revisão válida (a resposta segue sem o selo de revisada)
  async function revisar(plano: Plano, mensagens: MensagemIA[], rascunho: string, modeloRascunho: string | null, ex: Execucao, conta: { chamadas: number; modelos: string[] }): Promise<{ problemas: Problema[]; modelo: string } | null> {
    const pedido = [{ role: 'system' as const, content: PROMPT_REVISOR }, { role: 'user' as const, content: `CONVERSA:\n${textoRecente(mensagens, 3, 4000)}\n\nRASCUNHO DE RESPOSTA:\n${rascunho.slice(0, 16_000)}` }];
    for (const revisor of plano.apoio) {
      try {
        const r = await chamarInterno([revisor], pedido, ex, conta, { max_tokens: 900, temperature: 0.1, valida: (t) => Boolean(lerRevisao(t)) });
        if (mesmoModeloReal(r.modelo, modeloRascunho)) continue; // outro apelido, mesmo modelo: não é revisão independente
        conta.modelos.push(r.modelo);
        return { problemas: lerRevisao(r.texto) ?? [], modelo: r.modelo };
      } catch (e) {
        const err = comoErro(e);
        if (ex.signal.aborted || err.name === 'AbortError' || err.status === 429) break;
      }
    }
    return null;
  }

  async function revisadaAPartirDe(plano: Plano, mensagens: MensagemIA[], ex: Execucao, conta: { chamadas: number; modelos: string[] }) {
    ex.aoStatus?.('Escrevendo a resposta…');
    const r = await chamarInterno(plano.principal, mensagens, ex, conta, { prazo: PRAZO_RASCUNHO, max_tokens: 4000 });
    conta.modelos.push(r.modelo);
    const rascunho = limparResposta(r.texto);
    ex.aoStatus?.('Conferindo com outro modelo…');
    const rev = await revisar(plano, mensagens, rascunho, r.modelo, ex, conta);
    // só problema grave reescreve: nas avaliações, apontamentos menores do revisor chegaram a estragar respostas certas
    const graves = rev?.problemas.filter((p) => p.gravidade === 'alta') ?? [];
    if (!graves.length) return { texto: entregar(ex, rascunho), modelo: r.modelo, revisadaPorOutro: Boolean(rev), mudou: false };
    ex.aoStatus?.('Corrigindo o que a revisão encontrou…');
    try {
      const final = await transmitir(plano.principal, [...mensagens, { role: 'assistant', content: rascunho }, { role: 'user', content: `${PROMPT_REESCRITA}\n\nPROBLEMAS APONTADOS:\n${formatarProblemas(graves)}` }], ex, conta);
      return { texto: final.texto, modelo: final.modelo, revisadaPorOutro: true, mudou: true };
    } catch (e) {
      if (ex.signal.aborted) throw e;
      return { texto: entregar(ex, rascunho), modelo: r.modelo, revisadaPorOutro: false, mudou: false }; // correção falhou: fica o rascunho, sem o selo
    }
  }

  async function comparada(plano: Plano, mensagens: MensagemIA[], ex: Execucao, conta: { chamadas: number; modelos: string[] }) {
    ex.aoStatus?.('Consultando dois modelos…');
    const segundo = [...plano.principal.slice(1), ...plano.apoio].filter((m) => m !== plano.principal[0] && m !== 'auto');
    const [a, b] = await Promise.allSettled([
      chamarInterno(plano.principal.slice(0, 1).concat(plano.principal.at(-1) === 'auto' ? ['auto'] : []), mensagens, ex, conta, { prazo: PRAZO_RASCUNHO }),
      chamarInterno(segundo.slice(0, 2), mensagens, ex, conta, { prazo: PRAZO_RASCUNHO }),
    ]);
    if (ex.signal.aborted) throw erroGyde('Cancelado', { name: 'AbortError' });
    const ok = [a, b].flatMap((x) => (x.status === 'fulfilled' ? [x.value] : []));
    if (!ok.length) return { ...(await transmitirDireta(plano, mensagens, ex, conta)), revisadaPorOutro: false, mudou: false };
    for (const r of ok) conta.modelos.push(r.modelo);
    const [ra, rb] = ok.map((r) => ({ ...r, texto: limparResposta(r.texto) })) as [{ texto: string; modelo: string }, { texto: string; modelo: string } | undefined];
    // só um respondeu, ou os dois são o mesmo modelo real: não existe comparação para fazer
    if (!rb || mesmoModeloReal(ra.modelo, rb.modelo) || ra.texto === rb.texto) return { texto: entregar(ex, ra.texto), modelo: ra.modelo, revisadaPorOutro: false, mudou: false };
    ex.aoStatus?.('Comparando as respostas…');
    try {
      const final = await transmitir(plano.principal, [...mensagens, { role: 'user', content: `${PROMPT_SINTESE}\n\n<resposta_1>\n${ra.texto.slice(0, 16_000)}\n</resposta_1>\n\n<resposta_2>\n${rb.texto.slice(0, 16_000)}\n</resposta_2>` }], ex, conta);
      return { texto: final.texto, modelo: final.modelo, revisadaPorOutro: true, mudou: true };
    } catch (e) {
      if (ex.signal.aborted) throw e;
      return { texto: entregar(ex, ra.texto), modelo: ra.modelo, revisadaPorOutro: false, mudou: false };
    }
  }

  async function especialistas(plano: Plano, mensagens: MensagemIA[], ex: Execucao, conta: { chamadas: number; modelos: string[] }) {
    ex.aoStatus?.('Analisando os requisitos…');
    let analise = '';
    try {
      const r = await chamarInterno(catalogo.cadeia(['analise', 'raciocinio'], { max: 3, excluir: [plano.principal[0]!] }).filter((m) => m !== 'auto'), [{ role: 'system', content: PROMPT_ANALISTA }, { role: 'user', content: textoRecente(mensagens, 4, 8000) }], ex, conta, { max_tokens: 700, temperature: 0.2 });
      analise = limparResposta(r.texto);
      conta.modelos.push(r.modelo);
    } catch (e) { if (ex.signal.aborted) throw e; /* sem análise: segue com escrita + revisão */ }
    const comAnalise: MensagemIA[] = analise && mensagens[0]?.role === 'system'
      ? [{ role: 'system', content: `${String(mensagens[0].content)}\n\nANÁLISE TÉCNICA FEITA ANTES (material interno, a pessoa não viu; use o que for útil e não a cite):\n${analise}` }, ...mensagens.slice(1)]
      : mensagens;
    return revisadaAPartirDe(plano, comAnalise, ex, conta);
  }

  async function transmitirDireta(plano: Plano, mensagens: MensagemIA[], ex: Execucao, conta: { chamadas: number; modelos: string[] }) {
    const r = await transmitir(plano.principal, mensagens, ex, conta);
    return { texto: r.texto, modelo: r.modelo, consumo: r.consumo };
  }

  async function executar(plano: Plano, ex: Execucao & { userId?: string | null; origem?: string }): Promise<Resposta> {
    const inicio = Date.now();
    const conta = { chamadas: 0, modelos: [] as string[] };
    const c = plano.classificacao;
    let mostrou = false;
    const aoEscrever = (t: string) => { mostrou = true; ex.aoEscrever(t); };
    const relogio = plano.estrategia === 'direta' ? null : new AbortController();
    const estouro = relogio ? setTimeout(() => relogio.abort(erroGyde('A colaboração entre modelos passou do prazo.', { status: 504 })), PRAZO_COLABORACAO) : null;
    const trabalho: Execucao = { ...ex, aoEscrever, signal: relogio ? AbortSignal.any([ex.signal, relogio.signal]) : ex.signal };
    const registrar = (estrategia: string, modelos: string[], resultado: string, mudou: boolean) => desempenho?.decisao({
      userId: ex.userId ?? null, origem: ex.origem ?? 'chat', tarefa: c.tarefa, complexidade: c.complexidade, estrategia, motivo: plano.motivo, modelos, chamadas: conta.chamadas, ms: Date.now() - inicio, resultado, mudou,
    });
    try {
      const r: { texto: string; modelo: string | null; revisadaPorOutro?: boolean; mudou?: boolean; consumo?: Consumo | null } =
        await (async () => {
          try {
            return plano.estrategia === 'revisada' ? await revisadaAPartirDe(plano, ex.mensagens, trabalho, conta)
              : plano.estrategia === 'comparada' ? await comparada(plano, ex.mensagens, trabalho, conta)
                : plano.estrategia === 'especialistas' ? await especialistas(plano, ex.mensagens, trabalho, conta)
                  : await transmitirDireta(plano, ex.mensagens, trabalho, conta);
          } catch (e) {
            // a colaboração falhou antes de mostrar qualquer coisa: a pessoa ainda recebe a resposta de um modelo
            if (plano.estrategia === 'direta' || mostrou || ex.signal.aborted || comoErro(e).status === 429) throw e;
            ex.aoStatus?.('Respondendo com um modelo só…');
            return { ...(await transmitirDireta(plano, ex.mensagens, { ...ex, aoEscrever }, conta)), revisadaPorOutro: false, mudou: false };
          } finally { if (estouro) clearTimeout(estouro); }
        })();
      const modelos = [...new Set(conta.modelos)];
      registrar(plano.estrategia, modelos, 'ok', Boolean(r.mudou));
      return {
        texto: r.texto, modelo: r.modelo, estrategia: plano.estrategia, motivo: plano.motivo, chamadas: conta.chamadas, modelos,
        revisadaPorOutro: Boolean(r.revisadaPorOutro) && modelos.length > 1, mudou: Boolean(r.mudou),
        consumo: r.consumo ?? (r.modelo ? { provedor: await provedores.ativo(), modelo: r.modelo, tokens: null } : null),
      };
    } catch (e) {
      registrar(plano.estrategia, [...new Set(conta.modelos)], ex.signal.aborted ? 'cancelado' : 'erro', false);
      throw e;
    }
  }

  // A Forja pede uma leitura independente das mudanças. O revisor só lê: quem mexe nos arquivos é sempre um modelo por vez.
  async function revisarTrabalho({ tarefa, mudancas, modeloAutor, modo, desligados, signal, registro }: { tarefa: string; mudancas: string; modeloAutor: string | null; modo: ModoResposta; desligados: string[]; signal: AbortSignal; registro?: Registro | undefined }) {
    if (await provedores.ativo() === 'offline') return null;
    await catalogo.atualizar();
    const apoio = catalogo.cadeia(['revisao'], { modo, desligados, tamanho: mudancas.length, max: 3, reserva: CADEIAS['gyde-1'] ?? [], ...(modeloAutor ? { excluir: [modeloAutor] } : {}) }).filter((m) => m !== 'auto');
    if (!apoio.length) return null;
    const plano = { apoio } as Plano;
    return revisar(plano, [{ role: 'user', content: tarefa }], mudancas, modeloAutor, { mensagens: [], signal, registro, aoEscrever: () => {} }, { chamadas: 0, modelos: [] });
  }

  return { planejar, executar, revisarTrabalho };
}
export type Orquestrador = ReturnType<typeof criarOrquestrador>;
