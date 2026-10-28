// Base dos testes de navegador do Gyde. Cada teste sobe o próprio servidor (pasta de dados temporária, porta livre,
// contratos em modo estrito) e abre um Chrome/Edge sem janela pelo protocolo de depuração. Nada toca nos dados reais.
// Navegador: variável GYDE_NAVEGADOR, ou o Edge/Chrome instalado no lugar de sempre.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const RAIZ = path.join(import.meta.dirname, '..');
export const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export const portaLivre = () => new Promise((ok) => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
});

// placar simples: imprime PASSOU/FALHOU e devolve o código de saída no fim
export function placar() {
  let falhas = 0;
  const ok = (nome, condicao, extra = '') => { if (!condicao) falhas++; console.log(`${condicao ? 'PASSOU' : 'FALHOU'}  ${nome}${extra ? `  (${extra})` : ''}`); return condicao; };
  const fim = () => { console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO PASSOU'); return falhas ? 1 : 0; };
  return { ok, fim };
}

// servidor do Gyde isolado. `pasta` permite reabrir com os mesmos dados (ex.: depois de restaurar uma cópia).
export async function subirServidor({ env = {}, pasta } = {}) {
  const dados = pasta ?? mkdtempSync(path.join(tmpdir(), 'gyde-e2e-'));
  const porta = await portaLivre();
  const saida = [];
  const proc = spawn(process.execPath, [path.join(RAIZ, 'pacotes', 'servidor', 'server.ts')], {
    env: {
      ...process.env, DATA_DIR: dados, PORT: String(porta), GYDE_CONTRATOS: 'estrito', GYDE_DESKTOP: '1',
      GYDE_ENV_FILE: path.join(dados, '.env'), // nunca lê o .env de verdade
      FREELLMAPI_URL: 'http://127.0.0.1:9', OLLAMA_URL: 'http://127.0.0.1:9', ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.on('data', (d) => saida.push(String(d)));
  proc.stderr.on('data', (d) => saida.push(String(d)));
  const base = `http://127.0.0.1:${porta}`;
  for (let i = 0; i < 150; i++) {
    try { await fetch(`${base}/api/auth/me`); break; } catch { if (proc.exitCode !== null) throw new Error(`O servidor fechou:\n${saida.join('')}`); await espera(100); }
  }
  return {
    base, pasta: dados, saida,
    // respostas fora do contrato aparecem no log do servidor (modo estrito)
    foraDoContrato: () => saida.join('').match(/fora do contrato.*$/m)?.[0] ?? null,
    async parar({ apagar = !pasta } = {}) {
      proc.kill();
      await new Promise((r) => (proc.exitCode !== null ? r() : proc.once('exit', r)));
      if (apagar) { await espera(300); try { rmSync(dados, { recursive: true, force: true }); } catch { /* arquivo preso */ } }
    },
  };
}

// conta pela API (cookie guardado) — útil para preparar dados antes de abrir o navegador
export function clienteApi(base) {
  let cookie = '';
  const pedir = async (metodo, rota, corpo, cabecalhos = {}) => {
    const r = await fetch(base + rota, { method: metodo, headers: { 'x-gyde': '1', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...cabecalhos }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    const c = r.headers.get('set-cookie'); if (c) cookie = c.split(';')[0];
    return r;
  };
  return {
    pedir,
    async criarConta({ nome = 'Teste', email = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@t.test`, senha = 'teste2026x', pularQuiz = true } = {}) {
      await pedir('POST', '/api/auth/register', { name: nome, email, password: senha });
      await pedir('POST', '/api/auth/login', { email, password: senha });
      if (pularQuiz) await pedir('POST', '/api/profile/skip', {});
      return { email, senha };
    },
  };
}

function caminhoNavegador() {
  const candidatos = [process.env.GYDE_NAVEGADOR,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const achado = candidatos.find((c) => existsSync(c));
  if (!achado) throw new Error('Não achei o Chrome nem o Edge. Defina GYDE_NAVEGADOR com o caminho do executável.');
  return achado;
}

// navegador sem janela, controlado pelo protocolo de depuração (CDP)
export async function abrirNavegador({ largura = 1280, altura = 860, movel = false } = {}) {
  const perfil = mkdtempSync(path.join(tmpdir(), 'gyde-e2e-nav-'));
  const porta = await portaLivre();
  const proc = spawn(caminhoNavegador(), ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', ...(process.platform === 'linux' ? ['--no-sandbox'] : []), 'about:blank'], { stdio: 'ignore' });
  let alvos;
  for (let i = 0; i < 80 && !alvos; i++) { try { alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json(); } catch { await espera(250); } }
  const ws = new WebSocket(alvos.find((x) => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pendentes = new Map(); const erros = []; const dialogos = [];
  const enviar = (method, params = {}) => new Promise((r) => { const i = ++id; pendentes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (pendentes.has(d.id)) { pendentes.get(d.id)(d); pendentes.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') erros.push(d.params.exceptionDetails.exception?.description?.split('\n')[0] || d.params.exceptionDetails.text);
    // confirm()/alert(): aceita e guarda o texto para o teste conferir
    if (d.method === 'Page.javascriptDialogOpening') { dialogos.push(d.params.message); enviar('Page.handleJavaScriptDialog', { accept: true }); }
  });
  await enviar('Runtime.enable'); await enviar('Page.enable');
  await enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: movel });
  if (movel) await enviar('Emulation.setTouchEmulationEnabled', { enabled: true });
  const avaliar = async (expressao) => {
    const r = await enviar('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.result?.exceptionDetails) throw new Error(`Erro no navegador: ${r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text}`);
    return r.result?.result?.value;
  };
  return {
    erros, dialogos, enviar, avaliar,
    async ir(url, pausa = 2000) { await enviar('Page.navigate', { url }); await espera(pausa); },
    async esperar(condicao, ms = 10_000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await avaliar(condicao)) return true; } catch { /* página trocando */ } await espera(200); } return false; },
    // entra com uma conta e pula o vídeo de abertura
    async entrar(base, { email, senha }) {
      await this.ir(`${base}/`, 800);
      await avaliar(`(async()=>{ localStorage.setItem('gyde-intro-vista','1'); await fetch('/api/auth/login',{method:'POST',headers:{'x-gyde':'1','Content-Type':'application/json'},body:${JSON.stringify(JSON.stringify({ email, password: senha }))}}); return 1; })()`);
    },
    async fechar() {
      ws.close();
      // no Windows o kill não derruba os processos filhos do navegador
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(proc.pid), '/t', '/f'], { stdio: 'ignore' });
        // filhos que já se soltaram da árvore: qualquer processo que ainda use a pasta de perfil deste teste
        spawnSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '${path.basename(perfil)}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' });
      } else proc.kill();
      await new Promise((r) => (proc.exitCode !== null ? r() : proc.once('exit', r)));
      await espera(300); try { rmSync(perfil, { recursive: true, force: true }); } catch { /* perfil preso */ }
    },
  };
}

// projeto pequeno para a Forja: soma.js com bug, teste que falha, e um .env FALSO que ela nunca pode ler
export function criarProjetoForja() {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-e2e-proj-'));
  const f = (nome, texto) => writeFileSync(path.join(pasta, nome), texto);
  const chaveFalsa = ['AIza', 'Sy', 'FALSO'.repeat(5), '12345'].join('');
  f('package.json', JSON.stringify({ name: 'proj-forja', version: '1.0.0', scripts: { test: 'node teste.js' } }, null, 2));
  f('soma.js', `// chave antiga: ${chaveFalsa}
function soma(a, b) {
  return a - b;
}
module.exports = { soma };
`);
  f('teste.js', `const { soma } = require('./soma.js');
if (soma(2, 3) !== 5) { console.log('FALHOU: soma(2, 3) deu ' + soma(2, 3)); process.exit(1); }
console.log('OK');
`);
  f('.env', `${['API_KEY=', 'SEGREDOFALSO', '1234567890'].join('')}\n`);
  return { pasta, ler: (nome) => readFileSync(path.join(pasta, nome), 'utf8'), apagar: () => rmSync(pasta, { recursive: true, force: true }) };
}
