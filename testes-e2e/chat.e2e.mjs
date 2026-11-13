// Chat na tela, com o provedor de IA falso: enviar, resposta em streaming, título, gerar de novo, editar, parar,
// anexos, menu "/", modelo, busca, renomear e excluir.
import { subirServidor, abrirNavegador, clienteApi, placar } from './ajuda.mjs';
import { provedorFalso } from './provedor-falso.mjs';

const { ok, fim } = placar();
const ia = await provedorFalso();
const servidor = await subirServidor({ env: { FREELLMAPI_URL: ia.url, FREELLMAPI_KEY: 'freellmapi-teste-falsa-0000' } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Clara Teste' });
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
  ok('seletor de modelo só com as opções do Gyde', await avaliar(`document.querySelector('#model').value === 'gyde-1' && [...document.querySelectorAll('#model option')].every((o) => /^gyde-/.test(o.value)) && document.querySelectorAll('#model option').length >= 2`), String(await avaliar(`[...document.querySelectorAll('#model option')].map((o) => o.value).join(',')`)));

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
  // conta as recargas da conversa: o Parar não depende mais delas (era a corrida que deixava este teste instável)
  await avaliar(`(()=>{ const original = window.fetch; window.__recargas = 0; window.fetch = (u, o) => { if (/\\/api\\/conversations\\/[\\w-]+$/.test(String(u)) && !(o && o.method && o.method !== 'GET')) window.__recargas++; return original(u, o); }; window.__semContagem = () => { window.fetch = original; }; return 1; })()`);
  await avaliar(`document.querySelector('#sendBtn').click()`);
  ok('Parar encerra a resposta no meio', await esperar(`!${transmitindo}`, 10_000));
  ok('o que já tinha chegado fica na tela e salvo (e não a resposta inteira)', await avaliar(`document.querySelectorAll('.msg.assistant').length === 2`) && await avaliar(`!/300\\. Linha/.test(document.querySelectorAll('.msg.assistant .md')[1].textContent)`),
    await avaliar(`document.querySelectorAll('.msg.assistant').length + ' respostas'`));
  ok('Parar não precisa recarregar a conversa (o servidor manda o fim)', await avaliar(`window.__recargas === 0`), String(await avaliar(`window.__recargas`)));
  await avaliar(`window.__semContagem()`);
  {
    const salvas = await (await api.pedir('GET', `/api/conversations/${(await avaliar('location.hash')).replace('#/c/', '')}`)).json();
    const parcial = salvas.messages.filter((m) => m.role === 'assistant')[1]?.content ?? '';
    ok('no banco fica a resposta parcial (e não a inteira)', parcial.length > 100 && !/300\. Linha/.test(parcial), `${parcial.length} caracteres`);
  }

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
  // "Mostrar o erro" num print enviado: destaque na região que o modelo apontou e a explicação
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const convPrint = await (await api.pedir('POST', '/api/conversations', {})).json();
  await (await api.pedir('POST', `/api/conversations/${convPrint.id}/messages`, { mode: 'new', content: 'Por que dá esse erro?', attachments: [{ kind: 'image', name: 'erro.png', dataUrl: PNG }], model: 'gyde-1', kind: 'chat' })).text();
  await nav.ir(`${servidor.base}/?r=9#/c/${convPrint.id}`, 2500);
  ok('o print enviado tem o botão "Mostrar o erro"', await esperar(`[...document.querySelectorAll('.anexo-imagem .apontar-btn')].some((b) => /Mostrar o erro/.test(b.textContent))`));
  await avaliar(`document.querySelector('.anexo-imagem .apontar-btn').click()`);
  ok('o destaque aparece onde o modelo apontou', await esperar(`(() => { const r = document.querySelector('dialog.apontar[open] .apontar-regiao'); return Boolean(r) && r.style.left === '20%' && r.style.top === '30%' && r.style.width === '40%' && r.style.height === '10%'; })()`, 8000));
  ok('a explicação e o aviso de estimativa aparecem', await avaliar(`/variável total não existe/.test(document.querySelector('.apontar-texto').textContent) && /estimativa do modelo/.test(document.querySelector('.apontar-nota').textContent)`));
  await avaliar(`document.querySelector('dialog.apontar .icon-btn[aria-label="Fechar"]').click()`);
  ok('fechar tira o diálogo', await esperar(`document.querySelector('dialog.apontar') === null`, 3000));
  ok('o servidor recusa o que não é imagem', (await api.pedir('POST', '/api/apontar', { imagem: 'data:text/html;base64,PGgxPg==' })).status === 400);
  // inteligência multimodelo: o padrão chama um modelo só; capricho confere com outro e a tela diz isso
  {
    const antes = ia.pedidos.length;
    const conv = await (await api.pedir('POST', '/api/conversations', {})).json();
    const sse = await (await api.pedir('POST', `/api/conversations/${conv.id}/messages`, { mode: 'new', content: 'corrija este bug no meu código python', attachments: [], model: 'gyde-1', kind: 'chat' })).text();
    ok('modo padrão: pergunta de código usa uma chamada de resposta', ia.pedidos.slice(antes).filter((p) => p.stream).length === 1 && !ia.pedidos.slice(antes).some((p) => /revisor técnico/.test(JSON.stringify(p.mensagens[0]))));
    ok('modo padrão: a resposta conta a estratégia usada', /"estrategia":"direta"/.test(sse));
    const pref = await (await api.pedir('PUT', '/api/ia/preferencias', { modo: 'capricho' })).json();
    ok('preferência de modo salva', pref.modo === 'capricho' && pref.especialistas === false);
    ok('modo inexistente é recusado', (await api.pedir('PUT', '/api/ia/preferencias', { modo: 'turbo' })).status === 400);
    const meio = ia.pedidos.length;
    const sse2 = await (await api.pedir('POST', `/api/conversations/${conv.id}/messages`, { mode: 'new', content: 'corrija este outro bug no meu código python', attachments: [], model: 'gyde-1', kind: 'chat' })).text();
    const novos = ia.pedidos.slice(meio);
    ok('capricho: um segundo modelo revisa', novos.some((p) => /revisor técnico/.test(JSON.stringify(p.mensagens[0]))) && /"estrategia":"revisada"/.test(sse2) && /"revisada":true/.test(sse2));
    ok('capricho: a pessoa acompanha o que está acontecendo', /Conferindo com outro modelo/.test(sse2));
    await nav.ir(`${servidor.base}/?r=10#/c/${conv.id}`, 2000);
    const dados = await (await api.pedir('GET', '/api/ia/modelos')).json();
    ok('a lista de modelos vem das medições, sem nota inventada', Array.isArray(dados.modelos) && dados.modelos.every((m) => typeof m.acertos === 'number' && typeof m.respondidas === 'number'));
    ok('as decisões aparecem por estratégia', dados.estrategias.some((e) => e.estrategia === 'revisada'));
    await avaliar(`document.querySelector('#openSettings').click()`);
    await esperar(`document.querySelector('dialog.config[open]') !== null`, 3000);
    await avaliar(`[...document.querySelectorAll('[role="tab"]')].find((b) => /IA e modelos/.test(b.textContent)).click()`);
    ok('Configurações mostram "Como responder", já em Capricho', await esperar(`document.querySelector('select[aria-label="Como responder"]')?.value === 'capricho'`, 3000));
    await avaliar(`(() => { const d = document.querySelector('.ia-detalhes'); d.open = true; d.dispatchEvent(new Event('toggle')); return 1; })()`);
    ok('"Como o Gyde funciona" abre e avisa que grátis não é ilimitado', await esperar(`/não quer dizer ilimitado/.test(document.querySelector('.ia-detalhes').textContent)`, 3000));
    await avaliar(`(() => { const s = document.querySelector('select[aria-label="Como responder"]'); s.value = 'rapido'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
    ok('trocar o modo pela tela salva no servidor', await esperar(`fetch('/api/ia/preferencias', { headers: { 'x-gyde': '1' } }).then((r) => r.json()).then((p) => p.modo === 'rapido')`, 3000));
    await avaliar(`document.querySelector('dialog.config').close()`);
    const meio2 = ia.pedidos.length;
    await (await api.pedir('POST', `/api/conversations/${conv.id}/messages`, { mode: 'new', content: 'esse outro bug é importante, corrija meu código python que vai para produção', attachments: [], model: 'gyde-1', kind: 'chat' })).text();
    ok('rápido: nem pedido importante chama um segundo modelo', !ia.pedidos.slice(meio2).some((p) => /revisor técnico/.test(JSON.stringify(p.mensagens[0]))));
  }
  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); await ia.fechar(); }
process.exit(fim());
