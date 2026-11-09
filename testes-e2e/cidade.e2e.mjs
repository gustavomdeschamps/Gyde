// Cidade do código na tela: a aba aparece na Forja, a lista em texto mostra os arquivos reais da pasta
// (com as mudanças do git), esconde segredos, filtra e ordena, e cabe no celular sem rolagem para o lado.
// A checagem de segurança do 3D confere que os prédios aparecem e, se não aparecerem, baixa a qualidade e avisa.
// Também: outro projeto qualquer vira cidade, pasta sem git funciona sem cores, e pasta grande avisa o que ficou de fora.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

async function verificar(nav, rotulo, webgl) {
  const { avaliar, esperar } = nav;
  await nav.entrar(servidor.base, conta);
  await avaliar(`localStorage.setItem('cidadeQualidade', 'alta'); 1`); // fixa a alta: o desenho por software do teste é lento e o automático baixaria
  await nav.ir(`${servidor.base}/?r=1#/agente/${sessao.id}`, 2500);
  ok(`${rotulo}: aba Cidade aparece ao lado da Conversa`, await esperar(`document.querySelector('#abaCidade') !== null && document.querySelector('#abaConversa')?.getAttribute('aria-selected') === 'true'`));
  const tresAntes = await avaliar(`performance.getEntriesByType('resource').some((r) => /cidade3d/.test(r.name))`);
  await avaliar(`document.querySelector('#abaCidade').click()`);
  ok(`${rotulo}: o 3D só é baixado quando a aba abre`, !tresAntes && await esperar(`performance.getEntriesByType('resource').some((r) => /cidade3d/.test(r.name))`, 8000));
  if (webgl) {
    ok(`${rotulo}: a cidade 3D aparece`, await esperar(`document.querySelector('.cidade-canvas') !== null && !document.querySelector('.cidade-palco-info')`, 20_000));
    ok(`${rotulo}: a checagem de segurança confirma prédios no quadro`, await esperar(`document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok'`, 25_000), await avaliar(`document.querySelector('.cidade-3d')?.dataset.verificacao ?? 'sem resultado'`));
  }
  else ok(`${rotulo}: sem WebGL, a tela oferece a lista`, await esperar(`/Ver como lista/.test(document.querySelector('.cidade-palco-info')?.textContent || '') || document.querySelector('.cidade-canvas') !== null`, 20_000));
  await avaliar(`[...document.querySelectorAll('.cidade-modo button')].find((b) => b.textContent === 'Lista').click()`);
  ok(`${rotulo}: a cena 3D é desmontada ao trocar para a lista`, await esperar(`document.querySelector('.cidade-canvas') === null`, 3000));
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
  await avaliar(`localStorage.removeItem('cidadeModo'); 1`); // a próxima rodada começa de novo no 3D
}

// abre a Cidade de uma pasta e devolve o navegador já na aba (3D ou lista)
async function abrirCidade(nav, pasta, { modo = '3d', extra = '' } = {}) {
  const s = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta })).json();
  await nav.entrar(servidor.base, conta);
  await nav.avaliar(`localStorage.setItem('cidadeQualidade', 'alta'); localStorage.setItem('cidadeModo', '${modo}'); ${extra} 1`);
  await nav.ir(`${servidor.base}/?r=${Math.random()}#/agente/${s.id}`, 2500);
  await nav.esperar(`document.querySelector('#abaCidade') !== null`);
  await nav.avaliar(`document.querySelector('#abaCidade').click()`);
}
const pastaTemp = (nome) => mkdtempSync(path.join(tmpdir(), `gyde-e2e-${nome}-`));

