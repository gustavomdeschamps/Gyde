// Grava o tutorial animado da documentação (docs/imagens/tutorial.gif) num servidor de teste, com a IA de verdade:
// conta nova "Estudante" (e-mail de exemplo), Primeiros passos, a primeira pergunta com o código conferido, a Forja
// corrigindo o projeto de exemplo C:\Projetos\calculadora até o "Verificado" e a Cidade. As chaves do .env vão só
// para o processo do servidor de teste (nunca na tela nem em log). Sem dependências: o GIF é montado por gif.mjs.
//   node ferramentas/gravar-tutorial.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { subirServidor, abrirNavegador, clienteApi, espera, RAIZ } from '../testes-e2e/ajuda.mjs';
import { lerPng, montarGif } from './gif.mjs';

const PROJETO = 'C:/Projetos/calculadora';
if (!existsSync(PROJETO)) { console.error('Falta o projeto de exemplo C:/Projetos/calculadora'); process.exit(1); }
spawnSync('git', ['-C', PROJETO, 'checkout', '--', '.']); // volta o erro de propósito do projeto de exemplo
const chaves = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)
  .filter((l) => /^(NVIDIA_API_KEY|GROQ_API_KEY|GEMINI_API_KEY)=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const servidor = await subirServidor({ env: { ...chaves, FREELLMAPI_URL: 'http://127.0.0.1:9' } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Estudante', email: 'estudante@exemplo.com' });
const sessao = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta: PROJETO })).json();
const nav = await abrirNavegador({ largura: 1024, altura: 640, webgl: true });
const quadros = [];
const foto = async (segundos) => {
  const { data } = (await nav.enviar('Page.captureScreenshot', { format: 'png' })).result;
  quadros.push({ ...lerPng(Buffer.from(data, 'base64')), atraso: Math.round(segundos * 100) });
};
try {
  await nav.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await nav.entrar(servidor.base, conta);
  await nav.avaliar(`localStorage.setItem('theme', 'light'); localStorage.setItem('cidadeModo', '3d'); 1`);
  await nav.ir(`${servidor.base}/?r=1#/`, 2500);
  await nav.esperar(`document.querySelector('.primeiros-passos') !== null`, 15_000);
  await foto(2.8);
  await nav.avaliar(`[...document.querySelectorAll('.primeiros-passos button')].find((b) => /Usar um exemplo/.test(b.textContent)).click()`);
  await espera(600);
  await foto(1.6);
  await nav.avaliar(`document.querySelector('#input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
  // a resposta chegando aos poucos
  for (let i = 0; i < 10; i++) {
    await espera(700);
    await foto(0.7);
    if (await nav.avaliar(`!document.querySelector('#sendBtn').classList.contains('streaming') && /Código conferido|Atenção/.test(document.querySelector('.msg.assistant')?.textContent || '')`)) break;
  }
  await nav.esperar(`!document.querySelector('#sendBtn').classList.contains('streaming')`, 60_000);
  await espera(800);
  await nav.avaliar(`document.querySelector('#thread').scrollTop = document.querySelector('#thread').scrollHeight; 1`);
  await foto(3.2);
  // a Forja no projeto de exemplo
  await nav.ir(`${servidor.base}/?r=2#/agente/${sessao.id}`, 2500);
  await nav.avaliar(`(()=>{ const x = document.querySelector('#agenteView textarea'); x.value = 'Os testes estão falhando. Ache o erro, corrija e rode os testes.'; x.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await foto(1.8);
  await nav.avaliar(`document.querySelector('#agenteView form').requestSubmit()`);
  const fim = Date.now() + 240_000;
  while (Date.now() < fim) {
    await espera(1500);
    // a Forja pede permissão para rodar comandos de risco: aceita (é o projeto de exemplo)
    await nav.avaliar(`[...document.querySelectorAll('.forja-confirmar button')].find((b) => /Permitir|Seguir/.test(b.textContent))?.click(); 1`);
    if (quadros.length < 30) await foto(0.9);
    if (await nav.avaliar(`document.querySelector('#agenteView .send').getAttribute('aria-label') !== 'Parar' && document.querySelector('.forja-turno .forja-resposta')?.textContent.length > 20`)) break;
  }
  await espera(1000);
  await nav.avaliar(`document.querySelector('.forja-verificacao')?.scrollIntoView({ block: 'end' }); 1`);
  await foto(3.5);
  // a Cidade
  await nav.avaliar(`document.querySelector('#abaCidade').click()`);
  await nav.esperar(`document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok'`, 60_000);
  await espera(1500);
  await foto(3.5);
} finally { await nav.fechar(); await servidor.parar(); spawnSync('git', ['-C', PROJETO, 'checkout', '--', '.']); }
const gif = montarGif(quadros);
writeFileSync(path.join(RAIZ, 'docs', 'imagens', 'tutorial.gif'), gif);
console.log(`tutorial.gif: ${quadros.length} quadros, ${(gif.length / 1048576).toFixed(1)} MB, ${Math.round(quadros.reduce((n, q) => n + q.atraso, 0) / 100)} s`);
