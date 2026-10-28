// Skills (componente Svelte): catálogo, criar, editar, importar, publicar e instalar da loja por outra pessoa.
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
const total = await aba('Todas');
ok('catálogo carrega com abas e contagens', total > 0 && await aba('Instaladas') === 0, `${total} skills`);
await ev(`document.querySelector('#skillsView .skill-card .btn.primary').click()`);
ok('instalar muda o botão e a contagem', await espera(`document.querySelector('#skillsView .skill-card.on .btn.installed') !== null`) && await aba('Instaladas') === 1);
ok('selo do menu lateral mostra 1', await ev(`document.querySelector('#skillsBadge').textContent === '1'`));
const comandoInstalado = await ev(`document.querySelector('#skillsView .skill-card.on .cmd')?.textContent || ''`);
await ev(`location.hash = '#/'`); await sleep(600);
await ev(`(()=>{ const t = document.querySelector('#input'); t.focus(); t.value = '/'; t.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`); await sleep(200);
ok('skill instalada aparece no menu "/" do chat', await ev(`[...document.querySelectorAll('.slash-item code')].some((c) => c.textContent === ${JSON.stringify(comandoInstalado)})`), comandoInstalado);
await ev(`(()=>{ const t = document.querySelector('#input'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
await ev(`location.hash = '#/skills'`); await sleep(800);
await clicar('#skillsView .tab', 'Instaladas'); await sleep(200);
await ev(`document.querySelector('#skillsView .skill-card .btn.installed').click()`);
ok('remover na aba Instaladas tira o cartão', await espera(`document.querySelectorAll('#skillsView .skill-card').length === 0 && /Nenhuma skill instalada/.test(document.querySelector('#skillsView').textContent)`));

// criar
await clicar('#skillsView .tab', 'Todas');
await clicar('#skillsView .hero-actions button', 'Criar skill');
ok('editor abre', await espera(`document.querySelector('dialog.wide-dialog[open] .skill-form') !== null`));
await preencher('.skill-form input[name="nome"]', 'Skill de teste');
await preencher('.skill-form input[name="comando"]', CMD);
await preencher('.skill-form input[name="descricao"]', 'Uma skill só para o teste automático.');
await preencher('.skill-form textarea[name="corpo"]', 'Quando esta skill estiver ativa, responda com exemplos curtos e termine com uma pergunta para a pessoa pensar.');
await ev(`document.querySelectorAll('.symbol-picker button')[4].click()`);
await clicar('.skill-form .dialog-actions button', 'Salvar skill');
ok('salvar abre a página da skill nova', await espera(`/^#\\/skills\\/minha-/.test(location.hash) && /Skill de teste/.test(document.querySelector('.skill-detail h1')?.textContent || '')`));
ok('símbolo escolhido e "Minha skill"', await ev(`document.querySelector('.skill-detail .skill-symbol').textContent === '■' && /Minha skill/.test(document.querySelector('.skill-meta').textContent)`));
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
ok('importar vai para "Minhas" com 2 skills', await espera(`document.querySelector('#skillsView .tab.active')?.textContent.startsWith('Minhas') && document.querySelectorAll('#skillsView .skill-card').length === 2`));

// loja vista pela autora
await clicar('#skillsView .tab', 'Loja');
ok('loja mostra a skill publicada como "Você publicou"', await espera(`[...document.querySelectorAll('.loja-card')].some((c) => /Você publicou/.test(c.textContent) && /editada/.test(c.textContent))`));
await preencher('#lojaBusca', 'zzz-nada');
ok('busca na loja sem resultado avisa', await espera(`/Nada encontrado/.test(document.querySelector('#skillsView').textContent)`));
await preencher('#lojaBusca', '');

// outra pessoa instala da loja
await entrarComo(OUTRA);
await send('Page.navigate', { url: `${BASE}/?r=2#/skills` }); await sleep(2500);
await clicar('#skillsView .tab', 'Loja'); await sleep(500);
await ev(`[...document.querySelectorAll('.loja-card')].find((c) => /editada/.test(c.textContent)).querySelector('.btn.primary').click()`);
ok('"Ver e instalar" abre as instruções antes', await espera(`document.querySelector('dialog.wide-dialog[open] .loja-detail .skill-body') !== null && /responda com exemplos curtos/.test(document.querySelector('.loja-detail .md').textContent)`));
await clicar('.loja-detail .dialog-actions button', 'Instalar cópia');
ok('instalar cópia fecha o diálogo e marca Instalada', await espera(`document.querySelector('dialog.wide-dialog') === null && [...document.querySelectorAll('.loja-card')].some((c) => /editada/.test(c.textContent) && c.querySelector('.btn.installed'))`));
ok('cópia aparece em Minhas como "Da loja"', await aba('Minhas') === 1 && await clicar('#skillsView .tab', 'Minhas') && await espera(`/Da loja/.test(document.querySelector('#skillsView .skill-card')?.textContent || '')`));

// autora tira da loja e exclui
await entrarComo(AUTOR);
await send('Page.navigate', { url: `${BASE}/?r=3#/skills/${skillId}` }); await sleep(2500);
await clicar('#skillsView .detail-actions button', 'Tirar da loja');
ok('tirar da loja volta para "Publicar na loja"', await espera(`/Publicar na loja/.test(document.querySelector('.detail-actions').textContent)`));
await clicar('#skillsView .detail-actions button', 'Excluir');
ok('excluir volta para a lista', await espera(`location.hash === '#/skills' && document.querySelector('.skills-hero') !== null`));
ok('skill inexistente na URL volta para a lista', await ev(`(location.hash = '#/skills/minha-naoexiste', 1)`) && await espera(`location.hash === '#/skills'`));

ok('sem erro de JavaScript', erros.length === 0, erros.slice(0, 3).join(' | '));
ok('servidor sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
await nav.fechar();
await servidor.parar();
process.exit(fim());