try {
  // checagem de segurança: com a falha simulada na qualidade alta, a cena volta sozinha para a média e avisa
  const falha = await abrirNavegador({ webgl: true });
  try {
    await abrirCidade(falha, proj.pasta, { extra: `localStorage.setItem('gyde-teste-cidade-falha', 'alta');` });
    ok('falha simulada na alta: volta sozinha para a média', await falha.esperar(`document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok' && /Média/.test(document.querySelector('.cidade-qualidade')?.textContent || '')`, 30_000),
      await falha.avaliar(`JSON.stringify([document.querySelector('.cidade-3d')?.dataset.verificacao, document.querySelector('.cidade-qualidade')?.textContent])`));
    ok('mostra um aviso discreto dizendo o que mudou', await falha.esperar(`/não apareceram na qualidade alta.*Mudei para a média/.test(document.querySelector('.cidade-aviso3d')?.textContent || '')`, 3000));
    ok('sem erro de JavaScript na falha simulada', falha.erros.length === 0, falha.erros.slice(0, 3).join(' | '));
  } finally { await falha.fechar(); }

  // (1) outro projeto qualquer (Python, sem nada do Gyde) vira cidade sozinho; (2) sem git: funciona, sem cores;
  // (3) mais de 1.500 arquivos: avisa quantos ficaram de fora
  const outro = pastaTemp('python');
  for (const [nome, texto] of Object.entries({ 'app/main.py': 'print(1)\n'.repeat(30), 'app/modelos/usuario.py': 'x = 1\n'.repeat(80), 'testes/test_main.py': 'def test(): pass\n', 'requirements.txt': 'flask\n', 'README.md': '# Loja\n' })) {
    mkdirSync(path.dirname(path.join(outro, nome)), { recursive: true }); writeFileSync(path.join(outro, nome), texto);
  }
  spawnSync('git', ['-c', 'user.name=Teste', '-c', 'user.email=teste@exemplo.invalid', '-c', 'commit.gpgsign=false', 'init', '-q'], { cwd: outro });
  spawnSync('git', ['-c', 'user.name=Teste', '-c', 'user.email=teste@exemplo.invalid', '-c', 'commit.gpgsign=false', 'add', '.'], { cwd: outro });
  spawnSync('git', ['-c', 'user.name=Teste', '-c', 'user.email=teste@exemplo.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'um'], { cwd: outro });
  const semGit = pastaTemp('semgit');
  for (const nome of ['index.html', 'css/estilo.css', 'js/app.js']) { mkdirSync(path.dirname(path.join(semGit, nome)), { recursive: true }); writeFileSync(path.join(semGit, nome), 'a\nb\n'); }
  const grande = pastaTemp('grande');
  for (let p = 0; p < 32; p++) { mkdirSync(path.join(grande, `modulo${p}`)); for (let i = 0; i < 50; i++) writeFileSync(path.join(grande, `modulo${p}`, `arq${i}.js`), 'x\n'.repeat(1 + ((p * 50 + i) % 40))); }
  const nav3 = await abrirNavegador({ webgl: true });
  try {
    await abrirCidade(nav3, outro);
    ok('(1) outro projeto vira cidade 3D sozinho', await nav3.esperar(`document.querySelector('.cidade-canvas') !== null && /5 prédios/.test(document.querySelector('.cidade-numeros')?.textContent || '')`, 20_000), await nav3.avaliar(`document.querySelector('.cidade-numeros')?.textContent`));
    ok('(1) e a checagem confirma os prédios na tela', await nav3.esperar(`document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok'`, 25_000), await nav3.avaliar(`document.querySelector('.cidade-3d')?.dataset.verificacao ?? 'sem resultado'`));
    await abrirCidade(nav3, semGit, { modo: 'lista' });
    ok('(2) pasta sem git: a lista funciona e explica que não há cores', await nav3.esperar(`document.querySelectorAll('.cidade-bairro tbody tr').length === 3 && /não usa git/.test(document.querySelector('.cidade-resumo')?.textContent || '')`, 10_000), await nav3.avaliar(`document.querySelector('.cidade-resumo')?.textContent`));
    ok('(2) sem a coluna de mudanças do git', await nav3.avaliar(`![...document.querySelectorAll('.cidade-bairro th')].some((t) => /Mudanças/.test(t.textContent))`));
    await nav3.avaliar(`[...document.querySelectorAll('.cidade-modo button')].find((b) => b.textContent === 'Cidade 3D').click()`);
    ok('(2) pasta sem git também vira cidade 3D', await nav3.esperar(`document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok'`, 25_000));
    await abrirCidade(nav3, grande, { modo: 'lista' });
    ok('(3) 1.600 arquivos: avisa que 100 ficaram de fora', await nav3.esperar(`/1[.]600 arquivos.*1[.]500.*100 ficaram de fora/.test(document.querySelector('.cidade-aviso')?.textContent || '')`, 20_000), await nav3.avaliar(`document.querySelector('.cidade-aviso')?.textContent`));
    ok('(3) e mostra só 1.500 prédios', await nav3.avaliar(`document.querySelectorAll('.cidade-bairro tbody tr').length === 1500`));
    ok('sem erro de JavaScript nas outras pastas', nav3.erros.length === 0, nav3.erros.slice(0, 3).join(' | '));
  } finally { await nav3.fechar(); for (const p of [outro, semGit, grande]) rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); }

  const pc = await abrirNavegador({ webgl: true });
  try { await verificar(pc, 'computador', true); } finally { await pc.fechar(); }
  const cel = await abrirNavegador({ largura: 390, altura: 844, movel: true });
  try { await verificar(cel, 'celular', false); } finally { await cel.fechar(); }
} finally {
  ok('sem resposta fora do contrato', !servidor.foraDoContrato(), servidor.foraDoContrato() ?? '');
  await servidor.parar();
  proj.apagar();
}
process.exit(fim());
