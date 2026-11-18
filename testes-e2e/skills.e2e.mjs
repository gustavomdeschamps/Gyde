// Skills (componente Svelte): catálogo por objetivo (busca "Quero...", pacotes, categorias), criar, editar, importar,
// publicar e instalar da loja por outra pessoa.
import { subirServidor, abrirNavegador, placar, espera as sleep } from './ajuda.mjs';

const { ok, fim } = placar();
const servidor = await subirServidor();
const BASE = servidor.base;
const nav = await abrirNavegador();
const ev = (e) => nav.avaliar(e).catch(() => undefined);
const espera = (cond, ms = 8000) => nav.esperar(cond, ms);
const send = nav.enviar;
const erros = nav.erros;
// Cada execução sobe o próprio servidor (testes-e2e/ajuda.mjs).
const sufixo = Date.now().toString(36);
const AUTOR = { name: 'Autora Skill', email: `autora-${sufixo}@t.test`, password: 'teste2026x' };
const OUTRA = { name: 'Outra Pessoa', email: `outra-${sufixo}@t.test`, password: 'teste2026x' };
const CMD = `/t${sufixo.slice(-6)}`;

const H = `{'x-gyde':'1','Content-Type':'application/json'}`;
const entrarComo = (u) => ev(`(async()=>{ localStorage.setItem('gyde-intro-vista','1'); await fetch('/api/auth/logout',{method:'POST',headers:${H}});
  await fetch('/api/auth/register',{method:'POST',headers:${H},body:${JSON.stringify(JSON.stringify(u))}});
  await fetch('/api/auth/login',{method:'POST',headers:${H},body:${JSON.stringify(JSON.stringify({ email: u.email, password: u.password }))}});
  await fetch('/api/profile/skip',{method:'POST',headers:${H},body:'{}'}); return 1; })()`);
