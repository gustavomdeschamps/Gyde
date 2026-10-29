// Capturas reais do Gyde instalado para o tutorial: instala em silêncio numa pasta de teste, abre o app com dados
// temporários e dirige pela depuração (CDP) como uma pessoa faria: criar conta, questionário, conversa, Prática,
// Configurações, Forja e as mensagens de problemas comuns. No fim desinstala e apaga tudo que criou.
// A IA é a de verdade (FreeLLMAPI deste computador): a chave vai pelo ambiente do processo, nunca digitada nem mostrada.
//   node ferramentas/tutorial/capturar-app.mjs
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..', '..');
const SAIDA = path.join(RAIZ, 'docs', 'tutorial', 'capturas');
mkdirSync(SAIDA, { recursive: true });
const versao = JSON.parse(readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).version;
const INSTALADOR = path.join(RAIZ, 'dist-desktop', `Gyde-Setup-${versao}.exe`);
const env = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const portaLivre = () => new Promise((ok) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });

const PASTA = mkdtempSync(path.join(tmpdir(), 'gyde-tut-'));
const EXE = path.join(PASTA, 'Gyde.exe');
const DADOS = mkdtempSync(path.join(tmpdir(), 'gyde-tut-dados-'));
const PROJETO = path.join(mkdtempSync(path.join(tmpdir(), 'gyde-tut-proj-')), 'meu-site');

