// App de desktop do Gyde (Electron): sobe o servidor do Gyde num processo separado, numa porta só deste computador
// (a 3210, ou outra livre se ela estiver ocupada), e abre a interface numa janela própria. Os dados e o .env ficam na pasta do usuário
// (%APPDATA%\Gyde), não na pasta do programa, então atualizar ou reinstalar não apaga nada.
import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell, utilityProcess, type UtilityProcess } from 'electron';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { prepararDePasta } from '../servidor/copia.ts';
import path from 'node:path';

// testes apontam os dados para uma pasta temporária (GYDE_DESKTOP_DADOS), longe dos dados de verdade
if (process.env.GYDE_DESKTOP_DADOS) app.setPath('userData', path.resolve(process.env.GYDE_DESKTOP_DADOS));
const RAIZ = app.getAppPath(); // pasta do programa (ou o app.asar, no instalado)
const DADOS = app.getPath('userData');
const ICONE = path.join(RAIZ, 'pacotes', 'interface', 'public', 'icon-512.png');

let servidor: UtilityProcess | null = null;
let janela: BrowserWindow | null = null;
let saindo = false;
let endereco = '';
// segredo desta abertura: só o processo principal conhece (a página não), e o servidor exige nas rotas do desktop
const SEGREDO = randomBytes(32).toString('hex');

// porta só no 127.0.0.1. Prefere a 3210, que é onde as extensões do VS Code e do Chrome procuram o Gyde;
// se ela estiver ocupada (ex.: o iniciar.bat aberto), o sistema escolhe outra livre
const PORTA_PADRAO = 3210;
const tentarPorta = (porta: number) => new Promise<number | null>((ok) => {
  const s = createServer();
  s.once('error', () => ok(null));
  s.listen(porta, '127.0.0.1', () => { const { port } = s.address() as { port: number }; s.close(() => ok(port)); });
});
const escolherPorta = async () => (await tentarPorta(PORTA_PADRAO)) ?? (await tentarPorta(0))!;

async function subirServidor() {
  const porta = await escolherPorta();
  const pastaDados = path.join(DADOS, 'dados');
  mkdirSync(pastaDados, { recursive: true });
  const saida: string[] = [];
  servidor = utilityProcess.fork(path.join(RAIZ, 'pacotes', 'servidor', 'server.ts'), [], {
    serviceName: 'Servidor do Gyde',
    stdio: 'pipe',
    env: { ...process.env, GYDE_DESKTOP: '1', GYDE_SEGREDO_DESKTOP: SEGREDO, PORT: String(porta), DATA_DIR: pastaDados, GYDE_ENV_FILE: path.join(DADOS, '.env') },
  });
  const guardar = (d: Buffer) => { saida.push(String(d)); if (saida.length > 60) saida.shift(); };
  servidor.stdout?.on('data', guardar);
  servidor.stderr?.on('data', guardar);
  servidor.on('exit', (codigo) => {
    servidor = null;
    if (saindo) return;
    // o servidor caiu sozinho: mostra o motivo em vez de deixar a janela parada
    dialog.showErrorBox('O Gyde parou', `O servidor do Gyde fechou (código ${codigo}).\n\n${saida.join('').slice(-1500)}`);
    app.quit();
  });
  endereco = `http://127.0.0.1:${porta}`;
  // espera responder (o primeiro início pode migrar o banco)
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(endereco, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* ainda subindo */ }
    if (!servidor) throw new Error('O servidor do Gyde fechou ao iniciar.');
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`O servidor do Gyde não respondeu.\n\n${saida.join('').slice(-1500)}`);
}

function abrirJanela() {
  janela = new BrowserWindow({
    width: 1280, height: 840, minWidth: 380, minHeight: 520,
    title: 'Gyde', icon: ICONE, show: false, autoHideMenuBar: true, backgroundColor: '#0b1220',
    webPreferences: { preload: path.join(RAIZ, 'pacotes', 'desktop', 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  janela.once('ready-to-show', () => janela?.show());
  // links externos abrem no navegador padrão; a janela do Gyde nunca sai do servidor local
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) && !url.startsWith(endereco)) shell.openExternal(url);
    return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(endereco)) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
  janela.on('closed', () => { janela = null; });
  janela.loadURL(endereco);
}

// seletor de pasta nativo para a Forja (substitui a janela do PowerShell)
ipcMain.handle('gyde:escolher-pasta', async (e) => {
  const dono = BrowserWindow.fromWebContents(e.sender);
  const opcoes = { title: 'Escolha a pasta do projeto', properties: ['openDirectory' as const] };
  const r = dono ? await dialog.showOpenDialog(dono, opcoes) : await dialog.showOpenDialog(opcoes);
  return r.canceled ? null : r.filePaths[0] ?? null;
});

// esqueceu a senha (modo pessoal, sem e-mail): a troca só acontece depois de confirmar numa janela nativa,
// então um script na página não consegue trocar a senha de ninguém sozinho
ipcMain.handle('gyde:redefinir-senha', async (e, email: unknown, senha: unknown) => {
  const dono = BrowserWindow.fromWebContents(e.sender);
  const conta = String(email ?? '').trim().slice(0, 254);
  const opcoes = { type: 'warning' as const, buttons: ['Trocar a senha', 'Cancelar'], defaultId: 1, cancelId: 1, title: 'Trocar senha',
    message: `Trocar a senha da conta ${conta} neste computador?`, detail: 'A conta sai de todos os lugares onde estava aberta e passa a entrar com a senha nova.' };
  const { response } = dono ? await dialog.showMessageBox(dono, opcoes) : await dialog.showMessageBox(opcoes);
  if (response !== 0) return { ok: false, cancelado: true };
  try {
    const r = await fetch(`${endereco}/api/auth/redefinir-local`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gyde': '1', 'x-gyde-desktop': SEGREDO },
      body: JSON.stringify({ email: conta, password: String(senha ?? '') }),
    });
    const corpo = await r.json().catch(() => ({})) as { error?: string };
    return r.ok ? { ok: true } : { ok: false, erro: corpo.error || `Erro ${r.status}` };
  } catch { return { ok: false, erro: 'Não consegui falar com o servidor do Gyde.' }; }
});

