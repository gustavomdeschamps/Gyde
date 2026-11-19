// Mede o desempenho das telas pesadas num servidor de teste (conta e projeto de exemplo, IA falsa, nada pessoal):
//  - abrir o app: tempo desde o início da navegação até o campo de mensagem aparecer (no máximo: é medido na primeira
//    vez que a ferramenta vê o campo; o Edge sem janela não registra o primeiro desenho);
//  - Cidade 3D com uma cópia de um projeto real (o código do próprio Gyde, sem node_modules): tempo até o primeiro
//    quadro, tempo até "pronta" (a abertura animada, que é proposital, terminou e a checagem confirmou os prédios),
//    tempo de CPU para desenhar cada quadro (medido pela própria Cidade, em "Copiar diagnóstico") e memória JavaScript;
//  - Ao vivo de um site estático: tempo do clique até a página aparecer.
// O navegador é o Edge sem janela, com WebGL por software (SwiftShader): os números servem para comparar versões
// NESTE computador, não são o desempenho da placa de vídeo (ex.: Intel UHD 620) com o app aberto. O intervalo entre
// quadros fica preso em 16,7 ms (60 por segundo); por isso o número útil é o tempo de CPU por quadro.
//   node ferramentas/medir-desempenho.mjs [--repeticoes 5] [--saida resultado.json]
import { cpSync, writeFileSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { subirServidor, abrirNavegador, clienteApi, RAIZ } from '../testes-e2e/ajuda.mjs';
import { provedorFalso } from '../testes-e2e/provedor-falso.mjs';
import { apagarSeguro } from './limpeza-segura.mjs';

const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const REPETICOES = Number(arg('repeticoes', '5'));
const mediana = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

// cópia do código do Gyde (pacotes/, ferramentas/, testes-e2e/; sem node_modules nem builds): uma cidade de tamanho real
const projeto = mkdtempSync(path.join(tmpdir(), 'gyde-desempenho-'));
for (const p of ['pacotes', 'ferramentas', 'testes-e2e']) cpSync(path.join(RAIZ, p), path.join(projeto, p), { recursive: true, filter: (f) => !/[\\/](node_modules|dist|dist-desktop|out)([\\/]|$)/.test(f) && !/\.(vsix|zip|exe)$/.test(f) });
const site = mkdtempSync(path.join(tmpdir(), 'gyde-desempenho-site-'));
writeFileSync(path.join(site, 'index.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Site</title></head><body><h1>Olá</h1></body></html>');

const ia = await provedorFalso();
const servidor = await subirServidor({ env: { FREELLMAPI_URL: ia.url, FREELLMAPI_KEY: 'freellmapi-teste-falsa-0000' } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Medida' });
const sessao = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta: projeto })).json();
const sessaoSite = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta: site })).json();
const predios = (await (await api.pedir('GET', `/api/codigo/sessoes/${sessao.id}/cidade`)).json()).arquivos.length;
console.log(`Cidade com ${predios} prédios`);
const r = { abrir: [], cidadePrimeiroQuadro: [], cidadePronta: [], cpuQuadroMediana: [], cpuQuadroP95: [], intervaloP95: [], memoriaMB: [], aoVivo: [] };
try {
  for (let i = 0; i < REPETICOES; i++) {
    const nav = await abrirNavegador({ largura: 1280, altura: 800, webgl: true });
    try {
      await nav.entrar(servidor.base, conta);
      const marca = `m${Date.now()}`;
      await nav.ir(`${servidor.base}/?r=${marca}#/`, 0);
      await nav.esperar(`location.search.includes('${marca}') && document.querySelector('#input')?.getBoundingClientRect().height > 0`, 20_000);
      r.abrir.push(Math.round(await nav.avaliar('performance.now()')));

      await nav.ir(`${servidor.base}/?r=${Date.now()}#/agente/${sessao.id}`, 2000);
      await nav.esperar(`document.querySelector('#abaCidade') !== null`, 10_000);
      const t1 = Date.now();
      await nav.avaliar(`document.querySelector('#abaCidade').click()`);
      r.cidadePrimeiroQuadro.push(await nav.esperar(`document.querySelector('.cidade-canvas') !== null`, 60_000) ? Date.now() - t1 : null);
      r.cidadePronta.push(await nav.esperar(`document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok'`, 60_000) ? Date.now() - t1 : null);
      await nav.esperar('false', 8000); // a câmera gira sozinha; a Cidade guarda os tempos dos últimos quadros
      await nav.avaliar(`window.__diag = ''; navigator.clipboard.writeText = async (t) => { window.__diag = t; }; [...document.querySelectorAll('.cidade-rodape button')].find((b) => /Copiar diagnóstico/.test(b.textContent))?.click(); 1`);
      await nav.esperar(`window.__diag !== ''`, 3000);
      const d = String(await nav.avaliar('window.__diag'));
      const cpu = /CPU para desenhar mediana ([\d.]+) ms, pior 5% ([\d.]+) ms/.exec(d);
      const intervalo = /entre quadros mediana [\d.]+ ms, pior 5% ([\d.]+) ms/.exec(d);
      r.cpuQuadroMediana.push(cpu ? Number(cpu[1]) : null);
      r.cpuQuadroP95.push(cpu ? Number(cpu[2]) : null);
      r.intervaloP95.push(intervalo ? Number(intervalo[1]) : null);
      r.memoriaMB.push(Math.round((await nav.avaliar('performance.memory?.usedJSHeapSize ?? 0')) / 1048576));

      await nav.ir(`${servidor.base}/?r=${Date.now()}#/agente/${sessaoSite.id}`, 2000);
      await nav.avaliar(`[...document.querySelectorAll('.forja-acoes .btn')].find((b) => /Ao vivo/.test(b.textContent)).click()`);
      await nav.esperar(`[...document.querySelectorAll('.ao-vivo button')].some((b) => b.textContent === 'Abrir o site')`, 10_000);
      const t2 = Date.now();
      await nav.avaliar(`[...document.querySelectorAll('.ao-vivo button')].find((b) => b.textContent === 'Abrir o site').click()`);
      r.aoVivo.push(await nav.esperar(`document.querySelector('.ao-vivo iframe') !== null`, 20_000) ? Date.now() - t2 : null);
      await nav.avaliar(`document.querySelector('.ao-vivo button[aria-label="Fechar o Ao vivo e parar o projeto"]')?.click()`);
    } finally { await nav.fechar(); }
    console.log(`rodada ${i + 1}: ${Object.entries(r).map(([k, v]) => `${k} ${v.at(-1)}`).join(' · ')}`);
  }
} finally { await servidor.parar(); await ia.fechar(); apagarSeguro(projeto); apagarSeguro(site); }
const resumo = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { mediana: mediana(v), valores: v }]));
console.log(`\nMedianas (n = ${REPETICOES}, ${predios} prédios): ${Object.entries(resumo).map(([k, v]) => `${k} ${v.mediana}`).join(' · ')} (tempos em ms, memória em MB)`);
const saida = arg('saida', null);
if (saida) writeFileSync(saida, JSON.stringify({ em: new Date().toISOString(), repeticoes: REPETICOES, predios, navegador: 'Edge sem janela, WebGL por software (SwiftShader)', resumo }, null, 2));
