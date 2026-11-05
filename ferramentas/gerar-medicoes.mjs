// Junta rodadas de ferramentas/avaliar-modelos.mjs no arquivo que o orquestrador lê (pacotes/servidor/ia/medicoes.json).
//   node ferramentas/gerar-medicoes.mjs docs/avaliacao/modelos-AAAA-MM-DD.json [outra-rodada.json ...]
// Só conta o que foi medido: nenhuma nota é escrita à mão. Modelo nunca respondido entra com os limites, para o Gyde saber.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arquivos = process.argv.slice(2);
if (!arquivos.length) { console.error('Diga quais rodadas juntar.'); process.exit(1); }
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

let em = null;
const brutos = new Map();
for (const a of arquivos) {
  const j = JSON.parse(readFileSync(a, 'utf8'));
  if (!em || j.em > em) em = j.em;
  for (const r of j.resultados) {
    const chave = `${r.modelo}\n${r.categoria}`;
    if (!brutos.has(chave)) brutos.set(chave, []);
    brutos.get(chave).push(r);
  }
}

const modelos = {};
for (const [chave, rs] of brutos) {
  const [modelo, categoria] = chave.split('\n');
  const m = (modelos[modelo] ??= { via: [], categorias: {} });
  const respondidas = rs.filter((r) => !r.erro);
  m.categorias[categoria] = { acertos: respondidas.filter((r) => r.ok).length, respondidas: respondidas.length, limites: rs.filter((r) => r.limite).length, ms: mediana(respondidas.map((r) => r.ms)) };
  for (const r of respondidas) if (r.via && !m.via.includes(r.via)) m.via.push(r.via);
}
const saida = path.join(import.meta.dirname, '..', 'pacotes', 'servidor', 'ia', 'medicoes.json');
writeFileSync(saida, `${JSON.stringify({ em, modelos }, null, 1)}\n`);
console.log(`${Object.keys(modelos).length} modelos em ${path.relative(process.cwd(), saida)} (rodada de ${em})`);
