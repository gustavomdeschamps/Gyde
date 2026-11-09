// Cidade do código: o mapa da pasta tem só nomes e números, conta linhas e mudanças no git de verdade,
// pula segredos e pastas pesadas, e respeita o limite de prédios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mapaDaCidade } from '../cidade.ts';

function projeto(arquivos) {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-cidade-'));
  for (const [nome, conteudo] of Object.entries(arquivos)) { mkdirSync(path.dirname(path.join(pasta, nome)), { recursive: true }); writeFileSync(path.join(pasta, nome), conteudo); }
  return pasta;
}
const git = (pasta, ...args) => spawnSync('git', ['-c', 'user.name=Teste', '-c', 'user.email=teste@exemplo.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: pasta, encoding: 'utf8' });

test('mapa conta linhas, marca binário e pula segredos e pastas pesadas', async () => {
  const pasta = projeto({
    'src/app.js': 'a\nb\nc\n', 'src/util/x.js': 'sem quebra no fim', 'README.md': '',
    'logo.png': Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02]),
    '.env': 'CHAVE=segredo', 'config/.env.local': 'X=1', 'node_modules/pacote/index.js': 'x', 'dist/a.js': 'x',
  });
  try {
    const m = await mapaDaCidade(pasta);
    const por = Object.fromEntries(m.arquivos.map((a) => [a.caminho, a]));
    assert.deepEqual(Object.keys(por).sort(), ['README.md', 'logo.png', 'src/app.js', 'src/util/x.js']);
    assert.equal(por['src/app.js'].linhas, 3);
    assert.equal(por['src/util/x.js'].linhas, 1);
    assert.equal(por['README.md'].linhas, 0);
    assert.equal(por['logo.png'].binario, true);
    assert.equal(m.git.ativo, false);
    assert.equal(m.cortados, 0);
    assert.ok(!JSON.stringify(m).includes('segredo'), 'conteúdo de arquivo nunca aparece');
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('mudanças no git são contadas por arquivo, também numa subpasta do repositório', async (t) => {
  if (git(tmpdir(), '--version').status !== 0) return t.skip('git não instalado');
  const pasta = projeto({ 'app/a.js': '1\n', 'app/b.js': '1\n', 'outro.txt': 'x' });
  try {
    git(pasta, 'init', '-q');
    git(pasta, 'add', '.'); git(pasta, 'commit', '-qm', 'um');
    writeFileSync(path.join(pasta, 'app/a.js'), '1\n2\n'); git(pasta, 'commit', '-qam', 'dois');
    writeFileSync(path.join(pasta, 'app/a.js'), '1\n2\n3\n'); git(pasta, 'commit', '-qam', 'tres');
    const m = await mapaDaCidade(pasta);
    const por = Object.fromEntries(m.arquivos.map((a) => [a.caminho, a]));
    assert.equal(m.git.ativo, true);
    assert.equal(m.git.commits, 3);
    assert.equal(por['app/a.js'].mudancas, 3);
    assert.equal(por['app/b.js'].mudancas, 1);
    assert.ok(por['app/a.js'].ultima > 0);
    // pasta conectada = subpasta do repositório: caminhos relativos a ela
    const sub = await mapaDaCidade(path.join(pasta, 'app'));
    assert.deepEqual(sub.arquivos.map((a) => [a.caminho, a.mudancas]), [['a.js', 3], ['b.js', 1]]);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('limite de prédios: ficam os mais alterados e os maiores, o resto é contado', async () => {
  const arquivos = {};
  for (let i = 0; i < 30; i++) arquivos[`p/arq${String(i).padStart(2, '0')}.txt`] = 'x'.repeat(i + 1);
  const pasta = projeto(arquivos);
  try {
    const m = await mapaDaCidade(pasta, { limite: 10 });
    assert.equal(m.total, 30);
    assert.equal(m.cortados, 20);
    assert.equal(m.arquivos.length, 10);
    assert.ok(m.arquivos.every((a) => a.bytes >= 21), 'ficaram os maiores');
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});
