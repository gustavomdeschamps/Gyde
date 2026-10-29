// App de desktop (Electron) em desenvolvimento ou instalado: abre, sobe o servidor, mostra a interface, isola o Node
// da página, grava os dados na pasta indicada e fecha o servidor junto. Dados numa pasta temporária.
// Uso: node testes-e2e/desktop.e2e.mjs [caminho do Gyde.exe empacotado, ex.: dist-desktop/win-unpacked/Gyde.exe]
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { RAIZ, portaLivre } from './ajuda.mjs';
import { MIGRACOES } from '../pacotes/servidor/migracoes.ts';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0;
const ok = (n, c, x = '') => { if (!c) falhas++; console.log(`${c ? 'PASSOU' : 'FALHOU'}  ${n}${x ? `  (${x})` : ''}`); };
// require('electron') devolve o executável e baixa o binário na primeira vez (num clone novo, como no CI, ele ainda não existe)
const EXE = process.argv[2] ? path.resolve(process.argv[2]) : createRequire(import.meta.url)('electron');
const ARGS = process.argv[2] ? [] : [RAIZ];
const PORTA_DEPURACAO = await portaLivre();
const dados = mkdtempSync(path.join(tmpdir(), 'gyde-desktop-'));
const env = { ...process.env, GYDE_DESKTOP_DADOS: dados };
delete env.ELECTRON_RUN_AS_NODE;
const t0 = Date.now();
const app = spawn(EXE, [...ARGS, `--remote-debugging-port=${PORTA_DEPURACAO}`], { env, stdio: 'ignore' });

