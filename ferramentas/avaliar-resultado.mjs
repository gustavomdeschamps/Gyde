// Medição por RESULTADO das skills e dos agentes: cada tarefa de ferramentas/tarefas-resultado.mjs (conjunto separado,
// não usado para escrever as skills) roda N vezes SEM nada e N vezes COM cada skill e cada agente do assunto, nos
// mesmos modelos. A nota de cada resposta é a fração das conferências escondidas que passaram (código rodando, consulta
// no banco, axe-core no navegador...). A diferença com e sem vem com um intervalo de 90% por reamostragem (bootstrap):
//   melhora      a diferença é positiva e o intervalo inteiro fica acima de zero
//   tendência    a diferença é positiva, mas o intervalo inclui zero (amostra pequena para afirmar)
//   não melhora  a diferença é zero ou negativa
//   node ferramentas/avaliar-resultado.mjs --provedores nvidia,groq [--repeticoes 5] [--juntos 3] [--tarefas a,b] [--so skills|agentes] [--saida arquivo.json]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TAREFAS, fecharNavegador } from './tarefas-resultado.mjs';
import { migrar } from '../pacotes/servidor/banco.ts';
import { criarProvedores } from '../pacotes/servidor/provedores.ts';
import { criarCatalogo, lerMedicoes } from '../pacotes/servidor/ia/catalogo.ts';
import { criarDesempenho } from '../pacotes/servidor/ia/desempenho.ts';
import { classificar } from '../pacotes/servidor/ia/classificar.ts';
import { sistemaDoChat } from '../pacotes/servidor/ia/prompts.ts';
import { AGENTES, textoDoAgente } from '../pacotes/servidor/ia/agentes.ts';
import { lerCatalogo, trechoDaSkill, textoDaSkillNoPedido } from '../pacotes/servidor/skills-sistema.ts';
import { completar } from '../pacotes/servidor/motor.ts';
import { redigir } from '../pacotes/servidor/seguranca.ts';
import { PROVEDORES_GRATIS } from '../pacotes/servidor/ia/provedores-gratis.ts';

const RAIZ = path.join(import.meta.dirname, '..');
const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const env = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const N = Number(arg('repeticoes', '5'));
const JUNTOS = Number(arg('juntos', '3'));
const SO_TAREFAS = arg('tarefas', null)?.split(',');
const SO = arg('so', null);
const SAIDA = arg('saida', path.join(RAIZ, 'docs/avaliacao', `resultado-${new Date().toISOString().slice(0, 10)}.json`));
const limparErro = (t) => redigir(String(t)).replace(/org_[A-Za-z0-9]{10,}/g, 'org_[oculto]');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const db = new DatabaseSync(':memory:');
migrar(db);
const desempenho = criarDesempenho(db);
const PROVS = arg('provedores', 'nvidia,groq').split(',').map((id) => PROVEDORES_GRATIS.find((p) => p.id === id)).filter(Boolean);
for (const p of PROVS) process.env[p.chaveEnv] = env[p.chaveEnv] ?? '';
const extras = PROVS.map((p) => ({ id: p.id, url: p.url, chaveEnv: p.chaveEnv, modelos: Object.keys(lerMedicoes().modelos).filter((id) => id.startsWith(`${p.id}:`)).map((id) => ({ id: id.slice(p.id.length + 1) })) }));
const provedores = criarProvedores({ routerUrl: 'http://127.0.0.1:9', routerKey: 'freellmapi-desligado', ollamaUrl: 'http://127.0.0.1:1', ollamaModelo: 'nenhum', modo: 'online', desempenho, extras });
const catalogo = criarCatalogo({ router: provedores.router, desempenho, extras, apenas: PROVS.map((p) => p.id) });
const skills = lerCatalogo(path.join(RAIZ, 'pacotes/servidor'));
const agentes = new Map(AGENTES.map((a) => [a.id, a]));

// braços: SEM (nada), skill:<id> e agente:<id>
const lista = TAREFAS.filter((t) => !SO_TAREFAS || SO_TAREFAS.includes(t.id));
const fila = [];
for (const t of lista) {
  const bracos = ['sem', ...(SO === 'agentes' ? [] : t.skills.filter((s) => skills.has(s)).map((s) => `skill:${s}`)), ...(SO === 'skills' ? [] : t.agentes.filter((a) => agentes.has(a)).map((a) => `agente:${a}`))];
  for (let i = 0; i < N; i++) for (const b of bracos) fila.push({ t, b });
}

const resultados = existsSync(SAIDA) && SO_TAREFAS ? JSON.parse(readFileSync(SAIDA, 'utf8')).execucoes.filter((e) => !SO_TAREFAS.includes(e.tarefa)) : [];
function extrasDo(b, t) {
  if (b === 'sem') return [];
  const [tipo, id] = b.split(':');
  if (tipo === 'skill') { const s = skills.get(id); return [textoDaSkillNoPedido(s, trechoDaSkill(s, t.pedido))]; }
  return [textoDoAgente(agentes.get(id))];
}

