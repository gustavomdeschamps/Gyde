// Roda todas as suítes de navegador (testes-e2e/*.e2e.mjs), uma de cada vez, e resume no fim.
// Uso: npm run e2e            (todas)
//      npm run e2e -- chat    (só as que têm "chat" no nome)
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const pasta = import.meta.dirname;
const filtro = process.argv[2] ?? '';
if (!existsSync(path.join(pasta, '..', 'pacotes', 'interface', 'dist', 'index.html'))) {
  console.error('A interface ainda não foi gerada: rode npm run build antes.');
  process.exit(1);
}
const suites = readdirSync(pasta).filter((f) => f.endsWith('.e2e.mjs') && f.includes(filtro)).sort();
const resultados = [];
for (const suite of suites) {
  const inicio = Date.now();
  console.log(`\n=== ${suite}`);
  const codigo = await new Promise((ok) => {
    const p = spawn(process.execPath, [path.join(pasta, suite)], { stdio: 'inherit' });
    const limite = setTimeout(() => { console.log('TEMPO ESGOTADO (5 min)'); p.kill(); }, 5 * 60_000);
    p.on('exit', (c) => { clearTimeout(limite); ok(c ?? 1); });
  });
  resultados.push({ suite, ok: codigo === 0, segundos: Math.round((Date.now() - inicio) / 1000) });
}
console.log('\n=== Resumo');
for (const r of resultados) console.log(`${r.ok ? 'PASSOU' : 'FALHOU'}  ${r.suite}  (${r.segundos} s)`);
const falhas = resultados.filter((r) => !r.ok).length;
console.log(falhas ? `${falhas} de ${resultados.length} suíte(s) falharam` : `Todas as ${resultados.length} suítes passaram`);
process.exit(falhas ? 1 : 0);
