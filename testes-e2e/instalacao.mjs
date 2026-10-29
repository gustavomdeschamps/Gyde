// Teste do instalador de verdade (Windows): instala uma versão "antiga" numa pasta de teste, confere atalhos e o
// registro de desinstalação, abre o Gyde instalado e testa o uso, atualiza para a versão atual por cima, confere que
// os dados continuam e desinstala, conferindo que o programa sai e os dados ficam. No fim, nada fica instalado.
// Os dados do teste ficam numa pasta temporária (GYDE_DESKTOP_DADOS); em %APPDATA%\Gyde só entra um arquivo-marcador
// para provar que atualizar e desinstalar não apagam os dados da pessoa (ele é removido no fim).
// Uso: npm run teste:instalacao   (gera os instaladores se ainda não existirem; demora alguns minutos)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RAIZ, placar, portaLivre, espera } from './ajuda.mjs';

if (process.platform !== 'win32') { console.log('PULADO  o instalador testado aqui é o do Windows'); process.exit(0); }
const { ok, fim } = placar();
const versao = JSON.parse(readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).version;
const ANTIGA = '1.9.9';
const INSTALADOR = path.join(RAIZ, 'dist-desktop', `Gyde-Setup-${versao}.exe`);
const INSTALADOR_ANTIGO = path.join(RAIZ, 'dist-desktop', 'teste-antigo', `Gyde-Setup-${ANTIGA}.exe`);
const ps = (comando) => spawnSync('powershell', ['-NoProfile', '-Command', comando], { encoding: 'utf8' }).stdout.trim();
const npx = (args) => spawnSync(`npx ${args.join(' ')}`, { cwd: RAIZ, stdio: 'inherit', shell: true });

// ---------- instaladores ----------
if (!existsSync(INSTALADOR)) { console.log('gerando o instalador atual...'); npx(['electron-builder', '--win', '--publish', 'never']); }
if (!existsSync(INSTALADOR_ANTIGO)) {
  console.log(`gerando um instalador ${ANTIGA} para testar a atualização...`);
  npx(['electron-builder', '--win', '--publish', 'never', `-c.extraMetadata.version=${ANTIGA}`, '-c.directories.output=dist-desktop/teste-antigo']);
}
ok('instaladores gerados', existsSync(INSTALADOR) && existsSync(INSTALADOR_ANTIGO), `${path.basename(INSTALADOR_ANTIGO)} e ${path.basename(INSTALADOR)}`);

const PASTA = mkdtempSync(path.join(tmpdir(), 'gyde-inst-')); // sem espaços: o /D do NSIS não aceita aspas
const EXE = path.join(PASTA, 'Gyde.exe');
const DADOS = mkdtempSync(path.join(tmpdir(), 'gyde-inst-dados-'));
const APPDATA_GYDE = path.join(process.env.APPDATA, 'Gyde');
const appdataExistia = existsSync(APPDATA_GYDE);
const MARCADOR = path.join(APPDATA_GYDE, 'marcador-do-teste-de-instalacao.txt');
const ATALHO_MENU = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Gyde.lnk');
const ATALHO_AREA = path.join(process.env.USERPROFILE, 'Desktop', 'Gyde.lnk');
const alvoDoAtalho = (lnk) => ps(`(New-Object -ComObject WScript.Shell).CreateShortcut('${lnk}').TargetPath`);
const registroDesinstalar = () => ps(`Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'Gyde' } | ForEach-Object { $_.DisplayVersion + '|' + $_.InstallLocation }`);

function instalar(instalador) {
  const r = spawnSync(instalador, ['/S', `/D=${PASTA}`], { stdio: 'ignore' });
  return r.status === 0;
}

