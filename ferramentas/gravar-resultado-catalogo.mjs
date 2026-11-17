// Grava no catálogo (pacotes/servidor/skills-catalogo/avaliacao.json) o resultado da medição por resultado de cada
// skill, a partir do arquivo de saída de ferramentas/avaliar-resultado.mjs. Skill sem tarefa de resultado fica de fora
// (o catálogo mostra "Sem teste de resultado").
//   node ferramentas/gravar-resultado-catalogo.mjs docs/avaliacao/resultado-AAAA-MM-DD.json
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..');
const arquivo = process.argv[2];
const r = JSON.parse(readFileSync(arquivo, 'utf8'));
const skills = {};
for (const [braco, s] of Object.entries(r.resumo)) {
  if (!braco.startsWith('skill:')) continue;
  skills[braco.slice(6)] = { com: s.com, sem: s.sem, nCom: s.nCom, nSem: s.nSem, diferenca: s.diferenca, intervalo90: s.intervalo90, veredito: s.veredito };
}
const saida = {
  em: r.em, provedores: r.provedores, metodo: 'resultado',
  nota: `Nota média numa tarefa separada, conferida rodando o resultado (código, consulta, página, comandos), com e sem a skill. Detalhe em docs/avaliacao/${path.basename(arquivo)}`,
  skills: Object.fromEntries(Object.entries(skills).sort()),
};
writeFileSync(path.join(RAIZ, 'pacotes/servidor/skills-catalogo/avaliacao.json'), JSON.stringify(saida, null, 1) + '\n');
console.log(`${Object.keys(skills).length} skills com resultado gravadas`);
