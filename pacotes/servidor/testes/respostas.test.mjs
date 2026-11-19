// Qualidade das respostas: acabamento do texto (sem desculpa nem fecho vazio, código intacto), verificação do código
// (roda o que é seguro, recusa o resto) e correção antes de salvar (até 2 vezes, com aviso honesto).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acabamento } from '../ia/filtro.ts';
import { blocosRodaveis, verificarCodigo, motivoParaNaoRodar } from '../ia/verificar-codigo.ts';
import { conferirResposta, MAX_CORRECOES } from '../ia/conferir-resposta.ts';

const F = '```';
const js = (c) => `${F}js\n${c}\n${F}`;

test('acabamento: tira desculpa e fecho vazio, arruma o Markdown e não toca no código', () => {
  const t = `Peço desculpas pela confusão. A função soma dois números.\n\n##Exemplo\n\n${F}js\n// Desculpe: este comentário fica\nconsole.log(1)\n${F}\n\nO resultado é 1.\n\nO resultado é 1.\n\nEspero ter ajudado! Se tiver mais dúvidas, é só perguntar.`;
  assert.equal(acabamento(t), `A função soma dois números.\n\n## Exemplo\n\n${F}js\n// Desculpe: este comentário fica\nconsole.log(1)\n${F}\n\nO resultado é 1.`);
  assert.equal(acabamento('Desculpe, mas a pergunta depende do contexto: use X.'), 'A pergunta depende do contexto: use X.');
  assert.equal(acabamento(`Veja:\n${F}py\nprint(1)`), `Veja:\n${F}py\nprint(1)\n${F}`, 'bloco aberto é fechado');
  assert.equal(acabamento('Use `map`.\n\nBons estudos!'), 'Use `map`.');
  assert.equal(acabamento('Se você tiver um array vazio, o reduce precisa do valor inicial.'), 'Se você tiver um array vazio, o reduce precisa do valor inicial.', 'frase de conteúdo que começa com "se você tiver" fica');
});

test('verificação: roda JavaScript isolado, pega erro e laço infinito; Python não roda sozinho', async () => {
  assert.deepEqual(await verificarCodigo(js('const soma = (a, b) => a + b;\nconsole.log(soma(2, 3));')), { rodou: 1, comUso: 1, erros: [] });
  const erro = await verificarCodigo(js('function f(l) { return l.map((x) => x * 2); }\nconsole.log(f(undefined));'));
  assert.equal(erro.erros.length, 1);
  assert.match(erro.erros[0].erro, /TypeError/);
  assert.match((await verificarCodigo(js('while (true) {}\nconsole.log(1);'))).erros[0].erro, /3 segundos/);
  assert.equal(blocosRodaveis('```python\nimport math\nprint(math.sqrt(4))\n```').length, 0, 'Python não roda sozinho');
  assert.ok(motivoParaNaoRodar({ linguagem: 'js', codigo: "const fs = require('fs');\nfs.unlinkSync('a');" }));
  assert.equal(blocosRodaveis(`Este código dá erro:\n${js('console.log(x.y);\nlet x;')}\nCorrigido:\n${js('const x = { y: 1 };\nconsole.log(x.y);')}`).length, 1, 'o código mostrado como errado não é "consertado"');
});

test('isolamento: nada do Node nem do computador chega ao código, e nada derruba o servidor', async () => {
  const { rodarBloco } = await import('../ia/verificar-codigo.ts');
  const roda = (codigo) => rodarBloco({ linguagem: 'js', codigo });
  // tentativas que passariam pelo filtro de texto (o isolamento não depende dele)
  const escape = await roda("const P = this.constructor.constructor('return process')();\nconsole.log(P.pid);");
  assert.equal(escape?.ok, false, 'sem gerar código a partir de texto: não alcança o process');
  const porConsole = await roda("const P = console.log.constructor('return process')();\nconsole.log(typeof P);");
  assert.equal(porConsole?.ok, false, 'nem pelo console');
  assert.equal(await roda("const r = globalThis['req' + 'uire'];\nr('node:net');").then((x) => x?.ok), false, 'require não existe: o código não alcança nada');
  assert.equal(await roda("const f = globalThis['fe' + 'tch'];\nf('http://127.0.0.1:3210');").then((x) => x?.ok), false, 'fetch não existe: sem rede');
  // saída gigante (inclusive no console.error) não derruba nada: vira "não verificado"
  assert.equal(await roda("const s = 'x'.repeat(1e6);\nfor (let i = 0; i < 1e6; i++) console.error(s);").then((r) => r?.ok), true, 'o console guarda até um limite: roda até o fim, sem estourar');
  assert.equal(await roda("for (let i = 0; i < 1e5; i++) console.log('linha ' + i);\nconsole.log('fim');").then((r) => r?.ok), true, 'muitas linhas: o console guarda até um limite e o código roda');
  // memória: um laço que cresce sem parar é cortado (tempo ou memória), sem levar o servidor junto
  const memoria = await roda('const a = [];\nwhile (true) a.push(new Array(1e5).fill(1));');
  assert.ok(memoria === null || memoria.ok === false);
});

function roteador(respostas) {
  const pedidos = [];
  const router = async (_rota, { body }) => {
    pedidos.push(JSON.parse(body));
    const texto = respostas.shift() ?? 'sem resposta';
    return new Response(JSON.stringify({ choices: [{ message: { content: texto } }] }), { headers: { 'content-type': 'application/json' } });
  };
  return { router, pedidos };
}

test('correção: código com erro é corrigido antes de salvar, com aviso; sem conserto, a original com alerta', async () => {
  const quebrado = `A média:\n${js('function media(l) { return l.reduce((a, b) => a + b) / l.length; }\nconsole.log(media([]));')}`;
  const certo = `A média:\n${js('function media(l) { return l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0; }\nconsole.log(media([]));')}`;
  const r1 = roteador([certo]);
  const c1 = await conferirResposta({ texto: quebrado, mensagens: [{ role: 'user', content: 'media' }], router: r1.router, cadeia: ['m'], verificar: true });
  assert.equal(c1.nota, 'corrigido');
  assert.match(c1.texto, /l\.length \? /);
  assert.match(c1.texto, /a primeira versão deu erro ao rodar \(TypeError/);
  assert.match(r1.pedidos[0].messages.at(-1).content, /deu este erro: TypeError/);

  const r2 = roteador([quebrado, quebrado, quebrado]);
  const c2 = await conferirResposta({ texto: quebrado, mensagens: [], router: r2.router, cadeia: ['m'], verificar: true });
  assert.equal(c2.nota, 'erro');
  assert.equal(r2.pedidos.length, MAX_CORRECOES, 'no máximo 2 tentativas');
  assert.match(c2.texto, /Atenção: rodei o código e deu erro/);

  const c3 = await conferirResposta({ texto: `Pronto:\n${js('console.log(2 + 2);')}`, mensagens: [], router: roteador([]).router, cadeia: ['m'], verificar: true });
  assert.match(c3.texto, /Código conferido: rodei e não deu erro\.\*$/);
  const c5 = await conferirResposta({ texto: `Assim:\n${js('function dobro(x) {\n  return x * 2;\n}')}`, mensagens: [], router: roteador([]).router, cadeia: ['m'], verificar: true });
  assert.match(c5.texto, /só define, sem exemplo de uso/, 'só a definição: não diz mais do que rodar provou');
  const c4 = await conferirResposta({ texto: 'Sem código aqui.', mensagens: [], router: roteador([]).router, cadeia: ['m'], verificar: true });
  assert.equal(c4.texto, 'Sem código aqui.', 'sem código, nenhuma linha a mais');
});
