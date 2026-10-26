// Trilhas de Skills do Gyde. Cada exercício pede uma função; os testes rodam no navegador.
// tests: [{ args: [...], expected }]  (comparação por igualdade profunda; números com tolerância)

export const TRACKS = [
  {
    id: 'python-basico',
    title: 'Primeiros passos em Python',
    lang: 'python',
    color: '#2f6bff',
    icon: 'python',
    description: 'Variáveis, contas, condições e laços — a base de tudo, com exercícios curtinhos.',
    exercises: [
      {
        id: 'py-ola', title: 'Olá, pessoa!', xp: 10, fn: 'ola',
        statement: 'Crie a função `ola(nome)` que **devolve** (com `return`) o texto `Olá, <nome>!`.\n\nExemplo: `ola("Ana")` devolve `"Olá, Ana!"`.\n\n> Dica: em Python dá para juntar textos com `+` ou usar f-string: `f"Olá, {nome}!"`.',
        starter: 'def ola(nome):\n    # escreva seu código aqui\n    pass\n',
        tests: [{ args: ['Ana'], expected: 'Olá, Ana!' }, { args: ['Gyde'], expected: 'Olá, Gyde!' }, { args: [''], expected: 'Olá, !' }],
      },
      {
        id: 'py-area', title: 'Área do retângulo', xp: 10, fn: 'area_retangulo',
        statement: 'Crie `area_retangulo(base, altura)` que devolve a área (base × altura).\n\nExemplo: `area_retangulo(3, 4)` devolve `12`.',
        starter: 'def area_retangulo(base, altura):\n    pass\n',
        tests: [{ args: [3, 4], expected: 12 }, { args: [2.5, 2], expected: 5 }, { args: [0, 10], expected: 0 }],
      },
      {
        id: 'py-par', title: 'Par ou ímpar?', xp: 15, fn: 'eh_par',
        statement: 'Crie `eh_par(n)` que devolve `True` se `n` for par e `False` se for ímpar.\n\n> Dica: o operador `%` dá o **resto** da divisão. `7 % 2` é `1`.',
        starter: 'def eh_par(n):\n    pass\n',
        tests: [{ args: [4], expected: true }, { args: [7], expected: false }, { args: [0], expected: true }, { args: [-3], expected: false }],
      },
      {
        id: 'py-maior', title: 'O maior de três', xp: 15, fn: 'maior',
        statement: 'Crie `maior(a, b, c)` que devolve o maior dos três números **sem usar** a função `max`.\n\nUse `if`, `elif` e `else`.',
        starter: 'def maior(a, b, c):\n    pass\n',
        tests: [{ args: [1, 5, 3], expected: 5 }, { args: [9, 2, 4], expected: 9 }, { args: [1, 2, 8], expected: 8 }, { args: [7, 7, 7], expected: 7 }, { args: [-5, -2, -9], expected: -2 }],
      },
      {
        id: 'py-soma-ate', title: 'Somando até n', xp: 20, fn: 'soma_ate',
        statement: 'Crie `soma_ate(n)` que devolve `1 + 2 + ... + n` usando um laço `for`.\n\nExemplo: `soma_ate(5)` devolve `15`.\n\n> Cuidado: `range(1, n)` **para antes** de `n`!',
        starter: 'def soma_ate(n):\n    total = 0\n    # use um for aqui\n    return total\n',
        tests: [{ args: [5], expected: 15 }, { args: [1], expected: 1 }, { args: [10], expected: 55 }, { args: [0], expected: 0 }],
      },
      {
        id: 'py-vogais', title: 'Contando vogais', xp: 20, fn: 'conta_vogais',
        statement: 'Crie `conta_vogais(texto)` que devolve quantas vogais (a, e, i, o, u) o texto tem, **sem diferenciar maiúsculas de minúsculas**.\n\nExemplo: `conta_vogais("Programar")` devolve `3`.',
        starter: 'def conta_vogais(texto):\n    pass\n',
        tests: [{ args: ['Programar'], expected: 3 }, { args: ['AEIOU'], expected: 5 }, { args: ['xyz'], expected: 0 }, { args: [''], expected: 0 }],
      },
      {
        id: 'py-media', title: 'Média das notas', xp: 25, fn: 'media',
        statement: 'Crie `media(notas)` que recebe uma **lista** de números e devolve a média.\n\nSe a lista estiver vazia, devolva `0` (dividir por zero dá erro!).\n\nExemplo: `media([7, 8, 9])` devolve `8`.',
        starter: 'def media(notas):\n    pass\n',
        tests: [{ args: [[7, 8, 9]], expected: 8 }, { args: [[10]], expected: 10 }, { args: [[5, 6]], expected: 5.5 }, { args: [[]], expected: 0 }],
      },
    ],
  },
  {
    id: 'js-zero',
    title: 'JavaScript do zero',
    lang: 'javascript',
    color: '#d97706',
    icon: 'javascript',
    description: 'A linguagem da web: funções, arrays e os métodos que todo dev usa no dia a dia.',
    exercises: [
      {
        id: 'js-saudacao', title: 'Template string', xp: 10, fn: 'saudacao',
        statement: 'Crie `saudacao(nome, idade)` que devolve `"<nome> tem <idade> anos"`.\n\nUse **template string** (crase): `` `${nome}` ``.',
        starter: 'function saudacao(nome, idade) {\n  // seu código aqui\n}\n',
        tests: [{ args: ['Ana', 17], expected: 'Ana tem 17 anos' }, { args: ['Leo', 1], expected: 'Leo tem 1 anos' }],
      },
      {
        id: 'js-celsius', title: 'Celsius para Fahrenheit', xp: 10, fn: 'celsiusParaF',
        statement: 'Crie `celsiusParaF(c)` que converte Celsius para Fahrenheit: `F = C × 9/5 + 32`.\n\nExemplo: `celsiusParaF(100)` devolve `212`.',
        starter: 'function celsiusParaF(c) {\n}\n',
        tests: [{ args: [100], expected: 212 }, { args: [0], expected: 32 }, { args: [-40], expected: -40 }, { args: [37], expected: 98.6 }],
      },
      {
        id: 'js-conta', title: 'Array de 1 até n', xp: 15, fn: 'contaAte',
        statement: 'Crie `contaAte(n)` que devolve um array `[1, 2, ..., n]` usando um laço `for` e `push`.\n\nSe `n` for 0, devolva `[]`.',
        starter: 'function contaAte(n) {\n  const lista = [];\n  // seu laço aqui\n  return lista;\n}\n',
        tests: [{ args: [3], expected: [1, 2, 3] }, { args: [1], expected: [1] }, { args: [0], expected: [] }],
      },
      {
        id: 'js-soma', title: 'Somando um array', xp: 15, fn: 'somaArray',
        statement: 'Crie `somaArray(numeros)` que devolve a soma de todos os números do array.\n\nPode usar `for...of` ou o método `reduce`.',
        starter: 'function somaArray(numeros) {\n}\n',
        tests: [{ args: [[1, 2, 3]], expected: 6 }, { args: [[]], expected: 0 }, { args: [[-5, 5, 10]], expected: 10 }],
      },
      {
        id: 'js-map', title: 'Tudo em maiúsculas', xp: 20, fn: 'gritar',
        statement: 'Crie `gritar(palavras)` que recebe um array de textos e devolve um **novo** array com tudo em maiúsculas.\n\nUse o método `map` e `toUpperCase()`.\n\nExemplo: `gritar(["oi", "gyde"])` devolve `["OI", "GYDE"]`.',
        starter: 'function gritar(palavras) {\n}\n',
        tests: [{ args: [['oi', 'gyde']], expected: ['OI', 'GYDE'] }, { args: [[]], expected: [] }],
      },
      {
        id: 'js-filter', title: 'Filtrando notas', xp: 20, fn: 'aprovados',
        statement: 'Crie `aprovados(notas)` que devolve só as notas **maiores ou iguais a 6**, usando `filter`.',
        starter: 'function aprovados(notas) {\n}\n',
        tests: [{ args: [[5, 6, 9, 3, 7.5]], expected: [6, 9, 7.5] }, { args: [[1, 2]], expected: [] }],
      },
      {
        id: 'js-objeto', title: 'Objetos', xp: 25, fn: 'criarAluno',
        statement: 'Crie `criarAluno(nome, notas)` que devolve um **objeto** com três propriedades:\n\n- `nome`\n- `media` (média das notas; `0` se não houver notas)\n- `aprovado` (`true` se a média for 6 ou mais)\n\nExemplo: `criarAluno("Ana", [8, 6])` → `{ nome: "Ana", media: 7, aprovado: true }`',
        starter: 'function criarAluno(nome, notas) {\n}\n',
        tests: [
          { args: ['Ana', [8, 6]], expected: { nome: 'Ana', media: 7, aprovado: true } },
          { args: ['Leo', [4, 5]], expected: { nome: 'Leo', media: 4.5, aprovado: false } },
          { args: ['Bia', []], expected: { nome: 'Bia', media: 0, aprovado: false } },
        ],
      },
    ],
  },
  {
    id: 'logica',
    title: 'Lógica e algoritmos',
    lang: 'python',
    color: '#7c3aed',
    icon: 'logica',
    description: 'Desafios clássicos de entrevista e olimpíada: FizzBuzz, primos, palíndromos e mais.',
    exercises: [
      {
        id: 'lg-fizzbuzz', title: 'FizzBuzz', xp: 20, fn: 'fizzbuzz',
        statement: 'Crie `fizzbuzz(n)` que devolve:\n\n- `"FizzBuzz"` se `n` for divisível por 3 **e** por 5\n- `"Fizz"` se for divisível só por 3\n- `"Buzz"` se for divisível só por 5\n- o próprio número **como texto** nos outros casos (`"7"`)\n\n> A ordem dos `if` importa!',
        starter: 'def fizzbuzz(n):\n    pass\n',
        tests: [{ args: [15], expected: 'FizzBuzz' }, { args: [9], expected: 'Fizz' }, { args: [10], expected: 'Buzz' }, { args: [7], expected: '7' }, { args: [30], expected: 'FizzBuzz' }],
      },
      {
        id: 'lg-fatorial', title: 'Fatorial', xp: 20, fn: 'fatorial',
        statement: 'Crie `fatorial(n)` que devolve `n! = n × (n-1) × ... × 1`. Por definição, `0! = 1`.\n\nTente com um laço — e, se quiser um desafio extra, depois com **recursão**.',
        starter: 'def fatorial(n):\n    pass\n',
        tests: [{ args: [5], expected: 120 }, { args: [0], expected: 1 }, { args: [1], expected: 1 }, { args: [10], expected: 3628800 }],
      },
      {
        id: 'lg-primo', title: 'É primo?', xp: 25, fn: 'eh_primo',
        statement: 'Crie `eh_primo(n)` que devolve `True` se `n` for primo.\n\nPrimo: maior que 1 e divisível só por 1 e por ele mesmo.\n\n> Desafio: basta testar divisores até a raiz quadrada de `n`.',
        starter: 'def eh_primo(n):\n    pass\n',
        tests: [{ args: [2], expected: true }, { args: [17], expected: true }, { args: [1], expected: false }, { args: [21], expected: false }, { args: [97], expected: true }, { args: [0], expected: false }],
      },
      {
        id: 'lg-palindromo', title: 'Palíndromo', xp: 25, fn: 'palindromo',
        statement: 'Crie `palindromo(texto)` que diz se o texto é lido igual de trás para frente, **ignorando espaços e maiúsculas**.\n\nExemplo: `palindromo("Socorram me subi no onibus em Marrocos")` → `True`.\n\n> Dica: `texto[::-1]` inverte um texto.',
        starter: 'def palindromo(texto):\n    pass\n',
        tests: [{ args: ['arara'], expected: true }, { args: ['Ana'], expected: true }, { args: ['Socorram me subi no onibus em Marrocos'], expected: true }, { args: ['gyde'], expected: false }],
      },
      {
        id: 'lg-segundo', title: 'Segundo maior', xp: 30, fn: 'segundo_maior',
        statement: 'Crie `segundo_maior(numeros)` que devolve o **segundo maior valor diferente** da lista.\n\nSe não existir (lista com menos de 2 valores diferentes), devolva `None`.\n\nExemplo: `segundo_maior([4, 9, 9, 2])` → `4`.',
        starter: 'def segundo_maior(numeros):\n    pass\n',
        tests: [{ args: [[4, 9, 9, 2]], expected: 4 }, { args: [[1, 2]], expected: 1 }, { args: [[5, 5, 5]], expected: null }, { args: [[]], expected: null }, { args: [[-1, -7, -3]], expected: -3 }],
      },
      {
        id: 'lg-frequencia', title: 'Contando palavras', xp: 30, fn: 'frequencia',
        statement: 'Crie `frequencia(frase)` que devolve um **dicionário** com quantas vezes cada palavra aparece (em minúsculas).\n\nExemplo: `frequencia("o gato e o rato")` → `{"o": 2, "gato": 1, "e": 1, "rato": 1}`.\n\n> Dica: `frase.lower().split()` separa as palavras.',
        starter: 'def frequencia(frase):\n    contagem = {}\n    return contagem\n',
        tests: [{ args: ['o gato e o rato'], expected: { o: 2, gato: 1, e: 1, rato: 1 } }, { args: ['Oi oi OI'], expected: { oi: 3 } }, { args: [''], expected: {} }],
      },
    ],
  },

  // ---------- Projetos guiados: o código de cada etapa continua na próxima ----------
  {
    id: 'proj-adivinhacao',
    projeto: true,
    title: 'Projeto: Jogo de adivinhação',
    lang: 'python',
    color: '#0891b2',
    icon: 'adivinhacao',
    description: 'Construa, etapa por etapa, a lógica de um jogo em que o jogador tenta adivinhar um número secreto.',
    exercises: [
      {
        id: 'pa-dica', title: '1. A dica', xp: 20, fn: 'dica',
        statement: 'Todo jogo de adivinhação precisa dizer se o chute foi alto ou baixo.\n\nCrie `dica(chute, segredo)` que devolve:\n\n- `"acertou"` se forem iguais\n- `"maior"` se o segredo for **maior** que o chute\n- `"menor"` se o segredo for **menor** que o chute',
        starter: 'def dica(chute, segredo):\n    pass\n',
        tests: [{ args: [5, 5], expected: 'acertou' }, { args: [3, 8], expected: 'maior' }, { args: [9, 2], expected: 'menor' }],
      },
      {
        id: 'pa-validar', title: '2. Chute válido', xp: 20, fn: 'chute_valido',
        statement: 'O jogo usa números de **1 a 100**. Crie `chute_valido(chute)` que devolve `True` só se o chute for um número inteiro entre 1 e 100 (incluindo os dois).\n\nSeu código da etapa anterior continua aqui em cima — mantenha-o.',
        starter: '\ndef chute_valido(chute):\n    pass\n',
        tests: [{ args: [1], expected: true }, { args: [100], expected: true }, { args: [0], expected: false }, { args: [101], expected: false }, { args: [50], expected: true }],
      },
      {
        id: 'pa-pontos', title: '3. Pontuação', xp: 25, fn: 'pontuacao',
        statement: 'Quanto menos tentativas, mais pontos. Crie `pontuacao(tentativas)`:\n\n- começa em **100** pontos\n- perde **10** por tentativa **depois da primeira**\n- nunca fica abaixo de **10**\n\nExemplos: 1 tentativa → 100; 3 → 80; 20 → 10.',
        starter: '\ndef pontuacao(tentativas):\n    pass\n',
        tests: [{ args: [1], expected: 100 }, { args: [3], expected: 80 }, { args: [10], expected: 10 }, { args: [20], expected: 10 }],
      },
      {
        id: 'pa-jogar', title: '4. Juntando tudo', xp: 35, fn: 'jogar',
        statement: 'Agora o jogo completo! Crie `jogar(segredo, chutes)`, que recebe a lista de chutes do jogador e devolve um **dicionário**:\n\n- `"dicas"`: a lista de dicas, uma por chute **válido**, parando no acerto\n- `"pontos"`: a pontuação (usando `pontuacao`) se acertou, ou `0` se não acertou\n\nChutes inválidos são ignorados (não contam como tentativa).\n\nExemplo: `jogar(40, [50, 0, 30, 40, 99])` → `{"dicas": ["menor", "maior", "acertou"], "pontos": 80}`\n\n> Use as funções `dica`, `chute_valido` e `pontuacao` que você já fez.',
        starter: '\ndef jogar(segredo, chutes):\n    dicas = []\n    # percorra os chutes...\n    return {"dicas": dicas, "pontos": 0}\n',
        tests: [
          { args: [40, [50, 0, 30, 40, 99]], expected: { dicas: ['menor', 'maior', 'acertou'], pontos: 80 } },
          { args: [7, [7]], expected: { dicas: ['acertou'], pontos: 100 } },
          { args: [10, [5, 200, 6]], expected: { dicas: ['maior', 'maior'], pontos: 0 } },
        ],
      },
    ],
  },
  {
    id: 'proj-tarefas',
    projeto: true,
    title: 'Projeto: Lista de tarefas',
    lang: 'javascript',
    color: '#16a34a',
    icon: 'tarefas',
    description: 'Monte o "cérebro" de um app de tarefas em JavaScript: criar, concluir, filtrar e resumir.',
    exercises: [
      {
        id: 'pt-criar', title: '1. Criar tarefa', xp: 20, fn: 'criarTarefa',
        statement: 'Crie `criarTarefa(titulo)` que devolve um objeto `{ titulo, feita: false }`.\n\nO título deve vir **sem espaços sobrando** nas pontas (use `trim()`).',
        starter: 'function criarTarefa(titulo) {\n}\n',
        tests: [{ args: ['Estudar JS'], expected: { titulo: 'Estudar JS', feita: false } }, { args: ['  Lavar louça  '], expected: { titulo: 'Lavar louça', feita: false } }],
      },
      {
        id: 'pt-concluir', title: '2. Concluir sem estragar', xp: 20, fn: 'concluir',
        statement: 'Crie `concluir(tarefa)` que devolve uma **cópia** da tarefa com `feita: true`, **sem alterar** a original.\n\n> Dica: o spread `{ ...tarefa }` copia um objeto.',
        starter: '\nfunction concluir(tarefa) {\n}\n',
        tests: [{ args: [{ titulo: 'Ler', feita: false }], expected: { titulo: 'Ler', feita: true } }, { args: [{ titulo: 'Já feita', feita: true }], expected: { titulo: 'Já feita', feita: true } }],
      },
      {
        id: 'pt-pendentes', title: '3. Só as pendentes', xp: 25, fn: 'pendentes',
        statement: 'Crie `pendentes(lista)` que devolve só os **títulos** das tarefas que ainda não foram feitas.\n\n> Combine `filter` e `map`.',
        starter: '\nfunction pendentes(lista) {\n}\n',
        tests: [
          { args: [[{ titulo: 'A', feita: true }, { titulo: 'B', feita: false }, { titulo: 'C', feita: false }]], expected: ['B', 'C'] },
          { args: [[]], expected: [] },
        ],
      },
      {
        id: 'pt-resumo', title: '4. O resumo do app', xp: 35, fn: 'resumo',
        statement: 'Crie `resumo(lista)` que devolve um texto para a tela do app:\n\n- `"Nenhuma tarefa"` se a lista estiver vazia\n- `"Tudo feito!"` se todas estiverem feitas\n- senão, `"<feitas> de <total> tarefas feitas"` (ex.: `"1 de 3 tarefas feitas"`)',
        starter: '\nfunction resumo(lista) {\n}\n',
        tests: [
          { args: [[]], expected: 'Nenhuma tarefa' },
          { args: [[{ titulo: 'A', feita: true }]], expected: 'Tudo feito!' },
          { args: [[{ titulo: 'A', feita: true }, { titulo: 'B', feita: false }, { titulo: 'C', feita: false }]], expected: '1 de 3 tarefas feitas' },
        ],
      },
    ],
  },
];

// Pontos fracos do quiz -> exercícios recomendados para reforçar.
export const TOPICO_EXERCICIOS = {
  'variáveis': ['py-area'],
  'texto vs. número': ['py-ola', 'js-saudacao'],
  'laços (for)': ['py-soma-ate', 'js-conta'],
  'listas e índices': ['py-media', 'js-soma'],
  'funções': ['py-maior', 'lg-fatorial'],
  'limites do laço': ['py-soma-ate'],
  'laços (while)': ['lg-fatorial'],
  'referências de listas': ['pt-concluir'],
};

export const findExercise = (id) => {
  for (const t of TRACKS) {
    const ex = t.exercises.find((e) => e.id === id);
    if (ex) return { track: t, ex };
  }
  return null;
};
