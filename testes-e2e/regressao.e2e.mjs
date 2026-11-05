// Regressão: rotas principais respondem, todas as páginas e abas de Configurações abrem sem erro, e uma resposta
// fora do contrato (servidor desatualizado) vira erro claro com "Tentar de novo", nunca tela vazia.
import { subirServidor, abrirNavegador, clienteApi, placar } from './ajuda.mjs';
import { provedorFalso } from './provedor-falso.mjs';

const { ok, fim } = placar();
const ia = await provedorFalso();
const servidor = await subirServidor({ env: { FREELLMAPI_URL: ia.url, FREELLMAPI_KEY: 'freellmapi-teste-falsa-0000' } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Regina' });
for (const rota of ['/api/conversations', '/api/memoria', '/api/models', '/api/quiz', '/api/settings', '/api/skills', '/api/skills/loja', '/api/tokens', '/api/codigo/sessoes', '/api/uso', '/api/status']) {
  const r = await api.pedir('GET', rota);
  ok(`rota ${rota}`, r.status === 200, String(r.status));
}

const nav = await abrirNavegador();
try {
  await nav.entrar(servidor.base, conta);
  for (const h of ['#/', '#/skills', '#/agente']) {
    nav.erros.length = 0;
    await nav.ir(`${servidor.base}/?r=${Date.now()}${h}`, 2500);
    const pagina = await nav.avaliar(`document.querySelector('.main')?.dataset.page`);
    ok(`página ${h} abre sem erro`, nav.erros.length === 0 && Boolean(pagina), `${pagina}${nav.erros.length ? ` | ${nav.erros.join(' | ')}` : ''}`);
  }

  nav.erros.length = 0;
  await nav.ir(`${servidor.base}/?r=${Date.now()}#/`, 2500);
  const abas = await nav.avaliar(`(async () => {
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    document.getElementById('openSettings').click(); await espera(800);
    const out = {};
    for (const b of document.querySelectorAll('.config-abas [data-aba]')) {
      b.click(); await espera(b.dataset.aba === 'uso' ? 1500 : 400);
      const p = document.querySelector('.config-painel:not([hidden])');
      out[b.dataset.aba] = { visivel: Boolean(p && p.dataset.painel === b.dataset.aba), texto: p ? p.innerText.length : 0, ruim: /undefined|NaN|object Object/.test(p?.innerText || '') };
    }
    document.querySelector('dialog.config').close();
    return out;
  })()`);
  ok('Configurações: 5 abas abrem com conteúdo', abas && Object.keys(abas).length === 5 && Object.values(abas).every((a) => a.visivel && a.texto > 20), JSON.stringify(abas));
  ok('Configurações: nada de undefined/NaN na tela', abas && Object.values(abas).every((a) => !a.ruim));
  ok('Configurações: sem erro de JavaScript', nav.erros.length === 0, nav.erros.join(' | '));

  await nav.ir(`${servidor.base}/?r=${Date.now()}#/agente`, 2500);
  const forja = await nav.avaliar(`({ barra: Boolean(document.querySelector('.forja-proj-btn')), campo: (() => { const f = document.querySelector('#agenteView form'); return Boolean(f && f.offsetParent !== null && f.getBoundingClientRect().height > 20); })() })`);
  ok('Forja abre como chat, com barra de projeto e campo de mensagem visível', forja.barra && forja.campo, JSON.stringify(forja));
  // a Prática e as Turmas saíram: link antigo abre o chat, e a API não responde mais por elas
  await nav.ir(`${servidor.base}/?r=${Date.now()}#/pratica/js-zero`, 2500);
  ok('link antigo da Prática abre as conversas', await nav.esperar(`document.querySelector('.main').dataset.page === 'chat'`, 3000));
  ok('o menu não tem mais Prática nem Turmas', await nav.avaliar(`!document.querySelector('.nav-item[data-nav="pratica"], .nav-item[data-nav="turmas"]') && !/XP/.test(document.querySelector('.main-nav').textContent)`));
  for (const rota of ['/api/pratica', '/api/turmas', '/api/duelos', '/api/certificados']) ok(`rota ${rota} não existe mais`, (await api.pedir('GET', rota)).status === 404);
  ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
  ok('servidor sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); await ia.fechar(); }
process.exit(fim());
