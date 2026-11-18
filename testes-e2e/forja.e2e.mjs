// Forja na tela, com o provedor falso: corrigir um arquivo, rodar os testes, resumo, histórico, desfazer e parar.
// Os comandos da Forja rodam pelo cmd.exe: este teste só roda no Windows.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
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
  ok('resumo: soma.js alterado e npm test deu certo', await avaliar(`(()=>{ const r = document.querySelector('.forja-resumo'); return Boolean(r) && /soma\\.js/.test(r.textContent) && /npm test/.test(r.querySelector('code.ok')?.textContent || ''); })()`), await avaliar(`document.querySelector('.forja-resumo')?.textContent.slice(0, 120)`));
  ok('arquivo realmente corrigido no disco', /a\s*\+\s*b/.test(proj.ler('soma.js')));
  ok('chave falsa do arquivo não foi para a IA (segredo removido)', ia.pedidos.every((p) => !p.mensagens.some((m) => /AIzaSyFALSO/.test(JSON.stringify(m.content)))));
  ok('botão Desfazer aparece', await avaliar(`[...document.querySelectorAll('.forja-acoes .btn')].some((b) => /Desfazer/.test(b.textContent))`));

  await nav.ir(`${servidor.base}/?r=2#/agente/${sessao.id}`, 2500);
  ok('depois de recarregar, o histórico volta com o mesmo resumo', await esperar(`document.querySelectorAll('.forja-turno').length === 1 && /soma\\.js/.test(document.querySelector('.forja-resumo')?.textContent || '')`));
  ok('atividade fechada, abre ao clicar', await avaliar(`(()=>{ const t = document.querySelector('.forja-turno'); const fechado = t.classList.contains('fechado'); t.querySelector('.forja-cab').click(); return fechado; })()`) && await esperar(`!document.querySelector('.forja-turno').classList.contains('fechado') && document.querySelectorAll('.ag-passo').length > 0`, 3000));

  await avaliar(`[...document.querySelectorAll('.forja-acoes .btn')].find((b) => /Desfazer/.test(b.textContent)).click()`);
  ok('Desfazer volta o arquivo e avisa na conversa', await esperar(`/Desfeito/.test(document.querySelector('.forja-desfeito')?.textContent || '')`, 10_000) && /a\s*-\s*b/.test(proj.ler('soma.js')));

  // travas por tarefa: não substitui arquivo sem ler, não troca segredo real pelo marcador, cobra os testes antes do fim
  const antesDasTravas = ia.pedidos.length;
  await pedir('SOBRESCREVER a soma.');
  ok('turno das travas termina', await esperar(`document.querySelectorAll('.forja-turno').length === 2 && !document.querySelector('.forja-turno.trabalhando')`, 60_000));
  const conversa = ia.pedidos.slice(antesDasTravas).flatMap((p) => p.mensagens).map((m) => JSON.stringify(m.content)).join('\n');
  ok('substituir sem ler é recusado', /você ainda não leu nesta tarefa/.test(conversa));
  ok('regravar trocando o segredo pelo marcador é recusado', /no lugar de um segredo real/.test(conversa));
  ok('o segredo real continua no arquivo e a correção entrou por "editar"', proj.ler('soma.js').includes(['AIza', 'Sy'].join('')) && /a\s*\+\s*b/.test(proj.ler('soma.js')));
  ok('mudou e quis terminar sem testar: a Forja pede os testes uma vez', (conversa.match(/Antes de responder: você alterou arquivos/g) || []).length >= 1 && ia.pedidos.slice(antesDasTravas).filter((p) => /Antes de responder: você alterou arquivos/.test(JSON.stringify(p.mensagens.at(-1)?.content))).length === 1);
  ok('o turno fecha com npm test rodado', await esperar(`/npm test/.test([...document.querySelectorAll('.forja-resumo')].pop()?.querySelector('code.ok')?.textContent || '')`, 5000));

  await pedir('TEXTOPURO o que tem em soma.js?');
  ok('resposta final em texto puro vale como resposta (não vira erro)', await esperar(`document.querySelectorAll('.forja-turno').length === 3 && !document.querySelector('.forja-turno.trabalhando') && /tem a função soma/.test([...document.querySelectorAll('.forja-turno')].pop().textContent)`, 30_000));

  writeFileSync(path.join(proj.pasta, 'soma.js'), proj.ler('soma.js').replace('a + b', 'a - b'));
  const antesDaPreguica = ia.pedidos.length;
  await pedir('PREGUICA: corrija a soma e rode os testes.');
  ok('pedido de mudança encerrado sem agir: a Forja cobra o trabalho uma vez', await esperar(`document.querySelectorAll('.forja-turno').length === 4 && !document.querySelector('.forja-turno.trabalhando')`, 30_000)
    && ia.pedidos.slice(antesDaPreguica).filter((p) => /Você ainda não mudou nada/.test(JSON.stringify(p.mensagens.at(-1)?.content))).length === 1
    && /a\s*\+\s*b/.test(proj.ler('soma.js')));

  // Fase 2: regras que valem mesmo que o modelo tente outra coisa
  const turnos = () => avaliar(`document.querySelectorAll('.forja-turno').length`);
  const terminou = (n) => esperar(`document.querySelectorAll('.forja-turno').length === ${n} && !document.querySelector('.forja-turno.trabalhando')`, 60_000);
  const ultimoTurno = `[...document.querySelectorAll('.forja-turno')].pop()`;
  let n = await turnos();
  await pedir('LACO: troque o trecho.');
  ok('repetindo a mesma tentativa sem resultado, a Forja para e diz o motivo', await terminou(n + 1) && /repetindo a mesma tentativa/.test(await avaliar(`${ultimoTurno}.textContent`)), await avaliar(`${ultimoTurno}.textContent.slice(-300)`));
  ok('o laço parou bem antes das 30 rodadas', ia.pedidos.filter((p) => /LACO/.test(JSON.stringify(p.mensagens[1] ?? ''))).length <= 6);

  writeFileSync(path.join(proj.pasta, 'soma.js'), proj.ler('soma.js').replace('a + b', 'a - b'));
  n = await turnos();
  const antesDaMentira = ia.pedidos.length;
  await pedir('MENTIRA mude a soma.');
  ok('teste falhou depois da mudança: a Forja pede uma vez para corrigir ou explicar', await terminou(n + 1) && ia.pedidos.slice(antesDaMentira).filter((p) => /o último comando depois da sua mudança/.test(JSON.stringify(p.mensagens.at(-1)?.content))).length === 1);
  ok('a tela mostra que a verificação falhou', await esperar(`/Verificação falhou: npm test/.test(${ultimoTurno}.querySelector('.forja-verificacao.falhou')?.textContent || '')`, 3000));
  ok('"todos os testes passaram" sem base vira aviso conferido pelo Gyde', /Conferido pelo Gyde: A resposta diz que os testes passaram/.test(await avaliar(`${ultimoTurno}.querySelector('.forja-verificacao.aviso')?.textContent || ''`)));

  n = await turnos();
  writeFileSync(path.join(proj.pasta, 'soma.js'), proj.ler('soma.js').replace('a * b', 'a + b')); // npm test passando: só a conferência de site cobra
  const antesDoSite = ia.pedidos.length;
  await pedir('SITE-RUIM crie uma página');
  ok('mudou uma página: a Forja confere lang e viewport e pede a correção antes de terminar', await terminou(n + 1)
    && ia.pedidos.slice(antesDoSite).filter((p) => /conferi as páginas e os estilos/.test(JSON.stringify(p.mensagens.at(-1)?.content))).length === 1
    && /lang="pt-BR"/.test(proj.ler('pagina.html')), ia.pedidos.slice(antesDoSite).map((p) => JSON.stringify(p.mensagens.at(-1)?.content).slice(0, 90)).join(' || '));

  writeFileSync(path.join(proj.pasta, 'soma.js'), proj.ler('soma.js').replace('a + b', 'a * b')); // o roteiro ARGS corrige a * b
  writeFileSync(path.join(proj.pasta, 'GYDE.md'), '# Projeto de teste\nUse sempre ponto e vírgula. INSTRUCAO-DO-GYDE-MD\n');
  // menu do campo: "@" lista os arquivos e "/" os comandos
  const digitar = (t) => avaliar(`(()=>{ const c = document.querySelector('#agenteView textarea'); c.focus(); c.value = ${JSON.stringify(t)}; c.setSelectionRange(c.value.length, c.value.length); c.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  const tecla = (key) => avaliar(`document.querySelector('#agenteView textarea').dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }))`);
  await digitar('ARGS corrija @so');
  ok('"@" mostra os arquivos do projeto', await esperar(`/soma\\.js/.test(document.querySelector('#forjaMenuCampo')?.textContent || '')`, 5000));
  ok('o .env nunca aparece no menu', !/\.env/.test(await avaliar(`document.querySelector('#forjaMenuCampo')?.textContent || ''`)));
  await tecla('Enter');
  ok('Enter escolhe o arquivo e completa o campo', await esperar(`document.querySelector('#agenteView textarea').value === 'ARGS corrija @soma.js ' && !document.querySelector('#forjaMenuCampo')`, 3000), await avaliar(`document.querySelector('#agenteView textarea').value`));
  n = await turnos();
  const antesDosArgs = ia.pedidos.length;
  await avaliar(`document.querySelector('#agenteView form').requestSubmit()`);
  ok('argumento faltando: a Forja explica o formato certo e o modelo corrige', await terminou(n + 1) && /Argumentos inválidos para [^:]*editar[^:]*: [^ ]*procurar[^ ]* é obrigatório/.test(ia.pedidos.slice(antesDosArgs).map((p) => JSON.stringify(p.mensagens)).join('')) && /a\s*\+\s*b/.test(proj.ler('soma.js')));
  {
    const sistema = JSON.stringify(ia.pedidos.slice(antesDosArgs).find((p) => /Você é a Forja/.test(JSON.stringify(p.mensagens[0])))?.mensagens[0] ?? '');
    ok('o arquivo citado com @ vai junto no pedido', /ARQUIVOS QUE O USUÁRIO APONTOU COM @/.test(sistema) && /@soma\.js/.test(sistema));
    ok('o GYDE.md do projeto vai junto, abaixo das regras de segurança', /INSTRUÇÕES DO PROJETO/.test(sistema) && /INSTRUCAO-DO-GYDE-MD/.test(sistema) && sistema.indexOf('SEGURANÇA') < sistema.indexOf('INSTRUCAO-DO-GYDE-MD'));
    ok('o segredo do arquivo citado com @ não vai para a IA', !/AIzaSyFALSO/.test(sistema));
  }
  ok('verificado: npm test passou depois da última mudança', /Verificado: npm test/.test(await avaliar(`${ultimoTurno}.querySelector('.forja-verificacao.verificado')?.textContent || ''`)));
  // desfazer um arquivo só, pelo botão ao lado dele no resumo
  await avaliar(`window.confirm = () => true; 1`);
  ok('o resumo da última tarefa tem "Desfazer" por arquivo', await esperar(`${ultimoTurno}.querySelector('button[aria-label="Desfazer a mudança em soma.js"]') !== null`, 3000));
  await avaliar(`${ultimoTurno}.querySelector('button[aria-label="Desfazer a mudança em soma.js"]').click()`);
  ok('desfazer um arquivo volta só ele e marca como desfeito', await esperar(`/desfeito/.test(${ultimoTurno}.querySelector('.forja-arq')?.textContent || '')`, 5000) && /a\s*\*\s*b/.test(proj.ler('soma.js')), proj.ler('soma.js'));
  await digitar('/');
  ok('"/" mostra os comandos da Forja', await esperar(`/\\/testes/.test(document.querySelector('#forjaMenuCampo')?.textContent || '') && /\\/gyde-md/.test(document.querySelector('#forjaMenuCampo')?.textContent || '')`, 3000));
  await digitar('/expl');
  await tecla('Enter');
  ok('escolher um comando escreve o pedido no campo (a pessoa confere e envia)', await esperar(`/^Explique como este projeto funciona/.test(document.querySelector('#agenteView textarea').value)`, 3000));
  await digitar('');
  writeFileSync(path.join(proj.pasta, 'soma.js'), proj.ler('soma.js').replace('a * b', 'a + b'));

  // Ao vivo: sem nada rodável explica; com um site, liga um servidor estático de verdade (raiz certa, porta própria),
  // recarrega quando a Forja edita, e para tudo ao fechar. Erro do projeto vira pedido pronto para a Forja.
  const botaoAoVivo = `[...document.querySelectorAll('.forja-acoes .btn')].find((b) => /Ao vivo/.test(b.textContent))`;
  await avaliar(`${botaoAoVivo}.click()`);
  ok('Ao vivo sem nada rodável explica o motivo', await esperar(`/Não achei nada para ligar/.test(document.querySelector('.ao-vivo')?.textContent || '')`, 5000));
  await avaliar(`${botaoAoVivo}.click()`);
  writeFileSync(path.join(proj.pasta, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="/estilo.css"></head><body><h1>Olá, mundo</h1></body></html>');
  writeFileSync(path.join(proj.pasta, 'estilo.css'), 'h1 { color: blue; }');
  await avaliar(`${botaoAoVivo}.click()`);
  ok('com um site, o painel mostra o que vai fazer antes de ligar', await esperar(`/Site de HTML/.test(document.querySelector('.ao-vivo select')?.selectedOptions[0]?.textContent || '') && [...document.querySelectorAll('.ao-vivo button')].some((b) => b.textContent === 'Abrir o site')`, 5000));
  await avaliar(`[...document.querySelectorAll('.ao-vivo button')].find((b) => b.textContent === 'Abrir o site').click()`);
  ok('o site abre num endereço próprio (localhost:porta), separado do Gyde', await esperar(`/^http:[/][/]localhost:[0-9]+[/]$/.test(document.querySelector('.ao-vivo iframe')?.getAttribute('src') || '')`, 8000), await avaliar(`document.querySelector('.ao-vivo iframe')?.getAttribute('src') ?? document.querySelector('.ao-vivo')?.textContent.slice(0, 200)`));
  const src = await avaliar(`document.querySelector('.ao-vivo iframe').getAttribute('src')`);
  const base = src.replace('localhost', '127.0.0.1');
  ok('a página e o CSS com caminho "/" carregam (raiz certa)', /Olá, mundo/.test(await (await fetch(base)).text()) && /color: blue/.test(await (await fetch(`${base}estilo.css`)).text()));
  ok('o Ao vivo não entrega .env nem sai da pasta', (await fetch(`${base}.env`)).status === 404 && (await fetch(`${base}..%2F..%2Fsegredo.txt`)).status !== 200);
  ok('"Abrir no navegador" aponta para o mesmo endereço', await avaliar(`document.querySelector('.ao-vivo a[target="_blank"]')?.getAttribute('href') === ${JSON.stringify(src)}`));
  await avaliar(`document.querySelector('.ao-vivo iframe').__marca = 1; 1`);
  await pedir('PREVIA troque o título');
  ok('quando a Forja edita um arquivo, a página recarrega sozinha', await esperar(`document.querySelector('.ao-vivo iframe') && !document.querySelector('.ao-vivo iframe').__marca`, 30_000) && /Olá, Gyde/.test(await (await fetch(base)).text()));
  await avaliar(`document.querySelector('.ao-vivo button[aria-label="Fechar o Ao vivo e parar o projeto"]').click()`);
  ok('fechar o painel volta a conversa para a tela inteira', await esperar(`document.querySelector('.ao-vivo') === null`, 3000));
  ok('fechar o painel para o servidor (nada fica rodando)', await (async () => { for (let i = 0; i < 20; i++) { try { await fetch(base); } catch { return true; } await new Promise((r) => setTimeout(r, 250)); } return false; })());
  // erro do projeto: explicação em português e "Pedir à Forja para consertar" com o erro já no campo
  await avaliar(`${botaoAoVivo}.click()`);
  await esperar(`document.querySelector('.ao-vivo-outro') !== null`, 5000);
  await avaliar(`(()=>{ const d = document.querySelector('.ao-vivo-outro'); d.open = true; const i = d.querySelector('input'); i.value = 'node -e "chamaQueNaoExiste()"'; i.dispatchEvent(new Event('input', { bubbles: true })); d.querySelector('form').requestSubmit(); return 1; })()`);
  ok('erro no projeto: o painel explica e oferece a Forja', await esperar(`/erro no código/.test(document.querySelector('.ao-vivo-aviso')?.textContent || '') && [...document.querySelectorAll('.ao-vivo button')].some((b) => /Pedir à Forja/.test(b.textContent))`, 20_000), await avaliar(`document.querySelector('.ao-vivo')?.textContent.slice(0, 300)`));
  await avaliar(`[...document.querySelectorAll('.ao-vivo button')].find((b) => /Pedir à Forja/.test(b.textContent)).click()`);
  ok('o erro vai para o campo da Forja (a pessoa confere e envia)', await esperar(`/ReferenceError/.test(document.querySelector('#agenteView textarea')?.value || '') && /Comando: node -e/.test(document.querySelector('#agenteView textarea')?.value || '')`, 3000));
  await avaliar(`(()=>{ const t = document.querySelector('#agenteView textarea'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.ao-vivo button[aria-label="Fechar o Ao vivo e parar o projeto"]').click(); return 1; })()`);
  await esperar(`document.querySelector('.ao-vivo') === null`, 3000);

  await pedir('REVISAR-ERRO crie a nota');
  ok('outro modelo lê as mudanças e a tela mostra o que ele apontou', await esperar(`/apontou 1 ponto/.test([...document.querySelectorAll('.forja-revisao')].pop()?.textContent || '')`, 30_000));
  ok('a Forja termina o turno depois da revisão', await esperar(`document.querySelector('#agenteView .send').getAttribute('aria-label') !== 'Parar'`, 30_000));
  {
    const revisao = ia.pedidos.findLast((p) => /revisor técnico independente/.test(JSON.stringify(p.mensagens[0])));
    const autor = ia.pedidos.filter((p) => /Você é a Forja/.test(JSON.stringify(p.mensagens[0]))).at(-1);
    ok('o revisor lê as mudanças e não recebe ferramentas', /primeira versão/.test(JSON.stringify(revisao?.mensagens)) && !/Você é a Forja/.test(JSON.stringify(revisao?.mensagens)));
    ok('quem corrige recebe o que o revisor apontou', /falta tratar lista vazia/.test(JSON.stringify(autor?.mensagens)));
    ok('o revisor é outro modelo', revisao?.modelo !== autor?.modelo, `${revisao?.modelo} / ${autor?.modelo}`);
  }

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
