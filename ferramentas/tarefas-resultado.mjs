// Tarefas da medição por RESULTADO (ferramentas/avaliar-resultado.mjs): um conjunto separado, que não foi usado para
// escrever nem para testar as skills (essas estão em cenarios-skills.mjs). A nota de cada resposta não olha o formato:
// roda o código com casos escondidos, executa a consulta SQL num banco de verdade, audita a página com o axe-core num
// navegador, executa os comandos de git num repositório temporário, e assim por diante. Nota = fração das conferências
// escondidas que passaram (0 a 1). Código da resposta só roda numa pasta temporária gyde-*, com tempo limite.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { apagarSeguro } from './limpeza-segura.mjs';

const RAIZ = path.join(import.meta.dirname, '..');
const yaml = createRequire(import.meta.url)('js-yaml');

// ---------- utilidades ----------
export const blocos = (t, linguagens = null) => [...String(t).matchAll(/```([\w+-]*)[^\n]*\n([\s\S]*?)```/g)]
  .filter((m) => !linguagens || linguagens.includes(m[1].toLowerCase())).map((m) => m[2]);
const JS = ['js', 'javascript', 'mjs', 'cjs', 'node', ''];
const pastaTemp = (nome) => mkdtempSync(path.join(tmpdir(), `gyde-res-${nome}-`));
function emPasta(nome, f) { const p = pastaTemp(nome); try { return f(p); } finally { try { apagarSeguro(p); } catch { /* arquivo preso */ } } }
const ENV = () => ({ PATH: process.env.PATH, SystemRoot: process.env.SystemRoot ?? '', TEMP: process.env.TEMP ?? '', TMP: process.env.TMP ?? '' });
const nota = (oks) => (oks.length ? oks.filter(Boolean).length / oks.length : 0);

// A conferência não pode depender do formato: o código pode vir num bloco (```), dentro da linha (`...`) ou solto no
// texto. Estas funções acham o código nos três jeitos.
const emLinha = (t) => [...String(t).replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
/** Trechos que podem ser código: blocos, código dentro da linha e, por fim, cada linha do texto. */
export const trechos = (t) => [...blocos(t), ...emLinha(t), ...String(t).replace(/```[\s\S]*?```/g, '').split('\n')];
/** Do início da função (com o comentário /** logo antes) até a chave que fecha o corpo dela, num texto qualquer. */
function funcaoNoTexto(texto, nome) {
  const m = new RegExp(`(?:async\\s+)?function\\s+${nome}\\b|(?:const|let|var)\\s+${nome}\\s*=`).exec(texto);
  if (!m) return null;
  let inicio = m.index;
  const antes = texto.slice(0, inicio), doc = antes.lastIndexOf('/**');
  if (doc >= 0 && /^\s*\*\/\s*$/m.test(antes.slice(doc)) && !/\n\s*\n/.test(antes.slice(antes.indexOf('*/', doc)))) inicio = doc;
  const abre = texto.indexOf('{', m.index);
  if (abre < 0) return null;
  let nivel = 0;
  for (let i = abre; i < texto.length; i++) {
    if (texto[i] === '{') nivel++;
    else if (texto[i] === '}' && --nivel === 0) return texto.slice(inicio, i + 1);
  }
  return null;
}
/** Código solto no texto (sem bloco): ficam as linhas que parecem código e as de dentro de chaves abertas; sai a prosa. */
function codigoSolto(t) {
  const fora = [];
  let nivel = 0;
  for (const linha of String(t).replace(/```[\w-]*\n?/g, '').split('\n')) {
    const pareceCodigo = /^\s*(import|export|const|let|var|function|async|class|return|if|else|for|while|try|catch|throw|module\.|exports\.|\/\/|\/\*|\*|[})\]])/.test(linha) || /[;{]\s*$/.test(linha);
    if (nivel > 0 || pareceCodigo) {
      fora.push(linha);
      nivel += (linha.match(/[{(]/g) ?? []).length - (linha.match(/[})]/g) ?? []).length;
      if (nivel < 0) nivel = 0;
    }
  }
  return fora.join('\n');
}
/** O código que define a função pedida: o último bloco JS que a define, ou a função achada solta no texto. */
function codigoCom(t, nome) {
  const re = new RegExp(`(function\\s+${nome}\\b|(const|let|var)\\s+${nome}\\s*=|${nome}\\s*\\(.*\\)\\s*\\{)`);
  const bloco = blocos(t, JS).filter((b) => re.test(b)).at(-1);
  if (bloco) return bloco;
  const solto = codigoSolto(t);
  if (re.test(solto)) return solto;
  const fora = funcaoNoTexto(String(t).replace(/```\w*\n?/g, ''), nome);
  // funções auxiliares soltas no texto (definidas fora da principal) vão junto
  if (!fora) return null;
  const aux = [...String(t).matchAll(/(?:async\s+)?function\s+(\w+)/g)].map((x) => x[1]).filter((n) => n !== nome).map((n) => funcaoNoTexto(String(t), n)).filter(Boolean);
  return [...aux, fora].join('\n');
}
// tira import/require de arquivos locais e o "export", e dá require/module ao código CommonJS dentro de um .mjs
const preparar = (codigo) => codigo
  .replace(/^\s*import\s+[^;\n]*from\s+['"]\.{1,2}\/[^'"]*['"];?\s*$/gm, '')
  .replace(/^\s*(const|let|var)\s+[^=\n]+=\s*require\(['"]\.{1,2}\/[^'"]*['"]\);?\s*$/gm, '')
  .replace(/^\s*export\s+default\s+(?=function|class|async)/gm, '')
  .replace(/^\s*export\s+default\s+[\w$]+;?\s*$/gm, '')
  .replace(/^\s*export\s+(?=(async\s+)?function|const|let|var|class)/gm, '')
  .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '');
const PRELUDIO = "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url); const module = { exports: {} }; const exports = module.exports;\nimport __a from 'node:assert/strict';\n";

/** Roda o código e os casos escondidos (cada um isolado); devolve as conferências que passaram. */
function casosJs(codigo, casos, { tempo = 20_000, antes = '' } = {}) {
  if (!codigo) return casos.map(() => false);
  return emPasta('js', (p) => {
    const script = `${PRELUDIO}${antes}\n${preparar(codigo)}\n;const __casos = [${casos.map((c) => `async () => { ${c} }`).join(',\n')}];\nconst __r = [];\nfor (const f of __casos) { try { await Promise.race([f(), new Promise((_, n) => setTimeout(() => n(new Error('tempo')), 8000))]); __r.push(true); } catch { __r.push(false); } }\nconsole.log('__RES__' + JSON.stringify(__r)); process.exit(0);`;
    writeFileSync(path.join(p, 'principal.mjs'), script);
    const r = spawnSync(process.execPath, ['principal.mjs'], { cwd: p, timeout: tempo, encoding: 'utf8', env: ENV() });
    const m = String(r.stdout).match(/__RES__(\[.*\])/);
    return m ? JSON.parse(m[1]) : casos.map(() => false);
  });
}

// ---------- navegador (páginas HTML): axe-core e medidas de layout ----------
let navegador = null;
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
async function nav() {
  if (!navegador) { const { abrirNavegador } = await import('../testes-e2e/ajuda.mjs'); navegador = await abrirNavegador({ largura: 1200, altura: 900 }); }
  return navegador;
}
export async function fecharNavegador() { if (navegador) { await navegador.fechar(); navegador = null; } }
// Uma aba só, usada por uma conferência de cada vez: com várias respostas sendo conferidas juntas, uma trocaria a página
// no meio da medida da outra (aconteceu: notas de página instáveis e "axe is already running").
let filaNavegador = Promise.resolve();
function naVez(f) { const vez = filaNavegador.then(f, f); filaNavegador = vez.catch(() => {}); return vez; }
function paginaDaResposta(t) {
  // em bloco ```html ou solta no texto (do <!doctype ou <html até </html>)
  const solta = String(t).match(/<!doctype html[\s\S]*?<\/html>|<html[\s>][\s\S]*?<\/html>/i)?.[0];
  const html = blocos(t, ['html']).sort((a, b) => b.length - a.length)[0] ?? solta;
  if (!html) return null;
  const css = blocos(t, ['css']).join('\n');
  let doc = /<html[\s>]/i.test(html) ? html : `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Teste</title></head><body>${html}</body></html>`;
  if (css) doc = doc.includes('</head>') ? doc.replace('</head>', `<style>${css}</style></head>`) : `<style>${css}</style>${doc}`;
  return doc.replace(/<script\b[\s\S]*?<\/script>/gi, ''); // scripts da resposta não rodam: só a página
}
async function abrirPagina(doc, largura) {
  const n = await nav();
  await n.enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: 900, deviceScaleFactor: 1, mobile: largura < 500 });
  await n.enviar('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(doc).toString('base64') });
  // espera a página e as fontes assentarem antes de medir (com 500 ms a medida às vezes saía antes do layout)
  await n.esperar(`document.readyState === "complete"`, 5000); await new Promise((r) => setTimeout(r, 900));
  return n;
}
async function axeSemErroGrave(doc) {
  const n = await abrirPagina(doc, 1200);
  await n.avaliar(`window.axe ? 1 : (eval(${JSON.stringify(AXE)}), 1)`);
  const v = await n.avaliar(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }).then((r) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id))`);
  return Array.isArray(v) && v.length === 0;
}
async function semRolagemHorizontal(doc, largura = 375) {
  const n = await abrirPagina(doc, largura);
  return Boolean(await n.avaliar(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`));
}

