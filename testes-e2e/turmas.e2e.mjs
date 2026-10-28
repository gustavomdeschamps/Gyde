// Turmas (componente Svelte): professor no navegador, aluno pela API e depois no navegador. Servidor próprio do teste.
import { subirServidor, abrirNavegador, placar, espera as sleep } from './ajuda.mjs';

const { ok, fim } = placar();
const servidor = await subirServidor();
const BASE = servidor.base;
const nav = await abrirNavegador();
const ev = (e) => nav.avaliar(e).catch(() => undefined);
const espera = (cond, ms = 8000) => nav.esperar(cond, ms);
const send = nav.enviar;
const erros = nav.erros;
const sufixo = Date.now().toString(36);
const PROF = { name: 'Prof Teste', email: `prof-${sufixo}@t.test`, password: 'teste2026x' };
const ALUNO = { name: 'Aluna Teste', email: `aluna-${sufixo}@t.test`, password: 'teste2026x' };
let cookieAluno = '';
const apiAluno = async (m, p, b) => { const r = await fetch(BASE + p, { method: m, headers: { 'x-gyde': '1', 'Content-Type': 'application/json', ...(cookieAluno ? { Cookie: cookieAluno } : {}) }, body: b ? JSON.stringify(b) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) cookieAluno = sc.split(';')[0]; return r; };
await apiAluno('POST', '/api/auth/register', ALUNO); await apiAluno('POST', '/api/auth/login', ALUNO); await apiAluno('POST', '/api/profile/skip', {});

const H = `{'x-gyde':'1','Content-Type':'application/json'}`;
const entrarComo = async (u, registrar) => {
  await ev(`(async()=>{ localStorage.setItem('gyde-intro-vista','1'); await fetch('/api/auth/logout',{method:'POST',headers:${H}});
    ${registrar ? `await fetch('/api/auth/register',{method:'POST',headers:${H},body:${JSON.stringify(JSON.stringify(u))}});` : ''}
    await fetch('/api/auth/login',{method:'POST',headers:${H},body:${JSON.stringify(JSON.stringify({ email: u.email, password: u.password }))}});
    await fetch('/api/profile/skip',{method:'POST',headers:${H},body:'{}'}); return 1; })()`);
};
const preencher = (sel, valor) => ev(`(()=>{ const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(valor)}; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return 1; })()`);
await send('Page.navigate', { url: BASE + '/' }); await sleep(1200);
await entrarComo(PROF, true);
await send('Page.navigate', { url: `${BASE}/?r=1#/turmas` }); await sleep(2500);

ok('tela inicial com os dois formulários e aviso de vazio', await ev(`document.querySelectorAll('#turmasView .turma-form').length === 2 && /nenhuma turma/.test(document.querySelector('#turmasView').textContent)`));
await preencher('#turmasView input[name="name"]', 'Turma do teste');
await ev(`document.querySelector('#turmasView .turma-form').requestSubmit()`);
ok('criar turma abre a turma com o código', await espera(`/^#\\/turmas\\/[\\w-]+$/.test(location.hash) && document.querySelector('.turma-code b')?.textContent.length === 6`));
const codigo = await ev(`document.querySelector('.turma-code b').textContent`);
const turmaId = await ev(`location.hash.split('/')[2]`);
ok('sem aluno: explica como passar o código', await ev(`/Nenhum aluno ainda/.test(document.querySelector('#turmasView').textContent)`));
ok('lista de exercícios da Prática no seletor', await espera(`document.querySelectorAll('select[name="exerciseId"] option').length > 5`), String(await ev(`document.querySelectorAll('select[name="exerciseId"] option').length`)));

// aluno entra pela API com o código mostrado na tela
const entrou = await apiAluno('POST', '/api/turmas/entrar', { code: codigo.toLowerCase() });
ok('aluno entra com o código (minúsculo também vale)', entrou.status === 200);

// professor passa duas tarefas
for (const [i, prazo] of [[1, '2020-01-10'], [2, '']]) {
  await preencher('select[name="exerciseId"]', await ev(`document.querySelectorAll('select[name="exerciseId"] option')[${i}].value`));
  await preencher('input[name="prazo"]', prazo);
  await ev(`document.querySelector('.turma-form.wide').requestSubmit()`);
  await espera(`document.querySelectorAll('.turma-table thead th[title]').length === ${i}`);
}
ok('painel mostra aluno x 2 tarefas', await ev(`document.querySelectorAll('.turma-table tbody tr').length === 1 && document.querySelectorAll('.turma-table thead th[title]').length === 2`));
ok('aluno aparece com 0/2 e "ainda não praticou"', await ev(`/0\\/2/.test(document.querySelector('.turma-table tbody tr').textContent) && /ainda não praticou/.test(document.querySelector('.turma-table tbody tr').textContent)`));
ok('formulário limpa depois de adicionar', await ev(`document.querySelector('select[name="exerciseId"]').value === '' && document.querySelector('input[name="prazo"]').value === ''`));
await ev(`document.querySelectorAll('.turma-table thead .x')[1].click()`);
ok('remover tarefa atualiza o painel', await espera(`document.querySelectorAll('.turma-table thead th[title]').length === 1`));

// lista do professor
await ev(`location.hash = '#/turmas'`);
ok('lista "Turmas que eu ensino" com 1 aluno e 1 tarefa', await espera(`/1 aluno · 1 tarefas/.test(document.querySelector('#turmasView .track-card')?.textContent || '')`));

// visão do aluno no navegador
await entrarComo(ALUNO, false);
await send('Page.navigate', { url: `${BASE}/?r=2#/turmas` }); await sleep(2500);
ok('aluno vê a turma em "Turmas em que estou"', await ev(`/Turmas em que estou/.test(document.querySelector('#turmasView').textContent) && /Prof Teste/.test(document.querySelector('#turmasView .track-card').textContent)`));
await ev(`document.querySelector('#turmasView .track-card').click()`);
ok('aluno vê a tarefa com prazo vencido marcada como atrasada', await espera(`document.querySelectorAll('#turmasView .ex-item').length === 1 && document.querySelector('#turmasView .badge.late') !== null`));
ok('tarefa leva para o exercício da Prática', await ev(`/^#\\/pratica\\/[\\w-]+\\/[\\w-]+$/.test(new URL(document.querySelector('#turmasView .ex-item').href).hash)`));
await ev(`[...document.querySelectorAll('#turmasView button')].find((b) => /Sair da turma/.test(b.textContent)).click()`);
ok('sair da turma volta para a lista vazia', await espera(`location.hash === '#/turmas' && /nenhuma turma/.test(document.querySelector('#turmasView').textContent)`));

// turma que não existe
await ev(`location.hash = '#/turmas/nao-existe'`);
ok('turma inexistente volta para a lista com aviso', await espera(`location.hash === '#/turmas'`) && await espera(`!document.querySelector('#toast').hidden`, 3000));

// professor apaga
await entrarComo(PROF, false);
await send('Page.navigate', { url: `${BASE}/?r=3#/turmas/${turmaId}` }); await sleep(2500);
await ev(`[...document.querySelectorAll('#turmasView button')].find((b) => /Apagar turma/.test(b.textContent)).click()`);
ok('apagar turma volta para a lista vazia', await espera(`location.hash === '#/turmas' && /nenhuma turma/.test(document.querySelector('#turmasView').textContent)`));

ok('sem erro de JavaScript', erros.length === 0, erros.slice(0, 3).join(' | '));
await nav.fechar();
await servidor.parar();
process.exit(fim());
