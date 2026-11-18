// Mede o estilo das respostas: a versão ANTIGA (guia anterior, sem acabamento nem conferência do código) contra a NOVA
// (guia de estilo, acabamento e conferência do código), nos mesmos 40 pedidos (ferramentas/pedidos-estilo.mjs) e nos
// mesmos modelos. Critérios objetivos, conferidos por programa:
//   comeca      a primeira frase não é enchimento ("Claro!", "Ótima pergunta", "Vamos lá", repetir a pergunta...)
//   sem_formula nenhuma fórmula vazia fora do código (desculpas, "espero ter ajudado", "se tiver dúvidas...")
//   tamanho     fora do código, no limite do pedido (curta até 120 palavras, média até 350)
//   codigo_roda os blocos de JavaScript e Python que dá para rodar com segurança rodam sem erro (só conta se houver)
//   sem_sucesso_falso não diz que testou, rodou ou conferiu (a linha "Código conferido" é do Gyde, e só aparece quando rodou)
// Nota de cada resposta = fração dos critérios que se aplicam e passaram. Diferença com intervalo de 90% (bootstrap).
//   node ferramentas/avaliar-estilo.mjs --provedores nvidia,groq [--repeticoes 2] [--juntos 3] [--saida arquivo.json]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PEDIDOS } from './pedidos-estilo.mjs';
import { migrar } from '../pacotes/servidor/banco.ts';
import { criarProvedores } from '../pacotes/servidor/provedores.ts';
import { criarCatalogo, lerMedicoes } from '../pacotes/servidor/ia/catalogo.ts';
import { criarDesempenho } from '../pacotes/servidor/ia/desempenho.ts';
import { classificar } from '../pacotes/servidor/ia/classificar.ts';
import { sistemaDoChat, IDENTIDADE, IDENTIDADE_ANTERIOR } from '../pacotes/servidor/ia/prompts.ts';
import { limparResposta } from '../pacotes/servidor/ia/filtro.ts';
import { conferirResposta } from '../pacotes/servidor/ia/conferir-resposta.ts';
import { verificarCodigo } from '../pacotes/servidor/ia/verificar-codigo.ts';
import { completar } from '../pacotes/servidor/motor.ts';
import { redigir } from '../pacotes/servidor/seguranca.ts';
import { PROVEDORES_GRATIS } from '../pacotes/servidor/ia/provedores-gratis.ts';

const RAIZ = path.join(import.meta.dirname, '..');
const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const env = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const N = Number(arg('repeticoes', '2'));
const JUNTOS = Number(arg('juntos', '3'));
const SAIDA = arg('saida', path.join(RAIZ, 'docs/avaliacao', `estilo-${new Date().toISOString().slice(0, 10)}.json`));

const db = new DatabaseSync(':memory:');
migrar(db);
const desempenho = criarDesempenho(db);
const PROVS = arg('provedores', 'nvidia,groq').split(',').map((id) => PROVEDORES_GRATIS.find((p) => p.id === id)).filter(Boolean);
for (const p of PROVS) process.env[p.chaveEnv] = env[p.chaveEnv] ?? '';
const extras = PROVS.map((p) => ({ id: p.id, url: p.url, chaveEnv: p.chaveEnv, modelos: Object.keys(lerMedicoes().modelos).filter((id) => id.startsWith(`${p.id}:`)).map((id) => ({ id: id.slice(p.id.length + 1) })) }));
const provedores = criarProvedores({ routerUrl: 'http://127.0.0.1:9', routerKey: 'freellmapi-desligado', ollamaUrl: 'http://127.0.0.1:1', ollamaModelo: 'nenhum', modo: 'online', desempenho, extras });
const catalogo = criarCatalogo({ router: provedores.router, desempenho, extras, apenas: PROVS.map((p) => p.id) });

// ---------- critérios ----------
const semCodigo = (t) => t.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, 'x');
const ENCHIMENTO = /^\W*(claro|com certeza|certamente|[óo]tima pergunta|boa pergunta|excelente pergunta|vamos l[áa]|ol[áa]|oi\b|perfeito|entendi|beleza|que legal|isso [ée] (uma )?[óo]tim|voc[êe] (quer|perguntou|deseja) saber|a sua pergunta|primeiramente|antes de (mais nada|tudo)|vou (te )?(explicar|mostrar))/i;
const FORMULA = /(pe[çc]o desculpas|desculpe (pela|o erro|a confus)|lamento (o|a|pela)|espero (ter ajudado|que (isso|isto|essa explica[çc][ãa]o) (ajude|tenha ajudado))|se (voc[êe] )?(tiver|precisar)[^.\n]{0,40}(d[úu]vidas?|ajuda)|qualquer d[úu]vida|fico [àa] disposi[çc][ãa]o|bons estudos|boa sorte!)/i;
const SUCESSO_FALSO = /\b(testei|rodei|executei|j[áa] testado|foi testad[oa]|verifiquei que funciona|funciona perfeitamente|est[áa] testado|garanto que funciona)\b/i;
const LIMITE = { curta: 120, media: 350, longa: Infinity };
const palavras = (t) => semCodigo(t).split(/\s+/).filter((p) => /\p{L}/u.test(p)).length;

