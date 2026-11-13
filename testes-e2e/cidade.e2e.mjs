// Cidade do código na tela: a aba aparece na Forja, a lista em texto mostra os arquivos reais da pasta
// (com as mudanças do git), esconde segredos, filtra e ordena, e cabe no celular sem rolagem para o lado.
// Um visual só: a base desenha direto na tela; extras (bloom) só ligam depois de passar na checagem de segurança e,
// se falharem, desligam em silêncio. A cidade reage à Forja (o prédio acende; arquivo novo vira prédio novo).
// Também: outro projeto qualquer vira cidade, pasta sem git funciona sem cores, e pasta grande avisa o que ficou de fora.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { subirServidor, abrirNavegador, clienteApi, placar, criarProjetoForja } from './ajuda.mjs';
import { provedorFalso } from './provedor-falso.mjs';

const { ok, fim } = placar();
const ia = await provedorFalso();
const servidor = await subirServidor({ env: { FREELLMAPI_URL: ia.url, FREELLMAPI_KEY: 'freellmapi-teste-falsa-0000' } });
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
  await nav.ir(`${servidor.base}/?r=1#/agente/${sessao.id}`, 2500);
  ok(`${rotulo}: aba Cidade aparece ao lado da Conversa`, await esperar(`document.querySelector('#abaCidade') !== null && document.querySelector('#abaConversa')?.getAttribute('aria-selected') === 'true'`));
  const tresAntes = await avaliar(`performance.getEntriesByType('resource').some((r) => /cidade3d/.test(r.name))`);
  await avaliar(`document.querySelector('#abaCidade').click()`);
  ok(`${rotulo}: o 3D só é baixado quando a aba abre`, !tresAntes && await esperar(`performance.getEntriesByType('resource').some((r) => /cidade3d/.test(r.name))`, 8000));
  if (webgl) {
    ok(`${rotulo}: a cidade 3D aparece`, await esperar(`document.querySelector('.cidade-canvas') !== null && !document.querySelector('.cidade-palco-info')`, 20_000));
    await avaliar(`window.__copiado = null; navigator.clipboard.writeText = async (t) => { window.__copiado = t; }; 1`);
    await avaliar(`[...document.querySelectorAll('.cidade-rodape button')].find((b) => /Copiar diagnóstico/.test(b.textContent)).click()`);
    ok(`${rotulo}: abre desenhando direto na tela (sem imagem fora da tela)`, await esperar(`/Desenho: direto na tela/.test(window.__copiado || '')`, 3000), await avaliar(`window.__copiado`));
    ok(`${rotulo}: não há botão de qualidade (um visual só)`, await avaliar(`document.querySelector('.cidade-qualidade') === null`));
    ok(`${rotulo}: "Copiar diagnóstico" traz placa, formatos e erros, sem caminho de pasta`, await avaliar(`(() => { const t = window.__copiado || ''; return /Placa de vídeo: /.test(t) && /ponto flutuante/.test(t) && /Erros: /.test(t) && !/gyde-e2e|Users|Documents/i.test(t); })()`));
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
  await nav.avaliar(`localStorage.setItem('cidadeModo', '${modo}'); ${extra} 1`);
  await nav.ir(`${servidor.base}/?r=${Math.random()}#/agente/${s.id}`, 2500);
  await nav.esperar(`document.querySelector('#abaCidade') !== null`);
  await nav.avaliar(`document.querySelector('#abaCidade').click()`);
}
const pastaTemp = (nome) => mkdtempSync(path.join(tmpdir(), `gyde-e2e-${nome}-`));

