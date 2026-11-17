// Avaliação das skills: o mesmo pedido COM e SEM a skill, nos mesmos modelos, com critérios objetivos
// (ferramentas/cenarios-skills.mjs). Uma skill só fica no catálogo se cumprir mais critérios com ela do que sem ela.
// O texto da skill que entra no pedido é o mesmo que o chat usa (trechoDaSkill), com o mesmo limite de tamanho.
//   node ferramentas/avaliar-skills.mjs --provedores nvidia,groq [--skills a,b] [--repeticoes 2] [--juntos 3] [--saida arquivo.json]
// Sem --saida, grava em pacotes/servidor/skills-catalogo/avaliacao.json (o que o catálogo mostra).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CENARIOS } from './cenarios-skills.mjs';
import { migrar } from '../pacotes/servidor/banco.ts';
import { criarProvedores } from '../pacotes/servidor/provedores.ts';
import { criarCatalogo, lerMedicoes } from '../pacotes/servidor/ia/catalogo.ts';
import { criarDesempenho } from '../pacotes/servidor/ia/desempenho.ts';
import { classificar } from '../pacotes/servidor/ia/classificar.ts';
import { sistemaDoChat } from '../pacotes/servidor/ia/prompts.ts';
import { completar } from '../pacotes/servidor/motor.ts';
import { redigir } from '../pacotes/servidor/seguranca.ts';
import { PROVEDORES_GRATIS } from '../pacotes/servidor/ia/provedores-gratis.ts';
import { lerCatalogo, trechoDaSkill, textoDaSkillNoPedido } from '../pacotes/servidor/skills-sistema.ts';

const RAIZ = path.join(import.meta.dirname, '..');
const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const env = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const REPETICOES = Number(arg('repeticoes', '2'));
const JUNTOS = Number(arg('juntos', '3'));
const PAUSA = Number(arg('pausa', '3000'));
const SO = arg('skills', null)?.split(',');
const PADRAO = path.join(RAIZ, 'pacotes/servidor/skills-catalogo/avaliacao.json');
const SAIDA = arg('saida', PADRAO);
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

const skills = lerCatalogo(path.join(RAIZ, 'pacotes/servidor'));
const lista = CENARIOS.filter((c) => !SO || SO.includes(c.skill));
for (const c of lista) if (!skills.has(c.skill)) throw new Error(`Cenário sem skill no catálogo: ${c.skill}`);

// mesmo modelo nas duas versões do pedido: a cadeia é escolhida uma vez por cenário
async function responder(c, comSkill, cadeia) {
  const tarefa = classificar(c.pedido).tarefa;
  const extrasSistema = comSkill ? [textoDaSkillNoPedido(skills.get(c.skill), trechoDaSkill(skills.get(c.skill), c.pedido))] : [];
  const inicio = Date.now();
  const r = await completar(provedores.router, {
    cadeia, messages: [{ role: 'system', content: sistemaDoChat({ tarefa, extras: extrasSistema }) }, { role: 'user', content: c.pedido }],
    max_tokens: 2500, temperature: 0.3, tempoLimite: 120_000, signal: AbortSignal.timeout(180_000),
  });
  return { texto: r.texto, modelo: r.modelo, ms: Date.now() - inicio, tamanhoSkill: comSkill ? extrasSistema[0].length : 0 };
}

const resultados = existsSync(SAIDA) && SO ? (JSON.parse(readFileSync(SAIDA, 'utf8')).execucoes ?? []).filter((e) => !SO.includes(e.skill)) : [];
const pedidos = [];
for (const c of lista) for (let n = 0; n < REPETICOES; n++) pedidos.push({ c, n });
await catalogo.atualizar();

function resumir() {
  const porSkill = {};
  for (const id of new Set(resultados.map((r) => r.skill))) {
    const rs = resultados.filter((r) => r.skill === id && !r.erro);
    const media = (com) => { const x = rs.filter((r) => r.com === com); return x.length ? x.reduce((a, r) => a + r.nota, 0) / x.length : null; };
    const com = media(true), sem = media(false);
    const n = Math.min(rs.filter((r) => r.com).length, rs.filter((r) => !r.com).length);
    porSkill[id] = { com: com == null ? null : Math.round(com * 100), sem: sem == null ? null : Math.round(sem * 100), n, criterios: rs[0]?.total ?? 0,
      melhorou: com != null && sem != null && n > 0 && com > sem, tamanho: rs.find((r) => r.com)?.tamanhoSkill ?? 0 };
  }
  return porSkill;
}
const gravar = () => writeFileSync(SAIDA, JSON.stringify({ em: new Date().toISOString().slice(0, 10), provedores: PROVS.map((p) => p.id), repeticoes: REPETICOES, skills: resumir(), execucoes: resultados }, null, 1) + '\n');

await Promise.all(Array.from({ length: JUNTOS }, async () => {
  while (pedidos.length) {
    const { c } = pedidos.shift();
    const cadeia = catalogo.cadeia(['codigo', 'tutor'], { max: 3 });
    for (const com of [false, true]) {
      let linha;
      try {
        const r = await responder(c, com, cadeia);
        if (!r.texto.trim()) throw new Error('resposta vazia');
        const passou = c.criterios.map(([nome, f]) => { try { return [nome, Boolean(f(r.texto))]; } catch { return [nome, false]; } });
        const nota = passou.filter(([, ok]) => ok).length / passou.length;
        linha = { skill: c.skill, com, nota, total: passou.length, falhou: passou.filter(([, ok]) => !ok).map(([n]) => n), modelo: r.modelo, ms: r.ms, tamanhoSkill: r.tamanhoSkill, erro: false, tamanhoResposta: r.texto.length, ...(nota < 1 ? { inicio: r.texto.slice(0, 4000) } : {}) };
      } catch (e) { linha = { skill: c.skill, com, nota: 0, total: c.criterios.length, falhou: [], modelo: null, ms: 0, erro: limparErro(e.message).slice(0, 120) }; }
      resultados.push(linha);
      console.log(`${c.skill.padEnd(22)} ${com ? 'COM' : 'SEM'}  ${linha.erro ? 'ERRO ' + linha.erro : `${Math.round(linha.nota * 100)}%  ${String(linha.ms).padStart(6)} ms  ${linha.modelo}  falhou: ${linha.falhou.join('; ')}`}`);
      gravar();
      await espera(PAUSA);
    }
  }
}));
gravar();
console.log('\nResumo (critérios cumpridos, média): com a skill / sem a skill / execuções de cada');
for (const [id, s] of Object.entries(resumir()).sort()) console.log(`${s.melhorou ? 'MELHOROU' : 'NÃO     '} ${id.padEnd(22)} ${String(s.com).padStart(3)}% / ${String(s.sem).padStart(3)}%  n=${s.n}  ${s.tamanho} caracteres`);
process.exit(0);
