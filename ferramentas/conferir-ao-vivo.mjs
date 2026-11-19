// Confere o Ao vivo com projetos de verdade, como a pessoa usaria: cria um site de HTML, um projeto Vite, um Next.js e
// um programa Python de console numa pasta temporária, liga cada um pelo próprio Ao vivo (com o "instalar" que ele
// oferece, que roda npm install e precisa de internet) e confere que a página responde com o conteúdo do projeto
// (ou, no console, que a saída aparece). No fim para tudo e apaga as pastas (só gyde-* da pasta temporária).
//   node ferramentas/conferir-ao-vivo.mjs [--so html,vite,next,python] [--saida resultado.json]
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { subirServidor, clienteApi, espera } from '../testes-e2e/ajuda.mjs';
import { apagarSeguro } from './limpeza-segura.mjs';

const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const SO = arg('so', 'html,vite,next,python').split(',');

const PROJETOS = {
  html: { 'index.html': '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Site</title></head><body><h1>MARCA-HTML</h1></body></html>' },
  vite: {
    'package.json': JSON.stringify({ name: 'teste-vite', private: true, type: 'module', scripts: { dev: 'vite' }, devDependencies: { vite: '^6.0.0' } }, null, 2),
    'index.html': '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Vite</title></head><body><div id="app">MARCA-VITE</div><script type="module" src="/main.js"></script></body></html>',
    'main.js': "document.querySelector('#app').dataset.pronto = '1';\n",
  },
  next: {
    'package.json': JSON.stringify({ name: 'teste-next', private: true, scripts: { dev: 'next dev' }, dependencies: { next: '^15.0.0', react: '^19.0.0', 'react-dom': '^19.0.0' } }, null, 2),
    'app/layout.js': "export default function Layout({ children }) { return <html lang=\"pt-BR\"><body>{children}</body></html>; }\n",
    'app/page.js': 'export default function Pagina() { return <h1>MARCA-NEXT</h1>; }\n',
  },
  python: { 'principal.py': 'print("MARCA-PYTHON", 2 + 3)\n' },
};
const MARCA = { html: 'MARCA-HTML', vite: 'MARCA-VITE', next: 'MARCA-NEXT', python: 'MARCA-PYTHON 5' };

const servidor = await subirServidor();
const api = clienteApi(servidor.base);
await api.criarConta({ nome: 'Ao vivo' });
const resultados = [];
const pastas = [];
try {
  for (const tipo of SO) {
    const pasta = mkdtempSync(path.join(tmpdir(), `gyde-aovivo-${tipo}-`));
    pastas.push(pasta);
    for (const [f, t] of Object.entries(PROJETOS[tipo])) { mkdirSync(path.dirname(path.join(pasta, f)), { recursive: true }); writeFileSync(path.join(pasta, f), t); }
    const sessao = await (await api.pedir('POST', '/api/codigo/sessoes', { pasta })).json();
    const { plano } = await (await api.pedir('GET', `/api/codigo/sessoes/${sessao.id}/ao-vivo`)).json();
    const opcao = plano.opcoes.find((o) => o.id === plano.recomendada) ?? plano.opcoes[0];
    const r = { tipo, detectado: opcao?.rotulo ?? null, comando: opcao?.comando ?? null, ok: false, fase: null, segundos: null, detalhe: '' };
    if (!opcao) { r.detalhe = plano.motivo ?? 'nada para ligar'; resultados.push(r); console.log(`FALHA ${tipo}: ${r.detalhe}`); continue; }
    const inicio = Date.now();
    let estado = await (await api.pedir('POST', `/api/codigo/sessoes/${sessao.id}/ao-vivo/iniciar`, { opcao: opcao.id, instalar: Boolean(opcao.instalar) })).json();
    while (Date.now() - inicio < 8 * 60_000 && ['instalando', 'iniciando'].includes(estado.fase)) {
      await espera(1500);
      estado = await (await api.pedir('GET', `/api/codigo/sessoes/${sessao.id}/ao-vivo/estado`)).json();
    }
    r.fase = estado.fase;
    if (estado.tipo === 'console' || tipo === 'python') {
      for (let i = 0; i < 20 && !['terminou', 'falhou'].includes(estado.fase); i++) { await espera(500); estado = await (await api.pedir('GET', `/api/codigo/sessoes/${sessao.id}/ao-vivo/estado`)).json(); }
      r.fase = estado.fase;
      r.ok = estado.fase === 'terminou' && estado.saida.join('').includes(MARCA[tipo]);
      r.detalhe = estado.saida.join('').trim().slice(-200);
    } else if (estado.url) {
      const url = estado.url.replace('localhost', '127.0.0.1');
      let html = '';
      for (let i = 0; i < 90 && !html.includes(MARCA[tipo]); i++) { try { html = await (await fetch(url, { signal: AbortSignal.timeout(20_000) })).text(); } catch { /* compilando */ } if (!html.includes(MARCA[tipo])) await espera(1000); }
      r.ok = html.includes(MARCA[tipo]);
      r.detalhe = r.ok ? `página respondeu em ${url}` : `${estado.mensagem ?? ''} ${html.slice(0, 160)}`;
    } else r.detalhe = `${estado.mensagem ?? ''} ${estado.saida.slice(-3).join(' ')}`.trim().slice(0, 300);
    r.segundos = Math.round((Date.now() - inicio) / 1000);
    await api.pedir('POST', `/api/codigo/sessoes/${sessao.id}/ao-vivo/parar`, {});
    resultados.push(r);
    console.log(`${r.ok ? 'OK   ' : 'FALHA'} ${tipo.padEnd(7)} ${String(r.segundos).padStart(4)} s  ${r.detectado}  (${r.comando ?? 'servidor estático'})  ${r.detalhe}`);
  }
} finally {
  await servidor.parar();
  await espera(1000);
  for (const p of pastas) { try { apagarSeguro(p); } catch (e) { console.log(`não apaguei ${p}: ${e.message}`); } }
}
const saida = arg('saida', null);
if (saida) writeFileSync(saida, JSON.stringify({ em: new Date().toISOString(), sistema: `${process.platform} ${process.arch}`, node: process.versions.node, resultados }, null, 2));
console.log(`\n${resultados.filter((r) => r.ok).length}/${resultados.length} tipos de projeto funcionaram no Ao vivo`);
