// Contabilização de uso do Gyde: UMA linha por pedido do usuário (uma mensagem do chat, uma tarefa da Forja,
// uma dica da Prática), mesmo que por dentro o Gyde tenha chamado o provedor várias vezes (troca de modelo,
// rodadas da Forja). As chamadas ficam em `chamadas`, para não contar o mesmo pedido duas vezes.
// Tokens só entram quando o provedor informa (campo usage); senão ficam NULL ("não informado"), nunca estimados.
// Isto é o registro do Gyde neste computador, não o saldo oficial de nenhum provedor.
import { randomUUID } from 'node:crypto';
import type { Db, Registro, Resultado, UsoInformado } from './tipos.ts';
import { comoErro, consulta } from './tipos.ts';

export interface TotaisPeriodo {
  pedidos: number; concluidos: number; falhas: number; cancelados: number; limite: number;
  chamadas: number; chamadasFalhas: number; tokensEntrada: number; tokensSaida: number; semTokens: number;
}
interface LinhaPeriodo { provedor: string | null; resultado: Resultado; pedidos: number; chamadas: number | null; falhas: number | null; entrada: number | null; saida: number | null; sem_tokens: number | null }

const DIA = 86_400_000;
const RESULTADOS: Resultado[] = ['ok', 'erro', 'cancelado', 'limite'];

export function criarUso(db: Db) {
  const q = {
    inserir: db.prepare(`INSERT INTO uso_registros (id, user_id, origem, provedor, modelo, resultado, chamadas, chamadas_falhas, tokens_entrada, tokens_saida, erro, inicio, duracao_ms)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    periodo: db.prepare(`SELECT provedor, resultado, COUNT(*) AS pedidos, SUM(chamadas) AS chamadas, SUM(chamadas_falhas) AS falhas,
                           SUM(tokens_entrada) AS entrada, SUM(tokens_saida) AS saida, SUM(tokens_entrada IS NULL AND resultado = 'ok') AS sem_tokens
                         FROM uso_registros WHERE user_id = ? AND inicio >= ? GROUP BY provedor, resultado`),
    ultimos: consulta<{ origem: string; provedor: string | null; modelo: string | null; resultado: Resultado; chamadas: number; tokens_entrada: number | null; tokens_saida: number | null; erro: string | null; inicio: number; duracao_ms: number }>(db, 'SELECT origem, provedor, modelo, resultado, chamadas, tokens_entrada, tokens_saida, erro, inicio, duracao_ms FROM uso_registros WHERE user_id = ? ORDER BY inicio DESC LIMIT ?'),
    internas: db.prepare('SELECT COUNT(*) AS n FROM uso_registros WHERE user_id IS NULL AND inicio >= ?'),
    apagar: db.prepare('DELETE FROM uso_registros WHERE user_id = ?'),
  };

  // Começa o registro de um pedido. O provedores.js chama `chamada()` a cada ida ao provedor.
  function iniciar(userId: string | null, origem: string): Registro {
    const r = {
      id: randomUUID(), inicio: Date.now(), provedor: null as string | null, modelo: null as string | null, chamadas: 0, falhas: 0,
      entrada: null as number | null, saida: null as number | null, fechado: false,
      chamada({ provedor, modelo, ok }: { provedor?: string | null; modelo?: string | null; ok: boolean }) {
        r.chamadas++; if (!ok) r.falhas++;
        if (provedor) r.provedor = provedor;
        if (modelo && ok) r.modelo = modelo;
      },
      tokens(usage?: UsoInformado | null) { // soma o que o provedor informou (a Forja faz várias rodadas)
        if (!usage) return;
        if (usage.prompt_tokens != null) r.entrada = (r.entrada || 0) + usage.prompt_tokens;
        if (usage.completion_tokens != null) r.saida = (r.saida || 0) + usage.completion_tokens;
      },
      fim(resultado: Resultado, erro?: string | null) {
        if (r.fechado) return; r.fechado = true; // fechar duas vezes não conta duas vezes
        q.inserir.run(r.id, userId ?? null, origem, r.provedor, r.modelo, RESULTADOS.includes(resultado) ? resultado : 'erro',
          r.chamadas, r.falhas, r.entrada, r.saida, erro ? String(erro).slice(0, 300) : null, r.inicio, Date.now() - r.inicio);
      },
    };
    return r;
  }

  // Resultado de um erro: limite (429), cancelado (Parar) ou erro.
  const resultadoDe = (e: unknown): Resultado => { const err = e == null ? null : comoErro(e); return (err?.name === 'AbortError' ? 'cancelado' : err?.status === 429 ? 'limite' : 'erro'); };

  function periodo(userId: string, desde: number): Record<string, TotaisPeriodo> {
    const vazio = (): TotaisPeriodo => ({ pedidos: 0, concluidos: 0, falhas: 0, cancelados: 0, limite: 0, chamadas: 0, chamadasFalhas: 0, tokensEntrada: 0, tokensSaida: 0, semTokens: 0 });
    const porProvedor: Record<string, TotaisPeriodo> = {};
    for (const l of q.periodo.all(userId, desde) as unknown as LinhaPeriodo[]) {
      const p = (porProvedor[l.provedor || 'nenhum'] ||= vazio());
      p.pedidos += l.pedidos; p.chamadas += l.chamadas || 0; p.chamadasFalhas += l.falhas || 0;
      p.tokensEntrada += l.entrada || 0; p.tokensSaida += l.saida || 0; p.semTokens += l.sem_tokens || 0;
      const chave = ({ ok: 'concluidos', erro: 'falhas', cancelado: 'cancelados', limite: 'limite' } as const)[l.resultado];
      p[chave] += l.pedidos;
    }
    return porProvedor; // separado por provedor: cotas de provedores diferentes não se somam
  }

  function resumo(userId: string, { mostrarInternas = false } = {}) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return {
      hoje: periodo(userId, hoje.getTime()),
      semana: periodo(userId, Date.now() - 7 * DIA),
      ultimos: q.ultimos.all(userId, 8),
      internasHoje: mostrarInternas ? (q.internas.get(hoje.getTime()) as { n: number }).n : null,
    };
  }

  return { iniciar, resultadoDe, resumo, apagarDe: (userId: string) => q.apagar.run(userId) };
}

export type Uso = ReturnType<typeof criarUso>;
