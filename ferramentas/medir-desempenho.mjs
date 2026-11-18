// Mede o desempenho das telas pesadas num servidor de teste (conta e projeto de exemplo, IA falsa, nada pessoal):
//  - abrir o app: tempo desde o início da navegação até o campo de mensagem aparecer (no máximo: é medido na primeira
//    vez que a ferramenta vê o campo; o Edge sem janela não registra o primeiro desenho);
//  - Cidade 3D com uma cópia de um projeto real (o código do próprio Gyde, sem node_modules): tempo até o primeiro
//    quadro conferido, tempos de quadro por 6 s (mediana e 95º percentil) e memória JavaScript;
//  - Ao vivo de um site estático: tempo do clique até a página aparecer.
// O navegador é o Edge sem janela, com WebGL por software (SwiftShader): os números servem para comparar versões
// NESTE computador, não são o desempenho da placa de vídeo (ex.: Intel UHD 620) com o app aberto.
//   node ferramentas/medir-desempenho.mjs [--repeticoes 3] [--saida resultado.json]
import { cpSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { subirServidor, abrirNavegador, clienteApi, RAIZ } from '../testes-e2e/ajuda.mjs';
import { provedorFalso } from '../testes-e2e/provedor-falso.mjs';
import { apagarSeguro } from './limpeza-segura.mjs';

const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const REPETICOES = Number(arg('repeticoes', '3'));
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const percentil = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };

// cópia do código do Gyde (só pacotes/ e ferramentas/, sem node_modules nem dist): uma cidade de tamanho real
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
const r = { abrir: [], cidadePronta: [], quadroMediana: [], quadroP95: [], memoriaMB: [], predios: [], aoVivo: [] };
try {
  for (let i = 0; i < REPETICOES; i++) {
    const nav = await abrirNavegador({ largura: 1280, altura: 800, webgl: true });
    try {
      await nav.entrar(servidor.base, conta);
      const marca = `m${Date.now()}`;
      await nav.ir(`${servidor.base}/?r=${marca}#/`, 0);
      // só conta a página nova (a marca na URL) e o campo de mensagem visível; o tempo vem do relógio da própria página
      await nav.esperar(`location.search.includes('${marca}') && document.querySelector('#input')?.getBoundingClientRect().height > 0`, 20_000);
      r.abrir.push(Math.round(await nav.avaliar(`performance.now()`)));

      await nav.ir(`${servidor.base}/?r=${Date.now()}#/agente/${sessao.id}`, 2000);
      await nav.esperar(`document.querySelector('#abaCidade') !== null`, 10_000);
      const t1 = Date.now();
      await nav.avaliar(`document.querySelector('#abaCidade').click()`);
      const pronta = await nav.esperar(`document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok'`, 60_000);
      r.cidadePronta.push(pronta ? Date.now() - t1 : null);
      r.predios.push(await nav.avaliar(`document.querySelectorAll('.cidade-bairro tbody tr').length || Number(document.querySelector('.cidade-3d')?.dataset.predios || 0)`));
      // tempos de quadro: 6 s de requestAnimationFrame com a câmera girando sozinha (a cena anima o fundo)
      const q = await nav.avaliar(`new Promise((ok) => { const t = []; let a = performance.now(); const fim = a + 6000; const f = (n) => { t.push(n - a); a = n; if (n < fim) requestAnimationFrame(f); else ok(t.slice(5)); }; requestAnimationFrame(f); })`);
      r.quadroMediana.push(Number(mediana(q).toFixed(1))); r.quadroP95.push(Number(percentil(q, 0.95).toFixed(1)));
      r.memoriaMB.push(Math.round((await nav.avaliar(`performance.memory?.usedJSHeapSize ?? 0`)) / 1048576));

      await nav.ir(`${servidor.base}/?r=${Date.now()}#/agente/${sessaoSite.id}`, 2000);
      await nav.avaliar(`[...document.querySelectorAll('.forja-acoes .btn')].find((b) => /Ao vivo/.test(b.textContent)).click()`);
      await nav.esperar(`[...document.querySelectorAll('.ao-vivo button')].some((b) => b.textContent === 'Abrir o site')`, 10_000);
      const t2 = Date.now();
      await nav.avaliar(`[...document.querySelectorAll('.ao-vivo button')].find((b) => b.textContent === 'Abrir o site').click()`);
      const abriu = await nav.esperar(`document.querySelector('.ao-vivo iframe') !== null`, 20_000);
      r.aoVivo.push(abriu ? Date.now() - t2 : null);
      await nav.avaliar(`document.querySelector('.ao-vivo button[aria-label="Fechar o Ao vivo e parar o projeto"]')?.click()`);
    } finally { await nav.fechar(); }
    console.log(`rodada ${i + 1}: abrir ${r.abrir.at(-1)} ms · Cidade pronta ${r.cidadePronta.at(-1)} ms · quadro ${r.quadroMediana.at(-1)} ms (p95 ${r.quadroP95.at(-1)}) · memória ${r.memoriaMB.at(-1)} MB · Ao vivo ${r.aoVivo.at(-1)} ms`);
  }
} finally { await servidor.parar(); await ia.fechar(); apagarSeguro(projeto); apagarSeguro(site); }
const resumo = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { mediana: mediana(v.filter((x) => x != null)), valores: v }]));
console.log(`\nMedianas (n = ${REPETICOES}): abrir ${resumo.abrir.mediana} ms · Cidade pronta ${resumo.cidadePronta.mediana} ms · quadro ${resumo.quadroMediana.mediana} ms (p95 ${resumo.quadroP95.mediana}) · memória ${resumo.memoriaMB.mediana} MB · Ao vivo ${resumo.aoVivo.mediana} ms`);
const saida = arg('saida', null);
if (saida) writeFileSync(saida, JSON.stringify({ em: new Date().toISOString(), repeticoes: REPETICOES, navegador: 'Edge sem janela, WebGL por software', resumo }, null, 2));
