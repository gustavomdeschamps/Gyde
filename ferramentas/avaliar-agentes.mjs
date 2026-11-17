// Avaliação dos agentes especializados do chat (pacotes/servidor/ia/agentes.ts): a mesma tarefa COM e SEM o papel,
// nos mesmos modelos, com os critérios objetivos dos cenários das skills (ferramentas/cenarios-skills.mjs) que são do
// assunto de cada agente. Mede acerto e tempo. Um agente só fica se acertar mais sem ficar mais lento.
//   node ferramentas/avaliar-agentes.mjs --provedores nvidia,groq [--agentes a,b] [--repeticoes 2] [--juntos 3] [--saida arquivo.json]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CENARIOS } from './cenarios-skills.mjs';
import { migrar } from '../pacotes/servidor/banco.ts';
import { criarProvedores } from '../pacotes/servidor/provedores.ts';
import { criarCatalogo, lerMedicoes } from '../pacotes/servidor/ia/catalogo.ts';
import { criarDesempenho } from '../pacotes/servidor/ia/desempenho.ts';
import { classificar } from '../pacotes/servidor/ia/classificar.ts';
import { sistemaDoChat } from '../pacotes/servidor/ia/prompts.ts';
import { AGENTES, escolherAgente, textoDoAgente } from '../pacotes/servidor/ia/agentes.ts';
import { completar } from '../pacotes/servidor/motor.ts';
import { redigir } from '../pacotes/servidor/seguranca.ts';
import { PROVEDORES_GRATIS } from '../pacotes/servidor/ia/provedores-gratis.ts';

// cenários do assunto de cada agente (os pedidos que o próprio agente pega pela regra)
export const DO_AGENTE = {
  depurador: ['explicador-erros'],
  testador: ['testes-automatizados'],
  seguranca: ['senhas-seguras', 'injecao-xss', 'segredos-env'],
  iniciante: ['explicar-conceito', 'exercicios-praticos'],
  documentador: ['documentador', 'readme-projeto', 'documentar-api'],
  designer: ['design-visual', 'front-end', 'acessibilidade-web'],
  planejador: ['planejador-projetos'],
};

const RAIZ = path.join(import.meta.dirname, '..');
const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const env = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const REPETICOES = Number(arg('repeticoes', '2'));
const JUNTOS = Number(arg('juntos', '3'));
const PAUSA = Number(arg('pausa', '3000'));
const SO = arg('agentes', null)?.split(',');
const SAIDA = arg('saida', path.join(RAIZ, 'docs/avaliacao', `agentes-${new Date().toISOString().slice(0, 10)}.json`));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const limparErro = (t) => redigir(String(t)).replace(/org_[A-Za-z0-9]{10,}/g, 'org_[oculto]');

const db = new DatabaseSync(':memory:');
migrar(db);
const desempenho = criarDesempenho(db);
const PROVS = (arg('provedores', 'nvidia,groq') || '').split(',').filter(Boolean).map((id) => PROVEDORES_GRATIS.find((p) => p.id === id)).filter(Boolean);
for (const p of PROVS) process.env[p.chaveEnv] = env[p.chaveEnv] ?? '';
const extras = PROVS.map((p) => ({ id: p.id, url: p.url, chaveEnv: p.chaveEnv, modelos: Object.keys(lerMedicoes().modelos).filter((id) => id.startsWith(`${p.id}:`)).map((id) => ({ id: id.slice(p.id.length + 1) })) }));
const provedores = criarProvedores({ routerUrl: 'http://127.0.0.1:9', routerKey: 'freellmapi-desligado', ollamaUrl: 'http://127.0.0.1:1', ollamaModelo: 'nenhum', modo: 'online', desempenho, extras });
const catalogo = criarCatalogo({ router: provedores.router, desempenho, extras, apenas: PROVS.map((p) => p.id) });

