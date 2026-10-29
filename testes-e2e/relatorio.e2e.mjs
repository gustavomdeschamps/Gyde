// Relatório de erro (Configurações > Geral): junta erros do servidor e da tela, sem conversas nem chaves.
// A cópia vai para uma função falsa da página: a área de transferência de verdade não é tocada.
import { subirServidor, abrirNavegador, clienteApi, placar } from './ajuda.mjs';

const { ok, fim } = placar();
const CHAVE = 'freellmapi-chave-que-nao-pode-aparecer-123';
// FreeLLMAPI fora do ar: a resposta do chat falha e o erro entra no relatório
const servidor = await subirServidor({ env: { FREELLMAPI_URL: 'http://127.0.0.1:9', FREELLMAPI_KEY: CHAVE, GYDE_MODO_IA: 'online' } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Rel' });
const conv = await (await api.pedir('POST', '/api/conversations', {})).json();
await (await api.pedir('POST', `/api/conversations/${conv.id}/messages`, { content: 'minha pergunta particular' })).text();

const nav = await abrirNavegador();
const { avaliar, esperar } = nav;
try {
  await nav.entrar(servidor.base, conta);
  await nav.ir(`${servidor.base}/?r=1#/`, 2500);
  await avaliar(`(setTimeout(() => { throw new Error('erro de teste da tela') }), 1)`);
  await avaliar(`(navigator.clipboard.writeText = async (t) => { window.__copiado = t; }, 1)`);
  await avaliar(`document.querySelector('#openSettings').click()`);
  ok('Configurações > Geral tem o botão do relatório', await esperar(`[...document.querySelectorAll('[data-painel="geral"] button')].some((b) => /Copiar relatório/.test(b.textContent))`, 5000));
  await avaliar(`[...document.querySelectorAll('[data-painel="geral"] button')].find((b) => /Copiar relatório/.test(b.textContent)).click()`);
  ok('o relatório foi copiado', await esperar(`typeof window.__copiado === 'string'`, 5000));
  const texto = await avaliar('window.__copiado');
  ok('tem versões e estado da IA', /Gyde \d+\.\d+\.\d+/.test(texto) && /Node \d+/.test(texto) && /esquema \d+/.test(texto) && /FreeLLMAPI sem resposta/.test(texto), texto.split('\n').slice(2, 5).join(' | '));
  ok('tem o erro do servidor (resposta do chat)', /Erros do servidor \([1-9]/.test(texto) && /resposta do chat/.test(texto));
  ok('tem o erro desta tela', /erro de teste da tela/.test(texto));
  ok('não tem a chave nem o texto das conversas', !texto.includes(CHAVE) && !texto.includes('pergunta particular'));
  ok('caminhos aparecem como <gyde>, sem a pasta do usuário', texto.includes('<gyde>/pacotes/servidor/') && !/Users[\\/]/i.test(texto));
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
} finally { await nav.fechar(); await servidor.parar(); }
process.exit(fim());
