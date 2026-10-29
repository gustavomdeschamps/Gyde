// Gera a imagem lateral do instalador do Windows (NSIS: BMP de 24 bits, 164x314) com o logo e as cores do Gyde.
// Renderiza um HTML no Edge sem janela e converte para BMP pelo System.Drawing do Windows.
//   node ferramentas/gerar-lateral-instalador.mjs   (grava pacotes/desktop/instalador-lateral.bmp)
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..');
const DESTINO = path.join(RAIZ, 'pacotes', 'desktop', 'instalador-lateral.bmp');
const logo = readFileSync(path.join(RAIZ, 'pacotes', 'interface', 'public', 'logo.svg'), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: 164px; height: 314px; overflow: hidden; }
  body { background: #0b1220; font-family: "Segoe UI Variable Display", "Segoe UI", sans-serif; position: relative; }
  .trilha { position: absolute; inset: 0; }
  .logo { position: absolute; left: 50%; top: 92px; width: 60px; height: 60px; transform: translateX(-50%); }
  .logo svg { width: 100%; height: 100%; }
  .nome { position: absolute; top: 166px; width: 100%; text-align: center; color: #f1f5f9; font-size: 27px; font-weight: 600; letter-spacing: -.01em; }
  .sub { position: absolute; top: 206px; width: 100%; text-align: center; color: #8ea0bf; font-size: 11.5px; line-height: 1.35; }
</style></head><body>
  <svg class="trilha" viewBox="0 0 164 314"><path d="M-10 300C40 250 120 270 110 200S30 120 120 40" fill="none" stroke="#3b82f6" stroke-opacity=".18" stroke-width="10" stroke-linecap="round"/></svg>
  <div class="logo">${logo}</div>
  <div class="nome">Gyde</div>
  <div class="sub">seu guia de programação<br>em português</div>
</body></html>`;

const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-lateral-'));
const arquivoHtml = path.join(pasta, 'lateral.html'), png = path.join(pasta, 'lateral.png');
writeFileSync(arquivoHtml, html);
const porta = await new Promise((ok) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${path.join(pasta, 'perfil')}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let alvos; for (let i = 0; i < 40 && !alvos; i++) { try { alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json(); } catch { await espera(250); } }
const ws = new WebSocket(alvos.find((x) => x.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } });
const enviar = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await enviar('Emulation.setDeviceMetricsOverride', { width: 164, height: 314, deviceScaleFactor: 1, mobile: false });
await enviar('Page.navigate', { url: `file:///${arquivoHtml.replaceAll('\\', '/')}` });
await espera(1200);
writeFileSync(png, Buffer.from((await enviar('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
ws.close(); edge.kill();
await new Promise((r) => (edge.exitCode !== null ? r() : edge.once('exit', r)));
const ps = `Add-Type -AssemblyName System.Drawing; $i = [System.Drawing.Image]::FromFile('${png}'); $b = New-Object System.Drawing.Bitmap 164, 314, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb); $g = [System.Drawing.Graphics]::FromImage($b); $g.DrawImage($i, 0, 0, 164, 314); $b.Save('${DESTINO}', [System.Drawing.Imaging.ImageFormat]::Bmp); $g.Dispose(); $i.Dispose()`;
const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
await espera(500);
try { rmSync(pasta, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* o Edge pode segurar o perfil por um instante */ }
console.log('gravado:', path.relative(RAIZ, DESTINO));
