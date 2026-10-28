// Ligar e desligar a geração de imagens pelas Configurações, com uma Cloudflare falsa (sem rede, sem gastar cota).
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { subirServidor, abrirNavegador, clienteApi, placar, portaLivre } from './ajuda.mjs';

const { ok, fim } = placar();
const CONTA = '0123456789abcdef0123456789abcdef';
const TOKEN_BOM = 'token_falso_de_teste_0123456789abcdef';
const pedidosCf = [];
const portaCf = await portaLivre();
const cf = http.createServer((req, res) => {
  pedidosCf.push(req.url);
  const autorizado = req.headers.authorization === `Bearer ${TOKEN_BOM}` && req.url.includes(`/accounts/${CONTA}/`);
  res.writeHead(autorizado ? 200 : 403, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(autorizado ? { success: true, result: [] } : { success: false, errors: [{ message: 'Authentication error' }] }));
}).listen(portaCf, '127.0.0.1');

const servidor = await subirServidor({ env: { CLOUDFLARE_API_URL: `http://127.0.0.1:${portaCf}` } });
const conta = await clienteApi(servidor.base).criarConta({ nome: 'Ivo' });
const nav = await abrirNavegador();
try {
  await nav.entrar(servidor.base, conta);
  await nav.ir(`${servidor.base}/?r=1#/`);
  await nav.avaliar(`document.querySelector('#imageBtn').click()`);
  ok('sem configurar, o botão Imagem explica onde ligar', await nav.esperar(`/Configurações > IA e modelos/.test(document.querySelector('#toast').textContent)`, 3000));

  await nav.avaliar(`document.querySelector('#openSettings').click()`);
  await nav.avaliar(`[...document.querySelectorAll('[role="tab"]')].find((b) => /IA e modelos/.test(b.textContent)).click()`);
  ok('aba IA mostra o formulário das imagens', await nav.esperar(`/Gerar imagens/.test(document.querySelector('[data-painel="ia"]')?.textContent || '') && document.querySelector('[aria-label="API Token da Cloudflare"]') !== null`));
  const preencher = (contaTxt, token) => nav.avaliar(`(()=>{ const c = document.querySelector('[aria-label="Account ID da Cloudflare"]'), t = document.querySelector('[aria-label="API Token da Cloudflare"]');
    c.value = ${JSON.stringify(contaTxt)}; c.dispatchEvent(new Event('input', { bubbles: true })); t.value = ${JSON.stringify(token)}; t.dispatchEvent(new Event('input', { bubbles: true }));
    t.closest('form').requestSubmit(); return 1; })()`);

  await preencher('nao-e-id', TOKEN_BOM);
  ok('Account ID errado é recusado sem chamar a Cloudflare', await nav.esperar(`/32 caracteres/.test(document.querySelector('#toast').textContent)`, 3000) && pedidosCf.length === 0);
  await preencher(CONTA, 'token_que_a_cloudflare_recusa_0123456789');
  ok('token recusado pela Cloudflare explica a permissão', await nav.esperar(`/permissão "Workers AI"/.test(document.querySelector('#toast').textContent)`, 5000));
  await preencher(`  Account ID: ${CONTA.toUpperCase()} `, TOKEN_BOM);
  ok('conta e token bons ligam as imagens (ID aceito com texto junto)', await nav.esperar(`/Ligado \\(Cloudflare/.test(document.querySelector('[data-painel="ia"]').textContent)`, 5000));
  ok('a conferência só listou modelos (não gerou imagem)', pedidosCf.every((u) => u.includes('/ai/models/search')), pedidosCf.join(' | '));
  const env = existsSync(path.join(servidor.pasta, '.env')) ? readFileSync(path.join(servidor.pasta, '.env'), 'utf8') : '';
  ok('conta e token gravados no .env deste computador', env.includes(`CLOUDFLARE_ACCOUNT_ID=${CONTA}`) && env.includes(`CLOUDFLARE_API_TOKEN=${TOKEN_BOM}`));
  const respostas = await nav.avaliar(`(async()=>{ let t = ''; for (const u of ['/api/status', '/api/uso', '/api/settings']) t += await (await fetch(u)).text(); return t; })()`);
  ok('nenhuma resposta da API devolve o token', !respostas.includes(TOKEN_BOM));

  await nav.avaliar(`document.querySelector('dialog.config').close()`);
  await nav.esperar(`false`, 400);
  await nav.avaliar(`document.querySelector('#imageBtn').click()`);
  ok('o botão Imagem do chat liga o modo imagem', await nav.esperar(`document.querySelector('#imageBtn').getAttribute('aria-pressed') === 'true' && /Descreva a imagem/.test(document.querySelector('#input').placeholder)`, 3000));

  await nav.avaliar(`document.querySelector('#openSettings').click()`);
  await nav.avaliar(`[...document.querySelectorAll('[role="tab"]')].find((b) => /IA e modelos/.test(b.textContent)).click()`);
  await nav.esperar(`/Ligado/.test(document.querySelector('[data-painel="ia"]').textContent)`, 3000);
  await nav.avaliar(`[...document.querySelectorAll('[data-painel="ia"] button')].find((b) => b.textContent === 'Desligar').click()`);
  ok('desligar pede confirmação e volta ao formulário', await nav.esperar(`document.querySelector('[aria-label="API Token da Cloudflare"]') !== null`, 3000) && nav.dialogos.some((d) => /Desligar a geração de imagens/.test(d)));
  const envDepois = readFileSync(path.join(servidor.pasta, '.env'), 'utf8');
  ok('conta e token saem do .env', !/CLOUDFLARE_/.test(envDepois));
  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 2).join(' | '));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); cf.close(); }
process.exit(fim());
