// Estado da conversa da Forja: transforma os eventos do servidor (histórico ou ao vivo) em itens da tela.
// Função pura, sem DOM: a mesma lógica serve para o histórico e para o ao vivo, e é testada com node --test.

export interface AnexoSalvo { id: string; nome: string; tipo: 'imagem' | 'arquivo'; arquivo: string; tamanho: number }
export interface Mudancas { criados: string[]; modificados: string[]; apagados: string[]; comandos: { comando: string; ok: boolean; codigo: number | null }[] }
export type Diff = { caminho?: string; antes?: string; depois?: string; novo?: string; criado?: boolean };

export interface EtapaAcao {
  tipo: 'acao'; nome: string; args: Record<string, unknown>; pensamento: string;
  estado: 'rodando' | 'ok' | 'falhou' | 'interrompido'; resumo?: string; saida?: string; diff?: Diff;
}
export interface EtapaConfirmacao { tipo: 'confirmacao'; id: string; acao: string; motivo: string; resposta: boolean | null; aoVivo: boolean }
export type Etapa = EtapaAcao | EtapaConfirmacao;

export interface FimTurno {
  estado: 'ok' | 'parado' | 'erro' | 'interrompido'; texto: string; duracaoMs: number;
  acoes: number; arquivos: number; comandos: number; mudancas?: Mudancas; modelo?: string;
}
export interface Turno { tipo: 'turno'; chave: number; texto: string; anexos: AnexoSalvo[]; inicio: number; etapas: Etapa[]; pensando: boolean; fim: FimTurno | null }
export type Item = Turno | { tipo: 'desfeito'; chave: number; texto: string } | { tipo: 'reconectado'; chave: number; para: string };

// Evento como chega do servidor (o tipo diz quais campos existem).
export type Evento = { tipo: string; em?: number; [campo: string]: unknown };

const MUDA = new Set(['escrever', 'editar', 'apagar']);
let proximaChave = 1;

function ultimoTurno(itens: Item[]): Turno | undefined {
  for (let i = itens.length - 1; i >= 0; i--) { const it = itens[i]; if (it?.tipo === 'turno') return it; }
  return undefined;
}

function fechar(turno: Turno, ev: Evento, estado: FimTurno['estado'], agora: number) {
  const acoes = turno.etapas.filter((e): e is EtapaAcao => e.tipo === 'acao');
  for (const a of acoes) if (a.estado === 'rodando') a.estado = 'interrompido';
  for (const c of turno.etapas) if (c.tipo === 'confirmacao') c.aoVivo = false;
  const alterados = new Set(acoes.filter((a) => a.estado === 'ok' && MUDA.has(a.nome)).map((a) => String(a.args.caminho ?? '')));
  turno.pensando = false;
  turno.fim = {
    estado,
    texto: String(ev.texto ?? ''),
    duracaoMs: typeof ev.duracao_ms === 'number' ? ev.duracao_ms : Math.max(0, agora - turno.inicio),
    acoes: acoes.length,
    arquivos: Array.isArray(ev.arquivos) ? ev.arquivos.length : alterados.size,
    comandos: typeof ev.comandos === 'number' ? ev.comandos : acoes.filter((a) => a.nome === 'executar').length,
    ...(ev.mudancas ? { mudancas: ev.mudancas as Mudancas } : {}),
    ...(typeof ev.modelo === 'string' ? { modelo: ev.modelo } : {}),
  };
}

// Aplica um evento à lista de itens (altera a lista; o Svelte reage às mudanças).
export function aplicar(itens: Item[], ev: Evento, aoVivo = false, agora = Date.now()): void {
  if (ev.tipo === 'desfeito') { itens.push({ tipo: 'desfeito', chave: proximaChave++, texto: String(ev.texto ?? '') }); return; }
  if (ev.tipo === 'reconectado') { itens.push({ tipo: 'reconectado', chave: proximaChave++, para: String(ev.para ?? '') }); return; }
  if (ev.tipo === 'tarefa') {
    const inicio = aoVivo ? agora : Number(ev.inicio ?? ev.em ?? agora);
    itens.push({ tipo: 'turno', chave: proximaChave++, texto: String(ev.texto ?? ''), anexos: (ev.anexos as AnexoSalvo[]) ?? [], inicio, etapas: [], pensando: false, fim: null });
    return;
  }
  const turno = ultimoTurno(itens);
  if (!turno || turno.fim) return;
  turno.pensando = false;
  switch (ev.tipo) {
    case 'pensando': turno.pensando = aoVivo; break;
    case 'ferramenta':
      turno.etapas.push({ tipo: 'acao', nome: String(ev.nome), args: (ev.args as Record<string, unknown>) ?? {}, pensamento: String(ev.pensamento ?? ''), estado: 'rodando' });
      break;
    case 'resultado': {
      const rodando = [...turno.etapas].reverse().find((e): e is EtapaAcao => e.tipo === 'acao' && e.estado === 'rodando');
      if (rodando) Object.assign(rodando, { estado: ev.ok ? 'ok' : 'falhou', resumo: String(ev.resumo ?? ''), saida: String(ev.saida ?? ''), diff: ev.diff as Diff | undefined });
      break;
    }
    case 'confirmar':
      turno.etapas.push({ tipo: 'confirmacao', id: String(ev.id), acao: String(ev.acao ?? ''), motivo: String(ev.motivo ?? ''), resposta: null, aoVivo });
      break;
    case 'confirmacao': {
      const c = turno.etapas.find((e): e is EtapaConfirmacao => e.tipo === 'confirmacao' && e.id === ev.id);
      if (c) { c.resposta = Boolean(ev.aprovado); c.aoVivo = false; }
      break;
    }
    case 'resposta': fechar(turno, ev, 'ok', ev.em ?? agora); break;
    case 'erro': fechar(turno, ev, ev.texto === 'Parado por você.' ? 'parado' : 'erro', ev.em ?? agora); break;
  }
}

// Turnos que ficaram sem fim no histórico (servidor reiniciado no meio) fecham como "interrompido".
export function fecharPendentes(itens: Item[], quando: number): void {
  for (const it of itens) if (it.tipo === 'turno' && !it.fim) fechar(it, { tipo: 'erro', texto: 'Interrompido' }, 'interrompido', quando);
}

export const duracao = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`; };
export const relogio = (ms: number) => { const s = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
