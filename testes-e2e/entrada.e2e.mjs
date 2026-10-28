// Entrada (componentes Svelte): cadastro, questionário, resultado, sair, senha errada, entrar e refazer o questionário.
import { subirServidor, abrirNavegador, placar, espera as sleep } from './ajuda.mjs';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const { ok, fim } = placar();
const servidor = await subirServidor();
const BASE = servidor.base;
const nav = await abrirNavegador();
const ev = (e) => nav.avaliar(e).catch(() => undefined);
const espera = (cond, ms = 8000) => nav.esperar(cond, ms);
const send = nav.enviar;
const erros = nav.erros;
// Servidor próprio do teste (modo pessoal: cadastro entra direto, sem e-mail).
const EMAIL = `entrada-${Date.now().toString(36)}@t.test`;

const preencher = (sel, valor) => ev(`(()=>{ const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(valor)}; el.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
const clicar = (sel, texto) => ev(`(()=>{ const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.textContent.includes(${JSON.stringify(texto)})); b?.click(); return Boolean(b); })()`);
const passo = () => ev(`document.querySelector('#gate .quiz-step')?.textContent || ''`);
await send('Page.navigate', { url: BASE + '/' }); await sleep(800);
await ev(`(localStorage.setItem('gyde-intro-vista','1'), 1)`);
await send('Page.navigate', { url: `${BASE}/?r=1` }); await sleep(2000);

ok('sem sessão: tela de Entrar com foco no e-mail', await espera(`/Entrar/.test(document.querySelector('#gate h1')?.textContent || '') && document.activeElement?.name === 'email'`));
await clicar('#gate .link', 'Esqueci minha senha');
ok('modo pessoal: "Esqueci" explica o redefinir-senha.bat', await espera(`/redefinir-senha\\.bat/.test(document.querySelector('#gate').textContent)`));
await clicar('#gate button', 'Voltar para entrar');
await clicar('#gate .link', 'Criar conta');
ok('tela de cadastro com aviso do modo pessoal', await espera(`/Criar conta/.test(document.querySelector('#gate h1').textContent) && /Modo pessoal/.test(document.querySelector('#gate').textContent)`));
await preencher('#gate input[name="name"]', 'Bia Teste');
await preencher('#gate input[name="email"]', EMAIL);
await preencher('#gate input[name="password"]', 'curta');
await ev(`document.querySelector('#gate form').requestSubmit()`);
ok('senha fraca mostra erro do servidor', await espera(`!document.querySelector('#gate .gate-error').hidden && document.querySelector('#gate .gate-error').textContent.length > 0`), await ev(`document.querySelector('#gate .gate-error').textContent`));
await preencher('#gate input[name="password"]', 'teste2026x');
await ev(`document.querySelector('#gate form').requestSubmit()`);

// questionário
ok('cadastro abre o questionário com o nome', await espera(`/Oi, Bia Teste!/.test(document.querySelector('#gate').textContent)`));
const total = Number((await passo()).split(' de ')[1]);
ok('primeira pergunta é de resposta única', await ev(`document.querySelector('#gate .quiz-options').getAttribute('role') === 'radiogroup'`), `${total} perguntas`);
await clicar('#gate .quiz-option', 'Já fiz alguns exercícios');
ok('resposta única avança sozinha', await espera(`/2 de/.test(document.querySelector('#gate .quiz-step')?.textContent || '')`));
ok('pergunta 2 é de várias escolhas (linguagens)', await ev(`document.querySelector('#gate .quiz-options').getAttribute('role') === 'group'`));
await clicar('#gate .quiz-option', 'JavaScript');
ok('marcar opção múltipla seleciona', await ev(`[...document.querySelectorAll('#gate .quiz-option')].find((b) => b.textContent.includes('JavaScript')).getAttribute('aria-checked') === 'true'`));
await clicar('#gate .quiz-nav button', 'Continuar');
ok('Continuar vai para a pergunta 3', await espera(`/3 de/.test(document.querySelector('#gate .quiz-step').textContent)`));
await clicar('#gate .quiz-nav button', 'Voltar');
ok('Voltar mantém a escolha anterior', await espera(`/2 de/.test(document.querySelector('#gate .quiz-step').textContent)`) && await ev(`[...document.querySelectorAll('#gate .quiz-option')].find((b) => b.textContent.includes('JavaScript')).classList.contains('selected')`));
await clicar('#gate .quiz-nav button', 'Continuar');
// responde o resto: perguntas de perfil pela primeira opção; de código, sempre a primeira opção
let viuCodigoJs = false;
for (let k = 3; k <= total; k++) {
  await espera(`new RegExp('^[^·]*· ${k} de').test(document.querySelector('#gate .quiz-step')?.textContent || '')`, 4000);
  if (await ev(`/JavaScript/.test(document.querySelector('#gate .code-lang')?.textContent || '')`)) viuCodigoJs = true;
  const multi = await ev(`document.querySelector('#gate .quiz-options').getAttribute('role') === 'group'`);
  await ev(`document.querySelector('#gate .quiz-option').click()`);
  if (multi) await clicar('#gate .quiz-nav button', k === total ? 'Concluir' : 'Continuar');
}
ok('código das perguntas aparece em JavaScript (a linguagem escolhida)', viuCodigoJs);
ok('resultado com nota e nível', await espera(`/Prontinho, Bia!/.test(document.querySelector('#gate').textContent) && /no mini desafio/.test(document.querySelector('#gate .quiz-score').textContent)`, 8000), await ev(`document.querySelector('#gate .gate-sub')?.textContent`));
await clicar('#gate button', 'Começar a usar o Gyde');
ok('"Começar" fecha a entrada e mostra o app com o nome', await espera(`document.querySelector('#gate').hidden && document.querySelector('#userName').textContent === 'Bia Teste'`));
ok('nível do questionário aparece no menu', await ev(`/^Nível: /.test(document.querySelector('#userLevel').textContent)`), await ev(`document.querySelector('#userLevel').textContent`));

// sair, senha errada, entrar
await ev(`document.querySelector('#logoutBtn').click()`);
ok('sair volta para Entrar', await espera(`!document.querySelector('#gate').hidden && /Entrar/.test(document.querySelector('#gate h1')?.textContent || '')`, 10000));
await preencher('#gate input[name="email"]', EMAIL);
await preencher('#gate input[name="password"]', 'errada123');
await ev(`document.querySelector('#gate form').requestSubmit()`);
ok('senha errada mostra erro', await espera(`!document.querySelector('#gate .gate-error').hidden`), await ev(`document.querySelector('#gate .gate-error').textContent`));
await preencher('#gate input[name="password"]', 'teste2026x');
await ev(`document.querySelector('#gate form').requestSubmit()`);
ok('entrar abre o app direto (sem questionário de novo)', await espera(`document.querySelector('#gate').hidden && document.querySelector('#userName').textContent === 'Bia Teste'`));

// refazer pelo Configurações
await ev(`document.querySelector('#openSettings').click()`); await sleep(400);
await ev(`[...document.querySelectorAll('[role="tab"]')].find((b) => /Prática/.test(b.textContent))?.click()`); await sleep(400);
ok('Configurações > Prática oferece refazer', await espera(`/Refazer o questionário/.test(document.querySelector('#redoQuiz')?.textContent || '')`));
await ev(`document.querySelector('#redoQuiz').click()`);
ok('refazer abre o questionário de novo', await espera(`!document.querySelector('#gate').hidden && /1 de/.test(document.querySelector('#gate .quiz-step')?.textContent || '')`));
await clicar('#gate .quiz-nav button', 'Pular por agora');
ok('pular fecha e volta ao app', await espera(`document.querySelector('#gate').hidden`));

ok('sem erro de JavaScript', erros.length === 0, erros.slice(0, 3).join(' | '));
ok('servidor sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
await nav.fechar();
await servidor.parar();
process.exit(fim());