// depois de restaurar uma cópia: o app reabre e o servidor aplica a cópia antes de abrir o banco
ipcMain.handle('gyde:reiniciar', () => { app.relaunch(); app.quit(); });

// trazer os dados do Gyde que rodava pelo código (pasta data\ dele) para o app de desktop
ipcMain.handle('gyde:importar-dados', async (e) => {
  const dono = BrowserWindow.fromWebContents(e.sender);
  const escolha = { title: 'Escolha a pasta do Gyde antigo (onde fica o iniciar.bat) ou a pasta data dele', properties: ['openDirectory' as const] };
  const r = dono ? await dialog.showOpenDialog(dono, escolha) : await dialog.showOpenDialog(escolha);
  if (r.canceled || !r.filePaths[0]) return { ok: false, cancelado: true };
  const pasta = [path.join(r.filePaths[0], 'data'), r.filePaths[0]].find((p) => existsSync(path.join(p, 'chat.db')));
  if (!pasta) return { ok: false, erro: 'Não achei os dados do Gyde nessa pasta (procurei data\\chat.db e chat.db).' };
  let resumo;
  try { resumo = prepararDePasta(pasta, path.join(DADOS, 'dados')); } catch (err) { return { ok: false, erro: err instanceof Error ? err.message : String(err) }; }
  const confirmar = { type: 'question' as const, buttons: ['Importar e reabrir', 'Cancelar'], defaultId: 0, cancelId: 1, title: 'Importar dados do Gyde',
    message: `Importar ${resumo.contas} conta(s) e ${resumo.conversas} conversa(s)?`,
    detail: 'Os dados atuais deste app são trocados pelos importados (uma cópia deles fica guardada em copias-banco). O Gyde reabre sozinho.' };
  const { response } = dono ? await dialog.showMessageBox(dono, confirmar) : await dialog.showMessageBox(confirmar);
  if (response !== 0) { rmSync(path.join(DADOS, 'dados', 'restaurar-pendente'), { recursive: true, force: true }); return { ok: false, cancelado: true }; }
  app.relaunch(); app.quit();
  return { ok: true };
});

// atualização automática: procura uma versão nova publicada no GitHub. Sem release publicada, não faz nada.
async function procurarAtualizacao() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = (await import('electron-updater')).default;
    autoUpdater.autoDownload = false;
    autoUpdater.on('update-available', async (info) => {
      const { response } = await dialog.showMessageBox({ type: 'info', buttons: ['Baixar agora', 'Depois'], defaultId: 0, title: 'Atualização do Gyde', message: `Saiu a versão ${info.version} do Gyde. Quer baixar agora? Ela é instalada quando você fechar o Gyde.` });
      if (response === 0) autoUpdater.downloadUpdate();
    });
    await autoUpdater.checkForUpdates();
  } catch { /* sem internet ou sem versão publicada: segue sem atualizar */ }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    // o Electron concede qualquer permissão por padrão: aqui só vale o que o Gyde usa, e só para a página local
    const PERMITIDAS = new Set(['clipboard-sanitized-write', 'fullscreen']);
    const local = (url: string) => Boolean(endereco) && url.startsWith(endereco);
    session.defaultSession.setPermissionRequestHandler((wc, permissao, responder) => responder(PERMITIDAS.has(permissao) && local(wc.getURL())));
    session.defaultSession.setPermissionCheckHandler((wc, permissao) => PERMITIDAS.has(permissao) && local(wc?.getURL() ?? ''));
    try {
      await subirServidor();
    } catch (e) {
      dialog.showErrorBox('Não deu para abrir o Gyde', e instanceof Error ? e.message : String(e));
      saindo = true; servidor?.kill(); app.quit();
      return;
    }
    abrirJanela();
    procurarAtualizacao();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { saindo = true; servidor?.kill(); });
}
