// Forja na tela, com o provedor falso: corrigir um arquivo, rodar os testes, resumo, histórico, desfazer e parar.
// Os comandos da Forja rodam pelo cmd.exe: este teste só roda no Windows.
import { spawnSync } from 'node:child_process';
import { subirServidor, abrirNavegador, clienteApi, placar, criarProjetoForja } from './ajuda.mjs';
import { provedorFalso } from './provedor-falso.mjs';

if (process.platform !== 'win32') { console.log('PULADO  a Forja roda comandos pelo cmd.exe (só Windows)'); process.exit(0); }
const { ok, fim } = placar();
const ia = await provedorFalso();
const servidor = await subirServidor({ env: { FREELLMAPI_URL: ia.url, FREELLMAPI_KEY: 'freellmapi-teste-falsa-0000' } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Tela' });
const proj = criarProjetoForja();
const sessao = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta: proj.pasta })).json();
const nav = await abrirNavegador();
const { avaliar, esperar } = nav;
const pedir = (texto) => avaliar(`(()=>{ const t = document.querySelector('#agenteView textarea'); t.value = ${JSON.stringify(texto)}; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#agenteView form').requestSubmit(); return 1; })()`);
// o comando do roteiro falso é um node com setTimeout de 60 s; procura ele entre os processos do Windows
const comandoLongoVivo = () => /setTimeout/.test(spawnSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object -ExpandProperty CommandLine"], { encoding: 'utf8' }).stdout ?? '');
try {
  await nav.entrar(servidor.base, conta);
  await nav.ir(`${servidor.base}/?r=1#/agente/${sessao.id}`, 2500);
  ok('sessão abre com o projeto na barra', await esperar(`document.querySelector('.forja-proj-txt b')?.textContent.startsWith('gyde-e2e-proj-')`));
  ok('sugestões aparecem numa conversa nova', await avaliar(`document.querySelectorAll('.ag-sugestoes button').length === 4`));

  await pedir('Corrija a função soma em soma.js e rode npm test.');
  ok('o turno aparece "Trabalhando" com relógio', await esperar(`document.querySelector('.forja-turno.trabalhando .forja-tempo') !== null`, 10_000));
  ok('o turno termina e mostra quanto tempo levou', await esperar(`document.querySelector('.forja-turno') && !document.querySelector('.forja-turno.trabalhando') && /Trabalhou/.test(document.querySelector('.forja-status').textContent)`, 60_000));
  ok('resumo: soma.js alterado e npm test ✓', await avaliar(`(()=>{ const r = document.querySelector('.forja-resumo'); return Boolean(r) && /soma\\.js/.test(r.textContent) && /✓ npm test/.test(r.textContent); })()`), await avaliar(`document.querySelector('.forja-resumo')?.textContent.slice(0, 120)`));
  ok('arquivo realmente corrigido no disco', /a\s*\+\s*b/.test(proj.ler('soma.js')));
  ok('chave falsa do arquivo não foi para a IA (segredo removido)', ia.pedidos.every((p) => !p.mensagens.some((m) => /AIzaSyFALSO/.test(JSON.stringify(m.content)))));
  ok('botão Desfazer aparece', await avaliar(`[...document.querySelectorAll('.forja-acoes .btn')].some((b) => /Desfazer/.test(b.textContent))`));

  await nav.ir(`${servidor.base}/?r=2#/agente/${sessao.id}`, 2500);
  ok('depois de recarregar, o histórico volta com o mesmo resumo', await esperar(`document.querySelectorAll('.forja-turno').length === 1 && /soma\\.js/.test(document.querySelector('.forja-resumo')?.textContent || '')`));
  ok('atividade fechada, abre ao clicar', await avaliar(`(()=>{ const t = document.querySelector('.forja-turno'); const fechado = t.classList.contains('fechado'); t.querySelector('.forja-cab').click(); return fechado; })()`) && await esperar(`!document.querySelector('.forja-turno').classList.contains('fechado') && document.querySelectorAll('.ag-passo').length > 0`, 3000));

  await avaliar(`[...document.querySelectorAll('.forja-acoes .btn')].find((b) => /Desfazer/.test(b.textContent)).click()`);
  ok('Desfazer volta o arquivo e avisa na conversa', await esperar(`/Desfeito/.test(document.querySelector('.forja-desfeito')?.textContent || '')`, 10_000) && /a\s*-\s*b/.test(proj.ler('soma.js')));

  await pedir('Rode um comando LONGA e espere terminar.');
  await esperar(`[...document.querySelectorAll('.ag-passo[data-nome="executar"]')].some((p) => p.classList.contains('rodando'))`, 30_000);
  ok('botão vira "Parar" enquanto trabalha', await avaliar(`document.querySelector('#agenteView .send').getAttribute('aria-label') === 'Parar'`));
  let vivo = false;
  for (let i = 0; i < 10 && !vivo; i++) { vivo = comandoLongoVivo(); if (!vivo) await nav.esperar('false', 500); }
  ok('o comando está rodando de verdade', vivo);
  await avaliar(`document.querySelector('#agenteView .send').click()`);
  ok('Parar encerra o turno como "Parado"', await esperar(`/Parado/.test([...document.querySelectorAll('.forja-status')].pop()?.textContent || '')`, 15_000));
  await nav.esperar('false', 2000);
  ok('o comando morreu de verdade', !comandoLongoVivo());
  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); await ia.fechar(); proj.apagar(); }
process.exit(fim());
