// Quiz de boas-vindas: conhece a pessoa e mede o nível em programação.
// As perguntas de código têm versões em Python, JavaScript e Java (a resposta é a mesma nas três).
// As respostas certas ficam só no servidor.

const NAO_SEI = 'Não sei ainda';

export const QUIZ: Pergunta[] = [
  { id: 'experience', kind: 'profile', title: 'Quanto você já programou?', options: [
    'Nunca programei', 'Já fiz alguns exercícios', 'Programo com frequência', 'Faço projetos grandes ou trabalho com isso'] },
  { id: 'languages', kind: 'profile', multi: true, title: 'Quais linguagens você usa ou quer aprender?', options: [
    'Python', 'JavaScript', 'Java', 'C / C++', 'C#', 'PHP', 'HTML e CSS', 'SQL', 'Kotlin', 'Ainda não sei'] },
  { id: 'goal', kind: 'profile', title: 'Qual é o seu principal objetivo?', options: [
    'Ir bem no curso ou na escola', 'Conseguir meu primeiro emprego', 'Criar meus próprios apps e sites', 'Criar jogos', 'Faculdade, vestibular ou olimpíada'] },
  { id: 'style', kind: 'profile', title: 'Como você aprende melhor?', options: [
    'Passo a passo, bem explicado', 'Direto ao ponto', 'Com analogias e exemplos do dia a dia'] },

  {
    id: 'k_vars', kind: 'knowledge', topic: 'variáveis', title: 'O que aparece na tela?',
    code: {
      python: 'x = 5\nx = x + 2\nprint(x)',
      javascript: 'let x = 5;\nx = x + 2;\nconsole.log(x);',
      java: 'int x = 5;\nx = x + 2;\nSystem.out.println(x);',
    },
    options: ['5', '7', '52', 'Dá erro', NAO_SEI], answer: '7',
  },
  {
    id: 'k_concat', kind: 'knowledge', topic: 'texto vs. número', title: 'Atenção às aspas! O que aparece?',
    code: {
      python: 'a = "2"\nb = "3"\nprint(a + b)',
      javascript: 'const a = "2";\nconst b = "3";\nconsole.log(a + b);',
      java: 'String a = "2";\nString b = "3";\nSystem.out.println(a + b);',
    },
    options: ['5', '23', '2 3', 'Dá erro', NAO_SEI], answer: '23',
  },
  {
    id: 'k_loop', kind: 'knowledge', topic: 'laços (for)', title: 'Quais números aparecem?',
    code: {
      python: 'for i in range(3):\n    print(i)',
      javascript: 'for (let i = 0; i < 3; i++) {\n  console.log(i);\n}',
      java: 'for (int i = 0; i < 3; i++) {\n    System.out.println(i);\n}',
    },
    options: ['1 2 3', '0 1 2', '0 1 2 3', 'Só o 3', NAO_SEI], answer: '0 1 2',
  },
  {
    id: 'k_list', kind: 'knowledge', topic: 'listas e índices', title: 'O que aparece?',
    code: {
      python: 'nums = [10, 20, 30]\nprint(nums[1])',
      javascript: 'const nums = [10, 20, 30];\nconsole.log(nums[1]);',
      java: 'int[] nums = {10, 20, 30};\nSystem.out.println(nums[1]);',
    },
    options: ['10', '20', '30', 'Dá erro', NAO_SEI], answer: '20',
  },
  {
    id: 'k_func', kind: 'knowledge', topic: 'funções', title: 'Uma função chamando a si mesma no argumento. O que aparece?',
    code: {
      python: 'def dobro(n):\n    return n * 2\n\nprint(dobro(dobro(3)))',
      javascript: 'function dobro(n) {\n  return n * 2;\n}\n\nconsole.log(dobro(dobro(3)));',
      java: 'static int dobro(int n) {\n    return n * 2;\n}\n\n// dentro do main:\nSystem.out.println(dobro(dobro(3)));',
    },
    options: ['6', '9', '12', 'Dá erro', NAO_SEI], answer: '12',
  },
  {
    id: 'k_range', kind: 'knowledge', topic: 'limites do laço', title: 'Este código queria somar 1 + 2 + 3 + 4 + 5. O que ele mostra de verdade?',
    code: {
      python: 'total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)',
      javascript: 'let total = 0;\nfor (let i = 1; i < 5; i++) {\n  total += i;\n}\nconsole.log(total);',
      java: 'int total = 0;\nfor (int i = 1; i < 5; i++) {\n    total += i;\n}\nSystem.out.println(total);',
    },
    options: ['15', '10', '14', 'Dá erro', NAO_SEI], answer: '10',
  },
  {
    id: 'k_while', kind: 'knowledge', topic: 'laços (while)', title: 'Quantas vezes o laço roda? (o valor de passos no final)',
    code: {
      python: 'n = 10\npassos = 0\nwhile n > 1:\n    n = n // 2\n    passos += 1\nprint(passos)',
      javascript: 'let n = 10;\nlet passos = 0;\nwhile (n > 1) {\n  n = Math.floor(n / 2);\n  passos++;\n}\nconsole.log(passos);',
      java: 'int n = 10;\nint passos = 0;\nwhile (n > 1) {\n    n = n / 2;\n    passos++;\n}\nSystem.out.println(passos);',
    },
    options: ['3', '4', '5', 'Laço infinito', NAO_SEI], answer: '3',
  },
  {
    id: 'k_ref', kind: 'knowledge', topic: 'referências de listas', title: 'Pegadinha: b é uma cópia de a? O que aparece?',
    code: {
      python: 'a = [1, 2]\nb = a\nb.append(3)\nprint(len(a))',
      javascript: 'const a = [1, 2];\nconst b = a;\nb.push(3);\nconsole.log(a.length);',
      java: 'List<Integer> a = new ArrayList<>(List.of(1, 2));\nList<Integer> b = a;\nb.add(3);\nSystem.out.println(a.size());',
    },
    options: ['2', '3', '5', 'Dá erro', NAO_SEI], answer: '3',
  },
];

