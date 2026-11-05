// Antes e depois: as mesmas tarefas e a mesma correção automática de avaliar-modelos.mjs, passando pelo Gyde inteiro.
//   legado         a ordem fixa de modelos e as instruções de antes do núcleo multimodelo
//   direta         núcleo novo, um modelo escolhido pelas medições
//   revisada       um modelo escreve, outro procura erros, o primeiro corrige
//   comparada      duas respostas independentes e uma síntese
//   especialistas  análise, implementação e verificação (só tarefas de software)
//   auto           o que o Gyde decide sozinho no modo equilibrado
//   capricho       o que o Gyde decide sozinho no modo capricho
// Grava acerto, chamadas, tempo e modelos. Amostra pequena: serve para decidir os padrões do Gyde, não para comparar com outros produtos.
//   node ferramentas/avaliar-estrategias.mjs [--estrategias a,b] [--categorias a,b] [--repeticoes 2] [--juntos 3] [--saida arquivo.json]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TAREFAS } from './avaliacao-tarefas.mjs';
import { migrar } from '../pacotes/servidor/banco.ts';
import { criarProvedores } from '../pacotes/servidor/provedores.ts';
import { criarCatalogo } from '../pacotes/servidor/ia/catalogo.ts';
import { criarDesempenho } from '../pacotes/servidor/ia/desempenho.ts';
import { criarOrquestrador } from '../pacotes/servidor/ia/orquestrador.ts';
import { classificar } from '../pacotes/servidor/ia/classificar.ts';
import { sistemaDoChat } from '../pacotes/servidor/ia/prompts.ts';
import { tamanhoDe } from '../pacotes/servidor/ia/contexto.ts';
import { completar } from '../pacotes/servidor/motor.ts';

const RAIZ = path.join(import.meta.dirname, '..');
const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const env = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const ESTRATEGIAS = arg('estrategias', 'legado,direta,revisada,comparada,especialistas,auto,capricho').split(',');
const FORA = new Set(['agente', 'revisao', 'ferramentas', 'visao', 'agente-grande']); // têm avaliação própria
const SO = arg('categorias', null)?.split(',');
const LISTA = TAREFAS.filter((t) => !FORA.has(t.categoria) && (!SO || SO.includes(t.categoria)));
const REPETICOES = Number(arg('repeticoes', '2'));
const JUNTOS = Number(arg('juntos', '3'));
const PAUSA = Number(arg('pausa', '6000'));
const SAIDA = arg('saida', null);
const SOFTWARE = new Set(['codigo', 'sql', 'frontend', 'backend']);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const db = new DatabaseSync(':memory:');
migrar(db);
const desempenho = criarDesempenho(db);
const provedores = criarProvedores({ routerUrl: (env.FREELLMAPI_URL || 'http://127.0.0.1:31415').replace(/\/v1\/?$/, ''), routerKey: env.FREELLMAPI_KEY, ollamaUrl: 'http://127.0.0.1:1', ollamaModelo: 'nenhum', modo: 'online', desempenho });
const catalogo = criarCatalogo({ router: provedores.router, desempenho });
const orq = criarOrquestrador({ router: provedores.router, provedores, catalogo, desempenho });

// como o Gyde era antes: ordem fixa e as instruções únicas para tudo
const LEGADO = { cadeia: ['qwen3.8-27b', 'gpt-oss-120b', 'codestral', 'claude-sonnet-4-5', 'auto'], sistema: 'Você é o Gyde, um tutor de programação simpático para iniciantes brasileiros. Responda em português do Brasil, com linguagem simples; explique termos técnicos na primeira vez que aparecerem. Ao corrigir um erro: diga em uma frase o que ele significa, mostre a linha ou trecho culpado, explique a causa e só então mostre a correção. Ao revisar código: aponte primeiro o que está bom, depois os problemas em ordem de importância, sempre dizendo o porquê. Quando o usuário pedir um exercício, não entregue a resposta; corrija a solução dele depois, com dicas antes da resposta completa. Prefira exemplos curtos e comentados. Não invente funções ou bibliotecas; se não tiver certeza, diga.\n\nUse Markdown quando ajudar: títulos, listas, tabelas e blocos de código sempre com a linguagem indicada.\n\nNunca use emojis. Se precisar de ícones, use apenas símbolos tipográficos simples como ✓, ✗, →, •, ⚠︎, ★.' };

const semSistema = (t) => t.mensagens.filter((m) => m.role !== 'system');

