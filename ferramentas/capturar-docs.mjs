// Refaz as capturas da documentação (docs/imagens) num servidor de teste: conta "Estudante" com e-mail de exemplo,
// projetos de exemplo em C:\Projetos (calculadora com um erro de propósito e uma cópia do Gyde para a Cidade).
// A Forja usa a IA de verdade: as chaves do .env vão só para o processo do servidor de teste (nunca na tela nem em log).
//   node ferramentas/capturar-docs.mjs [--telas skills,forja,cidade]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { subirServidor, abrirNavegador, clienteApi, espera, RAIZ } from '../testes-e2e/ajuda.mjs';

const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const TELAS = arg('telas', 'skills,forja,cidade').split(',');
const SAIDA = path.join(RAIZ, 'docs/imagens');
const PROJETOS = 'C:/Projetos';
const chaves = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)
  .filter((l) => /^(NVIDIA_API_KEY|GROQ_API_KEY|GEMINI_API_KEY)=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));

const servidor = await subirServidor({ env: { ...chaves, FREELLMAPI_URL: 'http://127.0.0.1:9' } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Estudante', email: 'estudante@exemplo.com' });
const tema = (nav, t) => nav.avaliar(`localStorage.setItem('theme', '${t}'); document.documentElement.dataset.theme = '${t}'; 1`);
async function foto(nav, nome) {
  await espera(600);
  const { data } = (await nav.enviar('Page.captureScreenshot', { format: 'jpeg', quality: 88 })).result;
  writeFileSync(path.join(SAIDA, nome), Buffer.from(data, 'base64'));
  console.log('gravada', nome);
}
const git = (pasta, ...a) => spawnSync('git', ['-C', pasta, ...a], { encoding: 'utf8' });

try {
  if (TELAS.includes('skills')) {
    for (const id of ['explicar-conceito', 'git-sem-medo', 'front-end']) await api.pedir('POST', `/api/skills/${id}/install`);
    for (const t of ['light', 'dark']) {
      const nav = await abrirNavegador({ largura: 1440, altura: 900 });
      try {
        await nav.entrar(servidor.base, conta);
        await tema(nav, t);
        await nav.ir(`${servidor.base}/?r=${Math.random()}#/skills`, 2500);
        await tema(nav, t);
        await nav.esperar(`document.querySelector('.sk-quero') !== null`, 15_000);
        await nav.avaliar(`(()=>{ const i = document.querySelector('#skQuero'); i.value = 'analisar dados'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
        await foto(nav, t === 'light' ? 'skills.jpg' : 'skills-escuro.jpg');
      } finally { await nav.fechar(); }
    }
  }
  if (TELAS.includes('primeiros')) {
    // conta nova (sem conversa nem pasta) com a IA conectada: o cartão mostra o que falta; depois, o Diagnóstico
    const outra = await clienteApi(servidor.base).criarConta({ nome: 'Estudante', email: 'novo@exemplo.com' });
    for (const t of ['light', 'dark']) {
      const nav = await abrirNavegador({ largura: 1440, altura: 900 });
      try {
        await nav.entrar(servidor.base, outra);
        await tema(nav, t);
        await nav.ir(`${servidor.base}/?r=${Math.random()}#/`, 2500);
        await tema(nav, t);
        await nav.esperar(`document.querySelector('.primeiros-passos') !== null`, 15_000);
        await foto(nav, t === 'light' ? 'primeiros-passos.jpg' : 'primeiros-passos-escuro.jpg');
        await nav.avaliar(`document.querySelector('#openSettings').click()`);
        await nav.esperar(`document.querySelector('#rodarDiagnostico') !== null`, 5000);
        await nav.avaliar(`document.querySelector('#rodarDiagnostico').click()`);
        await nav.esperar(`document.querySelectorAll('.diagnostico li').length >= 6`, 60_000);
        await nav.avaliar(`document.querySelector('.diagnostico').scrollIntoView({ block: 'center' }); 1`);
        if (t === 'light') await foto(nav, 'diagnostico.jpg'); // só o claro aparece no guia de instalação
      } finally { await nav.fechar(); }
    }
  }
  if (TELAS.includes('respostas')) {
    // uma pergunta de código com a IA de verdade: a resposta segue o guia de estilo e termina com "Código conferido"
    const conv = await (await api.pedir('POST', '/api/conversations', {})).json();
    await (await api.pedir('POST', `/api/conversations/${conv.id}/messages`, { mode: 'new', content: 'escreve uma função em javascript que devolve só os números pares de uma lista', attachments: [], model: 'gyde-1', kind: 'chat' })).text();
    for (const t of ['light', 'dark']) {
      const nav = await abrirNavegador({ largura: 1440, altura: 900 });
      try {
        await nav.entrar(servidor.base, conta);
        await tema(nav, t);
        await nav.ir(`${servidor.base}/?r=${Math.random()}#/c/${conv.id}`, 2500);
        await tema(nav, t);
        await nav.esperar(`document.querySelector('.msg.assistant .md') !== null`, 15_000);
        await foto(nav, t === 'light' ? 'respostas.jpg' : 'respostas-escuro.jpg');
      } finally { await nav.fechar(); }
    }
  }
  if (TELAS.includes('forja')) {
    const pasta = `${PROJETOS}/calculadora`;
    if (!existsSync(pasta)) throw new Error('Falta o projeto de exemplo C:/Projetos/calculadora');
    for (const t of ['light', 'dark']) {
      git(pasta, 'checkout', '--', '.'); // volta o erro de propósito (o projeto de exemplo é só para as capturas)
      const s = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta })).json();
      const nav = await abrirNavegador({ largura: 1440, altura: 900 });
      try {
        await nav.entrar(servidor.base, conta);
        await tema(nav, t);
        await nav.ir(`${servidor.base}/?r=${Math.random()}#/agente/${s.id}`, 2500);
        await tema(nav, t);
        await nav.avaliar(`(()=>{ const x = document.querySelector('#agenteView textarea'); x.value = 'Os testes estão falhando. Ache o erro, corrija e rode os testes.'; x.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#agenteView form').requestSubmit(); return 1; })()`);
        // a Forja pede permissão para rodar comandos: aceita (é o projeto de exemplo)
        const fim = Date.now() + 240_000;
        while (Date.now() < fim) {
          await nav.avaliar(`[...document.querySelectorAll('.forja-confirmar button')].find((b) => /Permitir|Sim|Seguir/.test(b.textContent))?.click(); 1`);
          if (await nav.avaliar(`Boolean(document.querySelector('.forja-turno') && !document.querySelector('.forja-turno.trabalhando'))`)) break;
          await espera(1000);
        }
        await foto(nav, t === 'light' ? 'forja.jpg' : 'forja-escuro.jpg');
      } finally { await nav.fechar(); }
    }
    git(pasta, 'checkout', '--', '.');
  }
  if (TELAS.includes('cidade')) {
    const pasta = `${PROJETOS}/gyde`;
    git(pasta, 'fetch', '-q', 'origin'); git(pasta, 'checkout', '-q', '-B', 'main', 'origin/main'); // cópia do Gyde só para a Cidade, na main atual
    const s = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta })).json();
    for (const t of ['dark', 'light']) {
      const nav = await abrirNavegador({ largura: 1440, altura: 900, webgl: true });
      try {
        // câmera parada na vista geral (sem o voo até o prédio clicado), para a foto mostrar a cidade e o cartão
        await nav.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await nav.entrar(servidor.base, conta);
        await tema(nav, t);
        await nav.avaliar(`localStorage.setItem('cidadeModo', '3d'); localStorage.setItem('gyde-teste-cidade-ponto', '1'); 1`);
        await nav.ir(`${servidor.base}/?r=${Math.random()}#/agente/${s.id}`, 2500);
        await tema(nav, t);
        await nav.esperar(`document.querySelector('#abaCidade') !== null`);
        await nav.avaliar(`document.querySelector('#abaCidade').click()`);
        await nav.esperar(`document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok' && typeof document.querySelector('.cidade-3d').__pontoDe === 'function'`, 60_000);
        await espera(4000);
        if (t === 'dark') await foto(nav, 'cidade.jpg');
        const p = JSON.parse(await nav.avaliar(`JSON.stringify(document.querySelector('.cidade-3d').__pontoDe('pacotes/compartilhado/contratos.ts'))`));
        for (const tipo of ['mouseMoved', 'mousePressed', 'mouseReleased']) await nav.enviar('Input.dispatchMouseEvent', { type: tipo, x: p.x, y: p.y, button: 'left', clickCount: 1 });
        await nav.esperar(`document.querySelector('.cidade-cartao h3') !== null`, 8000);
        await espera(2500);
        await foto(nav, t === 'dark' ? 'cidade-forja.jpg' : 'cidade-forja-claro.jpg');
      } finally { await nav.fechar(); }
    }
  }
} finally { await servidor.parar(); }
process.exit(0);
