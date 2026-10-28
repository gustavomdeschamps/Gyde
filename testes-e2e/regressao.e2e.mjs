// Regressão: rotas principais respondem, todas as páginas e abas de Configurações abrem sem erro, e uma resposta
// fora do contrato (servidor desatualizado) vira erro claro com "Tentar de novo", nunca tela vazia.
import { subirServidor, abrirNavegador, clienteApi, placar } from './ajuda.mjs';
import { provedorFalso } from './provedor-falso.mjs';

const { ok, fim } = placar();
const ia = await provedorFalso();
const servidor = await subirServidor({ env: { FREELLMAPI_URL: ia.url, FREELLMAPI_KEY: 'freellmapi-teste-falsa-0000' } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Regina' });
for (const rota of ['/api/conversations', '/api/memoria', '/api/models', '/api/pratica', '/api/quiz', '/api/settings', '/api/skills', '/api/skills/loja', '/api/tokens', '/api/turmas', '/api/codigo/sessoes', '/api/uso', '/api/status']) {
  const r = await api.pedir('GET', rota);
  ok(`rota ${rota}`, r.status === 200, String(r.status));
}

const nav = await abrirNavegador();
try {
  await nav.entrar(servidor.base, conta);
  for (const h of ['#/', '#/pratica', '#/skills', '#/turmas', '#/agente']) {
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
      b.click(); await espera(b.dataset.aba === 'uso' || b.dataset.aba === 'pratica' ? 1500 : 400);
      const p = document.querySelector('.config-painel:not([hidden])');
      out[b.dataset.aba] = { visivel: Boolean(p && p.dataset.painel === b.dataset.aba), texto: p ? p.innerText.length : 0, ruim: /undefined|NaN|object Object/.test(p?.innerText || '') };
    }
    document.querySelector('dialog.config').close();
    return out;
  })()`);
  ok('Configurações: 6 abas abrem com conteúdo', abas && Object.keys(abas).length === 6 && Object.values(abas).every((a) => a.visivel && a.texto > 20), JSON.stringify(abas));
  ok('Configurações: nada de undefined/NaN na tela', abas && Object.values(abas).every((a) => !a.ruim));
  ok('Configurações: sem erro de JavaScript', nav.erros.length === 0, nav.erros.join(' | '));

  await nav.ir(`${servidor.base}/?r=${Date.now()}#/agente`, 2500);
  const forja = await nav.avaliar(`({ barra: Boolean(document.querySelector('.forja-proj-btn')), campo: (() => { const f = document.querySelector('#agenteView form'); return Boolean(f && f.offsetParent !== null && f.getBoundingClientRect().height > 20); })() })`);
  ok('Forja abre como chat, com barra de projeto e campo de mensagem visível', forja.barra && forja.campo, JSON.stringify(forja));
  await nav.ir(`${servidor.base}/?r=${Date.now()}#/pratica`, 2500);
  ok('Prática mostra "Seu plano" e explica quando não há questionário', await nav.esperar(`/questionário/.test(document.querySelector('.plano')?.innerText || '')`));

  // servidor desatualizado: a resposta perde um campo obrigatório
  nav.erros.length = 0;
  await nav.ir(`${servidor.base}/?r=${Date.now()}#/`, 2500);
  const antigo = await nav.avaliar(`(async () => {
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const original = window.fetch;
    window.fetch = async (u, o) => { const r = await original(u, o); if (String(u).endsWith('/api/pratica')) { const j = await r.json(); delete j.plano; return new Response(JSON.stringify(j), { status: 200, headers: { 'Content-Type': 'application/json' } }); } return r; };
    location.hash = '#/pratica'; await espera(2000);
    const pag = { erro: Boolean(document.querySelector('#praticaView .estado-erro button')), texto: document.querySelector('#praticaView')?.innerText.slice(0, 80) };
    document.getElementById('openSettings').click(); await espera(700);
    document.querySelector('[data-aba=pratica]').click(); await espera(1500);
    const cfg = { erro: Boolean(document.querySelector('[data-painel="pratica"] .config-erro button')), esqueleto: Boolean(document.querySelector('[data-painel="pratica"] .skeleton')) };
    window.fetch = original;
    return { pag, cfg };
  })()`);
  ok('Prática com servidor desatualizado: erro claro com "Tentar de novo"', antigo?.pag.erro, JSON.stringify(antigo?.pag));
  ok('Configurações > Prática com servidor desatualizado: erro e botão, sem carregamento preso', antigo?.cfg.erro && !antigo.cfg.esqueleto, JSON.stringify(antigo?.cfg));
  ok('sem erro de JavaScript não tratado nesse cenário', !nav.erros.some((e) => /proximo|Cannot read/.test(e)), nav.erros.join(' | '));
  ok('servidor sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); await ia.fechar(); }
process.exit(fim());
