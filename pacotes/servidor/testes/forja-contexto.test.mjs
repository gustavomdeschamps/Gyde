// Contexto que a Forja monta antes de chamar o modelo: camadas do projeto, arquivos relevantes para o pedido e
// mudanças da pessoa ainda não salvas no git. Nada disso pode incluir arquivos de segredo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { camadasDoProjeto, arquivosRelevantes, mudancasNaoSalvas } from '../codigo-agente.ts';

function projeto(arquivos) {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-ctx-'));
  for (const [nome, conteudo] of Object.entries(arquivos)) { mkdirSync(path.dirname(path.join(pasta, nome)), { recursive: true }); writeFileSync(path.join(pasta, nome), conteudo); }
  return pasta;
}
const apagar = (p) => rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });

test('camadas: separa front-end e back-end pelo código e pelas pastas; ignora testes, dependências e segredos', () => {
  const p = projeto({
    'servidor.js': "const http = require('node:http');\nhttp.createServer(() => {}).listen(3000);\n",
    'api/usuarios.py': 'from flask import Flask\napp = Flask(__name__)\n@app.route("/u")\ndef u(): return "x"\n',
    'public/index.html': '<p id="x"></p>',
    'public/app.js': "fetch('/api/ola').then((r) => r.json());\n",
    'src/components/Botao.jsx': 'export default () => null;\n',
    'util/contas.js': 'module.exports = (a, b) => a + b;\n',
    'teste.spec.js': "fetch('/x');\n",
    'node_modules/lib/index.js': "require('express')();\n",
    '.env': 'CHAVE=1',
  });
  try {
    const c = camadasDoProjeto(p);
    assert.deepEqual(new Set(c.backend), new Set(['servidor.js', 'api/usuarios.py']));
    assert.deepEqual(new Set(c.frontend), new Set(['public/index.html', 'public/app.js', 'src/components/Botao.jsx']));
  } finally { apagar(p); }
});

test('arquivos relevantes: palavras do pedido no nome e no conteúdo, mais relevante primeiro, sem segredos', () => {
  const p = projeto({
    'servidor.js': "function responder() { return { mensagem: 'Olá' }; }\n// rota /api/ola\n",
    'public/app.js': "fetch('/api/ola').then((d) => mostrar(d.mensagem));\n",
    'README.md': 'Projeto de exemplo.\n',
    'segredos.json': '{"mensagem": "api/ola"}',
    '.env': 'mensagem=api/ola',
  });
  try {
    const r = arquivosRelevantes(p, 'Adicione o campo hora na resposta de /api/ola e mostre junto da mensagem');
    const caminhos = r.map((x) => x.caminho);
    assert.deepEqual(new Set(caminhos), new Set(['servidor.js', 'public/app.js']));
    assert.ok(r.every((x) => x.motivo.length > 0));
    assert.deepEqual(arquivosRelevantes(p, 'faça isso para mim'), []); // só palavras comuns: nada
    assert.deepEqual(arquivosRelevantes(p, ''), []);
  } finally { apagar(p); }
});

test('mudanças não salvas no git: lista o que a pessoa mudou e o que é novo; sem git, nada', { skip: spawnSync('git', ['--version']).status !== 0 && 'git não instalado' }, () => {
  const p = projeto({ 'util.js': 'module.exports = {};\n', 'notas.md': 'a\n' });
  try {
    assert.deepEqual(mudancasNaoSalvas(p), []);
    const g = (...a) => spawnSync('git', ['-c', 'user.email=a@a', '-c', 'user.name=a', ...a], { cwd: p, stdio: 'ignore' });
    g('init', '-q'); g('add', '-A'); g('commit', '-qm', 'x');
    assert.deepEqual(mudancasNaoSalvas(p), []);
    writeFileSync(path.join(p, 'util.js'), 'module.exports = { metade: (n) => n / 2 };\n');
    writeFileSync(path.join(p, 'novo.js'), '// novo\n');
    const m = mudancasNaoSalvas(p);
    assert.ok(m.includes('M util.js'), m.join(' | '));
    assert.ok(m.includes('?? novo.js'), m.join(' | '));
    assert.ok(!m.some((l) => l.includes('notas.md')));
  } finally { apagar(p); }
});