// ---------- SQL ----------
function bancoCom(sql) { const db = new DatabaseSync(':memory:'); db.exec(sql); return db; }
const ultimaConsulta = (t) => {
  const sql = trechos(t).join('\n');
  const comandos = sql.split(/;\s*(\n|$)/).map((x) => x.trim()).filter((x) => /^(WITH|SELECT)\b/i.test(x));
  return comandos.at(-1) ?? null;
};

// ---------- git ----------
const git = (p, ...a) => spawnSync('git', ['-c', 'user.name=Teste', '-c', 'user.email=teste@exemplo.invalid', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...a], { cwd: p, encoding: 'utf8' });
function argsDaLinha(linha) { return [...linha.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]); }
function rodarComandosGit(t, p) {
  const linhas = [...new Set(trechos(t).flatMap((b) => b.split('\n')))].map((l) => l.replace(/^\s*[$>]\s*/, '').replace(/\s+#.*$/, '').trim())
    .filter((l) => /^git\s/.test(l) && !/\b(push|pull|fetch|clone|remote)\b|--force|-f\b/.test(l) && !/[<>]/.test(l));
  for (const l of linhas) git(p, ...argsDaLinha(l).slice(1));
  return linhas.length;
}

// ---------- tarefas ----------
// skills: as que são do assunto (cada uma é medida COM ela contra o SEM); agentes: idem.
export const TAREFAS = [
  {
    id: 'regex-celular', skills: ['regex'], agentes: [],
    pedido: 'Preciso de uma expressão regular em JavaScript que aceite celular brasileiro como (11) 91234-5678 ou 11912345678 e recuse o resto.',
    async verificar(t) {
      const re = (() => { for (const b of trechos(t)) { const m = b.match(/\/((?:\\\/|[^/\n])+)\/([gimsuy]*)/); if (m) try { return new RegExp(m[1], m[2].replace('g', '')); } catch { /* inválida */ } } return null; })();
      if (!re) return 0;
      const sim = ['(11) 91234-5678', '11912345678', '(21) 99876-5432'], nao = ['1191234567', '(11) 1234-5678', '11 91234-56789', 'abc11912345678', '(11)912345678x'];
      return nota([...sim.map((x) => re.test(x)), ...nao.map((x) => !re.test(x))]);
    },
  },
  {
    id: 'lig4', skills: ['logica-de-jogo'], agentes: [],
    pedido: "Escreva em JavaScript a função vencedor(grade) de um jogo de Lig 4: grade é uma matriz de 6 linhas e 7 colunas com 'X', 'O' ou null. Devolve 'X' ou 'O' se alguém tem 4 em sequência (horizontal, vertical ou diagonal) e null se ninguém tem.",
    async verificar(t) {
      const g = (pos, v) => `(() => { const m = Array.from({ length: 6 }, () => Array(7).fill(null)); for (const [l, c] of ${JSON.stringify(pos)}) m[l][c] = '${v}'; return m; })()`;
      return nota(casosJs(codigoCom(t, 'vencedor'), [
        `__a.equal(vencedor(${g([[5, 0], [5, 1], [5, 2], [5, 3]], 'X')}), 'X');`,
        `__a.equal(vencedor(${g([[2, 6], [3, 6], [4, 6], [5, 6]], 'O')}), 'O');`,
        `__a.equal(vencedor(${g([[5, 0], [4, 1], [3, 2], [2, 3]], 'X')}), 'X');`,
        `__a.equal(vencedor(${g([[2, 0], [3, 1], [4, 2], [5, 3]], 'O')}), 'O');`,
        `__a.equal(vencedor(${g([[5, 0], [5, 1], [5, 2]], 'X')}) ?? null, null);`,
        `__a.equal(vencedor(Array.from({ length: 6 }, () => Array(7).fill(null))) ?? null, null);`,
      ]));
    },
  },
  {
    id: 'refatorar-frete', skills: ['refatorador'], agentes: [],
    pedido: "Refatore mantendo exatamente o mesmo comportamento:\n```js\nfunction frete(p, r, e) { var v; if (r == 'sul') { if (p <= 1) { v = 10 } else { v = 10 + (p - 1) * 4 } } else { if (r == 'norte') { if (p <= 1) { v = 18 } else { v = 18 + (p - 1) * 6 } } else { if (p <= 1) { v = 14 } else { v = 14 + (p - 1) * 5 } } } if (e) { v = v * 1.5 } return Math.round(v * 100) / 100 }\n```",
    async verificar(t) {
      const orig = (p, r, e) => { let v; if (r == 'sul') { v = p <= 1 ? 10 : 10 + (p - 1) * 4; } else if (r == 'norte') { v = p <= 1 ? 18 : 18 + (p - 1) * 6; } else { v = p <= 1 ? 14 : 14 + (p - 1) * 5; } if (e) v *= 1.5; return Math.round(v * 100) / 100; };
      const casos = [];
      for (const p of [0.5, 1, 2.5, 7]) for (const r of ['sul', 'norte', 'centro']) for (const e of [true, false]) casos.push(`__a.equal(frete(${p}, '${r}', ${e}), ${orig(p, r, e)});`);
      return nota(casosJs(codigoCom(t, 'frete'), casos));
    },
  },
  {
    id: 'testes-cupom', skills: ['testes-automatizados'], agentes: ['testador'],
    pedido: "Escreva testes com node:test para a função aplicarCupom(preco, cupom), que está em cupom.js. Regras: cupom 'DEZ' tira 10% do preço; 'METADE' tira 50%; sem cupom (null) o preço não muda; cupom desconhecido lança Error('Cupom inválido'); preço negativo lança Error('Preço inválido').",
    async verificar(t) {
      const teste = blocos(t, JS).find((b) => /node:test|\btest\(|\bit\(/.test(b));
      if (!teste) return 0;
      const certo = "function aplicarCupom(p, c) { if (p < 0) throw new Error('Preço inválido'); if (c == null) return p; if (c === 'DEZ') return p * 0.9; if (c === 'METADE') return p * 0.5; throw new Error('Cupom inválido'); }";
      const mutantes = [
        "function aplicarCupom(p, c) { if (c == null) return p; if (c === 'DEZ') return p * 0.9; if (c === 'METADE') return p * 0.5; throw new Error('Cupom inválido'); }",
        "function aplicarCupom(p, c) { if (p < 0) throw new Error('Preço inválido'); if (c == null) return p; if (c === 'DEZ') return p * 0.8; if (c === 'METADE') return p * 0.5; throw new Error('Cupom inválido'); }",
        "function aplicarCupom(p, c) { if (p < 0) throw new Error('Preço inválido'); if (c === 'DEZ') return p * 0.9; if (c === 'METADE') return p * 0.5; return p; }",
      ];
      const corpo = preparar(teste).replace(/^\s*import\s+.*['"]node:(test|assert)(\/strict)?['"];?\s*$/gm, '').replace(/^\s*(const|let|var)\s+[^=\n]+=\s*require\(['"](node:)?(test|assert)(\/strict)?['"]\);?\s*$/gm, '');
      const rodar = (impl) => emPasta('t', (p) => {
        writeFileSync(path.join(p, 'teste.mjs'), `import { test, it, describe } from 'node:test';\nimport assert from 'node:assert/strict';\n${impl}\n${corpo}`);
        return spawnSync(process.execPath, ['--test', 'teste.mjs'], { cwd: p, timeout: 30_000, encoding: 'utf8', env: ENV() }).status === 0;
      });
      return nota([rodar(certo), ...mutantes.map((m) => !rodar(m))]);
    },
  },
  {
    id: 'pares-rapido', skills: ['desempenho-codigo'], agentes: [],
    pedido: 'Escreva em JavaScript a função contarPares(lista, alvo), que conta quantos pares de posições (i < j) têm soma igual a alvo. Precisa responder em menos de 1 segundo com 200 mil números.',
    async verificar(t) {
      return nota(casosJs(codigoCom(t, 'contarPares'), [
        '__a.equal(contarPares([1, 2, 3, 4], 5), 2);', '__a.equal(contarPares([2, 2, 2], 4), 3);', '__a.equal(contarPares([], 3), 0);', '__a.equal(contarPares([1, -1, 0, 0], 0), 2);',
        'const l = Array.from({ length: 200000 }, (_, i) => i % 1000); const t0 = performance.now(); const r = contarPares(l, 999); __a.ok(performance.now() - t0 < 1500); __a.equal(r, 20000000);',
      ], { tempo: 30_000 }));
    },
  },
  {
    id: 'erro-itens', skills: ['explicador-erros'], agentes: ['depurador'],
    pedido: "Dá TypeError: Cannot read properties of undefined (reading 'reduce') quando o pedido ainda não tem itens. Como resolvo?\n```js\nfunction totalPedido(pedido) {\n  return pedido.itens.reduce((soma, item) => soma + item.preco * item.qtd, 0);\n}\n```",
    async verificar(t) {
      return nota(casosJs(codigoCom(t, 'totalPedido'), [
        '__a.equal(totalPedido({}), 0);', '__a.equal(totalPedido({ itens: [] }), 0);',
        '__a.equal(totalPedido({ itens: [{ preco: 10, qtd: 2 }, { preco: 5, qtd: 1 }] }), 25);', '__a.equal(totalPedido({ itens: null }), 0);',
      ]));
    },
  },
  {
    id: 'revisar-media', skills: ['revisor-codigo'], agentes: ['depurador'],
    pedido: 'Revise e me devolva a função corrigida:\n```js\nfunction mediaAprovados(alunos) {\n  let soma = 0, n = 0;\n  for (let i = 1; i <= alunos.length; i++) {\n    if (alunos[i].nota >= 6) { soma += alunos[i].nota; n++; }\n  }\n  return soma / n;\n}\n```',
    async verificar(t) {
      return nota(casosJs(codigoCom(t, 'mediaAprovados'), [
        '__a.equal(mediaAprovados([{ nota: 8 }, { nota: 4 }, { nota: 6 }]), 7);', '__a.equal(mediaAprovados([{ nota: 10 }]), 10);',
        '__a.ok([0, null].includes(mediaAprovados([])));', '__a.ok([0, null].includes(mediaAprovados([{ nota: 2 }])));',
      ]));
    },
  },
  {
    id: 'estatistica-notas', skills: ['estatistica-basica'], agentes: [],
    pedido: 'As notas da turma foram 7, 8, 8, 9, 10, 3 e 8. Quais são a média, a mediana e a moda?',
    async verificar(t) {
      return nota([/7[,.]57|7[,.]6\b/.test(t), /mediana[^0-9]{0,60}\b8\b/i.test(t), /moda[^0-9]{0,60}\b8\b/i.test(t)]);
    },
  },
  {
    id: 'csv-aspas', skills: ['json-csv'], agentes: [],
    pedido: "Escreva em JavaScript a função csvParaObjetos(texto): o CSV usa ';' como separador, a primeira linha é o cabeçalho, e um campo entre aspas pode ter ';' ou aspas duplicadas (\"\"). Devolve um array de objetos.",
    async verificar(t) {
      const csv = 'nome;cidade;obs\\nAna;São Paulo;\\"Gosta de \\"\\"café\\"\\"; e chá\\"\\nBeto;Recife;\\n';
      return nota(casosJs(codigoCom(t, 'csvParaObjetos'), [
        `const r = csvParaObjetos("${csv}"); __a.equal(r.length, 2);`,
        `const r = csvParaObjetos("${csv}"); __a.equal(r[0].obs, 'Gosta de "café"; e chá');`,
        `const r = csvParaObjetos("${csv}"); __a.equal(r[1].cidade, 'Recife'); __a.equal(r[1].obs, '');`,
        "const r = csvParaObjetos('a;b\\n1;2'); __a.deepEqual(r, [{ a: '1', b: '2' }]);",
      ]));
    },
  },
  {
    id: 'limpar-clientes', skills: ['limpar-dados'], agentes: [],
    pedido: "Escreva em JavaScript a função limparClientes(lista): cada cliente tem { nome, email, cidade }. Remova duplicados pelo e-mail (sem diferenciar maiúsculas e ignorando espaços nas pontas), mantendo o primeiro; deixe a cidade sem espaços nas pontas e com cada palavra começando em maiúscula (o resto minúsculo).",
    async verificar(t) {
      const l = JSON.stringify([{ nome: 'Ana', email: 'Ana@X.com ', cidade: ' são paulo' }, { nome: 'Ana 2', email: 'ana@x.com', cidade: 'Rio' }, { nome: 'Bia', email: 'bia@x.com', cidade: 'BELO HORIZONTE ' }]);
      return nota(casosJs(codigoCom(t, 'limparClientes'), [
        `__a.equal(limparClientes(${l}).length, 2);`, `__a.equal(limparClientes(${l})[0].nome, 'Ana');`,
        `__a.equal(limparClientes(${l})[0].cidade, 'São Paulo');`, `__a.equal(limparClientes(${l})[1].cidade, 'Belo Horizonte');`,
      ]));
    },
  },
  {
    id: 'sql-gastos', skills: ['sql-na-pratica'], agentes: [],
    pedido: "Tenho as tabelas clientes(id, nome) e pedidos(id, cliente_id, valor). Escreva uma consulta SQL que mostre o nome de cada cliente e o total gasto, só de quem gastou mais de 100, do maior total para o menor.",
    async verificar(t) {
      const q = ultimaConsulta(t);
      if (!q) return 0;
      try {
        const db = bancoCom("CREATE TABLE clientes(id INTEGER PRIMARY KEY, nome TEXT); CREATE TABLE pedidos(id INTEGER PRIMARY KEY, cliente_id INT, valor REAL); INSERT INTO clientes VALUES (1,'Ana'),(2,'Beto'),(3,'Caio'),(4,'Duda'); INSERT INTO pedidos(cliente_id, valor) VALUES (1,80),(1,50),(2,40),(3,300),(4,100);");
        const r = db.prepare(q).all().map((x) => Object.values(x));
        return nota([r.length === 2, r[0]?.includes('Caio') && r[0]?.includes(300), r[1]?.includes('Ana') && r[1]?.includes(130)]);
      } catch { return 0; }
    },
  },
  {
    id: 'sql-nunca-vendido', skills: ['sql-na-pratica'], agentes: [],
    pedido: 'Com as tabelas produtos(id, nome) e vendas(id, produto_id, qtd), como listo o nome dos produtos que nunca foram vendidos?',
    async verificar(t) {
      const q = ultimaConsulta(t);
      if (!q) return 0;
      try {
        const db = bancoCom("CREATE TABLE produtos(id INTEGER PRIMARY KEY, nome TEXT); CREATE TABLE vendas(id INTEGER PRIMARY KEY, produto_id INT, qtd INT); INSERT INTO produtos VALUES (1,'Caneta'),(2,'Lápis'),(3,'Borracha'); INSERT INTO vendas(produto_id, qtd) VALUES (1,2),(1,1),(NULL,5);");
        const nomes = db.prepare(q).all().map((x) => Object.values(x)[0]).sort();
        return nota([nomes.length === 2, nomes.join() === 'Borracha,Lápis']);
      } catch { return 0; }
    },
  },
  {
    id: 'modelar-biblioteca', skills: ['modelagem-banco'], agentes: [],
    pedido: 'Escreva o SQL (SQLite) das tabelas de uma biblioteca: livros(id, titulo), leitores(id, nome, email) e emprestimos(id, livro_id, leitor_id, data). O e-mail do leitor não pode repetir e um empréstimo só pode existir com livro e leitor existentes.',
    async verificar(t) {
      const ddl = blocos(t, ['sql', '']).find((b) => /CREATE\s+TABLE/i.test(b)) ?? ((String(t).match(/CREATE\s+TABLE[\s\S]*?\);/gi) ?? []).join('\n') || null);
      if (!ddl) return 0;
      const db = new DatabaseSync(':memory:');
      try { db.exec('PRAGMA foreign_keys = ON;'); db.exec(ddl); } catch { return 0; }
      const tenta = (sql) => { try { db.exec(sql); return true; } catch { return false; } };
      const ok1 = tenta("INSERT INTO livros(id, titulo) VALUES (1, 'Dom Casmurro'); INSERT INTO leitores(id, nome, email) VALUES (1, 'Ana', 'ana@x.com');");
      return nota([ok1, !tenta("INSERT INTO leitores(id, nome, email) VALUES (2, 'Outra', 'ana@x.com');"),
        tenta("INSERT INTO emprestimos(livro_id, leitor_id, data) VALUES (1, 1, '2026-11-17');"),
        !tenta("INSERT INTO emprestimos(livro_id, leitor_id, data) VALUES (99, 1, '2026-11-17');")]);
    },
  },
  {
    id: 'indice-pedidos', skills: ['indices-consultas'], agentes: [],
    pedido: 'No SQLite, a consulta SELECT * FROM pedidos WHERE loja_id = ? AND criado_em >= ? ORDER BY criado_em está lenta (tabela pedidos(id, loja_id, criado_em, total), 2 milhões de linhas). Que índice eu crio?',
    async verificar(t) {
      const idx = String(t).match(/CREATE\s+(UNIQUE\s+)?INDEX[^;`\n]+/gi) ?? [];
      if (!idx.length) return 0;
      try {
        const db = bancoCom('CREATE TABLE pedidos(id INTEGER PRIMARY KEY, loja_id INT, criado_em TEXT, total REAL);');
        for (const i of idx) db.exec(i);
        const plano = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM pedidos WHERE loja_id = 1 AND criado_em >= \'2026-01-01\' ORDER BY criado_em').all().map((x) => x.detail).join(' | ');
        return nota([/USING (COVERING )?INDEX/.test(plano), !/TEMP B-TREE/.test(plano)]);
      } catch { return 0; }
    },
  },
  {
    id: 'vender-estoque', skills: ['banco-no-codigo'], agentes: [],
    pedido: "Escreva em JavaScript a função vender(db, produtoId, qtd) usando o node:sqlite (db é um DatabaseSync já aberto) com as tabelas produtos(id, estoque) e vendas(id, produto_id, qtd). Ela registra a venda e diminui o estoque; se não houver estoque suficiente, lança Error('Estoque insuficiente') e não registra nada.",
    async verificar(t) {
      const antes = "import { DatabaseSync as __Db } from 'node:sqlite'; const __novo = () => { const d = new __Db(':memory:'); d.exec('CREATE TABLE produtos(id INTEGER PRIMARY KEY, estoque INT); CREATE TABLE vendas(id INTEGER PRIMARY KEY, produto_id INT, qtd INT); INSERT INTO produtos VALUES (1, 5);'); return d; };";
      return nota(casosJs(codigoCom(t, 'vender'), [
        "const d = __novo(); await vender(d, 1, 3); __a.equal(d.prepare('SELECT estoque FROM produtos WHERE id = 1').get().estoque, 2); __a.equal(d.prepare('SELECT COUNT(*) n FROM vendas').get().n, 1);",
        "const d = __novo(); await __a.rejects(async () => vender(d, 1, 9), /Estoque insuficiente/);",
        "const d = __novo(); try { await vender(d, 1, 9); } catch {} __a.equal(d.prepare('SELECT estoque FROM produtos WHERE id = 1').get().estoque, 5); __a.equal(d.prepare('SELECT COUNT(*) n FROM vendas').get().n, 0);",
        "const d = __novo(); await vender(d, 1, 5); __a.equal(d.prepare('SELECT estoque FROM produtos WHERE id = 1').get().estoque, 0);",
      ], { antes }));
    },
  },
  {
    id: 'injecao-busca', skills: ['injecao-xss'], agentes: ['seguranca'],
    pedido: "Corrija as duas funções (as duas rodam no servidor, em Node, sem navegador; o banco é node:sqlite):\n```js\nfunction buscarUsuario(db, nome) {\n  return db.prepare(\"SELECT id, nome FROM usuarios WHERE nome = '\" + nome + \"'\").all();\n}\nfunction cartaoComentario(texto) {\n  return '<p class=\"comentario\">' + texto + '</p>';\n}\n```",
    async verificar(t) {
      const codigo = [codigoCom(t, 'buscarUsuario'), codigoCom(t, 'cartaoComentario')].filter((c, i, a) => c && a.indexOf(c) === i).join('\n');
      const antes = "import { DatabaseSync as __Db } from 'node:sqlite'; const __db = new __Db(':memory:'); __db.exec(\"CREATE TABLE usuarios(id INTEGER PRIMARY KEY, nome TEXT); INSERT INTO usuarios(nome) VALUES ('ana'),('beto');\");";
      return nota(casosJs(codigo || null, [
        "__a.equal(buscarUsuario(__db, 'ana').length, 1);", "__a.equal(buscarUsuario(__db, \"x' OR '1'='1\").length, 0);",
        "const h = cartaoComentario('<img src=x onerror=alert(1)>'); __a.ok(!/<img/i.test(h)); __a.ok(/&lt;img/.test(h));",
        "__a.ok(/Tom &amp; Jerry|Tom &#38; Jerry/.test(cartaoComentario('Tom & Jerry')));",
      ], { antes }));
    },
  },
  {
    id: 'hash-senha', skills: ['senhas-seguras'], agentes: ['seguranca'],
    pedido: 'Escreva em JavaScript, só com o módulo node:crypto, as funções criarHash(senha) e conferirSenha(senha, hashSalvo) para guardar senhas de usuários. Podem ser async.',
    async verificar(t) {
      const c1 = codigoCom(t, 'criarHash'), c2 = codigoCom(t, 'conferirSenha');
      const codigo = [c1, c2].filter((c, i, a) => c && a.indexOf(c) === i).join('\n');
      return nota(casosJs(codigo || null, [
        "const h = await criarHash('segredo123'); __a.ok(!String(h).includes('segredo123'));",
        "__a.notEqual(String(await criarHash('segredo123')), String(await criarHash('segredo123')));",
        "const h = await criarHash('segredo123'); __a.equal(await conferirSenha('segredo123', h), true);",
        "const h = await criarHash('segredo123'); __a.equal(await conferirSenha('errada', h), false);",
        "const s = String(await criarHash('x')); __a.ok(!/^[0-9a-f]{32}$|^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(s), 'hash rápido sem sal');",
      ]));
    },
  },
  {
    id: 'pedido-do-dono', skills: ['revisao-seguranca'], agentes: ['seguranca'],
    pedido: "Revise esta função de uma API e me devolva a versão corrigida (o usuário logado só pode ver os próprios pedidos):\n```js\nfunction pedidoDe(db, usuarioLogadoId, pedidoId) {\n  return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId) ?? null;\n}\n```",
    async verificar(t) {
      const antes = "import { DatabaseSync as __Db } from 'node:sqlite'; const __db = new __Db(':memory:'); __db.exec('CREATE TABLE pedidos(id INTEGER PRIMARY KEY, usuario_id INT, total REAL); INSERT INTO pedidos VALUES (1, 10, 50), (2, 20, 80);');";
      return nota(casosJs(codigoCom(t, 'pedidoDe'), [
        '__a.equal((await pedidoDe(__db, 10, 1))?.total, 50);',
        'let r; try { r = await pedidoDe(__db, 10, 2); } catch { r = null; } __a.ok(r == null || r === false);',
      ], { antes }));
    },
  },
  {
    id: 'git-branch-errada', skills: ['git-sem-medo'], agentes: [],
    pedido: "Fiz o último commit ('adiciona busca') direto na main, mas ele devia estar numa branch nova chamada busca. Não enviei nada para o GitHub ainda. Quais comandos eu rodo?",
    async verificar(t) {
      return emPasta('git', (p) => {
        git(p, 'init', '-q'); writeFileSync(path.join(p, 'a.txt'), '1'); git(p, 'add', '.'); git(p, 'commit', '-qm', 'base');
        writeFileSync(path.join(p, 'b.txt'), '2'); git(p, 'add', '.'); git(p, 'commit', '-qm', 'adiciona busca');
        if (!rodarComandosGit(t, p)) return 0;
        const main = git(p, 'log', '--format=%s', 'main').stdout.trim().split('\n');
        const busca = git(p, 'log', '--format=%s', 'busca').stdout.trim().split('\n');
        return nota([busca[0] === 'adiciona busca', main[0] === 'base', existsSync(path.join(p, 'b.txt')) || git(p, 'show', 'busca:b.txt').status === 0]);
      });
    },
  },
  {
    id: 'git-env-vazado', skills: ['segredos-env'], agentes: ['seguranca'],
    pedido: 'Commitei sem querer o arquivo .env (com chaves) no meu repositório local. Ainda não enviei. Quero que o git pare de acompanhar o .env e que ele nunca mais entre num commit, mas sem apagar o arquivo do meu computador. Quais comandos?',
    async verificar(t) {
      return emPasta('git', (p) => {
        git(p, 'init', '-q'); writeFileSync(path.join(p, 'app.js'), '1'); writeFileSync(path.join(p, '.env'), 'CHAVE=teste'); git(p, 'add', '.'); git(p, 'commit', '-qm', 'tudo');
        // o .gitignore também pode ser criado por "echo .env >> .gitignore": a resposta diz isso fora do git
        const ignora = /echo\s+['"]?\.env['"]?\s*>>\s*\.gitignore|\.gitignore[\s\S]{0,200}\.env/.test(t);
        if (ignora) writeFileSync(path.join(p, '.gitignore'), '.env\n', { flag: 'a' });
        if (!rodarComandosGit(t, p) && !ignora) return 0;
        git(p, 'add', '-A'); git(p, 'commit', '-qm', 'depois');
        return nota([existsSync(path.join(p, '.env')), !git(p, 'ls-files').stdout.split('\n').includes('.env'), git(p, 'check-ignore', '.env').status === 0]);
      });
    },
  },
  {
    id: 'cron-relatorio', skills: ['tarefas-agendadas'], agentes: [],
    pedido: 'No Linux, quero rodar /opt/app/relatorio.sh de segunda a sexta às 7h30 e guardar a saída em /var/log/relatorio.log. Como fica no cron?',
    async verificar(t) {
      const linha = trechos(t).flatMap((b) => b.split('\n')).map((l) => l.trim()).find((l) => /relatorio\.sh/.test(l) && /^[\d*]/.test(l));
      if (!linha) return 0;
      const c = linha.split(/\s+/);
      return nota([c[0] === '30', c[1] === '7', c[2] === '*' && c[3] === '*', /^(1-5|MON-FRI|mon-fri)$/.test(c[4]), /\/var\/log\/relatorio\.log/.test(linha) && />>?/.test(linha)]);
    },
  },
  {
    id: 'ps-maiores', skills: ['linha-de-comando'], agentes: [],
    pedido: 'No PowerShell, como vejo o nome dos 3 maiores arquivos da pasta atual, contando as subpastas?',
    async verificar(t) {
      if (process.platform !== 'win32') return null;
      const cmd = trechos(t).flatMap((b) => b.split('\n')).map((l) => l.replace(/^\s*(PS[^>]*>)\s*/, '').trim()).find((l) => /Get-ChildItem|\bgci\b|\bls\b|\bdir\b/i.test(l));
      if (!cmd || /Remove-|\bdel\b|\brm\b|Format-Volume|Set-|Stop-|Invoke-|iex|Start-Process/i.test(cmd)) return 0;
      return emPasta('ps', (p) => {
        mkdirSync(path.join(p, 'sub'));
        const tam = { 'grande.bin': 9000, 'sub/medio.bin': 6000, 'pequeno3.txt': 4000, 'nanico.txt': 100, 'sub/minimo.txt': 50 };
        for (const [n, b] of Object.entries(tam)) writeFileSync(path.join(p, n), 'x'.repeat(b));
        const r = spawnSync('powershell', ['-NoProfile', '-Command', cmd], { cwd: p, timeout: 30_000, encoding: 'utf8' });
        const s = String(r.stdout);
        return nota([/grande\.bin/.test(s), /medio\.bin/.test(s), /pequeno3\.txt/.test(s), !/nanico|minimo/.test(s)]);
      });
    },
  },
  {
    id: 'organizar-fotos', skills: ['scripts-arquivos'], agentes: [],
    pedido: 'Escreva um script Python organizar.py que recebe uma pasta como primeiro argumento e move cada .jpg dela para uma subpasta com o ano da data de modificação do arquivo (ex.: 2023/foto.jpg). Sem mais nenhum argumento, ele só mostra o que faria; com --executar, ele move de verdade.',
    async verificar(t) {
      const py = blocos(t, ['python', 'py']).sort((a, b) => b.length - a.length)[0];
      if (!py) return 0;
      return emPasta('py', (p) => {
        const fotos = path.join(p, 'fotos'); mkdirSync(fotos);
        writeFileSync(path.join(fotos, 'a.jpg'), 'a'); writeFileSync(path.join(fotos, 'b.jpg'), 'b'); writeFileSync(path.join(fotos, 'nota.txt'), 'n');
        utimesSync(path.join(fotos, 'a.jpg'), new Date('2021-05-01'), new Date('2021-05-01'));
        utimesSync(path.join(fotos, 'b.jpg'), new Date('2023-08-01'), new Date('2023-08-01'));
        writeFileSync(path.join(p, 'organizar.py'), py);
        // saída em UTF-8, como no terminal do Windows (pelo cano do teste o Python usaria cp1252 e quebraria em acentos e setas; o -I ignora PYTHONIOENCODING)
        const rodar = (...a) => spawnSync('python', ['-I', '-X', 'utf8', 'organizar.py', ...a], { cwd: p, timeout: 30_000, encoding: 'utf8', env: ENV() });
        rodar(fotos);
        const nadaMudou = existsSync(path.join(fotos, 'a.jpg')) && existsSync(path.join(fotos, 'b.jpg'));
        rodar(fotos, '--executar');
        return nota([nadaMudou, existsSync(path.join(fotos, '2021', 'a.jpg')), existsSync(path.join(fotos, '2023', 'b.jpg')), existsSync(path.join(fotos, 'nota.txt'))]);
      });
    },
  },
  {
    id: 'manifest-receitas', skills: ['app-celular'], agentes: [],
    pedido: 'Quero que meu site "Receitas da Vó" possa ser instalado no celular. Escreva o arquivo de manifest dele.',
    async verificar(t) {
      const solto = String(t).includes('{') ? String(t).slice(String(t).indexOf('{'), String(t).lastIndexOf('}') + 1) : '';
      const j = [...blocos(t, ['json', 'webmanifest', '']), solto].map((b) => { try { return JSON.parse(b); } catch { return null; } }).find((x) => x && typeof x === 'object' && !Array.isArray(x));
      if (!j) return 0;
      const tamanhos = (j.icons ?? []).flatMap((i) => String(i.sizes ?? '').split(/\s+/));
      return nota([Boolean(j.name || j.short_name), Boolean(j.start_url), ['standalone', 'fullscreen', 'minimal-ui'].includes(j.display), tamanhos.includes('192x192'), tamanhos.includes('512x512')]);
    },
  },
  {
    id: 'versao-semver', skills: ['changelog-versoes'], agentes: [],
    pedido: 'Minha biblioteca está na versão 2.7.3. (a) Se a próxima versão só adiciona uma função nova, sem quebrar nada, qual número ela leva? (b) E se, em vez disso, ela remover uma função que outros projetos usam?',
    async verificar(t) { return nota([/2\.8\.0/.test(t), /3\.0\.0/.test(t)]); },
  },
  {
    id: 'ler-servidor', skills: ['ler-codigo'], agentes: [],
    pedido: "Leia o código e responda: em que porta ele escuta, quantas tarefas aceita no máximo e que código HTTP devolve quando passa do limite?\n```js\nconst http = require('http');\nconst MAX = 25;\nconst tarefas = [];\nhttp.createServer((req, res) => {\n  if (req.method === 'POST') {\n    if (tarefas.length >= MAX) { res.statusCode = 507; return res.end(); }\n    tarefas.push(Date.now()); res.statusCode = 201; return res.end();\n  }\n  res.end(JSON.stringify(tarefas));\n}).listen(process.env.PORTA || 4321);\n```",
    async verificar(t) { return nota([/4321/.test(t), /\b25\b/.test(t), /\b507\b/.test(t)]); },
  },
  {
    id: 'segundo-maior', skills: ['logica-programacao'], agentes: ['iniciante'],
    pedido: 'Sou iniciante. Como faço em JavaScript a função segundoMaior(lista), que devolve o segundo maior valor diferente da lista, ou null se não existir?',
    async verificar(t) {
      return nota(casosJs(codigoCom(t, 'segundoMaior'), [
        '__a.equal(segundoMaior([3, 9, 4, 9]), 4);', '__a.equal(segundoMaior([5, 5, 5]) ?? null, null);', '__a.equal(segundoMaior([]) ?? null, null);',
        '__a.equal(segundoMaior([-2, -8, -5]), -5);', '__a.equal(segundoMaior([1, 2]), 1);',
      ]));
    },
  },
  {
    id: 'nave-movimento', skills: ['jogo-canvas'], agentes: [],
    pedido: "Num jogo em JavaScript, escreva a função atualizar(nave, dt, teclas): nave tem { x, largura }, dt é o tempo do quadro em segundos e teclas é um Set com as teclas apertadas. Com 'ArrowRight' a nave anda 300 pixels por segundo para a direita e com 'ArrowLeft' para a esquerda, sem sair da tela de 800 pixels. Devolve a nave atualizada.",
    async verificar(t) {
      return nota(casosJs(codigoCom(t, 'atualizar'), [
        "const n = atualizar({ x: 100, largura: 40 }, 0.5, new Set(['ArrowRight'])); __a.equal(n.x, 250);",
        "const n = atualizar({ x: 100, largura: 40 }, 0.1, new Set(['ArrowLeft'])); __a.equal(n.x, 70);",
        "const n = atualizar({ x: 790, largura: 40 }, 1, new Set(['ArrowRight'])); __a.equal(n.x, 760);",
        "const n = atualizar({ x: 5, largura: 40 }, 1, new Set(['ArrowLeft'])); __a.equal(n.x, 0);",
        "const n = atualizar({ x: 100, largura: 40 }, 1, new Set()); __a.equal(n.x, 100);",
      ]));
    },
  },
  {
    id: 'api-tarefas', skills: ['api-rest', 'node-express'], agentes: [],
    pedido: 'Faça um servidor Express (CommonJS) de tarefas guardadas em memória: GET /tarefas lista, POST /tarefas cria (o campo titulo é obrigatório) e DELETE /tarefas/:id apaga. Exporte o app com module.exports = app e não chame app.listen.',
    async verificar(t) {
      const codigo = blocos(t, JS).filter((b) => /express/.test(b) && /module\.exports|exports\./.test(b)).at(-1);
      if (!codigo) return 0;
      return emPasta('api', (p) => {
        writeFileSync(path.join(p, 'app.cjs'), codigo.replace(/^\s*app\.listen\([\s\S]*?\);?\s*$/m, ''));
        writeFileSync(path.join(p, 'teste.cjs'), `
const app = require('./app.cjs'); const a = app.app || app;
const srv = a.listen(0, async () => {
  const base = 'http://127.0.0.1:' + srv.address().port; const r = [];
  const j = (m, u, b) => fetch(base + u, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  try {
    const c = await j('POST', '/tarefas', { titulo: 'estudar' }); r.push(c.status === 201); const corpo = await c.json().catch(() => ({}));
    const id = corpo.id ?? corpo.tarefa?.id;
    r.push((await j('POST', '/tarefas', {})).status === 400);
    const l = await (await j('GET', '/tarefas')).json().catch(() => null); r.push(Array.isArray(l) ? l.length === 1 : Array.isArray(l?.tarefas) && l.tarefas.length === 1);
    r.push((await j('DELETE', '/tarefas/999999')).status === 404);
    r.push([200, 204].includes((await j('DELETE', '/tarefas/' + id)).status));
  } catch (e) { while (r.length < 5) r.push(false); }
  console.log('__RES__' + JSON.stringify(r)); srv.close(); process.exit(0);
});`);
        const r = spawnSync(process.execPath, ['teste.cjs'], { cwd: p, timeout: 30_000, encoding: 'utf8', env: { ...ENV(), NODE_PATH: path.join(RAIZ, 'node_modules') } });
        const m = String(r.stdout).match(/__RES__(\[.*\])/);
        return m ? nota(JSON.parse(m[1])) : 0;
      });
    },
  },
  {
    id: 'buscar-produtos', skills: ['consumir-api'], agentes: [],
    pedido: 'Escreva em JavaScript a função async buscarProdutos(url), que busca a lista de produtos (JSON) com fetch. Se a resposta não for de sucesso, deve lançar um erro com o código HTTP na mensagem; se demorar mais de 3 segundos, deve desistir com erro.',
    async verificar(t) {
      const antes = "import { createServer as __cs } from 'node:http'; const __srv = __cs((q, s) => { if (q.url === '/ok') { s.setHeader('content-type', 'application/json'); return s.end('[{\"id\":1}]'); } if (q.url === '/erro') { s.statusCode = 503; return s.end('x'); } setTimeout(() => s.end('[]'), 6000); }); await new Promise((r) => __srv.listen(0, r)); const __b = 'http://127.0.0.1:' + __srv.address().port; setTimeout(() => process.exit(0), 15000).unref();";
      return nota(casosJs(codigoCom(t, 'buscarProdutos'), [
        "__a.deepEqual(await buscarProdutos(__b + '/ok'), [{ id: 1 }]);",
        "await __a.rejects(() => buscarProdutos(__b + '/erro'), /503/);",
        "const t0 = Date.now(); await __a.rejects(() => buscarProdutos(__b + '/lento')); __a.ok(Date.now() - t0 < 4500);",
      ], { antes, tempo: 30_000 }));
    },
  },
  {
    id: 'workflow-testes', skills: ['github-actions'], agentes: [],
    pedido: 'Quero que o GitHub rode os testes do meu projeto Node (npm test) em todo push e em todo pull request. Escreva o arquivo do workflow.',
    async verificar(t) {
      const y = blocos(t, ['yaml', 'yml', '']).map((b) => { try { return yaml.load(b); } catch { return null; } }).find((x) => x && x.jobs);
      if (!y) return 0;
      const on = y.on ?? y.true ?? {};
      const gatilhos = typeof on === 'string' ? [on] : Array.isArray(on) ? on : Object.keys(on);
      const passos = Object.values(y.jobs).flatMap((j) => j.steps ?? []);
      const usa = (re) => passos.some((s) => re.test(String(s.uses ?? '')));
      const roda = (re) => passos.some((s) => re.test(String(s.run ?? '')));
      return nota([gatilhos.includes('push'), gatilhos.includes('pull_request'), usa(/actions\/checkout/), usa(/actions\/setup-node/), roda(/npm (ci|install)/), roda(/npm (run )?test/)]);
    },
  },
  {
    id: 'rotas-netlify', skills: ['publicar-site'], agentes: [],
    pedido: 'Publiquei no Netlify meu site React com React Router (feito com Vite). A página inicial abre, mas se eu atualizar em /perfil aparece "Page not found". Como resolvo?',
    async verificar(t) { return nota([/\/\*\s+\/index\.html\s+200/.test(t) || /from\s*=\s*"\/\*"[\s\S]{0,80}to\s*=\s*"\/index\.html"[\s\S]{0,80}status\s*=\s*200/.test(t), /_redirects|netlify\.toml/.test(t)]); },
  },
  {
    id: 'jsdoc-tipos', skills: ['documentador'], agentes: ['documentador'],
    pedido: 'Documente esta função com JSDoc, incluindo os tipos dos parâmetros e do retorno:\n```js\nfunction parcelas(total, vezes, juros) {\n  if (vezes < 1) throw new Error(\'Vezes inválidas\');\n  const valor = (total * (1 + juros)) / vezes;\n  return Array.from({ length: vezes }, () => Math.round(valor * 100) / 100);\n}\n```',
    async verificar(t) {
      // a resposta pode trazer a função documentada ou só o comentário para colar em cima dela: os dois valem
      const ORIGINAL = "function parcelas(total, vezes, juros) {\n  if (vezes < 1) throw new Error('Vezes inválidas');\n  const valor = (total * (1 + juros)) / vezes;\n  return Array.from({ length: vezes }, () => Math.round(valor * 100) / 100);\n}";
      const soComentario = [...String(t).matchAll(/\/\*\*[\s\S]*?\*\//g)].map((m) => m[0]).find((c) => /@param/.test(c));
      const codigo = codigoCom(t, 'parcelas') ?? (soComentario ? `${soComentario}\n${ORIGINAL}` : null);
      if (!codigo || !/\/\*\*/.test(codigo)) return 0;
      // os tipos do JSDoc precisam pegar chamadas erradas no TypeScript (checkJs) e aceitar a certa
      return emPasta('doc', (p) => {
        writeFileSync(path.join(p, 'a.js'), `${codigo}\n/** @type {number[]} */\nconst ok = parcelas(100, 3, 0.02);\nparcelas('100', 3, 0.02);\n/** @type {string} */\nconst errado = parcelas(100, 3, 0.02);\n`);
        const r = spawnSync(process.execPath, [path.join(RAIZ, 'node_modules/typescript/bin/tsc'), '--allowJs', '--checkJs', '--noEmit', '--strict', 'a.js'], { cwd: p, timeout: 60_000, encoding: 'utf8' });
        const s = String(r.stdout);
        const linhaDe = (n) => new RegExp(`a\\.js\\(${n},`);
        const total = codigo.split('\n').length;
        return nota([!linhaDe(total + 2).test(s), linhaDe(total + 3).test(s), linhaDe(total + 5).test(s), /@param/.test(codigo) && /@returns?/.test(codigo)]);
      });
    },
  },
  {
    id: 'conflito-precos', skills: ['conflitos-git'], agentes: [],
    pedido: "Deu conflito no merge. Quero manter as duas mudanças: a taxa nova da outra branch e a função de desconto que eu criei. Me mande o arquivo resolvido.\n```js\n<<<<<<< HEAD\nconst TAXA = 0.05;\nfunction comDesconto(v) { return v * 0.9; }\n=======\nconst TAXA = 0.07;\n>>>>>>> main\nfunction comTaxa(v) { return v * (1 + TAXA); }\n```",
    async verificar(t) {
      const solto = codigoSolto(t);
      const codigo = blocos(t, JS).filter((b) => /comTaxa/.test(b) && /comDesconto/.test(b)).at(-1) ?? (/function comTaxa/.test(solto) && /function comDesconto/.test(solto) ? solto : null);
      if (!codigo || /^(<<<<<<<|=======|>>>>>>>)/m.test(codigo)) return 0;
      return nota(casosJs(codigo, ['__a.equal(Math.round(comTaxa(100) * 100) / 100, 107);', '__a.equal(comDesconto(100), 90);', '__a.equal(TAXA, 0.07);']));
    },
  },
  // páginas: auditadas pelo axe-core num navegador e medidas na largura de celular
  {
    id: 'pagina-contato', skills: ['formulario-web', 'acessibilidade-web', 'front-end'], agentes: ['designer'],
    pedido: 'Faça a página HTML (com o CSS junto) de contato de uma padaria: nome, e-mail, mensagem e botão de enviar.',
    async verificar(t) {
      const doc = paginaDaResposta(t);
      if (!doc) return 0;
      return nota([await axeSemErroGrave(doc), await semRolagemHorizontal(doc), /<meta[^>]+viewport/i.test(doc), (doc.match(/<label/gi) ?? []).length >= 3]);
    },
  },
  {
    id: 'pagina-galeria', skills: ['acessibilidade-web'], agentes: ['designer'],
    pedido: 'Arrume esta galeria para quem usa leitor de tela e teclado:\n```html\n<div class="galeria"><div onclick="abrir(1)"><img src="praia.jpg"></div><div onclick="abrir(2)"><img src="serra.jpg"></div></div>\n<div class="fechar" onclick="fechar()">X</div>\n<p style="color:#aaa;background:#fff">Clique numa foto para ampliar</p>\n```',
    async verificar(t) {
      const doc = paginaDaResposta(t);
      if (!doc) return 0;
      return nota([await axeSemErroGrave(doc), !/<div[^>]+onclick/i.test(doc), (doc.match(/<button/gi) ?? []).length >= 2, /<img[^>]+alt="[^"]+"/i.test(doc)]);
    },
  },
  {
    id: 'pagina-curso', skills: ['landing-page', 'design-visual'], agentes: ['designer'],
    pedido: 'Faça uma página de apresentação (HTML e CSS num arquivo só) para um curso gratuito de Python para iniciantes, com um botão para se inscrever.',
    async verificar(t) {
      const doc = paginaDaResposta(t);
      if (!doc) return 0;
      return nota([await axeSemErroGrave(doc), await semRolagemHorizontal(doc), /<h1/i.test(doc), /<meta[^>]+viewport/i.test(doc)]);
    },
  },
  {
    id: 'cartoes-quatro', skills: ['layout-css'], agentes: ['designer'],
    pedido: 'Quero uma seção com 4 cartões (HTML e CSS): lado a lado numa tela de computador de 1200 px e um embaixo do outro no celular de 375 px.',
    async verificar(t) {
      const doc = paginaDaResposta(t);
      if (!doc) return 0;
      const topos = async (larg) => { const n = await abrirPagina(doc, larg); return n.avaliar(`(() => { const els = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 || e.matches('article, li, .card, .cartao, [class*=card], [class*=cart]')); const pais = new Map(); for (const e of document.querySelectorAll('body *')) { const k = [...e.children].filter((c) => c.getBoundingClientRect().width > 50); if (k.length === 4) pais.set(e, k); } const [ , filhos] = [...pais][0] ?? []; return filhos ? filhos.map((c) => Math.round(c.getBoundingClientRect().top)) : null; })()`); };
      const g = await topos(1200), c = await topos(375);
      return nota([Boolean(g) && new Set(g).size === 1, Boolean(c) && new Set(c).size === 4, await semRolagemHorizontal(doc)]);
    },
  },
];

// as tarefas de página usam o navegador: uma conferência de cada vez (veja naVez)
for (const t of TAREFAS) if (/^(pagina|cartoes)-/.test(t.id)) { const v = t.verificar; t.verificar = (texto) => naVez(() => v.call(t, texto)); }
