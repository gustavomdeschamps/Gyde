// Avaliação dos modelos do FreeLLMAPI nas tarefas do Gyde, com chamadas reais e correção automática.
// Limite do provedor (413/429/sem resposta) é contado à parte: não é erro do modelo, é indisponibilidade naquele minuto.
// Não usa números de fora: cada resultado vem de uma resposta conferida aqui (código executado contra testes,
// formato JSON conferido, cor da imagem conferida). Amostra pequena: serve para comparar, não para ranking geral.
//   node ferramentas/avaliar-modelos.mjs [--modelos a,b,c] [--tarefas id,categoria] [--repeticoes 2] [--juntos 4] [--saida arquivo.json]
// As tarefas estão em avaliacao-tarefas.mjs. Depois: node ferramentas/gerar-medicoes.mjs (grava o que o orquestrador usa).
// Lê FREELLMAPI_URL e FREELLMAPI_KEY do .env da raiz (a chave nunca é mostrada nem gravada).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TAREFAS } from './avaliacao-tarefas.mjs';
import { PROVEDORES_GRATIS } from '../pacotes/servidor/ia/provedores-gratis.ts';
import { redigir as redigirChaves } from '../pacotes/servidor/seguranca.ts';
const redigir = (t) => redigirChaves(t).replace(/org_[A-Za-z0-9]{10,}/g, 'org_[oculto]'); // sem chaves e sem o ID da conta no provedor

const RAIZ = path.join(import.meta.dirname, '..');
const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const env = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
// --provedor groq|google|nvidia|mistral: direto no provedor, sem o FreeLLMAPI. Os modelos ficam gravados como "<provedor>:<modelo>".
const PROVEDOR = arg('provedor', null) ? PROVEDORES_GRATIS.find((p) => p.id === arg('provedor', '')) : null;
if (arg('provedor', null) && !PROVEDOR) { console.error(`Provedor desconhecido. Use: ${PROVEDORES_GRATIS.map((p) => p.id).join(', ')}`); process.exit(1); }
for (const [k, v] of Object.entries(env)) if (/(KEY|TOKEN)$/.test(k)) process.env[k] = v; // só para o filtro de segredos esconder o valor exato
const BASE = PROVEDOR ? PROVEDOR.url : `${(env.FREELLMAPI_URL || 'http://127.0.0.1:31415').replace(/\/v1\/?$/, '')}/v1`;
const CHAVE = PROVEDOR ? env[PROVEDOR.chaveEnv] : env.FREELLMAPI_KEY;
if (!CHAVE) { console.error(`${PROVEDOR ? PROVEDOR.chaveEnv : 'FREELLMAPI_KEY'} não está no .env.`); process.exit(1); }
if (process.argv.includes('--listar')) { // os modelos que a chave enxerga, só os nomes
  const r = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${CHAVE}` }, signal: AbortSignal.timeout(20_000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error(redigir(`HTTP ${r.status}: ${JSON.stringify(j).slice(0, 300)}`)); process.exit(1); }
  console.log((j.data ?? []).map((m) => m.id).sort().join('\n'));
  process.exit(0);
}
const MODELOS = arg('modelos', 'auto,qwen3.8-27b,gpt-oss-120b,codestral,mistral-code,gemini-3.8-flash,gemini-3.5-flash,gemini-2.5-flash,gemini-flash-lite,claude-sonnet-4-5,claude-opus-4-5,claude-haiku-4-5,nemotron-3-ultra-550b,nemotron-3-super-120b,glm-4.7-flash,command-a-reasoning,command-a,north-mini-code,gemma-4-31b,dots3-note-preview,poolside-laguna-xs-2.1,muse-glimmer-30b,gpt-oss-20b,fusion').split(',');
const SO_TAREFAS = arg('tarefas', null)?.split(',');
const LISTA = SO_TAREFAS ? TAREFAS.filter((t) => SO_TAREFAS.includes(t.id) || SO_TAREFAS.includes(t.categoria)) : TAREFAS;
const REPETICOES = Number(arg('repeticoes', '1'));
const PAUSA = Number(arg('pausa', '12000')); // entre chamadas do mesmo modelo: os provedores grátis limitam tokens por minuto
const JUNTOS = Number(arg('juntos', '6')); // modelos avaliados ao mesmo tempo (cada um em sequência)
const ESPERA_LIMITE = Number(arg('espera-limite', '60000'));
const SAIDA = arg('saida', null);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function chamar(modelo, tarefa) {
  const inicio = Date.now();
  let r;
  try {
    r = await fetch(`${BASE}/chat/completions`, {
      method: 'POST', signal: AbortSignal.timeout(90_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CHAVE}` },
      body: JSON.stringify({ model: modelo, messages: tarefa.mensagens, max_tokens: 1000, temperature: 0.2, ...tarefa.extra }),
    });
  } catch (e) { return { erro: redigir(`sem resposta: ${e.message}`), limite: false, ms: Date.now() - inicio }; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { erro: redigir(`HTTP ${r.status}: ${String(j.error?.message || j.message || j.detail || '').slice(0, 100)}`), limite: [413, 429].includes(r.status), ms: Date.now() - inicio };
  const conteudo = j.choices?.[0]?.message?.content;
  const texto = Array.isArray(conteudo) ? conteudo.filter((p) => p?.type === 'text').map((p) => p.text ?? '').join('') : String(conteudo || '');
  return { bruto: j, texto, via: r.headers.get('x-routed-via') || (PROVEDOR ? `${PROVEDOR.id}/${j.model || modelo}` : modelo), tokens: j.usage?.total_tokens ?? null, ms: Date.now() - inicio };
}