// ---------- abrir o Gyde instalado e dirigir pela depuração ----------
async function abrir({ ocuparPorta = false } = {}) {
  const ocupante = ocuparPorta ? await new Promise((r) => { const s = createServer(); s.listen(3210, '127.0.0.1', () => r(s)); s.on('error', () => r(null)); }) : null;
  const porta = await portaLivre();
  const env = { ...process.env, GYDE_DESKTOP_DADOS: DADOS };
  delete env.ELECTRON_RUN_AS_NODE;
  const proc = spawn(EXE, [`--remote-debugging-port=${porta}`], { env, stdio: 'ignore', cwd: tmpdir() });
  let pagina;
  for (let i = 0; i < 120 && !pagina; i++) {
    try { pagina = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find((x) => x.type === 'page' && /^http:\/\/127\.0\.0\.1:\d+\//.test(x.url)); } catch { /* subindo */ }
    if (!pagina) await espera(500);
  }
  if (!pagina) return { proc, ocupante, falhou: true };
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const erros = [];
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') erros.push(d.params.exceptionDetails.exception?.description?.split('\n')[0] ?? d.params.exceptionDetails.text); });
  const enviar = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const avaliar = async (e) => (await enviar('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const esperar = async (cond, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await avaliar(cond)) return true; } catch { /* trocando de página */ } await espera(300); } return false; };
  await enviar('Runtime.enable');
  return { proc, ocupante, ws, avaliar, esperar, enviar, erros, base: new URL(pagina.url).origin };
}
async function fechar(app) {
  app.ws?.close();
  spawnSync('taskkill', ['/PID', String(app.proc.pid)], { stdio: 'ignore' }); // como o X da janela
  const fechou = await Promise.race([new Promise((r) => app.proc.once('exit', () => r(true))), espera(30000).then(() => false)]); // 30 s: logo depois de gerar o .exe, o antivírus deixa tudo mais lento
  if (!fechou) spawnSync('taskkill', ['/PID', String(app.proc.pid), '/T', '/F'], { stdio: 'ignore' });
  app.ocupante?.close();
  return fechou;
}
const processosDoGyde = () => ps(`Get-CimInstance Win32_Process -Filter "Name='Gyde.exe'" | ForEach-Object { $_.ExecutablePath + '|' + $_.CommandLine }`).split(/\r?\n/).filter(Boolean);

try {
  // ---------- 1. instalar a versão antiga ----------
  ok(`instala a ${ANTIGA} em silêncio, sem administrador`, instalar(INSTALADOR_ANTIGO) && existsSync(EXE));
  ok('atalho no menu Iniciar aponta para o Gyde instalado', existsSync(ATALHO_MENU) && alvoDoAtalho(ATALHO_MENU).toLowerCase() === EXE.toLowerCase(), alvoDoAtalho(ATALHO_MENU));
  ok('atalho na área de trabalho aponta para o Gyde instalado', existsSync(ATALHO_AREA) && alvoDoAtalho(ATALHO_AREA).toLowerCase() === EXE.toLowerCase());
  ok(`aparece em "Aplicativos instalados" do Windows (${ANTIGA})`, registroDesinstalar().startsWith(`${ANTIGA}|`), registroDesinstalar());
  mkdirSync(APPDATA_GYDE, { recursive: true });
  writeFileSync(MARCADOR, 'dados da pessoa: atualizar e desinstalar não podem apagar');

  // ---------- 2. usar o Gyde instalado ----------
  let app = await abrir();
  ok('o Gyde instalado abre a interface na própria janela', !app.falhou, app.base);
  const H = `{'x-gyde':'1','Content-Type':'application/json'}`;
  await app.avaliar(`(async()=>{ localStorage.setItem('gyde-intro-vista','1');
    await fetch('/api/auth/register',{method:'POST',headers:${H},body:JSON.stringify({name:'Instalada',email:'inst@t.test',password:'teste2026x'})});
    await fetch('/api/profile/skip',{method:'POST',headers:${H},body:'{}'});
    const c = await (await fetch('/api/conversations',{method:'POST',headers:${H},body:'{}'})).json();
    await fetch('/api/conversations/' + c.id,{method:'PATCH',headers:${H},body:JSON.stringify({title:'Conversa do teste de instalação'})}); return 1; })()`);
  await app.enviar('Page.reload'); await espera(2500);
  ok('chat abre com a conta criada', await app.esperar(`document.querySelector('#userName')?.textContent === 'Instalada' && document.querySelector('#greeting') !== null`));
  for (const [h, sel] of [['#/pratica', '#praticaView .plano'], ['#/agente', '#agenteView form'], ['#/skills', '#skillsView .tab'], ['#/turmas', '#turmasView .turma-form'], ['#/', '#greeting']]) {
    await app.avaliar(`(location.hash = '${h}', 1)`);
    ok(`navega para ${h} dentro da janela do Gyde`, await app.esperar(`document.querySelector('${sel}') !== null`), await app.avaliar('location.href'));
  }
  ok('continua no endereço local (sem abrir navegador)', (await app.avaliar('location.origin')) === app.base);
  const procs = processosDoGyde();
  ok('roda só do que foi instalado (nada da pasta de desenvolvimento)', procs.length > 0 && procs.every((p) => p.toLowerCase().startsWith(EXE.toLowerCase()) && !p.toLowerCase().includes(RAIZ.toLowerCase())), `${procs.length} processo(s) Gyde.exe`);
  const segunda = spawn(EXE, [], { env: { ...process.env, GYDE_DESKTOP_DADOS: DADOS }, stdio: 'ignore' });
  ok('abrir de novo pelo atalho não cria outra janela nem outro servidor', await Promise.race([new Promise((r) => segunda.once('exit', () => r(true))), espera(15000).then(() => false)]));
  ok('sem erro de JavaScript', app.erros.length === 0, app.erros.slice(0, 2).join(' | '));
  ok('fechar a janela encerra o app', await fechar(app));
  await espera(1500);
  ok('nenhum processo do Gyde fica para trás', processosDoGyde().length === 0, processosDoGyde().join(' ; '));
  const registro = existsSync(path.join(DADOS, 'registros', 'gyde.log')) ? readFileSync(path.join(DADOS, 'registros', 'gyde.log'), 'utf8') : '';
  ok('registro de diagnóstico gravado (abrir, servidor pronto, fechar)', /abrindo/.test(registro) && /servidor pronto/.test(registro) && /fechando/.test(registro));

  // ---------- 3. porta 3210 ocupada e reabertura ----------
  app = await abrir({ ocuparPorta: true });
  ok('com a porta 3210 ocupada, abre noutra porta', !app.falhou && !app.base.endsWith(':3210'), app.base);
  await app.avaliar(`(localStorage.setItem('gyde-intro-vista','1'), location.reload(), 1)`); await espera(2500);
  ok('depois de fechar e abrir, a conversa e a conta continuam', await app.esperar(`[...document.querySelectorAll('#convList .conv a')].some((a) => a.textContent === 'Conversa do teste de instalação')`, 20000));
  await fechar(app);

  // ---------- 4. atualizar para a versão atual ----------
  await espera(1500);
  ok(`atualiza da ${ANTIGA} para a ${versao} por cima`, instalar(INSTALADOR) && registroDesinstalar().startsWith(`${versao}|`), registroDesinstalar());
  ok('a atualização não apagou os dados da pessoa', existsSync(MARCADOR));
  app = await abrir();
  await app.avaliar(`(localStorage.setItem('gyde-intro-vista','1'), location.reload(), 1)`); await espera(2500);
  ok('versão nova abre com as conversas de antes', !app.falhou && await app.esperar(`[...document.querySelectorAll('#convList .conv a')].some((a) => a.textContent === 'Conversa do teste de instalação')`, 20000));
  const versaoNaTela = await app.avaliar(`fetch('/api/diagnostico').then((r) => r.json()).then((d) => d.gyde)`);
  ok(`o servidor que responde é o da ${versao}`, versaoNaTela === versao, versaoNaTela);
  await fechar(app);
  await espera(1500);

  // ---------- 5. desinstalar ----------
  const desinstalador = readdirSync(PASTA).find((f) => /^Uninstall.*\.exe$/i.test(f));
  spawnSync(path.join(PASTA, desinstalador), ['/S'], { stdio: 'ignore' });
  for (let i = 0; i < 60 && existsSync(EXE); i++) await espera(1000); // o desinstalador se copia e roda à parte
  await espera(2000);
  ok('desinstalar remove o programa', !existsSync(EXE));
  ok('desinstalar remove os atalhos', !existsSync(ATALHO_MENU) && !existsSync(ATALHO_AREA));
  ok('desinstalar remove de "Aplicativos instalados"', registroDesinstalar() === '');
  ok('desinstalar sem confirmar mantém os dados da pessoa', existsSync(MARCADOR));
} finally {
  for (const p of processosDoGyde()) if (p.toLowerCase().startsWith(PASTA.toLowerCase())) ps(`Get-Process Gyde -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '${PASTA}*' } | Stop-Process -Force`);
  const desinstalador = existsSync(PASTA) ? readdirSync(PASTA).find((f) => /^Uninstall.*\.exe$/i.test(f)) : null;
  if (desinstalador && existsSync(EXE)) spawnSync(path.join(PASTA, desinstalador), ['/S'], { stdio: 'ignore' });
  rmSync(MARCADOR, { force: true });
  if (!appdataExistia) rmSync(APPDATA_GYDE, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  for (const p of [PASTA, DADOS]) rmSync(p, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
process.exit(fim());