export type Nivel = 'zero' | 'basic' | 'intermediate' | 'advanced';
const LEVELS: Record<Nivel, string> = {
  zero: 'iniciante absoluto',
  basic: 'iniciante',
  intermediate: 'intermediário',
  advanced: 'avançado',
};

// Versão sem as respostas, para mandar ao navegador.
export const publicQuiz = () => QUIZ.map(({ answer: _resposta, ...q }) => q);

export interface Pergunta { id: string; kind: 'profile' | 'knowledge'; title: string; options: string[]; multi?: boolean; topic?: string; answer?: string; code?: Record<string, string> }
export function gradeQuiz(answers: Record<string, unknown> = {}) {
  function pick(id: string, multi: true): string[];
  function pick(id: string): string | null;
  function pick(id: string, _multi?: boolean): string[] | string | null {
    const q = (QUIZ as Pergunta[]).find((x) => x.id === id);
    if (!q) return null;
    const v = answers[id];
    if (q.multi) return (Array.isArray(v) ? v : []).filter((o): o is string => q.options.includes(o)).slice(0, 10);
    return typeof v === 'string' && q.options.includes(v) ? v : null;
  }
  const knowledge = QUIZ.filter((q) => q.kind === 'knowledge');
  const results = knowledge.map((q) => ({ id: q.id, topic: q.topic, correct: answers[q.id] === q.answer, answer: q.answer, given: pick(q.id) }));
  const score = results.filter((r) => r.correct).length;
  const total = knowledge.length;

  let level: Nivel = score <= 1 ? 'zero' : score <= 3 ? 'basic' : score <= 6 ? 'intermediate' : 'advanced';
  const experience = pick('experience');
  // Acertar tudo não faz de alguém avançado se nunca fez projeto; e quem trabalha com isso não é "zero".
  if (level === 'advanced' && (experience === 'Nunca programei' || experience === 'Já fiz alguns exercícios')) level = 'intermediate';
  if (level === 'zero' && experience === 'Faço projetos grandes ou trabalho com isso') level = 'basic';

  const languages = pick('languages', true).filter((l) => l !== 'Ainda não sei');
  const profile = {
    level,
    levelLabel: LEVELS[level],
    score,
    total,
    experience,
    languages,
    goal: pick('goal'),
    style: pick('style'),
    weak: results.filter((r) => !r.correct).map((r) => r.topic),
    takenAt: Date.now(),
  };
  return { profile, results };
}
