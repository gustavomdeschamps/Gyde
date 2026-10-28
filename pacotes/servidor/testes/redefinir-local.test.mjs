// Troca de senha do app de desktop: só com o segredo do processo principal e só no modo pessoal.
// Sobe um servidor de verdade numa pasta temporária (sem internet e sem tocar nos dados reais).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SERVIDOR = path.join(import.meta.dirname, '..', 'server.ts');
const SEGREDO = 'segredo-de-teste-0123456789abcdef';
const portaLivre = () => new Promise((ok) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });
const abertos = [];
after(() => { for (const { proc, pasta } of abertos) { proc.kill(); try { rmSync(pasta, { recursive: true, force: true }); } catch { /* arquivo preso */ } } });

async function subir(env) {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-redef-'));
  const porta = await portaLivre();
  const proc = spawn(process.execPath, [SERVIDOR], {
    env: { ...process.env, DATA_DIR: pasta, PORT: String(porta), GYDE_DESKTOP: '1', GYDE_ENV_FILE: path.join(pasta, '.env'), FREELLMAPI_URL: 'http://127.0.0.1:1', OLLAMA_URL: 'http://127.0.0.1:1', ...env },
    stdio: 'ignore',
  });
  abertos.push({ proc, pasta });
  const base = `http://127.0.0.1:${porta}`;
  for (let i = 0; i < 100; i++) { try { await fetch(`${base}/api/auth/me`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  const pedir = (rota, corpo, extra = {}) => fetch(base + rota, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gyde': '1', ...extra }, body: JSON.stringify(corpo) });
  return { pedir };
}

test('com o segredo certo troca a senha e derruba as sessões; sem ele, recusa', async () => {
  const { pedir } = await subir({ GYDE_SEGREDO_DESKTOP: SEGREDO });
  assert.equal((await pedir('/api/auth/register', { name: 'Ana', email: 'ana@t.test', password: 'antiga123' })).status, 201);
  const sessaoAntiga = (await pedir('/api/auth/login', { email: 'ana@t.test', password: 'antiga123' })).headers.get('set-cookie').split(';')[0];

  assert.equal((await pedir('/api/auth/redefinir-local', { email: 'ana@t.test', password: 'nova12345' })).status, 403, 'sem cabeçalho');
  assert.equal((await pedir('/api/auth/redefinir-local', { email: 'ana@t.test', password: 'nova12345' }, { 'x-gyde-desktop': 'errado' })).status, 403, 'segredo errado');
  assert.equal((await pedir('/api/auth/redefinir-local', { email: 'ana@t.test', password: 'curta' }, { 'x-gyde-desktop': SEGREDO })).status, 400, 'senha fraca');
  assert.equal((await pedir('/api/auth/redefinir-local', { email: 'outra@t.test', password: 'nova12345' }, { 'x-gyde-desktop': SEGREDO })).status, 400, 'conta que não existe');

  const r = await pedir('/api/auth/redefinir-local', { email: 'ana@t.test', password: 'nova12345' }, { 'x-gyde-desktop': SEGREDO });
  assert.equal(r.status, 200);
  assert.equal((await pedir('/api/auth/login', { email: 'ana@t.test', password: 'antiga123' })).status, 401, 'senha antiga não entra mais');
  assert.equal((await pedir('/api/auth/login', { email: 'ana@t.test', password: 'nova12345' })).status, 200, 'senha nova entra');
  const me = await (await fetch(`${new URL(r.url).origin}/api/auth/me`, { headers: { Cookie: sessaoAntiga } })).json();
  assert.equal(me.user, null, 'a sessão aberta antes da troca caiu');
});

test('sem segredo configurado (fora do app de desktop) ou no modo público, a rota não funciona', async () => {
  for (const env of [{ GYDE_SEGREDO_DESKTOP: '' }, { GYDE_SEGREDO_DESKTOP: SEGREDO, GYDE_MODE: 'publico' }]) {
    const { pedir } = await subir(env);
    const r = await pedir('/api/auth/redefinir-local', { email: 'x@t.test', password: 'nova12345' }, { 'x-gyde-desktop': SEGREDO });
    assert.equal(r.status, 403);
  }
});