const clicar = (sel, texto) => ev(`(()=>{ const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => ${JSON.stringify(texto)} === '' || x.textContent.includes(${JSON.stringify(texto)})); b?.click(); return Boolean(b); })()`);
const preencher = (sel, valor) => ev(`(()=>{ const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(valor)}; el.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
const aba = (nome) => ev(`Number([...document.querySelectorAll('#skillsView .tab')].find((b) => b.textContent.startsWith(${JSON.stringify(nome)}))?.querySelector('span').textContent)`);
await send('Page.navigate', { url: BASE + '/' }); await sleep(1200);
await entrarComo(AUTOR);
await send('Page.navigate', { url: `${BASE}/?r=1#/skills` }); await sleep(2500);

// catálogo e instalar
await espera(`document.querySelector('#skillsView .tab') !== null`, 15000);
const total = await aba('Catálogo');
ok('catálogo carrega com abas e contagens', total >= 15 && await aba('Instaladas') === 0, `${total} skills`);
ok('página inicial do catálogo: para começar, pacotes e filtros por categoria', await espera(`document.querySelectorAll('.sk-pacote').length >= 4 && document.querySelectorAll('.sk-filtros button').length >= 8 && /Para começar/.test(document.querySelector('#skillsView').textContent)`));
ok('cartões com ícone do conjunto (decorativo), selo de categoria e resultado do teste', await ev(`[...document.querySelectorAll('#skillsView .sk-cartao')].every((c) => c.querySelector('.sk-marca svg.icone[aria-hidden="true"]') && c.querySelector('.sk-selo') && /Testada|Tendência|Sem teste de resultado/.test(c.querySelector('.sk-teste').textContent))`));
// filtro por categoria
await clicar('.sk-filtros button', 'Dados e planilhas');
ok('filtro por categoria mostra só as dela', await espera(`[...document.querySelectorAll('.sk-secao:last-child .sk-cartao .sk-selo')].every((x) => x.textContent === 'Dados e planilhas') && document.querySelectorAll('.sk-secao:last-child .sk-cartao').length >= 3`));
await clicar('.sk-filtros button', 'Todas');
// "quero analisar dados" chega no pacote certo sem procurar skill por skill
await preencher('#skQuero', 'quero analisar dados');
ok('busca por objetivo tira o "quero" repetido e acha o pacote Analisar dados', await espera(`document.querySelector('#skQuero').value === 'analisar dados' && /Analisar dados/.test(document.querySelector('.sk-pacote h3')?.textContent || '')`));
await clicar('.sk-pacote .btn.primary', 'Instalar');
ok('instalar o pacote instala as 3 skills de uma vez', await espera(`document.querySelector('.sk-pacote .btn.installed') !== null`) && await aba('Instaladas') === 3);
await preencher('#skQuero', 'zzzz');
ok('busca sem resultado orienta e oferece criar', await espera(`/Nenhuma skill sobre/.test(document.querySelector('#skillsView').textContent)`));
await preencher('#skQuero', '');
// volta ao estado do resto do teste: nada instalado
await ev(`(async()=>{ for (const id of ['analise-pandas','graficos-dados','planilhas-formulas']) await fetch('/api/skills/' + id + '/install', { method: 'DELETE', headers: ${H} }); return 1; })()`);
await send('Page.navigate', { url: `${BASE}/?r=1b#/skills` }); await sleep(2000);
await espera(`document.querySelector('#skillsView .sk-cartao') !== null`, 15000);
await ev(`document.querySelector('#skillsView .sk-cartao .btn.primary').click()`);
ok('instalar muda o botão e a contagem', await espera(`document.querySelector('#skillsView .sk-cartao.on .btn.installed') !== null`) && await aba('Instaladas') === 1);
ok('selo do menu lateral mostra 1', await ev(`document.querySelector('#skillsBadge').textContent === '1'`));
const comandoInstalado = await ev(`fetch('/api/skills').then((r) => r.json()).then((r) => r.skills.find((s) => s.instalada)?.comando || '')`);
await ev(`location.hash = '#/'`); await sleep(600);
await ev(`(()=>{ const t = document.querySelector('#input'); t.focus(); t.value = '/'; t.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`); await sleep(200);
ok('skill instalada aparece no menu "/" do chat', await ev(`[...document.querySelectorAll('.slash-item code')].some((c) => c.textContent === ${JSON.stringify(comandoInstalado)})`), comandoInstalado);
await ev(`(()=>{ const t = document.querySelector('#input'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
await ev(`location.hash = '#/skills'`); await sleep(800);
await clicar('#skillsView .tab', 'Instaladas'); await sleep(200);
await ev(`document.querySelector('#skillsView .sk-cartao .btn.installed').click()`);
ok('remover na aba Instaladas tira o cartão', await espera(`document.querySelectorAll('#skillsView .sk-cartao').length === 0 && /Nenhuma skill instalada/.test(document.querySelector('#skillsView').textContent)`));

// criar
await clicar('#skillsView .tab', 'Catálogo');
await clicar('#skillsView .hero-actions button', 'Criar skill');
ok('editor abre', await espera(`document.querySelector('dialog.wide-dialog[open] .skill-form') !== null`));
await preencher('.skill-form input[name="nome"]', 'Skill de teste');
await preencher('.skill-form input[name="comando"]', CMD);
await preencher('.skill-form input[name="descricao"]', 'Uma skill só para o teste automático.');
await preencher('.skill-form textarea[name="corpo"]', 'Quando esta skill estiver ativa, responda com exemplos curtos e termine com uma pergunta para a pessoa pensar.');
await ev(`document.querySelectorAll('.symbol-picker button')[4].click()`);
await clicar('.skill-form .dialog-actions button', 'Salvar skill');
ok('salvar abre a página da skill nova', await espera(`/^#\\/skills\\/minha-/.test(location.hash) && /Skill de teste/.test(document.querySelector('.skill-detail h1')?.textContent || '')`));
ok('ícone escolhido (banco de dados) e "Minha skill"', await ev(`document.querySelector('.skill-detail .sk-marca svg.icone')?.innerHTML.includes('ellipse') && /Minha skill/.test(document.querySelector('.skill-meta').textContent)`));
ok('diálogo some depois de salvar', await espera(`document.querySelector('dialog.wide-dialog') === null`, 3000), await ev(`JSON.stringify([...document.querySelectorAll('dialog')].map((d) => [d.className, d.open, d.querySelector('h1,h2')?.textContent]))`));
// comando repetido dá erro dentro do editor
await clicar('#skillsView .detail-actions button', 'Editar'); await sleep(300);
ok('editor de edição vem preenchido', await ev(`document.querySelector('.skill-form input[name="nome"]').value === 'Skill de teste'`));
await preencher('.skill-form input[name="comando"]', comandoInstalado || '/revisar');
await clicar('.skill-form .dialog-actions button', 'Salvar skill');
ok('comando já usado mostra erro sem fechar', await espera(`/já é usado/.test(document.querySelector('.skill-form .gate-error')?.textContent || '')`));
await preencher('.skill-form input[name="comando"]', CMD);
await preencher('.skill-form input[name="nome"]', 'Skill de teste editada');
await clicar('.skill-form .dialog-actions button', 'Salvar skill');
ok('editar atualiza a página', await espera(`/editada/.test(document.querySelector('.skill-detail h1')?.textContent || '')`));
const skillId = await ev(`location.hash.split('/')[2]`);
ok('link de exportar aponta para o .md', await ev(`/\\/api\\/skills\\/minha-[\\w-]+\\/export$/.test(document.querySelector('.detail-actions a[download]').href)`));

// publicar
await clicar('#skillsView .detail-actions button', 'Publicar na loja');
ok('publicar troca o botão para "Atualizar na loja"', await espera(`/Atualizar na loja/.test(document.querySelector('.detail-actions').textContent) && /na loja/.test(document.querySelector('.skill-meta').textContent)`));

// importar um .md
const md = `---\nnome: Importada do teste\ndescricao: Veio de um arquivo\nsimbolo: λ\ncomando: ${CMD}i\ngatilhos: teste, importar\n---\nInstruções da skill importada para o teste automático.`;
await ev(`location.hash = '#/skills'`); await sleep(800);
await ev(`(()=>{ const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(md)}], 'imp.md', { type: 'text/markdown' })); const i = document.querySelector('#skillFile'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
ok('importar vai para "Minhas" com 2 skills', await espera(`document.querySelector('#skillsView .tab.active')?.textContent.startsWith('Minhas') && document.querySelectorAll('#skillsView .sk-cartao').length === 2`));

// loja vista pela autora
await clicar('#skillsView .tab', 'Loja');
ok('loja mostra a skill publicada como "Você publicou"', await espera(`[...document.querySelectorAll('#skillsView .sk-cartao')].some((c) => /Você publicou/.test(c.textContent) && /editada/.test(c.textContent))`));
await preencher('#lojaBusca', 'zzz-nada');
ok('busca na loja sem resultado avisa', await espera(`/Nada encontrado/.test(document.querySelector('#skillsView').textContent)`));
await preencher('#lojaBusca', '');

// outra pessoa instala da loja
await entrarComo(OUTRA);
await send('Page.navigate', { url: `${BASE}/?r=2#/skills` }); await sleep(2500);
// a outra pessoa abre a Loja: espera o cartão chegar (no CI lento, meio segundo não bastava)
await espera(`document.querySelector('#skillsView .tab') !== null`, 15000);
await clicar('#skillsView .tab', 'Loja');
await espera(`[...document.querySelectorAll('#skillsView .sk-cartao')].some((c) => /editada/.test(c.textContent) && c.querySelector('.btn.primary'))`, 15000);
// clica de novo enquanto o diálogo não abre: no Windows do CI o primeiro clique às vezes se perdia (lista ainda sendo
// redesenhada); repetir o clique é o que uma pessoa faria e não esconde erro, porque o conteúdo continua conferido abaixo
await espera(`(()=>{ if (!document.querySelector('dialog.wide-dialog[open]')) [...document.querySelectorAll('#skillsView .sk-cartao')].find((c) => /editada/.test(c.textContent))?.querySelector('.btn.primary')?.click(); return document.querySelector('dialog.wide-dialog[open]') !== null; })()`, 15000);
ok('"Ver e instalar" abre as instruções antes', await espera(`document.querySelector('dialog.wide-dialog[open] .loja-detail .skill-body') !== null && /responda com exemplos curtos/.test(document.querySelector('.loja-detail .md').textContent)`));
await clicar('.loja-detail .dialog-actions button', 'Instalar cópia');
ok('instalar cópia fecha o diálogo e marca Instalada', await espera(`document.querySelector('dialog.wide-dialog') === null && [...document.querySelectorAll('#skillsView .sk-cartao')].some((c) => /editada/.test(c.textContent) && c.querySelector('.btn.installed'))`));
ok('cópia aparece em Minhas como "Da loja"', await aba('Minhas') === 1 && await clicar('#skillsView .tab', 'Minhas') && await espera(`/Da loja/.test(document.querySelector('#skillsView .sk-cartao')?.textContent || '')`));

// autora tira da loja e exclui
await entrarComo(AUTOR);
await send('Page.navigate', { url: `${BASE}/?r=3#/skills/${skillId}` }); await sleep(2500);
await clicar('#skillsView .detail-actions button', 'Tirar da loja');
ok('tirar da loja volta para "Publicar na loja"', await espera(`/Publicar na loja/.test(document.querySelector('.detail-actions').textContent)`));
await clicar('#skillsView .detail-actions button', 'Excluir');
ok('excluir volta para a lista', await espera(`location.hash === '#/skills' && document.querySelector('.sk-topo') !== null`));
ok('skill inexistente na URL volta para a lista', await ev(`(location.hash = '#/skills/minha-naoexiste', 1)`) && await espera(`location.hash === '#/skills'`));

ok('sem erro de JavaScript', erros.length === 0, erros.slice(0, 3).join(' | '));
ok('servidor sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
await nav.fechar();
await servidor.parar();
process.exit(fim());
