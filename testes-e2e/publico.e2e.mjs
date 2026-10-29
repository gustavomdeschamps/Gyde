// Modo público (um servidor para uma turma): cadastro com confirmação por e-mail, troca de senha por código,
// isolamento entre contas e o que fica bloqueado (Forja, chaves, cópia de segurança, modo da IA).
// O e-mail é "enviado" para o log do servidor (EMAIL_DEV_CONSOLE=1), sem sair do computador.
import { subirServidor, abrirNavegador, clienteApi, placar, espera } from './ajuda.mjs';

const { ok, fim } = placar();
const servidor = await subirServidor({ env: { GYDE_MODE: 'publico', EMAIL_DEV_CONSOLE: '1', GYDE_DESKTOP: '' } });
const codigoPara = async (email) => {
  for (let i = 0; i < 50; i++) {
    const achados = [...servidor.saida.join('').matchAll(new RegExp(`para ${email.replace(/[.@]/g, '\\$&')}: (\\d{6})`, 'g'))];
    if (achados.length) return achados.at(-1)[1];
    await espera(100);
  }
  return null;
};
const EMAIL = `aluna-${Date.now().toString(36)}@t.test`;
const nav = await abrirNavegador();
const { avaliar, esperar } = nav;
const preencher = (sel, valor) => avaliar(`(()=>{ const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(valor)}; el.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
try {
  await nav.ir(`${servidor.base}/`, 800);
  await avaliar(`(localStorage.setItem('gyde-intro-vista', '1'), 1)`);
  await nav.ir(`${servidor.base}/?r=1`, 1500);

  // cadastro com confirmação por e-mail
  await avaliar(`[...document.querySelectorAll('#gate .link')].find((b) => /Criar conta/.test(b.textContent)).click()`);
  ok('cadastro no modo público avisa que o código é de teste (não fala em modo pessoal)', await esperar(`/Criar conta/.test(document.querySelector('#gate h1').textContent) && !/Modo pessoal/.test(document.querySelector('#gate').textContent)`));
  await preencher('#gate input[name="name"]', 'Aluna');
  await preencher('#gate input[name="email"]', EMAIL);
  await preencher('#gate input[name="password"]', 'teste2026x');
  await avaliar(`document.querySelector('#gate form').requestSubmit()`);
  ok('cadastro pede o código mandado por e-mail', await esperar(`/Confirme seu e-mail/.test(document.querySelector('#gate h1')?.textContent || '')`) && await avaliar(`/Modo de teste/.test(document.querySelector('#gate').textContent)`));
  const codigo = await codigoPara(EMAIL);
  ok('o código foi "enviado" (aparece no log do servidor)', Boolean(codigo));
  await preencher('#gate input[name="code"]', '000000');
  await avaliar(`document.querySelector('#gate form').requestSubmit()`);
  ok('código errado é recusado', await esperar(`!document.querySelector('#gate .gate-error').hidden`, 5000));
  await preencher('#gate input[name="code"]', codigo);
  await avaliar(`document.querySelector('#gate form').requestSubmit()`);
  ok('código certo confirma e abre o questionário', await esperar(`/Oi, Aluna!/.test(document.querySelector('#gate').textContent)`));
  await avaliar(`[...document.querySelectorAll('#gate .quiz-nav button')].find((b) => /Pular/.test(b.textContent)).click()`);
  ok('pular o questionário entra no app', await esperar(`document.querySelector('#gate').hidden && document.querySelector('#userName').textContent === 'Aluna'`));

  // o que o modo público não deixa fazer pela tela
  const proibidos = await avaliar(`(async()=>{ const h = { 'x-gyde': '1', 'Content-Type': 'application/json' }; const st = async (m, u, b) => (await fetch(u, { method: m, headers: h, body: b && JSON.stringify(b) })).status;
    return { chave: await st('PUT', '/api/config/chave-freellmapi', { chave: 'freellmapi-teste-0000000000' }), imagens: await st('PUT', '/api/config/imagens', {}), copia: await st('GET', '/api/dados/copia'),
      restaurar: await st('POST', '/api/dados/restaurar', {}), modo: await st('POST', '/api/uso/modo', { modo: 'offline' }), forja: await st('GET', '/api/codigo/sessoes/x'), redefinir: await st('POST', '/api/auth/redefinir-local', {}) }; })()`);
  ok('modo público bloqueia chaves, cópia, modo da IA, Forja e troca de senha local', Object.values(proibidos).every((s) => s === 403), JSON.stringify(proibidos));
  const usoTela = await avaliar(`fetch('/api/uso').then((r) => r.json())`);
  ok('Uso e limites não mostra o consumo da conta do dono do FreeLLMAPI', usoTela.mes === null);

  // a tela não oferece o que o servidor bloqueia
  await avaliar(`document.querySelector('#openSettings').click()`);
  await avaliar(`[...document.querySelectorAll('[role="tab"]')].find((b) => /IA e modelos/.test(b.textContent)).click()`);
  ok('Configurações > IA: sem chave, modo e imagens, com explicação', await esperar(`/quem cuida do servidor/.test(document.querySelector('[data-painel="ia"]')?.textContent || '') && !document.querySelector('.config-chave') && !document.querySelector('[aria-label="Modo da IA"]')`, 5000));
  await avaliar(`[...document.querySelectorAll('[role="tab"]')].find((b) => /Privacidade/.test(b.textContent)).click()`);
  ok('Privacidade e dados: sem cópia de segurança nem Forja', await esperar(`/no servidor deste Gyde/.test(document.querySelector('[data-painel="dados"]')?.textContent || '') && !document.querySelector('[data-painel="dados"] a[href="/api/dados/copia"]') && !/Restaurar cópia|Forja/.test(document.querySelector('[data-painel="dados"]').textContent)`, 3000));
  await avaliar(`document.querySelector('dialog.config').close()`);

  // isolamento: outra conta não vê nem mexe na conversa desta
  const conv = await avaliar(`fetch('/api/conversations', { method: 'POST', headers: { 'x-gyde': '1', 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.json())`);
  const outra = clienteApi(servidor.base);
  const emailOutra = `outra-${Date.now().toString(36)}@t.test`;
  await outra.pedir('POST', '/api/auth/register', { name: 'Outra', email: emailOutra, password: 'teste2026x' });
  await outra.pedir('POST', '/api/auth/verify', { email: emailOutra, code: await codigoPara(emailOutra) });
  ok('outra conta confirmada pela API', (await outra.pedir('GET', '/api/conversations')).status === 200);
  ok('outra conta não lê a conversa da primeira', (await outra.pedir('GET', `/api/conversations/${conv.id}`)).status === 404);
  await outra.pedir('DELETE', `/api/conversations/${conv.id}`);
  ok('nem apaga', await avaliar(`fetch('/api/conversations/${conv.id}').then((r) => r.status)`) === 200);
  ok('conta sem confirmar o e-mail não entra', await (async () => {
    const semConfirmar = clienteApi(servidor.base);
    const e = `sem-${Date.now().toString(36)}@t.test`;
    await semConfirmar.pedir('POST', '/api/auth/register', { name: 'Sem', email: e, password: 'teste2026x' });
    const r = await semConfirmar.pedir('POST', '/api/auth/login', { email: e, password: 'teste2026x' });
    return r.status === 403 && (await r.json()).needsVerification === true;
  })());

  // troca de senha por código
  await avaliar(`document.querySelector('#logoutBtn').click()`);
  await esperar(`!document.querySelector('#gate').hidden`, 10_000);
  await avaliar(`[...document.querySelectorAll('#gate .link')].find((b) => /Esqueci/.test(b.textContent)).click()`);
  ok('"Esqueci minha senha" pede o e-mail (não fala do .bat)', await esperar(`/Trocar senha/.test(document.querySelector('#gate h1').textContent) && !/redefinir-senha/.test(document.querySelector('#gate').textContent)`));
  const antes = servidor.saida.join('').length;
  await preencher('#gate input[name="email"]', EMAIL);
  await avaliar(`document.querySelector('#gate form').requestSubmit()`);
  ok('tela de nova senha', await esperar(`/Nova senha/.test(document.querySelector('#gate h1').textContent)`));
  await espera(300);
  const novoCodigo = servidor.saida.join('').slice(antes).match(/troca de senha para [^:]+: (\d{6})/)?.[1];
  ok('código de troca de senha "enviado"', Boolean(novoCodigo));
  await preencher('#gate input[name="code"]', novoCodigo);
  await preencher('#gate input[name="password"]', 'novaSenha2026');
  await avaliar(`document.querySelector('#gate form').requestSubmit()`);
  ok('trocar a senha entra direto', await esperar(`document.querySelector('#gate').hidden && document.querySelector('#userName').textContent === 'Aluna'`));
  const velha = await clienteApi(servidor.base).pedir('POST', '/api/auth/login', { email: EMAIL, password: 'teste2026x' });
  ok('a senha antiga não funciona mais', velha.status === 401);

  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); }
process.exit(fim());