export async function notar(texto, pedido) {
  const semNotaDoGyde = texto.replace(/\n\n\*(Código conferido|Atenção: rodei)[^\n]*\*$/, '');
  const primeira = semCodigo(semNotaDoGyde).trim().split(/(?<=[.!?:])\s|\n/)[0] ?? '';
  const c = {
    comeca: !ENCHIMENTO.test(primeira),
    sem_formula: !FORMULA.test(semCodigo(semNotaDoGyde)),
    tamanho: palavras(semNotaDoGyde) <= LIMITE[pedido.tamanho],
    sem_sucesso_falso: !SUCESSO_FALSO.test(semCodigo(semNotaDoGyde)),
  };
  const v = await verificarCodigo(semNotaDoGyde);
  if (v.rodou) c.codigo_roda = v.erros.length === 0;
  const valores = Object.values(c);
  return { nota: valores.filter(Boolean).length / valores.length, criterios: c, palavras: palavras(semNotaDoGyde) };
}

// ---------- as duas versões ----------
async function responder(pedido, versao, cadeia) {
  const tarefa = classificar(pedido.texto).tarefa;
  const mensagens = [{ role: 'system', content: sistemaDoChat({ tarefa, extras: [], identidade: versao === 'nova' ? IDENTIDADE : IDENTIDADE_ANTERIOR }) }, { role: 'user', content: pedido.texto }];
  const inicio = Date.now();
  const r = await completar(provedores.router, { cadeia, messages: mensagens, max_tokens: 4000, temperature: 0.5, tempoLimite: 120_000, signal: AbortSignal.timeout(240_000) });
  let texto = limparResposta(r.texto);
  let tentativas = 0;
  if (versao === 'nova') {
    const c = await conferirResposta({ texto, mensagens, router: provedores.router, cadeia, verificar: ['codigo', 'sql', 'frontend', 'backend'].includes(tarefa) });
    texto = c.texto; tentativas = c.tentativas;
  }
  return { texto, modelo: r.modelo, ms: Date.now() - inicio, tentativas };
}

const resultados = [];
const fila = [];
for (let i = 0; i < N; i++) for (const p of PEDIDOS) for (const v of ['antiga', 'nova']) fila.push({ p, v });
const cadeiaDe = new Map();
function bootstrap(a, b, vezes = 4000) {
  const m = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length; const d = [];
  for (let i = 0; i < vezes; i++) d.push(m(a.map(() => a[Math.floor(Math.random() * a.length)])) - m(b.map(() => b[Math.floor(Math.random() * b.length)])));
  d.sort((x, y) => x - y); return [d[Math.floor(vezes * 0.05)], d[Math.floor(vezes * 0.95)]];
}
function resumir() {
  const lado = (v) => resultados.filter((r) => r.versao === v && !r.erro);
  const a = lado('antiga'), n = lado('nova');
  if (!a.length || !n.length) return null;
  const m = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const crit = {};
  for (const k of ['comeca', 'sem_formula', 'tamanho', 'codigo_roda', 'sem_sucesso_falso']) {
    const taxa = (rs) => { const x = rs.filter((r) => k in r.criterios); return x.length ? { taxa: Math.round((x.filter((r) => r.criterios[k]).length / x.length) * 100), n: x.length } : null; };
    crit[k] = { antiga: taxa(a), nova: taxa(n) };
  }
  const med = (xs) => { const s = [...xs].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  const [lo, hi] = bootstrap(n.map((r) => r.nota), a.map((r) => r.nota));
  return { nAntiga: a.length, nNova: n.length, notaAntiga: Math.round(m(a.map((r) => r.nota)) * 100), notaNova: Math.round(m(n.map((r) => r.nota)) * 100),
    diferenca: Math.round((m(n.map((r) => r.nota)) - m(a.map((r) => r.nota))) * 100), intervalo90: [Math.round(lo * 100), Math.round(hi * 100)],
    criterios: crit, msAntiga: med(a.map((r) => r.ms)), msNova: med(n.map((r) => r.ms)), palavrasAntiga: med(a.map((r) => r.palavras)), palavrasNova: med(n.map((r) => r.palavras)),
    corrigidas: n.filter((r) => r.tentativas > 0).length };
}
const gravar = () => writeFileSync(SAIDA, JSON.stringify({ em: new Date().toISOString().slice(0, 10), provedores: PROVS.map((p) => p.id), repeticoes: N, resumo: resumir(), execucoes: resultados }, null, 1) + '\n');

await catalogo.atualizar();
await Promise.all(Array.from({ length: JUNTOS }, async () => {
  while (fila.length) {
    const { p, v } = fila.shift();
    if (!cadeiaDe.has(p.id)) cadeiaDe.set(p.id, catalogo.cadeia(['codigo', 'tutor', 'conversa'], { max: 3 }));
    let linha;
    try {
      const r = await responder(p, v, cadeiaDe.get(p.id));
      const n = await notar(r.texto, p);
      linha = { pedido: p.id, versao: v, ...n, ms: r.ms, modelo: r.modelo, tentativas: r.tentativas, erro: false, ...(n.nota < 1 ? { texto: r.texto.slice(0, 2500) } : {}) };
    } catch (e) { linha = { pedido: p.id, versao: v, nota: 0, criterios: {}, ms: 0, erro: redigir(String(e.message)).slice(0, 120) }; }
    resultados.push(linha);
    console.log(`${p.id.padEnd(20)} ${v.padEnd(7)} ${linha.erro ? 'ERRO ' + linha.erro : `${String(Math.round(linha.nota * 100)).padStart(3)}%  ${String(linha.ms).padStart(6)} ms  ${Object.entries(linha.criterios).filter(([, ok]) => !ok).map(([k]) => k).join(',')}`}`);
    gravar();
  }
}));
gravar();
console.log('\nResumo:', JSON.stringify(resumir(), null, 1));
process.exit(0);
