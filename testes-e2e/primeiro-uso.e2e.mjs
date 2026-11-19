// Primeiro uso: o cartão "Primeiros passos" marca cada passo pelo estado de verdade (sem IA, sem pasta, sem conversa),
// leva para Conectar IA e para a Forja, e o Diagnóstico confere o ambiente e diz o que fazer. Depois, com a IA falsa
// conectada, o diagnóstico mostra a IA respondendo e o exemplo vira a primeira conversa.
import { subirServidor, abrirNavegador, clienteApi, placar, criarProjetoForja } from './ajuda.mjs';
import { provedorFalso } from './provedor-falso.mjs';

const { ok, fim } = placar();
const SEM_CHAVES = { FREELLMAPI_KEY: '', NVIDIA_API_KEY: '', GROQ_API_KEY: '', GEMINI_API_KEY: '', CEREBRAS_API_KEY: '', OPENROUTER_API_KEY: '' };

// 1) sem nenhuma IA conectada
{
  const servidor = await subirServidor({ env: SEM_CHAVES });
  const api = clienteApi(servidor.base);
  const conta = await api.criarConta({ nome: 'Primeira Vez' });
  const nav = await abrirNavegador();
  const { avaliar, esperar } = nav;
  try {
    await nav.entrar(servidor.base, conta);
    await nav.ir(`${servidor.base}/?r=1#/`, 2500);
    ok('o cartão de primeiros passos aparece numa conta nova', await esperar(`document.querySelector('.primeiros-passos') !== null`, 8000));
    ok('conta marcada; IA, pasta e pergunta ainda faltam', await esperar(`(() => { const l = [...document.querySelectorAll('.primeiros-passos li')]; return l.length === 4 && l[0].classList.contains('feito') && l.slice(1).every((x) => !x.classList.contains('feito')); })()`, 5000), await avaliar(`document.querySelector('.primeiros-passos')?.textContent`));
    ok('sem IA, o exemplo de pergunta fica desligado', await esperar(`[...document.querySelectorAll('.primeiros-passos button')].find((b) => /Usar um exemplo/.test(b.textContent))?.disabled === true`, 5000));
    await avaliar(`[...document.querySelectorAll('.primeiros-passos button')].find((b) => b.textContent === 'Conectar').click()`);
    ok('"Conectar" abre as Configurações em Conectar IA', await esperar(`document.querySelector('dialog.config[open]') !== null && document.querySelector('[data-aba="conectar"]')?.getAttribute('aria-selected') === 'true'`, 3000));
    await avaliar(`document.querySelector('[data-aba="geral"]').click()`);
    await esperar(`document.querySelector('#rodarDiagnostico') !== null`, 3000);
    await avaliar(`document.querySelector('#rodarDiagnostico').click()`);
    ok('o diagnóstico confere o ambiente', await esperar(`document.querySelectorAll('.diagnostico li').length >= 6`, 40_000), await avaliar(`document.querySelector('.diagnostico')?.textContent ?? document.querySelector('dialog.config .msg-error')?.textContent`));
    ok('sem IA: o diagnóstico diz o problema e o que fazer', await avaliar(`(() => { const l = [...document.querySelectorAll('.diagnostico li')].find((x) => /IA conectada/.test(x.textContent)); return l?.classList.contains('erro') && /Conectar IA/.test(l.textContent); })()`));
    ok('banco e pasta de dados conferidos', await avaliar(`['Banco de dados', 'Pasta de dados'].every((n) => [...document.querySelectorAll('.diagnostico li.ok')].some((x) => x.textContent.includes(n)))`));
    await avaliar(`document.querySelector('dialog.config').close()`);
    await avaliar(`document.querySelector('.primeiros-passos button[aria-label="Fechar os primeiros passos"]').click()`);
    await nav.ir(`${servidor.base}/?r=2#/`, 2500);
    ok('fechado, o cartão não volta', await avaliar(`document.querySelector('.primeiros-passos') === null`));
    ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
    ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
  } finally { await nav.fechar(); await servidor.parar(); }
}

// 2) com a IA (falsa) conectada
{
  const ia = await provedorFalso();
  const servidor = await subirServidor({ env: { ...SEM_CHAVES, FREELLMAPI_URL: ia.url, FREELLMAPI_KEY: 'freellmapi-teste-falsa-0000' } });
  const api = clienteApi(servidor.base);
  const conta = await api.criarConta({ nome: 'Com IA' });
  const proj = criarProjetoForja();
  const nav = await abrirNavegador();
  const { avaliar, esperar } = nav;
  try {
    await nav.entrar(servidor.base, conta);
    await nav.ir(`${servidor.base}/?r=3#/`, 2500);
    ok('com a IA conectada, o passo fica marcado', await esperar(`[...document.querySelectorAll('.primeiros-passos li')][1]?.classList.contains('feito')`, 8000));
    {
      const criada = await api.pedir('POST', '/api/codigo/sessoes', { pasta: proj.pasta });
      ok('pasta conectada pela API', criada.status === 201, String(criada.status));
      await avaliar(`dispatchEvent(new CustomEvent('gyde:estado')); 1`);
      ok('com uma pasta conectada, o passo da Forja fica marcado', await esperar(`[...document.querySelectorAll('.primeiros-passos li')][2]?.classList.contains('feito')`, 5000), await avaliar(`document.querySelector('.primeiros-passos')?.textContent ?? 'sem cartão'`));
    }
    await avaliar(`[...document.querySelectorAll('.primeiros-passos button')].find((b) => /Usar um exemplo/.test(b.textContent)).click()`);
    ok('o exemplo vai para o campo (a pessoa confere e envia)', await esperar(`/variável/.test(document.querySelector('#input').value)`, 3000));
    await avaliar(`document.querySelector('#input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
    ok('a primeira pergunta conclui os passos e o cartão some', await esperar(`document.querySelector('.msg.assistant .md') !== null`, 15_000) && await (async () => { await nav.ir(`${servidor.base}/?r=4#/`, 2500); return avaliar(`document.querySelector('.primeiros-passos') === null`); })());
    await avaliar(`document.querySelector('#openSettings').click()`);
    await esperar(`document.querySelector('#rodarDiagnostico') !== null`, 3000);
    await avaliar(`document.querySelector('#rodarDiagnostico').click()`);
    ok('com IA: o diagnóstico mostra a IA respondendo', await esperar(`[...document.querySelectorAll('.diagnostico li.ok')].some((x) => /IA conectada/.test(x.textContent) && /Respondeu em/.test(x.textContent))`, 40_000), await avaliar(`document.querySelector('.diagnostico')?.textContent`));
    ok('sem erro de JavaScript', nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
    ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
  } finally { await nav.fechar(); await servidor.parar(); await ia.fechar(); proj.apagar(); }
}
process.exit(fim());
