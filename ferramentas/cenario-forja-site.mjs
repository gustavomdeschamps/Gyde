// Cenário "redesenhar um site" da avaliação da Forja (grupo "site"): um site pequeno, feio e com problemas de
// acessibilidade e de celular. Conferido no navegador (Edge sem janela), sem nota dada por IA:
//  - o build do projeto passa (node build.js: confere que todo arquivo citado existe e copia para dist/);
//  - axe-core (WCAG 2.1 A e AA) sem violação séria ou crítica;
//  - cabe em 375 px de largura sem rolagem para o lado;
//  - mudou além da paleta: o CSS sem as cores, ou o HTML, ficou diferente (não é só trocar cores);
//  - o conteúdo continua lá (título, os três serviços e o contato).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { abrirNavegador } from '../testes-e2e/ajuda.mjs';

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const HTML = `<html>
<head>
<meta charset="utf-8">
<title>padaria</title>
<link rel="stylesheet" href="estilo.css">
</head>
<body>
<div class="topo"><font size="6">Padaria Pão Quente</font></div>
<div class="faixa"><img src="logo.svg"> Pães fresquinhos todo dia desde 1998</div>
<div class="servicos">
  <div class="s">Pães artesanais<br><span class="p">Fermentação natural, assados de madrugada.</span></div>
  <div class="s">Bolos sob encomenda<br><span class="p">Aniversários e festas, com 2 dias de antecedência.</span></div>
  <div class="s">Café da manhã<br><span class="p">Das 6h às 10h, com café coado na hora.</span></div>
</div>
<div class="contato">Contato: <a href="tel:+554799999999"><span class="p">clique aqui</span></a> | Rua das Flores, 120</div>
</body>
</html>
`;
const CSS = `body { width: 980px; margin: 0 auto; font-family: Times; background: #ffffff; color: #999999; }
.topo { background: #ffff00; padding: 4px; }
.faixa { background: #eeeeee; color: #cccccc; padding: 10px; }
.faixa img { width: 60px; }
.servicos { display: flex; }
.s { width: 320px; padding: 6px; color: #aaaaaa; }
.p { color: #dddddd; font-size: 11px; }
.contato { color: #bbbbbb; padding: 8px; }
.contato a { color: #eeeeee; }
`;
const BUILD = `// build do site: confere que todo arquivo citado no HTML existe e copia o site para dist/
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync('index.html', 'utf8');
const citados = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]).filter((c) => !c.startsWith('http') && !c.startsWith('tel') && !c.startsWith('mailto'));
const faltando = citados.filter((c) => !fs.existsSync(c));
if (faltando.length) { console.error('Arquivos citados que não existem: ' + faltando.join(', ')); process.exit(1); }
fs.mkdirSync('dist', { recursive: true });
for (const f of ['index.html', ...citados]) { fs.mkdirSync(path.dirname(path.join('dist', f)), { recursive: true }); fs.copyFileSync(f, path.join('dist', f)); }
console.log('build ok: ' + (citados.length + 1) + ' arquivos em dist/');
`;
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#c8873a"/></svg>\n';

// sem as cores (hex, rgb/hsl, nomes comuns) e sem espaços: se só a paleta mudou, isto fica igual
const semCores = (css) => css.replace(/#[0-9a-f]{3,8}\b/gi, '').replace(/\b(rgba?|hsla?|oklch|color-mix)\([^)]*\)/gi, '').replace(/\b(white|black|gray|grey|red|blue|green|yellow|orange|brown|transparent)\b/gi, '').replace(/\s+/g, '');

export function cenarioSite({ criarPasta, ler, rodar }) {
  return {
    id: 'redesenhar-site', grupo: 'site',
    pedido: 'Redesenhe este site da padaria para ficar moderno e profissional: melhore o layout, a tipografia e as cores, deixe acessível (contraste, textos alternativos, idioma) e funcionando bem no celular. Mantenha o conteúdo. No fim, rode o build (npm test).',
    criar() {
      const pkg = JSON.stringify({ name: 'padaria', version: '1.0.0', scripts: { build: 'node build.js', test: 'node build.js' } }, null, 2);
      const pasta = criarPasta({ 'package.json': pkg, 'index.html': HTML, 'estilo.css': CSS, 'build.js': BUILD, 'logo.svg': LOGO });
      return { pasta };
    },
    async conferir({ pasta }) {
      const build = rodar(pasta, 'build.js');
      const html = ler(pasta, 'index.html');
      const css = ler(pasta, 'estilo.css') + [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
      const alemDaPaleta = semCores(css) !== semCores(CSS) || html.replace(/\s+/g, '') !== HTML.replace(/\s+/g, '');
      const conteudo = /Pão Quente/.test(html) && /Pães artesanais/.test(html) && /Bolos sob encomenda/.test(html) && /Café da manhã/.test(html) && /Rua das Flores/.test(html);
      let serias, cabe, detalhe;
      const nav = await abrirNavegador({ largura: 375, altura: 812, movel: true });
      try {
        await nav.ir(pathToFileURL(path.join(pasta, 'index.html')).href, 1200);
        // sem a meta viewport o celular desenha a página com 980 px e encolhe tudo: não conta como caber
        cabe = await nav.avaliar(`/width=device-width/.test(document.querySelector('meta[name="viewport"]')?.content || '') && window.innerWidth <= 376 && document.documentElement.scrollWidth <= 376`);
        await nav.avaliar(`window.axe ? 1 : (eval(${JSON.stringify(AXE)}), 1)`);
        const v = await nav.avaliar(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }).then((r) => r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => x.id))`);
        serias = Array.isArray(v) ? v : null;
        detalhe = serias?.length ? `axe: ${serias.join(', ')}` : '';
      } finally { await nav.fechar(); }
      const checagens = [
        ['build passa', build.status === 0],
        ['axe-core sem violação séria', Array.isArray(serias) && serias.length === 0],
        ['cabe em 375 px', cabe === true],
        ['mudou além da paleta', alemDaPaleta],
        ['conteúdo mantido', conteudo],
      ];
      if (detalhe) checagens.detalhe = detalhe;
      return checagens;
    },
  };
}
