// O que o Gyde observa de cada modelo em uso real neste computador: taxa de sucesso, tempo até começar a responder, limites.
// Só números e nomes de modelos; nenhum texto de conversa entra aqui. Os limites de provedor chegam prontos nas respostas
// (429, 413): o Gyde não adivinha cota, ele só deixa de insistir por um tempo em quem acabou de recusar.
import { randomUUID } from 'node:crypto';
import type { Db } from '../tipos.ts';
import { consulta } from '../tipos.ts';
import type { TipoErroIA } from './adaptadores.ts';

export interface Observacao { modelo: string; via?: string | null; ok: boolean; tipo?: TipoErroIA | null; ms: number; tamanho: number; agora?: number }
export interface EstatisticaModelo { chamadas: number; falhas: number; limites: number; taxaOk: number; ms: number | null }
export interface Decisao { userId: string | null; origem: string; tarefa: string; complexidade: number; estrategia: string; motivo: string; modelos: string[]; chamadas: number; ms: number; resultado: string; mudou: boolean }

const SUAVIZACAO = 0.15; // peso de cada observação nova na média (as recentes valem mais: cota e roteamento mudam)
const FRIO_LIMITE = 60_000, FRIO_FALHA = 30_000, FRIO_MAX = 600_000, TETO_VALE = 5 * 60_000;
const MAX_DECISOES = 5000;

interface Linha { modelo: string; chamadas: number; falhas: number; limites: number; taxa_ok: number; ms: number | null }

export function criarDesempenho(db: Db) {
  const q = {
    ler: consulta<Linha>(db, 'SELECT modelo, chamadas, falhas, limites, taxa_ok, ms FROM ia_modelos WHERE modelo = ?'),
    todos: consulta<Linha>(db, 'SELECT modelo, chamadas, falhas, limites, taxa_ok, ms FROM ia_modelos ORDER BY chamadas DESC LIMIT 100'),
    gravar: db.prepare(`INSERT INTO ia_modelos (modelo, chamadas, falhas, limites, taxa_ok, ms, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(modelo) DO UPDATE SET chamadas = excluded.chamadas, falhas = excluded.falhas, limites = excluded.limites,
                          taxa_ok = excluded.taxa_ok, ms = excluded.ms, atualizado_em = excluded.atualizado_em`),
    decisao: db.prepare(`INSERT INTO ia_decisoes (id, user_id, origem, tarefa, complexidade, estrategia, motivo, modelos, chamadas, ms, resultado, mudou, em)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    podar: db.prepare('DELETE FROM ia_decisoes WHERE id IN (SELECT id FROM ia_decisoes ORDER BY em DESC LIMIT -1 OFFSET ?)'),
    resumo: consulta<{ estrategia: string; n: number; chamadas: number; ms: number; mudou: number }>(db, 'SELECT estrategia, COUNT(*) AS n, SUM(chamadas) AS chamadas, AVG(ms) AS ms, SUM(mudou) AS mudou FROM ia_decisoes WHERE user_id = ? GROUP BY estrategia'),
  };
  const frio = new Map<string, { ate: number; seguidas: number }>();
  const tetos = new Map<string, { chars: number; ate: number }>(); // maior pedido que o modelo provou não aceitar agora

  function observar({ modelo, ok, tipo, ms, tamanho, agora = Date.now() }: Observacao) {
    const a = q.ler.get(modelo);
    const taxa = a ? a.taxa_ok * (1 - SUAVIZACAO) + (ok ? SUAVIZACAO : 0) : ok ? 1 : 0;
    const tempo = ok ? (a?.ms != null ? a.ms * (1 - SUAVIZACAO) + ms * SUAVIZACAO : ms) : (a?.ms ?? null);
    q.gravar.run(modelo, (a?.chamadas ?? 0) + 1, (a?.falhas ?? 0) + (ok ? 0 : 1), (a?.limites ?? 0) + (tipo === 'limite' || tipo === 'tamanho' ? 1 : 0), taxa, tempo, agora);
    if (ok) { frio.delete(modelo); return; }
    if (tipo === 'tamanho') { // pedido grande demais agora: pedidos menores ainda podem passar
      const t = tetos.get(modelo);
      tetos.set(modelo, { chars: t && t.ate > agora ? Math.min(t.chars, tamanho) : tamanho, ate: agora + TETO_VALE });
      return;
    }
    if (tipo === 'chave' || tipo === 'outro') return; // não é disponibilidade do modelo
    const seguidas = (frio.get(modelo)?.seguidas ?? 0) + 1;
    const base = tipo === 'limite' ? FRIO_LIMITE : FRIO_FALHA;
    frio.set(modelo, { ate: agora + Math.min(base * 2 ** (seguidas - 1), FRIO_MAX), seguidas });
  }

  const disponivel = (modelo: string, tamanho = 0, agora = Date.now()) => {
    const f = frio.get(modelo);
    if (f && f.ate > agora) return false;
    const t = tetos.get(modelo);
    return !(t && t.ate > agora && tamanho >= t.chars);
  };

  const estatistica = (modelo: string): EstatisticaModelo | null => {
    const l = q.ler.get(modelo);
    return l ? { chamadas: l.chamadas, falhas: l.falhas, limites: l.limites, taxaOk: l.taxa_ok, ms: l.ms } : null;
  };

  let contagem = 0;
  function decisao(d: Decisao) {
    q.decisao.run(randomUUID(), d.userId, d.origem, d.tarefa, d.complexidade, d.estrategia, d.motivo.slice(0, 200), JSON.stringify(d.modelos), d.chamadas, d.ms, d.resultado, d.mudou ? 1 : 0, Date.now());
    if (++contagem % 100 === 0) q.podar.run(MAX_DECISOES);
  }

  return {
    observar, disponivel, estatistica, decisao,
    todos: () => q.todos.all().map((l) => ({ modelo: l.modelo, chamadas: l.chamadas, falhas: l.falhas, limites: l.limites, taxaOk: l.taxa_ok, ms: l.ms, descansando: !disponivel(l.modelo) })),
    resumoDecisoes: (userId: string) => q.resumo.all(userId),
    apagarDecisoes: (userId: string) => db.prepare('DELETE FROM ia_decisoes WHERE user_id = ?').run(userId),
  };
}
export type Desempenho = ReturnType<typeof criarDesempenho>;
