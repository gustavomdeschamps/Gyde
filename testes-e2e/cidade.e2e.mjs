// Cidade do código na tela: a aba aparece na Forja, a lista em texto mostra os arquivos reais da pasta
// (com as mudanças do git), esconde segredos, filtra e ordena, e cabe no celular sem rolagem para o lado.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { subirServidor, abrirNavegador, clienteApi, placar, criarProjetoForja } from './ajuda.mjs';

const { ok, fim } = placar();
const servidor = await subirServidor({ env: { FREELLMAPI_URL: 'http://127.0.0.1:1', FREELLMAPI_KEY: '' } });
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Cidade' });
const proj = criarProjetoForja();
mkdirSync(path.join(proj.pasta, 'src', 'telas'), { recursive: true });
writeFileSync(path.join(proj.pasta, 'src', 'telas', 'inicio.js'), 'linha\n'.repeat(40));
writeFileSync(path.join(proj.pasta, '.env'), 'SEGREDO=nao-pode-aparecer');
const git = (...a) => spawnSync('git', ['-c', 'user.name=Teste', '-c', 'user.email=teste@exemplo.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd: proj.pasta });
git('init', '-q'); git('add', 'soma.js', 'teste.js', 'package.json', 'src'); git('commit', '-qm', 'um');
writeFileSync(path.join(proj.pasta, 'soma.js'), proj.ler('soma.js') + '\n// mudou\n'); git('commit', '-qam', 'dois');
const sessao = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta: proj.pasta })).json();

async function verificar(nav, rotulo) {
  const { avaliar, esperar } = nav;
  await nav.entrar(servidor.base, conta);
  await nav.ir(`${servidor.base}/?r=1#/agente/${sessao.id}`, 2500);
  ok(`${rotulo}: aba Cidade aparece ao lado da Conversa`, await esperar(`document.querySelector('#abaCidade') !== null && document.querySelector('#abaConversa')?.getAttribute('aria-selected') === 'true'`));
  await avaliar(`document.querySelector('#abaCidade').click()`);
  ok(`${rotulo}: a lista mostra os arquivos reais da pasta`, await esperar(`document.querySelectorAll('.cidade-bairro tbody tr').length === 4`, 8000), await avaliar(`document.querySelector('.cidade')?.textContent.slice(0, 300)`));
  ok(`${rotulo}: .env não aparece`, await avaliar(`!/\\.env|nao-pode-aparecer/.test(document.querySelector('.cidade').textContent)`));
  ok(`${rotulo}: mudanças do git contadas (soma.js mudou 2 vezes)`, await avaliar(`(()=>{ const l = [...document.querySelectorAll('.cidade-bairro tbody tr')].find((tr) => /soma\\.js/.test(tr.textContent)); return Boolean(l) && /2 vezes/.test(l.textContent); })()`));
  ok(`${rotulo}: pastas viram bairros`, await avaliar(`[...document.querySelectorAll('.cidade-bairro-nome')].some((b) => b.textContent === 'src/telas/')`));
  ok(`${rotulo}: ordenado pelos mais alterados primeiro`, await avaliar(`/soma\\.js/.test(document.querySelector('.cidade-bairro tbody tr')?.textContent || '')`));
  await avaliar(`(()=>{ const s = document.querySelector('.cidade-ordem select'); s.value = 'tamanho'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  ok(`${rotulo}: ordenar por tamanho põe o maior bairro primeiro`, await esperar(`document.querySelector('.cidade-bairro-nome')?.textContent === 'src/telas/'`, 2000));
  await avaliar(`(()=>{ const i = document.querySelector('.cidade-filtro input'); i.value = 'inicio'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  ok(`${rotulo}: procurar filtra os arquivos`, await esperar(`document.querySelectorAll('.cidade-bairro tbody tr').length === 1`, 2000));
  ok(`${rotulo}: sem rolagem para o lado`, await avaliar(`document.documentElement.scrollWidth <= document.documentElement.clientWidth && [...document.querySelectorAll('.cidade, .forja-rolagem')].every((e) => e.scrollWidth <= e.clientWidth + 1)`), await avaliar(`JSON.stringify([document.documentElement.scrollWidth, document.documentElement.clientWidth])`));
  ok(`${rotulo}: sem erro de JavaScript`, nav.erros.length === 0, nav.erros.slice(0, 3).join(' | '));
  await avaliar(`document.querySelector('#abaConversa').click()`);
  ok(`${rotulo}: voltar para a Conversa mostra o campo da Forja`, await esperar(`document.querySelector('#agenteView textarea') !== null`, 2000));
}

try {
  const pc = await abrirNavegador();
  try { await verificar(pc, 'computador'); } finally { await pc.fechar(); }
  const cel = await abrirNavegador({ largura: 390, altura: 844, movel: true });
  try { await verificar(cel, 'celular'); } finally { await cel.fechar(); }
} finally {
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
  await servidor.parar();
  proj.apagar();
}
process.exit(fim());