async function abrir(extraEnv) {
  const porta = await portaLivre();
  const e = { ...process.env, GYDE_DESKTOP_DADOS: DADOS, ...extraEnv };
  delete e.ELECTRON_RUN_AS_NODE;
  const proc = spawn(EXE, [`--remote-debugging-port=${porta}`], { env: e, stdio: 'ignore', cwd: tmpdir() });
  let pagina;
  for (let i = 0; i < 120 && !pagina; i++) {
    try { pagina = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find((x) => x.type === 'page' && /^http:\/\/127\.0\.0\.1:\d+\//.test(x.url)); } catch { /* subindo */ }
    if (!pagina) await espera(500);
  }
  if (!pagina) throw new Error('o Gyde instalado não abriu');
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } });
  const enviar = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const avaliar = async (x) => (await enviar('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const esperar = async (cond, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await avaliar(cond)) return true; } catch { /* navegando */ } await espera(300); } return false; };
  // 1280x760 com escala 1,5: imagens nítidas para vídeo em 1080p
  await enviar('Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1.5, mobile: false });
  const foto = async (nome) => { await espera(600); writeFileSync(path.join(SAIDA, nome), Buffer.from((await enviar('Page.captureScreenshot', { format: 'png' })).result.data, 'base64')); console.log('foto:', nome); };
  const fechar = async () => { ws.close(); spawnSync('taskkill', ['/PID', String(proc.pid)], { stdio: 'ignore' }); await Promise.race([new Promise((r) => proc.once('exit', r)), espera(10000)]); spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); };
  return { avaliar, esperar, foto, fechar, base: new URL(pagina.url).origin };
}
const digitar = (sel, valor) => `(()=>{ const c = document.querySelector(${JSON.stringify(sel)}); c.value = ${JSON.stringify(valor)}; c.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`;
const clicarTexto = (sel, texto) => `(()=>{ const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.textContent.trim().includes(${JSON.stringify(texto)})); b?.click(); return Boolean(b); })()`;

try {
  if (spawnSync(INSTALADOR, ['/S', `/D=${PASTA}`]).status !== 0 || !existsSync(EXE)) throw new Error('instalação silenciosa falhou');
  // projeto de exemplo para a Forja
  mkdirSync(PROJETO, { recursive: true });
  writeFileSync(path.join(PROJETO, 'index.html'), '<!doctype html>\n<html lang="pt-BR">\n<head><meta charset="utf-8"><title>Meu site</title><link rel="stylesheet" href="estilo.css"></head>\n<body>\n  <h1>Olá!</h1>\n  <button id="botao">Clique</button>\n  <script src="app.js"></script>\n</body>\n</html>\n');
  writeFileSync(path.join(PROJETO, 'estilo.css'), 'body { font-family: sans-serif; }\n');
  writeFileSync(path.join(PROJETO, 'app.js'), "document.getElementById('botao').addEventListener('click', () => {\n  alert('Oi!');\n});\n");

  // ---------- com a IA funcionando ----------
  let app = await abrir({ FREELLMAPI_URL: env.FREELLMAPI_URL || 'http://127.0.0.1:31415', FREELLMAPI_KEY: env.FREELLMAPI_KEY, GYDE_MODO_IA: 'online' });
  const { avaliar, esperar, foto } = app;
  await avaliar(`(localStorage.setItem('gyde-intro-vista', '1'), location.reload(), 1)`); await espera(2500);
  await esperar(`document.querySelector('.gate-form') !== null`);
  await avaliar(clicarTexto('button.link', 'Criar conta'));
  await esperar(`document.querySelector('input[name="name"]') !== null`);
  await avaliar(digitar('input[name="name"]', 'Ana')); await avaliar(digitar('input[name="email"]', 'ana@exemplo.com')); await avaliar(digitar('input[name="password"]', 'senha-de-teste-2026'));
  await foto('passo-08-criar-conta.png');
  await avaliar(`document.querySelector('.gate-form').requestSubmit()`);
  await esperar(`document.querySelector('.quiz-option') !== null`);
  await foto('passo-08-questionario.png');
  // responde o questionário como uma iniciante que quer Python e HTML e CSS
  for (let i = 0; i < 14; i++) {
    const titulo = await avaliar(`document.querySelector('.quiz-title')?.textContent || ''`);
    if (!titulo) break;
    if (/linguagens/.test(titulo)) { await avaliar(clicarTexto('.quiz-option', 'Python')); await avaliar(clicarTexto('.quiz-option', 'HTML e CSS')); await avaliar(clicarTexto('button.btn.primary', 'Continuar')); }
    else if (/Quanto você já programou/.test(titulo)) await avaliar(clicarTexto('.quiz-option', 'Já fiz alguns exercícios'));
    else await avaliar(`document.querySelectorAll('.quiz-option')[${i % 2}]?.click()`);
    await espera(900);
  }
  await esperar(`document.querySelector('.quiz-score') !== null`, 8000);
  await avaliar(clicarTexto('button', 'Começar a usar o Gyde'));
  await esperar(`document.querySelector('#greeting') !== null`, 15000);
  await foto('passo-09-inicio.png');
  await avaliar(digitar('#input', 'Como faço um laço for em Python que mostra os números de 1 a 5?'));
  await avaliar(`document.getElementById('sendBtn').click()`);
  await esperar(`document.querySelector('#sendBtn.streaming') !== null`, 15000);
  await esperar(`document.querySelector('#sendBtn.streaming') === null && document.querySelector('.msg.assistant .msg-meta') !== null`, 120000);
  await espera(4000);
  await foto('passo-09-conversa.png');

  await avaliar(`(location.hash = '#/pratica', 1)`);
  await esperar(`document.querySelector('#praticaView .plano') !== null`);
  await foto('passo-10-pratica.png');
  await avaliar(`(location.hash = '#/pratica/projeto/pj-web-portfolio', 1)`);
  await esperar(`document.querySelector('.projeto-sobre') !== null`);
  await foto('passo-10-projeto.png');

  await avaliar(`(location.hash = '#/agente', 1)`);
  await esperar(`document.querySelector('#agenteView') !== null`);
  await foto('passo-11-forja-vazia.png');
  const sessao = await avaliar(`fetch('/api/codigo/sessoes', { method: 'POST', headers: { 'x-gyde': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ pasta: ${JSON.stringify(PROJETO)} }) }).then((r) => r.json()).then((j) => j.id)`);
  await avaliar(`(location.hash = '#/agente/${sessao}', 1)`);
  await esperar(`document.querySelector('.forja-proj-txt b') !== null`);
  await avaliar(`(()=>{ const t = document.querySelector('#agenteView textarea'); t.value = 'Quando eu clicar no botão, em vez do alerta, mostre "Você clicou!" num parágrafo abaixo dele.'; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#agenteView form').requestSubmit(); return 1; })()`);
  await esperar(`document.querySelector('.forja-turno') && !document.querySelector('.forja-turno.trabalhando')`, 240000);
  await espera(1500);
  await foto('passo-11-forja-resultado.png');

  await avaliar(`(location.hash = '#/', document.getElementById('openSettings').click(), 1)`);
  await esperar(`document.querySelector('[role="tab"]') !== null`);
  await avaliar(clicarTexto('[role="tab"]', 'IA'));
  await foto('passo-08-ia-e-modelos.png');
  await app.fechar();

  // ---------- problemas comuns: FreeLLMAPI fechado e chave não configurada ----------
  app = await abrir({ FREELLMAPI_URL: 'http://127.0.0.1:9', FREELLMAPI_KEY: '' });
  await app.avaliar(`(location.hash = '#/', location.reload(), 1)`); await espera(3000);
  await app.esperar(`document.querySelector('#greeting') !== null`);
  await espera(2500);
  await app.foto('passo-12-sem-freellmapi.png');
  await app.fechar();
  console.log('pronto: capturas em', path.relative(RAIZ, SAIDA));
} finally {
  spawnSync('powershell', ['-NoProfile', '-Command', `Get-Process Gyde -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '${PASTA}*' } | Stop-Process -Force`]);
  await espera(1500);
  const des = existsSync(PASTA) ? readdirSync(PASTA).find((f) => /^Uninstall.*\.exe$/i.test(f)) : null;
  if (des) spawnSync(path.join(PASTA, des), ['/S']);
  for (let i = 0; i < 30 && existsSync(EXE); i++) await espera(500);
  for (const p of [PASTA, DADOS, path.dirname(PROJETO)]) rmSync(p, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