const pedidos = [];
for (const a of AGENTES.filter((x) => !SO || SO.includes(x.id))) {
  for (const skill of DO_AGENTE[a.id] ?? []) {
    const c = CENARIOS.find((x) => x.skill === skill);
    const escolhido = escolherAgente(c.pedido, classificar(c.pedido));
    for (let n = 0; n < REPETICOES; n++) pedidos.push({ a, c, pegaPelaRegra: escolhido?.id === a.id });
  }
}

const resultados = [];
const mediana = (xs) => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
function resumir() {
  const r = {};
  for (const a of AGENTES) {
    const rs = resultados.filter((x) => x.agente === a.id && !x.erro);
    if (!rs.length) continue;
    const lado = (com) => rs.filter((x) => x.com === com);
    const media = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x.nota, 0) / xs.length) * 100) : null);
    const com = lado(true), sem = lado(false);
    r[a.id] = { com: media(com), sem: media(sem), n: Math.min(com.length, sem.length), msCom: mediana(com.map((x) => x.ms)), msSem: mediana(sem.map((x) => x.ms)),
      cenarios: [...new Set(rs.map((x) => x.cenario))], pegaPelaRegra: rs.every((x) => x.pegaPelaRegra) };
    r[a.id].melhorou = r[a.id].com != null && r[a.id].sem != null && r[a.id].com > r[a.id].sem;
  }
  return r;
}
const gravar = () => writeFileSync(SAIDA, JSON.stringify({ em: new Date().toISOString().slice(0, 10), provedores: PROVS.map((p) => p.id), repeticoes: REPETICOES, agentes: resumir(), execucoes: resultados }, null, 1) + '\n');

await catalogo.atualizar();
await Promise.all(Array.from({ length: JUNTOS }, async () => {
  while (pedidos.length) {
    const { a, c, pegaPelaRegra } = pedidos.shift();
    const cadeia = catalogo.cadeia(['codigo', 'tutor'], { max: 3 });
    for (const com of [false, true]) {
      const tarefa = classificar(c.pedido).tarefa;
      let linha;
      try {
        const inicio = Date.now();
        const r = await completar(provedores.router, {
          cadeia, messages: [{ role: 'system', content: sistemaDoChat({ tarefa, extras: com ? [textoDoAgente(a)] : [] }) }, { role: 'user', content: c.pedido }],
          max_tokens: 2500, temperature: 0.3, tempoLimite: 120_000, signal: AbortSignal.timeout(180_000),
        });
        if (!r.texto.trim()) throw new Error('resposta vazia');
        const passou = c.criterios.map(([nome, f]) => { try { return [nome, Boolean(f(r.texto))]; } catch { return [nome, false]; } });
        const nota = passou.filter(([, ok]) => ok).length / passou.length;
        linha = { agente: a.id, cenario: c.skill, com, nota, ms: Date.now() - inicio, modelo: r.modelo, falhou: passou.filter(([, ok]) => !ok).map(([n]) => n), pegaPelaRegra, erro: false };
      } catch (e) { linha = { agente: a.id, cenario: c.skill, com, nota: 0, ms: 0, modelo: null, falhou: [], pegaPelaRegra, erro: limparErro(e.message).slice(0, 120) }; }
      resultados.push(linha);
      console.log(`${a.id.padEnd(13)} ${c.skill.padEnd(22)} ${com ? 'COM' : 'SEM'}  ${linha.erro ? 'ERRO ' + linha.erro : `${Math.round(linha.nota * 100)}%  ${String(linha.ms).padStart(6)} ms  ${linha.modelo}`}`);
      gravar();
      await espera(PAUSA);
    }
  }
}));
gravar();
console.log('\nResumo: critérios cumpridos com / sem o agente, tempo mediano com / sem, execuções de cada lado');
for (const [id, s] of Object.entries(resumir())) console.log(`${s.melhorou ? 'MELHOROU' : 'NÃO     '} ${id.padEnd(13)} ${String(s.com).padStart(3)}% / ${String(s.sem).padStart(3)}%   ${s.msCom} ms / ${s.msSem} ms   n=${s.n}${s.pegaPelaRegra ? '' : '  (regra não pega algum pedido)'}`);
process.exit(0);
