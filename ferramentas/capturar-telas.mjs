// Fotografa telas do app num servidor de teste (dados temporários, conta de teste, IA falsa): para revisar o design e
// refazer as capturas da documentação sem dado pessoal nenhum.
//   node ferramentas/capturar-telas.mjs --saida pasta [--telas skills,skills-busca,skill,chat] [--temas claro,escuro] [--larguras 1280,390]
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { subirServidor, abrirNavegador, clienteApi, espera } from '../testes-e2e/ajuda.mjs';

const arg = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const SAIDA = arg('saida', path.join(process.cwd(), 'capturas'));
const TELAS = arg('telas', 'skills,skills-busca,skill').split(',');
const TEMAS = arg('temas', 'claro,escuro').split(',');
const LARGURAS = arg('larguras', '1280,390').split(',').map(Number);
mkdirSync(SAIDA, { recursive: true });

const servidor = await subirServidor();
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Ana Exemplo' });
// algumas skills instaladas, para os dois estados dos cartões aparecerem
for (const id of ['explicar-conceito', 'git-sem-medo', 'front-end']) await api.pedir('POST', `/api/skills/${id}/install`);

const ROTAS = {
  skills: { hash: '#/skills', pronto: `document.querySelector('.sk-quero') !== null` },
  'skills-busca': { hash: '#/skills', pronto: `document.querySelector('.sk-quero') !== null`, depois: `(()=>{ const i = document.querySelector('#skQuero'); i.value = 'quero fazer um site'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()` },
  skill: { hash: '#/skills/sql-na-pratica', pronto: `document.querySelector('.skill-detail h1') !== null` },
  chat: { hash: '#/', pronto: `document.querySelector('#input') !== null` },
};

for (const largura of LARGURAS) {
  for (const tema of TEMAS) {
    const movel = largura < 700;
    const nav = await abrirNavegador({ largura, altura: movel ? 844 : 900, movel });
    try {
      await nav.entrar(servidor.base, conta);
      await nav.avaliar(`localStorage.setItem('gyde-intro-vista','1'); localStorage.setItem('theme', ${JSON.stringify(tema === 'escuro' ? 'dark' : 'light')}); document.documentElement.dataset.theme = ${JSON.stringify(tema === 'escuro' ? 'dark' : 'light')}; 1`);
      for (const nome of TELAS) {
        const r = ROTAS[nome];
        await nav.ir(`${servidor.base}/?r=${Math.random()}${r.hash}`, 1500);
        await nav.avaliar(`document.documentElement.dataset.theme = ${JSON.stringify(tema === 'escuro' ? 'dark' : 'light')}; 1`);
        await nav.esperar(r.pronto, 15_000);
        if (r.depois) await nav.avaliar(r.depois);
        await espera(700);
        const { data } = (await nav.enviar('Page.captureScreenshot', { format: 'png' })).result;
        const arquivo = path.join(SAIDA, `${nome}-${tema}-${largura}.png`);
        writeFileSync(arquivo, Buffer.from(data, 'base64'));
        console.log(arquivo);
      }
      if (nav.erros.length) console.log('erros de JavaScript:', nav.erros.slice(0, 3).join(' | '));
    } finally { await nav.fechar(); }
  }
}
await servidor.parar();
process.exit(0);