const resultados = [];
const gravar = () => { if (SAIDA) writeFileSync(SAIDA, JSON.stringify({ em: new Date().toISOString(), repeticoes: REPETICOES, modelos: MODELOS, tarefas: LISTA.map(({ id, categoria }) => ({ id, categoria })), resultados }, null, 1)); };

async function avaliarModelo(modelo) {
  let limitesSeguidos = 0;
  for (const t of LISTA) {
    for (let n = 0; n < REPETICOES; n++) {
      // sempre no limite nesta rodada: não insiste (é indisponibilidade, e continuar só gastaria a cota dos outros modelos)
      if (limitesSeguidos >= 4) { resultados.push({ modelo: PROVEDOR ? `${PROVEDOR.id}:${modelo}` : modelo, tarefa: t.id, categoria: t.categoria, ok: false, motivo: 'pulado: sempre no limite nesta rodada', via: null, ms: 0, tokens: null, erro: true, limite: true }); continue; }
      let r = await chamar(modelo, t);
      if (r.limite) { await espera(ESPERA_LIMITE); r = await chamar(modelo, t); } // a cota do minuto volta: tenta mais uma vez
      limitesSeguidos = r.limite ? limitesSeguidos + 1 : 0;
      await espera(PAUSA);
      let nota;
      try {
        nota = r.erro ? { ok: false, motivo: r.erro } : t.corrigirBruto ? t.corrigirBruto(r.bruto) : r.texto.trim() ? t.corrigir(r.texto) : { ok: false, motivo: 'resposta vazia' };
      } catch (e) { nota = { ok: false, motivo: `correção falhou: ${e.message.slice(0, 60)}` }; }
      resultados.push({ modelo: PROVEDOR ? `${PROVEDOR.id}:${modelo}` : modelo, tarefa: t.id, categoria: t.categoria, ok: nota.ok, motivo: nota.motivo, via: r.via ?? null, ms: r.ms, tokens: r.tokens ?? null, erro: Boolean(r.erro), limite: Boolean(r.limite) });
      gravar();
      console.log(`${nota.ok ? 'OK   ' : 'FALHA'} ${modelo.padEnd(24)} ${t.id.padEnd(22)} ${String(r.ms).padStart(6)} ms  via ${String(r.via ?? '-').padEnd(26)} ${nota.motivo}`);
    }
  }
}
// alguns modelos ao mesmo tempo: em sequência, a rodada inteira levaria horas
const fila = [...MODELOS];
await Promise.all(Array.from({ length: JUNTOS }, async () => { while (fila.length) await avaliarModelo(fila.shift()); }));
gravar();

console.log('\nResumo por modelo (acertos / respondidas, tempo mediano):');
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
for (const modelo of MODELOS) {
  const rs = resultados.filter((r) => r.modelo === (PROVEDOR ? `${PROVEDOR.id}:${modelo}` : modelo));
  const respondidas = rs.filter((r) => !r.erro);
  console.log(`${modelo.padEnd(24)} ${respondidas.filter((r) => r.ok).length}/${respondidas.length} (${rs.filter((r) => r.limite).length} no limite, ${rs.filter((r) => r.erro && !r.limite).length} com erro)  ${mediana(respondidas.map((r) => r.ms))} ms`);
}