let pagina; for (let i = 0; i < 120 && !pagina; i++) {
  try { pagina = (await (await fetch(`http://127.0.0.1:${PORTA_DEPURACAO}/json`)).json()).find((x) => x.type === 'page' && /^http:\/\/127\.0\.0\.1:\d+\//.test(x.url)); } catch { /* subindo */ }
  if (!pagina) await sleep(500);
}
ok('janela abre na interface do servidor local', Boolean(pagina), pagina ? `${pagina.url} em ${((Date.now() - t0) / 1000).toFixed(1)} s` : 'sem janela');
if (!pagina) { app.kill(); process.exit(1); }
const porta = Number(new URL(pagina.url).port);
const ws = new WebSocket(pagina.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map(); const erros = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') erros.push(d.params.exceptionDetails.exception?.description?.split('\n')[0] || d.params.exceptionDetails.text); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
const espera = async (cond, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(cond)) return true; await sleep(300); } return false; };
await send('Runtime.enable');

ok('abertura (vídeo) ou entrada aparece numa instalação nova', await espera(`!document.querySelector('#intro').hidden || !document.querySelector('#gate').hidden`));
ok('página sem acesso ao Node', await ev(`typeof require === 'undefined' && typeof process === 'undefined'`));
const perm = await ev(`(async()=>{ const q = async (n) => { try { return (await navigator.permissions.query({ name: n })).state; } catch (e) { return 'erro'; } };
  return { clipboard: await q('clipboard-write'), geo: await q('geolocation'), cam: await q('camera'), notif: await Notification.requestPermission() }; })()`);
ok('permissões: só copiar é liberado (câmera, localização e notificações negadas)', perm?.clipboard === 'granted' && perm?.geo === 'denied' && perm?.cam === 'denied' && perm?.notif === 'denied', JSON.stringify(perm));
ok('ponte do desktop: escolherPasta e redefinirSenha, sem Node na página', await ev(`typeof window.gydeDesktop?.escolherPasta === 'function' && typeof window.gydeDesktop?.redefinirSenha === 'function' && Object.keys(window.gydeDesktop).sort().join() === 'escolherPasta,importarDados,redefinirSenha,reiniciar'`));
await ev(`(localStorage.setItem('gyde-intro-vista','1'), 1)`); await send('Page.reload'); await sleep(2000);
ok('entrada do desktop oferece trazer os dados do Gyde antigo', await espera(`/Trazer seus dados/.test(document.querySelector('#gate .gate-importar')?.textContent || '')`));
await ev(`[...document.querySelectorAll('#gate .link')].find((b) => /Esqueci/.test(b.textContent))?.click()`);
ok('"Esqueci minha senha" no desktop troca a senha aqui (sem .bat)', await espera(`document.querySelector('#gate form input[name="password"]') !== null && !/redefinir-senha\\.bat/.test(document.querySelector('#gate').textContent)`));
const deFora = await fetch(`http://127.0.0.1:${porta}/api/auth/redefinir-local`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gyde': '1', 'x-gyde-desktop': 'chute' }, body: '{"email":"a@t.test","password":"nova12345"}' });
ok('rota de troca local recusa quem não tem o segredo do app', deFora.status === 403);
const H = `{'x-gyde':'1','Content-Type':'application/json'}`;
await ev(`(async()=>{ localStorage.setItem('gyde-intro-vista','1');
  await fetch('/api/auth/register',{method:'POST',headers:${H},body:JSON.stringify({name:'Desktop Teste',email:'desk@t.test',password:'teste2026x'})});
  await fetch('/api/profile/skip',{method:'POST',headers:${H},body:'{}'}); return 1; })()`);
await send('Page.reload'); await sleep(2500);
ok('cadastro entra no app (modo pessoal)', await espera(`document.querySelector('#gate').hidden && document.querySelector('#userName').textContent === 'Desktop Teste'`));
ok('sem .env: aviso de chave não configurada', await espera(`!document.querySelector('#banner').hidden && /chave do FreeLLMAPI/.test(document.querySelector('#banner').textContent)`));
await ev(`document.querySelector('#bannerConfigIa').click()`); await sleep(500);
ok('link do aviso abre Configurações > IA', await espera(`document.querySelector('dialog.config[open]') !== null && document.querySelector('.config-chave') !== null`));
await ev(`document.querySelector('dialog.config').close()`); await sleep(200);
// chave do FreeLLMAPI pelas Configurações (chave FALSA, só para o teste)
const FALSA = 'freellmapi-testefalsa0123456789';
await ev(`document.querySelector('#openSettings').click()`); await sleep(400);
await ev(`[...document.querySelectorAll('[role="tab"]')].find((b) => /IA e modelos/.test(b.textContent)).click()`); await sleep(600);
ok('aba IA mostra o campo da chave como não configurada', await espera(`/Copy Key/.test(document.querySelector('.config-chave')?.textContent || '')`));
const campo = (v) => ev(`(()=>{ const i = document.querySelector('.config-chave input'); i.value = ${JSON.stringify('X')}.replace('X', ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.config-chave').requestSubmit(); return 1; })()`);
await campo('nao-e-chave');
ok('texto que não é chave é recusado', await espera(`/não parece a chave/.test(document.querySelector('#toast').textContent)`));
await campo(FALSA);
ok('chave salva: campo limpa e mostra "Configurada"', await espera(`document.querySelector('.config-chave input').value === '' && /Configurada neste computador/.test(document.querySelector('.config-chave').textContent)`));
const envTxt = existsSync(path.join(dados, '.env')) ? readFileSync(path.join(dados, '.env'), 'utf8') : '';
ok('chave gravada no .env da pasta do usuário', envTxt.includes(`FREELLMAPI_KEY=${FALSA}`) && /FREELLMAPI_URL=/.test(envTxt));
ok('aviso de chave some do topo', await espera(`!/chave do FreeLLMAPI ainda não/.test(document.querySelector('#banner').hidden ? '' : document.querySelector('#banner').textContent)`));
const respostas = await ev(`(async()=>{ let t = ''; for (const u of ['/api/status', '/api/uso', '/api/settings']) t += await (await fetch(u, { headers: { 'x-gyde': '1' } })).text(); return t; })()`);
ok('nenhuma resposta da API devolve a chave', !respostas.includes(FALSA));
await ev(`document.querySelector('dialog[open]')?.close()`);
await ev(`location.hash = '#/agente'`); await sleep(1500);
ok('microfone (ditado) escondido no desktop', await ev(`document.querySelector('#micBtn') === null`));
ok('Forja abre no desktop', await espera(`document.querySelector('#agenteView .forja-proj, #agenteView .ag-inicio, #agenteView button') !== null`));
ok('janela nova é bloqueada (links externos vão para o navegador)', await ev(`window.open('about:blank') === null`));

// segunda instância só foca a primeira e sai
const segunda = spawn(EXE, [...ARGS], { env, stdio: 'ignore' });
const saiu = await Promise.race([new Promise((r) => segunda.on('exit', () => r(true))), sleep(15000).then(() => false)]);
ok('segunda instância fecha sozinha', saiu);

const banco = path.join(dados, 'dados', 'chat.db');
ok('dados gravados na pasta do usuário', existsSync(banco));
if (existsSync(banco)) { const d = new DatabaseSync(banco, { readOnly: true }); ok('banco migrado (última versão do esquema) com a conta', d.prepare('PRAGMA user_version').get().user_version === MIGRACOES.length && d.prepare('SELECT COUNT(*) n FROM users').get().n === 1); d.close(); }
ok('sem erro de JavaScript', erros.length === 0, erros.slice(0, 3).join(' | '));

// fechar a janela (como o X) fecha o app e o servidor
ws.close();
const tFecha = Date.now();
try { execSync(`taskkill /PID ${app.pid}`, { stdio: 'ignore' }); } catch { /* já fechando */ }
const fechou = await Promise.race([new Promise((r) => app.on('exit', () => r(true))), sleep(15000).then(() => false)]);
ok('fechar a janela encerra o app', fechou, `${((Date.now() - tFecha) / 1000).toFixed(1)} s`);
let livre = false;
for (let i = 0; i < 20 && !livre; i++) { try { await fetch(`http://127.0.0.1:${porta}/`, { signal: AbortSignal.timeout(500) }); await sleep(500); } catch { livre = true; } }
ok('fechar o app desliga o servidor', livre, `${((Date.now() - tFecha) / 1000).toFixed(1)} s`);
try { execSync(`taskkill /PID ${app.pid} /T /F`, { stdio: 'ignore' }); } catch { /* já fechou */ }
await sleep(800);
try { rmSync(dados, { recursive: true, force: true }); } catch { /* arquivo preso */ }
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO PASSOU');
process.exit(falhas ? 1 : 0);