try {
  // extras: forçados a tentar (o desenho por software do teste é lento demais para ligarem sozinhos)
  const extras = await abrirNavegador({ webgl: true });
  try {
    await abrirCidade(extras, proj.pasta, { extra: `localStorage.setItem('gyde-teste-cidade-extras', '1');` });
    ok('extras passam na checagem e ligam', await extras.esperar(`document.querySelector('.cidade-3d')?.dataset.extras === 'ligados' && document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok'`, 40_000),
      await extras.avaliar(`JSON.stringify(document.querySelector('.cidade-3d')?.dataset)`));
  } finally { await extras.fechar(); }
  // com a falha simulada nos extras: desligam em silêncio, a base continua com prédios e nada de aviso
  const falha = await abrirNavegador({ webgl: true });
  try {
    await abrirCidade(falha, proj.pasta, { extra: `localStorage.setItem('gyde-teste-cidade-extras', '1'); localStorage.setItem('gyde-teste-cidade-falha', 'extras');` });
    ok('extras que falham desligam sozinhos e a base volta com prédios', await falha.esperar(`document.querySelector('.cidade-3d')?.dataset.extras === 'falharam' && document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok'`, 40_000),
      await falha.avaliar(`JSON.stringify(document.querySelector('.cidade-3d')?.dataset)`));
    ok('sem aviso na tela (o recuo é silencioso)', await falha.avaliar(`document.querySelector('.cidade-aviso3d') === null`));
    await falha.avaliar(`window.__copiado = null; navigator.clipboard.writeText = async (t) => { window.__copiado = t; }; [...document.querySelectorAll('.cidade-rodape button')].find((b) => /Copiar diagnóstico/.test(b.textContent)).click(); 1`);
    ok('o diagnóstico conta que os extras falharam e por quê', await falha.esperar(`(window.__copiado || '').includes('extras: desligados: falharam na checagem (a geometria dos prédios não chega à tela)')`, 3000), await falha.avaliar(`window.__copiado`));
    ok('sem erro de JavaScript na falha simulada', falha.erros.length === 0, falha.erros.slice(0, 3).join(' | '));
  } finally { await falha.fechar(); }

  // a Cidade reage à Forja: lê (prédio acende), edita e cria um arquivo novo (prédio novo sobe)
  const projAoVivo = criarProjetoForja();
  mkdirSync(path.join(projAoVivo.pasta, 'src', 'telas'), { recursive: true });
  writeFileSync(path.join(projAoVivo.pasta, 'src', 'telas', 'inicio.js'), 'linha\n'.repeat(12));
  const aoVivo = await abrirNavegador({ webgl: true });
  try {
    const s = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta: projAoVivo.pasta })).json();
    await aoVivo.entrar(servidor.base, conta);
    await aoVivo.avaliar(`localStorage.setItem('cidadeModo', '3d'); 1`);
    await aoVivo.ir(`${servidor.base}/?r=${Math.random()}#/agente/${s.id}`, 2500);
    await aoVivo.esperar(`document.querySelector('#agenteView textarea') !== null`);
    await aoVivo.avaliar(`(()=>{ const t = document.querySelector('#agenteView textarea'); t.value = 'CIDADE-AO-VIVO: corrija a soma e crie um arquivo'; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#agenteView form').requestSubmit(); return 1; })()`);
    await aoVivo.esperar(`document.querySelector('.forja-turno') !== null`, 5000);
    await aoVivo.avaliar(`document.querySelector('#abaCidade').click()`);
    // o HUD fica 4,5 s na tela; as últimas atividades ficam registradas na seção (data-atividades), sem depender do tempo
    const feitas = `(document.querySelector('.cidade')?.dataset.atividades ?? '').split(' | ')`;
    ok('Forja leu: o HUD mostra e o prédio existe na cidade', await aoVivo.esperar(`${feitas}.includes('lendo soma.js')`, 20_000), await aoVivo.avaliar(`${feitas}.join(' | ')`) || 'sem atividade');
    ok('Forja criou um arquivo: o HUD mostra a criação', await aoVivo.esperar(`${feitas}.includes('criando src/telas/novo.js')`, 20_000), await aoVivo.avaliar(`${feitas}.join(' | ')`) || 'sem atividade');
    await aoVivo.avaliar(`window.__copiado = null; navigator.clipboard.writeText = async (t) => { window.__copiado = t; }; [...document.querySelectorAll('.cidade-rodape button')].find((b) => /Copiar diagnóstico/.test(b.textContent)).click(); 1`);
    ok('o arquivo novo virou um prédio novo (5 prédios)', await aoVivo.esperar(`(window.__copiado || '').includes('Prédios: 5 ')`, 3000), await aoVivo.avaliar(`(window.__copiado || '').split('\\n').find((l) => l.startsWith('Prédios')) ?? ''`));
    ok('sem erro de JavaScript com a Forja trabalhando', aoVivo.erros.length === 0, aoVivo.erros.slice(0, 3).join(' | '));
  } finally { await aoVivo.fechar(); projAoVivo.apagar(); }

  // cartão do prédio: "Pedir à Forja" só escreve o pedido no campo da Forja (não envia); num farol, sugere dividir
  const projCartao = pastaTemp('cartao');
  writeFileSync(path.join(projCartao, 'grande.js'), 'x\n'.repeat(60));
  writeFileSync(path.join(projCartao, 'calmo.js'), 'y\n'.repeat(20));
  const gitCartao = (...a) => spawnSync('git', ['-c', 'user.name=Teste', '-c', 'user.email=teste@exemplo.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd: projCartao });
  gitCartao('init', '-q'); gitCartao('add', '.'); gitCartao('commit', '-qm', 'um');
  for (let i = 0; i < 3; i++) { writeFileSync(path.join(projCartao, 'grande.js'), 'x\n'.repeat(60 + i)); gitCartao('commit', '-qam', `muda ${i}`); } // grande.js: 4 mudanças, vira farol
  const navCartao = await abrirNavegador({ webgl: true });
  try {
    await navCartao.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); // câmera parada: o clique cai no prédio certo
    await abrirCidade(navCartao, projCartao, { extra: `localStorage.setItem('gyde-teste-cidade-ponto', '1');` });
    ok('cartão: a cidade abre e confere os prédios', await navCartao.esperar(`document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok' && typeof document.querySelector('.cidade-3d').__pontoDe === 'function'`, 25_000));
    const clicarPredio = async (arquivo) => {
      const p = JSON.parse(await navCartao.avaliar(`JSON.stringify(document.querySelector('.cidade-3d').__pontoDe(${JSON.stringify(arquivo)}))`));
      await navCartao.enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
      await navCartao.enviar('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await navCartao.enviar('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      return navCartao.esperar(`document.querySelector('.cidade-cartao h3')?.textContent === ${JSON.stringify(arquivo)}`, 5000);
    };
    const opcoes = `[...document.querySelectorAll('.cidade-cartao-opcoes button')].map((b) => b.textContent).join('|')`;
    ok('cartão: clicar num prédio abre o cartão com "Pedir à Forja"', await clicarPredio('grande.js') && await navCartao.avaliar(`/Pedir à Forja/.test(document.querySelector('.cidade-cartao-forja .btn')?.textContent || '')`),
      await navCartao.avaliar(`document.querySelector('.cidade-cartao')?.textContent ?? 'sem cartão'`));
    ok('cartão: num farol (muito alterado) as opções incluem dividir em partes menores', await navCartao.avaliar(`${opcoes} === 'Explicar|Simplificar|Achar bugs|Adicionar testes|Dividir em partes menores'`), await navCartao.avaliar(opcoes));
    const pedidosAntes = ia.pedidos.length;
    await navCartao.avaliar(`[...document.querySelectorAll('.cidade-cartao-opcoes button')].find((b) => b.textContent === 'Achar bugs').click()`);
    ok('cartão: "Achar bugs" volta para a Conversa com o pedido escrito', await navCartao.esperar(`document.querySelector('#abaConversa')?.getAttribute('aria-selected') === 'true' && document.querySelector('#agenteView textarea')?.value === 'Procure bugs no arquivo grande.js e corrija os que encontrar, explicando cada um.'`, 5000),
      await navCartao.avaliar(`document.querySelector('#agenteView textarea')?.value ?? 'sem campo'`));
    ok('cartão: o pedido NÃO é enviado sozinho (quem envia é a pessoa)', await navCartao.avaliar(`document.querySelector('.forja-turno') === null`) && ia.pedidos.length === pedidosAntes);
    ok('cartão: o campo fica com o foco, pronto para conferir e enviar', await navCartao.avaliar(`document.activeElement === document.querySelector('#agenteView textarea')`));
    await navCartao.avaliar(`document.querySelector('#abaCidade').click()`);
    await navCartao.esperar(`document.querySelector('.cidade-3d')?.dataset.verificacao === 'ok' && typeof document.querySelector('.cidade-3d').__pontoDe === 'function'`, 25_000);
    ok('cartão: num arquivo calmo não aparece "dividir"', await clicarPredio('calmo.js') && await navCartao.avaliar(`${opcoes} === 'Explicar|Simplificar|Achar bugs|Adicionar testes'`), await navCartao.avaliar(opcoes));
    await navCartao.avaliar(`document.querySelector('.cidade-cartao-forja .btn').click()`);
    ok('cartão: "Pedir à Forja" escreve o pedido de melhorias', await navCartao.esperar(`document.querySelector('#agenteView textarea')?.value === 'Analise o arquivo calmo.js e sugira melhorias.'`, 5000));
    ok('cartão: sem erro de JavaScript', navCartao.erros.length === 0, navCartao.erros.slice(0, 3).join(' | '));
  } finally { await navCartao.fechar(); rmSync(projCartao, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); }

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
  await ia.fechar();
  proj.apagar();
}
process.exit(fim());
