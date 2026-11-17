// Confere as tarefas de resultado: a resposta de referência tira 1, a resposta vazia tira 0, e a nota não depende do
// formato: a mesma referência sem blocos de código (```), e com o código de uma linha dentro da linha (`...`), tira 1.
// Páginas, workflow, Python e testes precisam de bloco (muitas linhas que não dá para separar do texto).
//   node ferramentas/conferir-tarefas-resultado.mjs
import { TAREFAS, fecharNavegador } from './tarefas-resultado.mjs';
import { REFERENCIAS } from './referencias-resultado.mjs';

const SO_EM_BLOCO = new Set(['workflow-testes', 'organizar-fotos', 'api-tarefas', 'testes-cupom']);
const semCercas = (t) => t.replace(/```[\w-]*\n?/g, '');
const naLinha = (t) => t.replace(/```[\w-]*\n([^\n]+)\n```/g, 'Use `$1` para isso.');

let falhas = 0;
for (const t of TAREFAS) {
  const ref = REFERENCIAS[t.id];
  const notas = { referencia: await t.verificar(ref), vazia: await t.verificar('Não sei.') };
  if (!SO_EM_BLOCO.has(t.id)) { notas.semBloco = await t.verificar(semCercas(ref)); notas.naLinha = await t.verificar(naLinha(ref)); }
  const ok = [notas.referencia, notas.semBloco, notas.naLinha].every((n) => n === 1 || n === null || n === undefined) && (notas.vazia === 0 || notas.vazia === null);
  if (!ok) falhas++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${t.id.padEnd(20)} ${JSON.stringify(notas)}`);
}
// as conferências de página rodam juntas na medição: em paralelo têm de dar a mesma nota
const paginas = TAREFAS.filter((t) => /^(pagina|cartoes)-/.test(t.id));
const juntas = await Promise.all([...paginas, ...paginas].map((t) => t.verificar(REFERENCIAS[t.id])));
if (juntas.some((n) => n !== 1)) { falhas++; console.log('FALHA páginas em paralelo', juntas.join(' ')); } else console.log('OK    páginas em paralelo');
await fecharNavegador();
console.log(falhas ? `${falhas} tarefa(s) com problema` : 'todas as tarefas conferidas');
process.exit(falhas ? 1 : 0);
