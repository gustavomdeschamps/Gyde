// Cenários difíceis da avaliação da Forja (ferramentas/avaliar-forja.mjs). Cada um cria um projeto pequeno de verdade e
// confere no disco, com testes escondidos (que a Forja não vê) para pegar remendo feito só para o teste passar.
//   bug-espalhado  dois bugs em arquivos diferentes; o teste só passa com os dois corrigidos
//   teste-engana   o erro aparece em formatar.js, mas a causa está em ler.js
//   pedido-grande  um campo novo que atravessa modelo, repositório, rotas, tela e testes
//   achar-arquivo  44 arquivos; o bug está num só, e os testes atuais passam (falta o caso pedido)
import { createHash } from 'node:crypto';

const sha = (t) => createHash('sha1').update(t).digest('hex');
const PKG = JSON.stringify({ name: 'projeto', version: '1.0.0', scripts: { test: 'node teste.js' } }, null, 2);

export function cenariosDificeis({ criarPasta, ler, rodar }) {
  return [
    {
      id: 'bug-espalhado', grupo: 'dificil',
      pedido: 'O teste do carrinho está falhando. Descubra o que está errado, corrija e rode os testes.',
      criar() {
        const teste = "const assert = require('node:assert');\nconst { totalDoCarrinho } = require('./src/carrinho.js');\n// 2 x 50 + 1 x 100 = 200, com 10% de desconto = 180\nassert.strictEqual(totalDoCarrinho([{ preco: 50, qtd: 2 }, { preco: 100, qtd: 1 }], 10), 180);\nconsole.log('testes ok');\n";
        const pasta = criarPasta({
          'package.json': PKG, 'teste.js': teste,
          'src/precos.js': "// pct em porcentagem: 10 = 10%\nfunction aplicarDesconto(valor, pct) {\n  return valor - valor * pct;\n}\n\nfunction arredondar(valor) {\n  return Math.round(valor * 100) / 100;\n}\n\nmodule.exports = { aplicarDesconto, arredondar };\n",
          'src/carrinho.js': "const { aplicarDesconto, arredondar } = require('./precos.js');\n\nfunction subtotal(itens) {\n  let total = 0;\n  for (let i = 1; i < itens.length; i++) total += itens[i].preco * itens[i].qtd;\n  return total;\n}\n\nfunction totalDoCarrinho(itens, descontoPct = 0) {\n  return arredondar(aplicarDesconto(subtotal(itens), descontoPct));\n}\n\nmodule.exports = { subtotal, totalDoCarrinho };\n",
          'src/frete.js': "function frete(total) {\n  return total >= 150 ? 0 : 20;\n}\n\nmodule.exports = { frete };\n",
        });
        return { pasta, teste: sha(teste) };
      },
      conferir({ pasta, teste }) {
        const escondido = rodar(pasta, '-e', [
          "const assert = require('node:assert');",
          "const p = require('./src/precos.js'); const c = require('./src/carrinho.js');",
          'assert.strictEqual(p.aplicarDesconto(200, 10), 180); assert.strictEqual(p.aplicarDesconto(80, 25), 60); assert.strictEqual(p.aplicarDesconto(50, 0), 50);',
          'assert.strictEqual(c.subtotal([{ preco: 3, qtd: 1 }]), 3); assert.strictEqual(c.subtotal([{ preco: 1, qtd: 2 }, { preco: 5, qtd: 1 }, { preco: 2, qtd: 3 }]), 13);',
          'assert.strictEqual(c.totalDoCarrinho([{ preco: 10, qtd: 3 }], 50), 15);',
        ].join('\n'));
        return [['testes passam', rodar(pasta, 'teste.js').status === 0], ['não mexeu no teste', sha(ler(pasta, 'teste.js')) === teste],
          ['os dois bugs corrigidos de verdade (testes escondidos)', escondido.status === 0]];
      },
    },
    {
      id: 'teste-engana', grupo: 'dificil',
      pedido: 'Os testes quebram com um erro dentro de formatar.js. Corrija o problema e rode os testes.',
      criar() {
        const formatar = "const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];\n\n// data = { dia, mes (1 a 12), ano }\nfunction formatarExtenso(data) {\n  const nome = MESES[data.mes - 1];\n  return `${data.dia} de ${nome.toLowerCase()} de ${data.ano}`;\n}\n\nmodule.exports = { formatarExtenso };\n";
        const teste = "const assert = require('node:assert');\nconst { lerData } = require('./ler.js');\nconst { formatarExtenso } = require('./formatar.js');\nassert.strictEqual(formatarExtenso(lerData('25/12/2024')), '25 de dezembro de 2024');\nassert.strictEqual(formatarExtenso(lerData('03/04/2025')), '3 de abril de 2025');\nconsole.log('testes ok');\n";
        const pasta = criarPasta({
          'package.json': PKG, 'teste.js': teste, 'formatar.js': formatar,
          'ler.js': "// lê \"DD/MM/AAAA\" e devolve { dia, mes, ano } com números\nfunction lerData(texto) {\n  const p = texto.split('/');\n  return { dia: Number(p[1]), mes: Number(p[0]), ano: Number(p[2]) };\n}\n\nmodule.exports = { lerData };\n",
        });
        return { pasta, teste: sha(teste), formatar: sha(formatar) };
      },
      conferir({ pasta, teste, formatar }) {
        const escondido = rodar(pasta, '-e', [
          "const assert = require('node:assert');",
          "assert.deepStrictEqual(require('./ler.js').lerData('25/12/2024'), { dia: 25, mes: 12, ano: 2024 });",
          "assert.deepStrictEqual(require('./ler.js').lerData('07/01/1999'), { dia: 7, mes: 1, ano: 1999 });",
          "assert.strictEqual(require('./formatar.js').formatarExtenso({ dia: 1, mes: 2, ano: 2020 }), '1 de fevereiro de 2020');",
        ].join('\n'));
        return [['testes passam', rodar(pasta, 'teste.js').status === 0], ['não mexeu no teste', sha(ler(pasta, 'teste.js')) === teste],
          ['corrigiu a causa em ler.js (testes escondidos)', escondido.status === 0], ['não remendou formatar.js', sha(ler(pasta, 'formatar.js')) === formatar]];
      },
    },
    {
      id: 'pedido-grande', grupo: 'dificil',
      pedido: 'Quero um campo "categoria" nas tarefas: obrigatório ao criar e só pode ser "casa", "trabalho" ou "estudo" (senão a criação responde 400). A listagem devolve a categoria e aceita o filtro ?categoria= (ex.: listar({ categoria: "casa" })). A página mostra a categoria ao lado do título. Ajuste o que precisar, atualize os testes e rode.',
      criar() {
        const pasta = criarPasta({
          'package.json': PKG,
          'README.md': '# Tarefas\n\nAPI de tarefas em memória. `src/rotas.js` tem os handlers, `src/modelo.js` valida, `src/repositorio.js` guarda.\n',
          'src/modelo.js': "function validarTarefa(dados = {}) {\n  if (!dados.titulo || typeof dados.titulo !== 'string') throw new Error('titulo obrigatório');\n  return { titulo: dados.titulo.trim(), feita: false };\n}\n\nmodule.exports = { validarTarefa };\n",
          'src/repositorio.js': "const tarefas = [];\n\nfunction adicionar(t) {\n  const nova = { id: tarefas.length + 1, ...t };\n  tarefas.push(nova);\n  return nova;\n}\n\nfunction listar(filtro = {}) {\n  return tarefas.filter((t) => filtro.feita === undefined || t.feita === filtro.feita);\n}\n\nfunction limpar() {\n  tarefas.length = 0;\n}\n\nmodule.exports = { adicionar, listar, limpar };\n",
          'src/rotas.js': "const repo = require('./repositorio.js');\nconst { validarTarefa } = require('./modelo.js');\n\nfunction criar(body) {\n  try {\n    return { status: 201, corpo: repo.adicionar(validarTarefa(body)) };\n  } catch (e) {\n    return { status: 400, corpo: { erro: e.message } };\n  }\n}\n\nfunction listar(query = {}) {\n  const feita = query.feita === undefined ? undefined : query.feita === 'true';\n  return { status: 200, corpo: repo.listar({ feita }) };\n}\n\nmodule.exports = { criar, listar };\n",
          'src/util/datas.js': "function hoje() {\n  return new Date().toISOString().slice(0, 10);\n}\n\nmodule.exports = { hoje };\n",
          'src/util/texto.js': "function capitalizar(t) {\n  return t ? t[0].toUpperCase() + t.slice(1) : t;\n}\n\nmodule.exports = { capitalizar };\n",
          'public/index.html': '<!doctype html>\n<html lang="pt-BR"><body>\n  <ul id="lista"></ul>\n  <script src="app.js"></script>\n</body></html>\n',
          'public/app.js': "function renderTarefa(t) {\n  return '<li>' + t.titulo + '</li>';\n}\n\nif (typeof document !== 'undefined') {\n  fetch('/api/tarefas').then((r) => r.json()).then((ts) => { document.getElementById('lista').innerHTML = ts.map(renderTarefa).join(''); });\n}\n\nif (typeof module !== 'undefined') module.exports = { renderTarefa };\n",
          'teste.js': "const assert = require('node:assert');\nconst rotas = require('./src/rotas.js');\nconst repo = require('./src/repositorio.js');\nrepo.limpar();\nassert.strictEqual(rotas.criar({}).status, 400);\nconsole.log('testes ok');\n",
        });
        return { pasta };
      },
      conferir({ pasta }) {
        const escondido = rodar(pasta, '-e', [
          "const assert = require('node:assert');",
          "const rotas = require('./src/rotas.js'); const repo = require('./src/repositorio.js'); const { renderTarefa } = require('./public/app.js');",
          'repo.limpar();',
          "const a = rotas.criar({ titulo: 'Lavar louça', categoria: 'casa' }); assert.strictEqual(a.status, 201); assert.strictEqual(a.corpo.categoria, 'casa');",
          "assert.strictEqual(rotas.criar({ titulo: 'Prova' }).status, 400, 'sem categoria');",
          "assert.strictEqual(rotas.criar({ titulo: 'Prova', categoria: 'lazer' }).status, 400, 'categoria inválida');",
          "assert.strictEqual(rotas.criar({ titulo: 'Prova', categoria: 'estudo' }).status, 201);",
          "const casa = rotas.listar({ categoria: 'casa' }).corpo; assert.strictEqual(casa.length, 1); assert.strictEqual(casa[0].categoria, 'casa');",
          'assert.strictEqual(rotas.listar({}).corpo.length, 2);',
          "assert.ok(renderTarefa({ titulo: 'Prova', categoria: 'estudo' }).includes('estudo'));",
        ].join('\n'));
        const testes = ler(pasta, 'teste.js');
        return [['testes passam', rodar(pasta, 'teste.js').status === 0], ['comportamento pedido (testes escondidos)', escondido.status === 0],
          ['testes cobrem a categoria', /categoria/.test(testes)]];
      },
    },
    {
      id: 'achar-arquivo', grupo: 'dificil',
      pedido: 'Pedidos de exatamente R$ 100 deveriam ter frete grátis, mas estão pagando frete. Corrija e rode os testes.',
      criar() {
        const arquivos = { 'package.json': PKG };
        for (let i = 1; i <= 40; i++) {
          const n = String(i).padStart(2, '0');
          arquivos[`src/modulos/m${n}.js`] = `// módulo ${n}: utilidades de exemplo\nfunction calcular${n}(x) {\n  return x * ${i} + ${i % 7};\n}\n\nfunction descrever${n}() {\n  return 'módulo ${n}';\n}\n\nmodule.exports = { calcular${n}, descrever${n} };\n`;
        }
        arquivos['src/servicos/frete/calculo.js'] = "// frete grátis a partir de R$ 100; abaixo disso, R$ 15\nfunction calcularFrete(total) {\n  if (total > 100) return 0;\n  return 15;\n}\n\nmodule.exports = { calcularFrete };\n";
        arquivos['src/servicos/pagamento.js'] = "function parcelas(total, n) {\n  return Math.round((total / n) * 100) / 100;\n}\n\nmodule.exports = { parcelas };\n";
        arquivos['teste.js'] = "const assert = require('node:assert');\nconst { calcularFrete } = require('./src/servicos/frete/calculo.js');\nassert.strictEqual(calcularFrete(150), 0);\nassert.strictEqual(calcularFrete(50), 15);\nconsole.log('testes ok');\n";
        const pasta = criarPasta(arquivos);
        const outros = Object.fromEntries(Object.entries(arquivos).filter(([f]) => f.startsWith('src/') && !f.endsWith('calculo.js')).map(([f, c]) => [f, sha(c)]));
        return { pasta, outros };
      },
      conferir({ pasta, outros }) {
        const escondido = rodar(pasta, '-e', "const assert = require('node:assert'); const { calcularFrete } = require('./src/servicos/frete/calculo.js'); assert.strictEqual(calcularFrete(100), 0); assert.strictEqual(calcularFrete(99.99), 15); assert.strictEqual(calcularFrete(250), 0);");
        return [['frete de R$ 100 grátis (testes escondidos)', escondido.status === 0], ['testes passam', rodar(pasta, 'teste.js').status === 0],
          ['não mexeu nos outros arquivos', Object.entries(outros).every(([f, h]) => sha(ler(pasta, f)) === h)]];
      },
    },
  ];
}
