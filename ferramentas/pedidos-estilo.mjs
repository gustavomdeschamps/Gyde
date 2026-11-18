// 40 pedidos reais de programação e estudo para medir o estilo das respostas (ferramentas/avaliar-estilo.mjs).
// Conjunto separado: não foi usado para escrever o guia de estilo. "tamanho" é o limite de palavras fora dos blocos de
// código que uma boa resposta respeita: curta (pergunta simples), media, longa (sem limite).
export const PEDIDOS = [
  // perguntas simples e objetivas
  { id: 'let-const', tamanho: 'curta', texto: 'qual a diferença entre let e const?' },
  { id: 'git-desfazer', tamanho: 'curta', texto: 'como desfaço o último commit sem perder as mudanças?' },
  { id: 'http-404', tamanho: 'curta', texto: 'o que significa o erro 404?' },
  { id: 'py-lista-tupla', tamanho: 'curta', texto: 'lista ou tupla em python, quando usar cada uma?' },
  { id: 'css-centralizar', tamanho: 'curta', texto: 'como centralizo uma div na tela com css?' },
  { id: 'js-igual', tamanho: 'curta', texto: 'por que em javascript se usa === e não ==?' },
  { id: 'sql-like', tamanho: 'curta', texto: 'como busco nomes que começam com "Ma" no SQL?' },
  { id: 'node-versao', tamanho: 'curta', texto: 'como vejo a versão do node instalada?' },
  { id: 'py-venv', tamanho: 'curta', texto: 'pra que serve o venv no python?' },
  { id: 'json-o-que', tamanho: 'curta', texto: 'o que é JSON?' },
  // escrever código
  { id: 'js-pares', tamanho: 'media', texto: 'escreve uma função em javascript que recebe uma lista de números e devolve só os pares' },
  { id: 'py-palindromo', tamanho: 'media', texto: 'faz uma função em python que diz se uma palavra é palíndromo, ignorando maiúsculas e acentos' },
  { id: 'js-contar-palavras', tamanho: 'media', texto: 'preciso de uma função js que conta quantas vezes cada palavra aparece num texto' },
  { id: 'py-fatorial', tamanho: 'media', texto: 'fatorial em python com recursão e sem recursão' },
  { id: 'js-data', tamanho: 'media', texto: 'como formato uma data no formato dd/mm/aaaa em javascript?' },
  { id: 'py-media-notas', tamanho: 'media', texto: 'programa em python que calcula a média de notas e diz se o aluno passou (média 7)' },
  { id: 'js-debounce', tamanho: 'media', texto: 'implementa um debounce em javascript' },
  { id: 'py-primos', tamanho: 'media', texto: 'lista os números primos até 100 em python' },
  { id: 'js-ordenar-objetos', tamanho: 'media', texto: 'ordenar um array de objetos por idade em js' },
  { id: 'py-dicionario', tamanho: 'media', texto: 'como inverto chaves e valores de um dicionário em python?' },
  // depurar
  { id: 'erro-undefined', tamanho: 'media', texto: "TypeError: Cannot read properties of undefined (reading 'length') no meu código:\n```js\nfunction tamanho(lista) { return lista.length; }\nconsole.log(tamanho());\n```" },
  { id: 'erro-indentacao', tamanho: 'media', texto: 'IndentationError: expected an indented block\n```python\nfor i in range(3):\nprint(i)\n```' },
  { id: 'erro-nan', tamanho: 'media', texto: 'por que isso dá NaN?\n```js\nconst total = ["10", "20"].reduce((a, b) => a + parseInt(b));\nconsole.log(total / undefined);\n```' },
  { id: 'erro-zero', tamanho: 'media', texto: 'ZeroDivisionError quando a lista está vazia:\n```python\ndef media(l):\n    return sum(l) / len(l)\nprint(media([]))\n```' },
  { id: 'erro-laco', tamanho: 'media', texto: 'meu laço nunca termina:\n```js\nlet i = 0;\nwhile (i < 10) {\n  console.log(i);\n}\n```' },
  { id: 'erro-await', tamanho: 'media', texto: 'por que meu console.log mostra Promise { <pending> }?\n```js\nasync function dado() { return 42; }\nconsole.log(dado());\n```' },
  { id: 'erro-tipo-py', tamanho: 'media', texto: "TypeError: can only concatenate str (not \"int\") to str\n```python\nidade = 20\nprint('Tenho ' + idade + ' anos')\n```" },
  { id: 'erro-escopo', tamanho: 'media', texto: 'por que imprime 3, 3, 3?\n```js\nfor (var i = 0; i < 3; i++) setTimeout(() => console.log(i), 0);\n```' },
  // estudar e aprender
  { id: 'estudo-recursao', tamanho: 'media', texto: 'sou iniciante, me explica recursão de um jeito simples' },
  { id: 'estudo-api', tamanho: 'media', texto: 'o que é uma API? nunca entendi' },
  { id: 'estudo-git', tamanho: 'media', texto: 'pra que serve o git, explica como se eu tivesse começado ontem' },
  { id: 'estudo-oop', tamanho: 'media', texto: 'o que é orientação a objetos, com um exemplo bem simples em python' },
  { id: 'estudo-big-o', tamanho: 'media', texto: 'o que é complexidade O(n) e O(n²)?' },
  { id: 'estudo-roteiro', tamanho: 'longa', texto: 'quero aprender programação do zero, por onde começo?' },
  // pedidos ambíguos ou abertos
  { id: 'ambiguo-ordenar', tamanho: 'media', texto: 'como ordeno uma lista?' },
  { id: 'ambiguo-site', tamanho: 'longa', texto: 'faz um site pra mim' },
  { id: 'ambiguo-banco', tamanho: 'media', texto: 'qual banco de dados eu uso?' },
  { id: 'opiniao-linguagem', tamanho: 'media', texto: 'python ou javascript pra começar?' },
  { id: 'revisar-codigo', tamanho: 'media', texto: 'meu código está bom?\n```js\nfunction soma(a,b){return a+b}\nconsole.log(soma(1,2))\n```' },
  { id: 'regex-email', tamanho: 'media', texto: 'regex pra validar email em javascript' },
];
