// Acessibilidade e celular: auditoria do axe-core (WCAG 2.1 A e AA) em cada tela, nos temas claro e escuro, e as
// mesmas telas numa largura de celular (sem rolagem para o lado, menu lateral abrindo e fechando).
// Uso: node testes-e2e/acessibilidade.e2e.mjs [--detalhes]   (lista cada problema encontrado)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { subirServidor, abrirNavegador, clienteApi, placar, criarProjetoForja } from './ajuda.mjs';

const { ok, fim } = placar();
const detalhes = process.argv.includes('--detalhes');
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const servidor = await subirServidor();
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Ana Acessível' });
const conv = await (await api.pedir('POST', '/api/conversations', {})).json();
await api.pedir('PATCH', `/api/conversations/${conv.id}`, { title: 'Conversa de exemplo' });
const proj = criarProjetoForja();
const sessao = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta: proj.pasta })).json();
const TELAS = [['chat', '#/'], ['Prática', '#/pratica'], ['exercício', '#/pratica/js-zero/js-saudacao'], ['Skills', '#/skills'], ['Turmas', '#/turmas'], ['Forja', `#/agente/${sessao.id}`]];

async function auditar(nav, rotulo, contexto = 'document') {
  await nav.avaliar(`window.axe ? 1 : (eval(${JSON.stringify(AXE)}), 1)`);
  const r = await nav.avaliar(`axe.run(${contexto}, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] })
    .then((r) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, impacto: v.impact, ajuda: v.help, onde: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })))`);
  if (detalhes) for (const v of r) console.log(`   [${rotulo}] ${v.impacto} ${v.id}: ${v.ajuda} -> ${v.onde.join(' | ')}`);
  ok(`acessibilidade: ${rotulo}`, r.length === 0, r.map((v) => v.id).join(', '));
}

for (const tema of ['light', 'dark']) {
  const nav = await abrirNavegador();
  try {
    await nav.entrar(servidor.base, conta);
    await nav.avaliar(`(localStorage.setItem('theme', '${tema}'), 1)`);
    for (const [nome, h] of TELAS) {
      await nav.ir(`${servidor.base}/?r=${Date.now()}${h}`, 2500);
      await nav.esperar(`document.querySelector('.skeleton') === null`, 5000);
      await auditar(nav, `${nome} (tema ${tema === 'light' ? 'claro' : 'escuro'})`);
    }
    await nav.ir(`${servidor.base}/?r=${Date.now()}#/`, 2500);
    await nav.avaliar(`document.querySelector('#openSettings').click()`);
    await nav.esperar('false', 600); // a animação de abertura deixa o texto semitransparente por um instante
    for (const aba of ['geral', 'ia', 'uso', 'pratica', 'dados', 'extensoes']) {
      await nav.avaliar(`document.querySelector('[data-aba="${aba}"]').click()`);
      await nav.esperar(`document.querySelector('[data-painel="${aba}"] .skeleton') === null`, 4000);
      await auditar(nav, `Configurações > ${aba} (tema ${tema === 'light' ? 'claro' : 'escuro'})`, `document.querySelector('dialog.config')`);
    }
  } finally { await nav.fechar(); }
}

// tela de entrada (sem login)
{
  const nav = await abrirNavegador();
  try {
    await nav.ir(`${servidor.base}/`, 800);
    await nav.avaliar(`(localStorage.setItem('gyde-intro-vista', '1'), 1)`);
    await nav.ir(`${servidor.base}/?r=1`, 1500);
    await auditar(nav, 'entrar');
  } finally { await nav.fechar(); }
}

// celular (375 x 812)
{
  const nav = await abrirNavegador({ largura: 375, altura: 812, movel: true });
  try {
    await nav.entrar(servidor.base, conta);
    for (const [nome, h] of TELAS) {
      await nav.ir(`${servidor.base}/?r=${Date.now()}${h}`, 2500);
      const largura = await nav.avaliar(`({ pagina: document.documentElement.scrollWidth, tela: innerWidth, sobra: [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed'; }).slice(0, 3).map((el) => el.className || el.tagName) })`);
      ok(`celular: ${nome} sem rolagem para o lado`, largura.pagina <= largura.tela, `${largura.pagina} > ${largura.tela}: ${largura.sobra.join(', ')}`);
    }
    await nav.ir(`${servidor.base}/?r=${Date.now()}#/`, 2500);
    ok('celular: menu lateral começa fechado', await nav.avaliar(`document.querySelector('#sidebar').getBoundingClientRect().right <= 0 || !document.querySelector('.app').classList.contains('sidebar-open')`));
    await nav.avaliar(`document.querySelector('#openSidebar').click()`);
    ok('celular: botão de menu abre a barra lateral', await nav.esperar(`document.querySelector('.app').classList.contains('sidebar-open') && document.querySelector('#sidebar').getBoundingClientRect().left >= 0`, 3000));
    await nav.avaliar(`document.querySelector('.nav-item[data-nav="pratica"]').click()`);
    ok('celular: escolher uma seção fecha a barra', await nav.esperar(`!document.querySelector('.app').classList.contains('sidebar-open') && location.hash === '#/pratica'`, 3000));
    await nav.ir(`${servidor.base}/?r=${Date.now()}#/`, 2500);
    ok('celular: campo de mensagem visível e com fonte de 16px (o celular não dá zoom ao tocar)', await nav.avaliar(`(() => { const t = document.querySelector('#input'); const r = t.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 && parseFloat(getComputedStyle(t).fontSize) >= 16; })()`), await nav.avaliar(`getComputedStyle(document.querySelector('#input')).fontSize`));
    await auditar(nav, 'chat no celular');
  } finally { await nav.fechar(); }
}
await servidor.parar(); proj.apagar();
process.exit(fim());
