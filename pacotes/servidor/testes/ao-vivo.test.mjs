// Ao vivo: descobre como ligar cada tipo de projeto, liga de verdade (servidor estático, servidor do projeto,
// programa de console), explica falhas em português, para tudo ao parar e não passa as chaves do Gyde ao projeto.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planejarAoVivo, explicarErro, criarAoVivo } from '../ao-vivo.ts';

const pastas = [];
function projeto(arquivos) {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-aovivo-'));
  for (const [nome, conteudo] of Object.entries(arquivos)) { mkdirSync(path.dirname(path.join(pasta, nome)), { recursive: true }); if (conteudo !== null) writeFileSync(path.join(pasta, nome), conteudo); }
  pastas.push(pasta);
  return pasta;
}
const aoVivo = criarAoVivo();
after(() => { aoVivo.fechar(); for (const p of pastas) rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperarFase(sessao, fases, ms = 20_000) {
  const t = Date.now();
  while (Date.now() - t < ms) { const e = aoVivo.estado(sessao); if (fases.includes(e.fase)) return e; await espera(150); }
  return aoVivo.estado(sessao);
}

test('React com Vite: servidor de desenvolvimento só em 127.0.0.1, na porta escolhida', () => {
  const p = projeto({ 'package.json': JSON.stringify({ scripts: { dev: 'vite', build: 'vite build' }, dependencies: { react: '19' }, devDependencies: { vite: '6' } }), 'package-lock.json': '{}', 'node_modules/.keep': '' });
  const plano = planejarAoVivo(p);
  const o = plano.opcoes.find((x) => x.id === plano.recomendada);
  assert.equal(o.tipo, 'web');
  assert.match(o.rotulo, /Vite \(React\)/);
  assert.equal(o.comando, 'npm run dev -- --host 127.0.0.1 --port {porta} --strictPort');
  assert.equal(o.instalar, null, 'node_modules já existe');
});

test('monorepo com pnpm e sem dependências (como o do Vue): pede pnpm install e acha os subprojetos', () => {
  const p = projeto({
    'package.json': JSON.stringify({ scripts: { dev: 'node scripts/dev.js', build: 'node scripts/build.js' } }), 'pnpm-workspace.yaml': 'packages: []',
    'packages-private/sfc-playground/package.json': JSON.stringify({ scripts: { dev: 'vite' }, dependencies: { vue: '3' }, devDependencies: { vite: '6' } }),
  });
  const plano = planejarAoVivo(p);
  const raiz = plano.opcoes.find((o) => o.id === 'node:.');
  assert.equal(raiz.ferramenta, 'pnpm');
  assert.equal(raiz.instalar, 'pnpm install');
  const sub = plano.opcoes.find((o) => o.pasta === 'packages-private/sfc-playground');
  assert.match(sub.rotulo, /Vite \(Vue\)/);
  assert.equal(sub.comando, 'pnpm run dev --host 127.0.0.1 --port {porta} --strictPort');
});

test('site pronto em dist/, HTML puro, Python, Flask e pasta vazia', () => {
  assert.equal(planejarAoVivo(projeto({ 'package.json': '{"scripts":{"build":"vite build"}}', 'dist/index.html': '<script src="/assets/app.js"></script>', 'dist/assets/app.js': '' })).recomendada, 'estatico:dist');
  assert.equal(planejarAoVivo(projeto({ 'index.html': '<link rel="stylesheet" href="/estilo.css">', 'estilo.css': '' })).recomendada, 'estatico:.');
  const py = planejarAoVivo(projeto({ 'main.py': 'print("oi")' }));
  assert.equal(py.opcoes[0].comando, 'python main.py');
  assert.equal(py.opcoes[0].tipo, 'console');
  const flask = planejarAoVivo(projeto({ 'app.py': 'from flask import Flask', 'requirements.txt': 'flask' }));
  assert.match(flask.opcoes[0].comando, /flask --app app run --host 127\.0\.0\.1 --port \{porta\}/);
  assert.equal(flask.opcoes[0].instalar, 'python -m pip install -r requirements.txt');
  const nada = planejarAoVivo(projeto({ 'LEIA.txt': 'nada aqui' }));
  assert.equal(nada.opcoes.length, 0);
  assert.match(nada.motivo, /Não achei nada para ligar/);
});

test('erros explicados em português, com o que fazer', () => {
  assert.match(explicarErro("'vite' não é reconhecido como um comando interno", 1, { instalar: 'npm install', ferramenta: 'npm' }), /Instalar e iniciar.*npm install/);
  assert.match(explicarErro("'pnpm' is not recognized as an internal or external command", 1, null), /pnpm, que não está instalado/);
  assert.match(explicarErro('Error: listen EADDRINUSE: address already in use :::5173', 1, null), /porta já está ocupada/);
  assert.match(explicarErro("ModuleNotFoundError: No module named 'flask'", 1, { instalar: null, ferramenta: 'python' }), /pip install flask/);
  assert.match(explicarErro('src/App.tsx(3,1): error TS2304: Cannot find name', 1, null), /erro no código/);
  assert.match(explicarErro('Python was not found; run without arguments to install from the Microsoft Store', 9009, null), /Python não está instalado/);
});

test('site com caminhos "/assets/...": servidor estático de verdade, com a raiz certa; .env não sai', async () => {
  const p = projeto({ 'dist/index.html': '<h1>Loja</h1><script src="/assets/app.js"></script>', 'dist/assets/app.js': 'console.log(1)', 'dist/.env': 'SEGREDO=x' });
  const e = await aoVivo.iniciar('estatico', p, 'estatico:dist');
  assert.equal(e.fase, 'pronto');
  assert.match(e.url, /^http:\/\/localhost:\d+\/$/);
  const base = `http://127.0.0.1:${e.porta}`;
  assert.match(await (await fetch(`${base}/`)).text(), /Loja/);
  const js = await fetch(`${base}/assets/app.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  assert.match(await (await fetch(`${base}/rota/de/app`)).text(), /Loja/, 'app de página única cai no index.html');
  await aoVivo.parar('estatico');
  await assert.rejects(fetch(`${base}/`), 'parado de verdade');
});

test('servidor do projeto: liga na porta livre, fica pronto, não recebe as chaves do Gyde e para de verdade', async () => {
  process.env.NVIDIA_API_KEY = `nvapi-${'TESTE'.repeat(8)}`;
  const servidor = `const http = require('http');
console.log('chave no projeto: ' + (process.env.NVIDIA_API_KEY || 'nenhuma'));
console.log('chave escrita na saida: nvapi-${'VAZOU'.repeat(8)}');
http.createServer((q, r) => r.end('<h1>Projeto ligado</h1>')).listen(Number(process.env.PORT), process.env.HOST, () => console.log('ouvindo em http://localhost:' + process.env.PORT));`;
  const p = projeto({ 'package.json': JSON.stringify({ scripts: { dev: 'node servidor.js' } }), 'package-lock.json': '{}', 'node_modules/.keep': '', 'servidor.js': servidor });
  await aoVivo.iniciar('web', p, 'node:.');
  const e = await esperarFase('web', ['pronto', 'falhou'], 30_000);
  assert.equal(e.fase, 'pronto', e.saida.join('\n'));
  assert.match(await (await fetch(`http://127.0.0.1:${e.porta}/`)).text(), /Projeto ligado/);
  const saida = e.saida.join('\n');
  assert.match(saida, /chave no projeto: nenhuma/, 'o projeto não recebe a chave do Gyde');
  assert.doesNotMatch(saida, /VAZOU|TESTE{2}/, 'a saída passa pelo filtro de segredos');
  await aoVivo.parar('web');
  await espera(1500);
  await assert.rejects(fetch(`http://127.0.0.1:${e.porta}/`), 'o processo do projeto morreu ao parar');
  delete process.env.NVIDIA_API_KEY;
});

test('programa de console (Python): mostra a saída e termina', async (t) => {
  if (spawnSync('python', ['--version'], { encoding: 'utf8' }).status !== 0) return t.skip('Python não instalado');
  const p = projeto({ 'main.py': 'print("ola do python")\nprint("segunda linha")' });
  await aoVivo.iniciar('py', p, 'py:script');
  const e = await esperarFase('py', ['terminou', 'falhou'], 20_000);
  assert.equal(e.fase, 'terminou', e.saida.join('\n'));
  assert.match(e.saida.join('\n'), /ola do python[\s\S]*segunda linha/);
});

test('erro no projeto: fase "falhou", explicação e o erro pronto para a Forja', async () => {
  const p = projeto({ 'main.py': 'print(1)', 'package.json': JSON.stringify({ scripts: { start: 'node quebrado.js' } }), 'package-lock.json': '{}', 'node_modules/.keep': '', 'quebrado.js': 'chamaQueNaoExiste()' });
  await aoVivo.iniciar('erro', p, 'node:.');
  const e = await esperarFase('erro', ['falhou'], 20_000);
  assert.equal(e.fase, 'falhou');
  assert.match(e.mensagem, /erro no código/);
  assert.match(e.erroParaForja, /Comando: npm run start[\s\S]*ReferenceError/);
});

test('comando bloqueado pela Forja continua bloqueado no "Outro comando"', async () => {
  const p = projeto({ 'LEIA.txt': '' });
  await assert.rejects(aoVivo.iniciar('bloq', p, null, { comandoProprio: 'format c:' }), /bloqueado/);
});

test('sem notícia do painel, o que estava ligado é parado sozinho', async () => {
  const curto = criarAoVivo({ contatoMaximo: 300 });
  try {
    const p = projeto({ 'index.html': '<h1>oi</h1>' });
    const e = await curto.iniciar('vigia', p, 'estatico:.');
    assert.equal(curto.ativos(), 1);
    await espera(6000); // o vigia olha a cada 5 s
    assert.equal(curto.ativos(), 0);
    await assert.rejects(fetch(`http://127.0.0.1:${e.porta}/`));
  } finally { curto.fechar(); }
});

test('fechamento forçado: na abertura seguinte, os processos órfãos do Ao vivo são encerrados (e só eles)', async (t) => {
  if (process.platform !== 'win32') return t.skip('conferência por linha de comando feita para o Windows');
  const { encerrarOrfaos } = await import('../ao-vivo.ts');
  const p = projeto({ 'LEIA.txt': '' });
  const arq = path.join(p, 'pids.json');
  const antigo = criarAoVivo({ arquivoPids: arq });
  await antigo.iniciar('orfao', p, null, { comandoProprio: 'node -e "setInterval(() => {}, 1000)"' });
  await espera(1500);
  const anotados = JSON.parse((await import('node:fs')).readFileSync(arq, 'utf8'));
  assert.equal(anotados.length, 1, 'o processo ligado ficou anotado');
  // um número de processo reaproveitado por outro programa (linha de comando diferente) não pode ser encerrado
  (await import('node:fs')).writeFileSync(arq, JSON.stringify([...anotados, { pid: process.pid, comando: 'comando-que-nao-e-deste-processo' }]));
  // o Gyde "morreu" sem parar nada (não chama parar nem fechar): a abertura seguinte limpa
  assert.equal(await encerrarOrfaos(arq), 1);
  await espera(800);
  const vivo = spawnSync('tasklist', ['/fi', `PID eq ${anotados[0].pid}`], { encoding: 'utf8' }).stdout;
  assert.doesNotMatch(vivo, new RegExp(`\b${anotados[0].pid}\b`), 'o órfão foi encerrado');
  assert.equal(JSON.parse((await import('node:fs')).readFileSync(arq, 'utf8')).length, 0);
  antigo.fechar();
});
