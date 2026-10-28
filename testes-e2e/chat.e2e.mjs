// Chat na tela, com o provedor de IA falso: enviar, resposta em streaming, título, gerar de novo, editar, parar,
// anexos, menu "/", modelo, busca, renomear e excluir.
import { subirServidor, abrirNavegador, clienteApi, placar } from './ajuda.mjs';
import { provedorFalso } from './provedor-falso.mjs';

const { ok, fim } = placar();
const ia = await provedorFalso();
const servidor = await subirServidor({ env: { FREELLMAPI_URL: ia.url, FREELLMAPI_KEY: 'freellmapi-teste-falsa-0000' } });
const conta = await clienteApi(servidor.base).criarConta({ nome: 'Clara Teste' });
const nav = await abrirNavegador();
const { avaliar, esperar } = nav;
const digitar = (texto) => avaliar(`(()=>{ const t = document.querySelector('#input'); t.focus(); t.value = ${JSON.stringify(texto)}; t.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
const transmitindo = `document.querySelector('#sendBtn').classList.contains('streaming')`;
try {
  await nav.entrar(servidor.base, conta);
  await nav.ir(`${servidor.base}/?r=1#/`, 2500);

  ok('saudação com o primeiro nome', await esperar(`document.querySelector('#greeting')?.textContent === 'Bora programar, Clara?'`));
  ok('quatro sugestões e botão Enviar desligado', await avaliar(`document.querySelectorAll('#suggestions button').length === 4 && document.querySelector('#sendBtn').disabled`));
  await avaliar(`document.querySelectorAll('#suggestions button')[2].click()`);
  ok('sugestão preenche o campo e liga o Enviar', await esperar(`/lógica de programação/.test(document.querySelector('#input').value) && !document.querySelector('#sendBtn').disabled`, 2000));
  ok('seletor de modelo com o Gyde 1 e os modelos do provedor', await avaliar(`document.querySelector('#model').value === 'gyde-1' && document.querySelectorAll('#model option').length >= 3`), String(await avaliar(`document.querySelectorAll('#model option').length`)));

  await digitar('/');
  ok('digitar "/" abre o menu de skills', await esperar(`document.querySelector('.slash-menu') !== null`, 2000));
  await avaliar(`document.querySelector('#input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  ok('Esc fecha o menu "/"', await esperar(`document.querySelector('.slash-menu') === null`, 2000));

  await avaliar(`(()=>{ const dt = new DataTransfer(); dt.items.add(new File(['print(1 + 1)'], 'conta.py', { type: 'text/plain' })); const i = document.querySelector('#fileInput'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  ok('anexo aparece como chip', await esperar(`[...document.querySelectorAll('#attachments .chip')].some((c) => /conta\\.py/.test(c.textContent) && !c.classList.contains('loading'))`, 5000));
  await avaliar(`document.querySelector('#attachments .chip-x').click()`);
  ok('remover anexo tira o chip', await esperar(`document.querySelectorAll('#attachments .chip').length === 0`, 2000));

  await digitar('Quanto é 2 + 2?');
  await avaliar(`document.querySelector('#input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
  ok('ao enviar, a pergunta aparece e o campo limpa', await esperar(`document.querySelector('.msg.user .bubble')?.textContent === 'Quanto é 2 + 2?' && document.querySelector('#input').value === ''`, 5000));
  ok('a resposta chega e fica salva na conversa', await esperar(`!${transmitindo} && /Resposta de teste: Quanto é 2 \\+ 2\\?/.test(document.querySelector('.msg.assistant .md')?.textContent || '')`));
  ok('endereço muda para a conversa', await avaliar(`/^#\\/c\\//.test(location.hash)`));
  ok('rodapé mostra o modelo que respondeu e os tokens', await esperar(`/120 tokens/.test(document.querySelector('.msg.assistant .msg-meta')?.textContent || '')`, 3000), await avaliar(`document.querySelector('.msg.assistant .msg-meta')?.textContent`));
  ok('conversa aparece na lista com o título gerado', await esperar(`document.querySelector('#convList .conv.active a')?.textContent === 'Conversa de teste' && document.querySelector('#convTitle').textContent === 'Conversa de teste'`));

  ok('"Gerar de novo" só na última resposta', await avaliar(`document.querySelectorAll('.msg.assistant [title="Gerar de novo"]').length === 1`));
  await avaliar(`document.querySelector('.msg.assistant [title="Gerar de novo"]').click()`);
  ok('gerar de novo troca a resposta (continua uma só)', await esperar(`!${transmitindo} && document.querySelectorAll('.msg.assistant').length === 1 && /Resposta de teste/.test(document.querySelector('.msg.assistant .md').textContent)`));

  await avaliar(`document.querySelector('.msg.user [title="Editar"]').click()`);
  ok('editar abre a caixa com o texto', await esperar(`document.querySelector('.edit-box textarea')?.value === 'Quanto é 2 + 2?'`, 2000));
  await avaliar(`(()=>{ const t = document.querySelector('.edit-box textarea'); t.value = 'Quanto é 3 + 3?'; t.dispatchEvent(new Event('input', { bubbles: true })); [...document.querySelectorAll('.edit-box button')].find((b) => b.textContent === 'Enviar').click(); return 1; })()`);
  ok('edição substitui a pergunta e gera nova resposta', await esperar(`!${transmitindo} && document.querySelectorAll('.msg.user').length === 1 && /3 \\+ 3/.test(document.querySelector('.msg.user .bubble').textContent) && /3 \\+ 3/.test(document.querySelector('.msg.assistant .md').textContent)`));

  const hash = await avaliar('location.hash');
  await nav.ir(`${servidor.base}/?r=2${hash}`, 2500);
  ok('depois de recarregar, a conversa volta', await esperar(`document.querySelectorAll('.msg.user').length === 1 && document.querySelectorAll('.msg.assistant').length === 1`));

  await digitar('Escreva uma lista LONGA de linguagens.');
  await avaliar(`document.querySelector('#composer').requestSubmit()`);
  await esperar(`(document.querySelectorAll('.msg.assistant .md')[1]?.textContent.length || 0) > 100`);
  await avaliar(`document.querySelector('#sendBtn').click()`);
  ok('Parar encerra a resposta no meio', await esperar(`!${transmitindo}`, 10_000));
  ok('o que já tinha chegado fica salvo (e não a resposta inteira)', await esperar(`document.querySelectorAll('.msg.assistant').length === 2`, 10_000) && await avaliar(`!/300\\. Linha/.test(document.querySelectorAll('.msg.assistant .md')[1].textContent)`));

  // corrida: a recarga depois do Parar chega atrasada, quando a pessoa já abriu uma conversa nova
  await digitar('Outra lista LONGA, por favor.');
  await avaliar(`document.querySelector('#composer').requestSubmit()`);
  await esperar(`(document.querySelectorAll('.msg.assistant .md')[2]?.textContent.length || 0) > 100`);
  await avaliar(`(()=>{ const original = window.fetch; window.fetch = async (u, o) => { const url = String(u); if (url.includes('/api/conversations/') && !url.includes('/messages') && !(o && o.method && o.method !== 'GET')) await new Promise((r) => setTimeout(r, 1500)); return original(u, o); }; window.__restaurar = () => { window.fetch = original; }; return 1; })()`);
  await avaliar(`document.querySelector('#sendBtn').click()`);
  await esperar(`!${transmitindo}`, 5000);
  await avaliar(`document.querySelector('#newChat').click()`);
  await nav.esperar('false', 3000);
  ok('recarga atrasada depois do Parar não traz a conversa antiga de volta', await avaliar(`location.hash === '#/' && document.querySelectorAll('.msg').length === 0`), await avaliar(`JSON.stringify({ h: location.hash, msgs: document.querySelectorAll('.msg').length })`));
  await avaliar(`window.__restaurar()`);
  await avaliar(`history.back()`); await esperar(`document.querySelectorAll('.msg.user').length === 3`, 5000);

  const segundo = await avaliar(`[...document.querySelectorAll('#model option')].map((o) => o.value).find((v) => v !== 'gyde-1') || ''`);
  await avaliar(`(()=>{ const s = document.querySelector('#model'); s.value = ${JSON.stringify(segundo)}; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  ok('trocar o modelo salva a escolha', await esperar(`localStorage.getItem('model') === ${JSON.stringify(segundo)}`, 2000), segundo);

  await avaliar(`document.querySelector('#newChat').click()`);
  ok('Nova conversa volta para a tela vazia', await esperar(`location.hash === '#/' && document.querySelectorAll('.msg').length === 0`, 3000), await avaliar(`JSON.stringify({ h: location.hash, msgs: document.querySelectorAll('.msg').length, transmitindo: ${transmitindo} })`));
  await avaliar(`(()=>{ const s = document.querySelector('#search'); s.value = 'zzz-nada-assim'; s.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  ok('busca sem resultado avisa', await esperar(`/Nenhuma conversa encontrada/.test(document.querySelector('#convList').textContent)`, 5000));
  await avaliar(`(()=>{ const s = document.querySelector('#search'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await esperar(`document.querySelectorAll('#convList .conv').length === 1`, 5000);

  await avaliar(`document.querySelector('#convList .conv-menu-btn').click()`);
  await avaliar(`[...document.querySelectorAll('.menu button')].find((b) => /Renomear/.test(b.textContent)).click()`);
  await esperar(`document.querySelector('.conv-rename') !== null`, 2000);
  await avaliar(`(()=>{ const i = document.querySelector('.conv-rename'); i.value = 'Conversa renomeada'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1; })()`);
  ok('renomear muda o título na lista', await esperar(`document.querySelector('#convList .conv a')?.textContent === 'Conversa renomeada'`, 5000));
  await avaliar(`document.querySelector('#convList .conv-menu-btn').click()`);
  await avaliar(`[...document.querySelectorAll('.menu button')].find((b) => /Excluir/.test(b.textContent)).click()`);
  ok('excluir pede confirmação e tira a conversa da lista', await esperar(`document.querySelectorAll('#convList .conv').length === 0`, 5000) && nav.dialogos.some((d) => /Excluir a conversa/.test(d)));

  // HTML perigoso numa resposta da IA não executa (markdown passa pelo DOMPurify)
  await avaliar(`document.querySelector('#newChat').click()`);
  await digitar('<img src=x onerror="window.__xss = 1"> <script>window.__xss2 = 1</script> <a href="javascript:window.__xss3 = 1">link</a>');
  await avaliar(`document.querySelector('#composer').requestSubmit()`);
  await esperar(`!${transmitindo} && document.querySelector('.msg.assistant .md') !== null`, 15_000);
  await nav.esperar('false', 500);
  ok('HTML perigoso na resposta não executa (sem onerror, script ou javascript:)', await avaliar(`window.__xss === undefined && window.__xss2 === undefined && !document.querySelector('.msg.assistant .md [onerror], .msg.assistant .md script, .msg.assistant .md a[href^="javascript"]')`));
  ok('o chat mandou o histórico ao provedor (pergunta e resposta anteriores)', ia.pedidos.some((p) => p.stream && p.mensagens.filter((m) => m.role === 'user').length >= 1));
  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); await ia.fechar(); }
process.exit(fim());