// intervalo de 90% da diferença de médias por reamostragem
function bootstrap(com, sem, vezes = 4000) {
  const media = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length;
  const d = [];
  for (let i = 0; i < vezes; i++) {
    const c = com.map(() => com[Math.floor(Math.random() * com.length)]), s = sem.map(() => sem[Math.floor(Math.random() * sem.length)]);
    d.push(media(c) - media(s));
  }
  d.sort((a, b) => a - b);
  return [d[Math.floor(vezes * 0.05)], d[Math.floor(vezes * 0.95)]];
}
export function resumir(execucoes) {
  const r = {};
  const bracos = [...new Set(execucoes.filter((e) => e.braco !== 'sem').map((e) => e.braco))];
  for (const b of bracos) {
    const tarefas = [...new Set(execucoes.filter((e) => e.braco === b).map((e) => e.tarefa))];
    const com = execucoes.filter((e) => e.braco === b && !e.erro).map((e) => e.nota);
    const sem = execucoes.filter((e) => e.braco === 'sem' && tarefas.includes(e.tarefa) && !e.erro).map((e) => e.nota);
    if (!com.length || !sem.length) continue;
    const media = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length;
    const dif = media(com) - media(sem);
    const [lo, hi] = bootstrap(com, sem);
    const msCom = execucoes.filter((e) => e.braco === b && !e.erro).map((e) => e.ms).sort((a, z) => a - z), msSem = execucoes.filter((e) => e.braco === 'sem' && tarefas.includes(e.tarefa) && !e.erro).map((e) => e.ms).sort((a, z) => a - z);
    r[b] = {
      tarefas, nCom: com.length, nSem: sem.length, com: Math.round(media(com) * 100), sem: Math.round(media(sem) * 100),
      diferenca: Math.round(dif * 100), intervalo90: [Math.round(lo * 100), Math.round(hi * 100)],
      veredito: dif > 0 && lo > 0 ? 'melhora' : dif > 0 ? 'tendência' : 'não melhora',
      msCom: msCom[Math.floor(msCom.length / 2)], msSem: msSem[Math.floor(msSem.length / 2)],
    };
  }
  return r;
}
const gravar = () => writeFileSync(SAIDA, JSON.stringify({ em: new Date().toISOString().slice(0, 10), provedores: PROVS.map((p) => p.id), repeticoes: N, resumo: resumir(resultados), execucoes: resultados }, null, 1) + '\n');

await catalogo.atualizar();
const cadeiaDe = new Map();
await Promise.all(Array.from({ length: JUNTOS }, async () => {
  while (fila.length) {
    const { t, b } = fila.shift();
    // a mesma cadeia de modelos para todos os braços da tarefa
    if (!cadeiaDe.has(t.id)) cadeiaDe.set(t.id, catalogo.cadeia(['codigo', 'tutor'], { max: 3 }));
    let linha;
    try {
      const inicio = Date.now();
      const r = await completar(provedores.router, {
        cadeia: cadeiaDe.get(t.id), messages: [{ role: 'system', content: sistemaDoChat({ tarefa: classificar(t.pedido).tarefa, extras: extrasDo(b, t) }) }, { role: 'user', content: t.pedido }],
        // o chat não limita o tamanho da resposta; aqui o limite é alto para não cortar página nem código longo
        max_tokens: 8000, temperature: 0.3, tempoLimite: 180_000, signal: AbortSignal.timeout(240_000),
      });
      if (!r.texto.trim()) throw new Error('resposta vazia');
      const nota = await t.verificar(r.texto);
      if (nota == null) continue; // tarefa que não roda neste sistema
      linha = { tarefa: t.id, braco: b, nota, ms: Date.now() - inicio, modelo: r.modelo, erro: false, ...(nota < 1 ? { inicio: r.texto.slice(0, 3000) } : {}) };
    } catch (e) { linha = { tarefa: t.id, braco: b, nota: 0, ms: 0, modelo: null, erro: limparErro(e.message).slice(0, 120) }; }
    resultados.push(linha);
    console.log(`${t.id.padEnd(20)} ${b.padEnd(28)} ${linha.erro ? 'ERRO ' + linha.erro : `${String(Math.round(linha.nota * 100)).padStart(3)}%  ${String(linha.ms).padStart(6)} ms  ${linha.modelo}`}`);
    gravar();
    await espera(1500);
  }
}));
await fecharNavegador();
gravar();
console.log('\nResumo (nota média com / sem, diferença e intervalo de 90%, execuções de cada lado):');
for (const [b, s] of Object.entries(resumir(resultados)).sort((a, z) => z[1].diferenca - a[1].diferenca)) {
  console.log(`${s.veredito.padEnd(12)} ${b.padEnd(28)} ${String(s.com).padStart(3)}% / ${String(s.sem).padStart(3)}%  dif ${String(s.diferenca).padStart(4)} [${s.intervalo90.join(', ')}]  n=${s.nCom}/${s.nSem}  ${s.msCom} / ${s.msSem} ms`);
}
process.exit(0);