async function rodar(estrategia, t) {
  const inicio = Date.now();
  const sinal = AbortSignal.timeout(300_000);
  if (estrategia === 'legado') {
    const r = await completar(provedores.router, { cadeia: LEGADO.cadeia, messages: [{ role: 'system', content: LEGADO.sistema }, ...semSistema(t)], max_tokens: 2000, temperature: 0.7, signal: sinal, tempoLimite: 90_000 });
    return { texto: r.texto, chamadas: 1, modelos: [r.modelo], estrategia, ms: Date.now() - inicio };
  }
  const ultima = String(semSistema(t).at(-1).content);
  const c = classificar(ultima);
  const mensagens = [{ role: 'system', content: sistemaDoChat({ tarefa: c.tarefa, extras: [] }) }, ...semSistema(t)];
  const modo = estrategia === 'auto' ? 'equilibrado' : estrategia === 'capricho' ? 'capricho' : 'capricho';
  const plano = await orq.planejar(c, { modo, tamanho: tamanhoDe(mensagens), reserva: LEGADO.cadeia.slice(0, -1) });
  if (!['auto', 'capricho'].includes(estrategia)) {
    plano.estrategia = estrategia; // força a estratégia, mesmo onde o Gyde não a escolheria
    if (estrategia !== 'direta' && !plano.apoio.length) plano.apoio = catalogo.cadeia(['revisao'], { excluir: [plano.principal[0]], max: 3 }).filter((m) => m !== 'auto');
  }
  let texto = '';
  const r = await orq.executar(plano, { mensagens, signal: sinal, aoEscrever: (x) => { texto += x; } });
  return { texto, chamadas: r.chamadas, modelos: r.modelos, estrategia: r.estrategia, revisada: r.revisadaPorOutro, mudou: r.mudou, tarefa: c.tarefa, ms: Date.now() - inicio };
}

const resultados = [];
const gravar = () => { if (SAIDA) writeFileSync(SAIDA, JSON.stringify({ em: new Date().toISOString(), repeticoes: REPETICOES, estrategias: ESTRATEGIAS, resultados }, null, 1)); };
const pedidos = [];
for (const e of ESTRATEGIAS) for (const t of LISTA) for (let n = 0; n < REPETICOES; n++) if (e !== 'especialistas' || SOFTWARE.has(t.categoria)) pedidos.push([e, t]);

await catalogo.atualizar();
await Promise.all(Array.from({ length: JUNTOS }, async () => {
  while (pedidos.length) {
    const [e, t] = pedidos.shift();
    let linha;
    try {
      const r = await rodar(e, t);
      const nota = r.texto.trim() ? t.corrigir(r.texto) : { ok: false, motivo: 'resposta vazia' };
      linha = { pedida: e, usada: r.estrategia, tarefa: t.id, categoria: t.categoria, ok: nota.ok, motivo: nota.motivo, chamadas: r.chamadas, modelos: r.modelos, ms: r.ms, revisada: r.revisada ?? false, mudou: r.mudou ?? false, erro: false };
    } catch (err) {
      linha = { pedida: e, usada: null, tarefa: t.id, categoria: t.categoria, ok: false, motivo: String(err.message).slice(0, 120), chamadas: 0, modelos: [], ms: 0, revisada: false, mudou: false, erro: true };
    }
    resultados.push(linha);
    gravar();
    console.log(`${linha.ok ? 'OK   ' : 'FALHA'} ${e.padEnd(14)} ${t.id.padEnd(22)} ${String(linha.ms).padStart(6)} ms  ${String(linha.chamadas).padStart(2)} ch  ${String(linha.usada).padEnd(13)} ${linha.modelos.join(', ').slice(0, 60)}  ${linha.motivo.slice(0, 70)}`);
    await espera(PAUSA);
  }
}));
gravar();

const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
console.log('\nResumo (acertos / respondidas, chamadas por pedido, tempo mediano):');
for (const e of ESTRATEGIAS) {
  const rs = resultados.filter((r) => r.pedida === e), ok = rs.filter((r) => !r.erro);
  if (!rs.length) continue;
  console.log(`${e.padEnd(14)} ${ok.filter((r) => r.ok).length}/${ok.length} (${rs.length - ok.length} erros)  ${(ok.reduce((a, r) => a + r.chamadas, 0) / (ok.length || 1)).toFixed(1)} ch  ${mediana(ok.map((r) => r.ms))} ms`);
}
process.exit(0);
