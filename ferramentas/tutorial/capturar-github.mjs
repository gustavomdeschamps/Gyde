// Capturas reais da página pública do Gyde no GitHub para o tutorial (passos 2 e 3), num Edge sem janela e sem login:
// a página do repositório (com Releases à direita) e a última versão publicada (com os arquivos em Assets).
//   node ferramentas/tutorial/capturar-github.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SAIDA = path.join(import.meta.dirname, '..', '..', 'docs', 'tutorial', 'capturas');
mkdirSync(SAIDA, { recursive: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-github-'));
const porta = await new Promise((ok) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${path.join(pasta, 'perfil')}`, '--no-first-run', '--hide-scrollbars', '--lang=pt-BR', 'about:blank'], { stdio: 'ignore' });
let alvos; for (let i = 0; i < 40 && !alvos; i++) { try { alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json(); } catch { await espera(250); } }
const ws = new WebSocket(alvos.find((x) => x.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } });
const enviar = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const avaliar = async (x) => (await enviar('Runtime.evaluate', { expression: x, returnByValue: true })).result?.result?.value;
await enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 860, deviceScaleFactor: 1.5, mobile: false });
await enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

async function capturar(url, nome, rolarAte) {
  await enviar('Page.navigate', { url });
  for (let i = 0; i < 60; i++) { if (await avaliar('document.readyState === "complete"')) break; await espera(250); }
  await espera(2500);
  if (rolarAte) await avaliar(`(()=>{ const el = [...document.querySelectorAll('h2, h3, summary, span')].find((e) => e.textContent.trim() === ${JSON.stringify(rolarAte)}); if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - 140); return Boolean(el); })()`);
  await espera(800);
  writeFileSync(path.join(SAIDA, nome), Buffer.from((await enviar('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  console.log('foto:', nome);
}
await capturar('https://github.com/gustavomdeschamps/Gyde', 'passo-02-github.png');
await capturar('https://github.com/gustavomdeschamps/Gyde/releases/latest', 'passo-03-assets.png', 'Assets');
ws.close(); edge.kill();
await new Promise((r) => (edge.exitCode !== null ? r() : edge.once('exit', r)));
await espera(500);
try { rmSync(pasta, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* perfil preso */ }
