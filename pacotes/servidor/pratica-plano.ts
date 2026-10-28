// Plano de estudos de UMA pessoa, a partir do questionário (o que ela respondeu), do mini desafio (o que foi medido)
// e dos exercícios (o que aconteceu). Funciona para QUALQUER combinação válida de respostas e não chama IA:
//   1. trilha      — existe trilha com testes automáticos para a tecnologia escolhida;
//   2. adaptada    — mistura trilhas existentes com exercícios guiados (ex.: HTML e CSS = JavaScript + exercícios web);
//   3. montada     — não há trilha: o plano é montado do catálogo local de exercícios guiados daquela tecnologia;
//   4. inicial     — faltam dados (sem questionário, nada escolhido): plano básico de lógica e Python.
// Exercícios guiados não rodam testes no navegador: a pessoa resolve e o Gyde corrige no chat.
import { TRACKS } from './pratica-dados.ts';
import type { Trilha } from './pratica-dados.ts';
import type { TPlano } from '../compartilhado/contratos.ts';

export type NivelPlano = 'basico' | 'intermediario' | 'avancado';
export type TipoPlano = 'trilha' | 'adaptada' | 'montada' | 'inicial';
export interface Guiado { id: string; tecnologia: string; nivel: NivelPlano; topico: string; titulo: string; enunciado: string }
// Perfil salvo do questionário (quiz.ts). Tudo opcional: perfis antigos ou incompletos também viram plano.
export interface Perfil {
  level?: string; levelLabel?: string; score?: number; total?: number; experience?: string | null; languages?: unknown;
  goal?: string | null; style?: string | null; weak?: string[]; takenAt?: number;
  anteriores?: { em?: number; nivel?: string; acertos?: number; total?: number }[];
}
export type Progresso = Record<string, { done: boolean; fails?: number; code?: string }>;
export type Passo =
  | { tipo: 'trilha'; trackId: string; exerciseId: string; titulo: string; tecnologia?: string }
  | { tipo: 'guiado'; id: string; titulo: string; tecnologia: string }
  | { tipo: 'chat'; titulo: string };
export interface Foco { tecnologia: string; tipo: 'trilha' | 'adaptado' | 'guiado'; trilhas: string[]; guiados: number }

export const TECNOLOGIAS = ['Python', 'JavaScript', 'Java', 'C / C++', 'C#', 'PHP', 'HTML e CSS', 'SQL', 'Kotlin', 'Lógica'];
const TRILHAS_DA: Record<string, string[]> = { Python: ['python-basico', 'proj-adivinhacao'], JavaScript: ['js-zero', 'proj-tarefas'], 'Lógica': ['logica'], 'HTML e CSS': ['js-zero', 'proj-tarefas'] };
const NIVEIS: NivelPlano[] = ['basico', 'intermediario', 'avancado'];
const NOME_NIVEL: Record<NivelPlano, string> = { basico: 'básico', intermediario: 'intermediário', avancado: 'avançado' };

// Catálogo local de exercícios guiados (enunciados revisados; a correção é feita pelo Gyde no chat).
// [tecnologia, nível, tópico, título, enunciado]
const C: [string, NivelPlano, string, string, string][] = [
  ['Lógica', 'basico', 'variáveis', 'Troca de valores', 'Escreva os passos (pseudocódigo ou na linguagem que preferir) para trocar os valores de duas variáveis a e b. Ex.: a = 3, b = 7 vira a = 7, b = 3.'],
  ['Lógica', 'basico', 'condições', 'Maior de idade', 'Leia uma idade e mostre "maior de idade" se for 18 ou mais, senão "menor de idade". Pense também em idades negativas.'],
  ['Lógica', 'intermediario', 'laços', 'Tabuada', 'Mostre a tabuada de um número n de 1 a 10, no formato "n x i = resultado".'],
  ['Lógica', 'intermediario', 'listas', 'Maior e menor', 'Dada uma lista de números, encontre o maior e o menor sem usar funções prontas como max ou min.'],
  ['Lógica', 'avancado', 'algoritmos', 'Busca binária', 'Implemente a busca binária numa lista ordenada e explique por que ela é mais rápida que olhar item por item.'],
  ['Lógica', 'avancado', 'recursão', 'Torre de Hanói', 'Escreva uma função recursiva que lista os movimentos da Torre de Hanói para n discos. Quantos movimentos são para n = 4?'],
  ['Python', 'basico', 'texto', 'Iniciais do nome', 'Escreva iniciais(nome) que devolve as iniciais em maiúsculas. Ex.: iniciais("ana maria silva") devolve "AMS".'],
  ['Python', 'basico', 'listas', 'Pares da lista', 'Escreva so_pares(lista) que devolve uma nova lista só com os números pares.'],
  ['Python', 'intermediario', 'dicionários', 'Contar palavras', 'Escreva conta_palavras(texto) que devolve um dicionário com quantas vezes cada palavra aparece (sem diferenciar maiúsculas).'],
  ['Python', 'intermediario', 'arquivos', 'Notas do arquivo', 'Leia um arquivo notas.txt com uma nota por linha e mostre a média, a maior e a menor nota. Trate linhas vazias.'],
  ['Python', 'avancado', 'classes', 'Conta bancária', 'Crie a classe Conta com depositar, sacar (sem deixar o saldo negativo) e extrato. Use exceções para saques inválidos.'],
  ['Python', 'avancado', 'desempenho', 'Duplicados rápido', 'Encontre os números repetidos numa lista com 1 milhão de itens. Compare uma solução com dois laços e outra com set.'],
  ['JavaScript', 'basico', 'funções', 'Preço com desconto', 'Escreva precoFinal(preco, desconto) que aplica um desconto em porcentagem e devolve com 2 casas decimais.'],
  ['JavaScript', 'basico', 'arrays', 'Filtrar aprovados', 'Dado um array de alunos { nome, nota }, use filter para pegar só quem tem nota maior ou igual a 7.'],
  ['JavaScript', 'intermediario', 'objetos', 'Carrinho de compras', 'Escreva um carrinho com adicionar(item), remover(nome) e total(), guardando os itens num array de objetos.'],
  ['JavaScript', 'intermediario', 'async', 'Esperar e mostrar', 'Escreva uma função async que espera 1 segundo (com Promise e setTimeout) e mostra "pronto". Explique o que o await faz.'],
  ['JavaScript', 'avancado', 'fetch', 'Consumir uma API', 'Use fetch para buscar https://api.github.com/users/octocat e mostre o nome e a quantidade de repositórios, tratando erro de rede.'],
  ['JavaScript', 'avancado', 'closures', 'Contador com closure', 'Crie criarContador() que devolve funções incrementar e valor, sem usar variáveis globais. Explique por que funciona.'],
  ['Java', 'basico', 'variáveis', 'Média de três notas', 'Escreva um programa Java que lê três notas com Scanner e mostra a média com uma casa decimal.'],
  ['Java', 'basico', 'condições', 'Par ou ímpar em Java', 'Escreva um método static boolean ehPar(int n) e teste com alguns números no main.'],
  ['Java', 'intermediario', 'arrays', 'Inverter array', 'Escreva um método que recebe int[] e devolve um novo array com os elementos em ordem inversa.'],
  ['Java', 'intermediario', 'classes', 'Classe Aluno', 'Crie a classe Aluno com nome e notas (ArrayList<Double>), um método media() e toString(). Use encapsulamento (private + getters).'],
  ['Java', 'avancado', 'interfaces', 'Formas geométricas', 'Crie a interface Forma com area() e implemente Circulo e Retangulo. Some as áreas de uma List<Forma>.'],
  ['Java', 'avancado', 'coleções', 'Ranking com Map', 'Leia pares nome/pontos e mostre o ranking em ordem decrescente usando Map e streams.'],
  ['C / C++', 'basico', 'variáveis', 'Conversor de temperatura', 'Em C, leia uma temperatura em Celsius com scanf e mostre em Fahrenheit com printf (%.1f).'],
  ['C / C++', 'basico', 'laços', 'Soma até n', 'Em C, leia n e mostre a soma de 1 até n com um laço for. O que acontece se n for negativo?'],
  ['C / C++', 'intermediario', 'vetores', 'Média do vetor', 'Em C, leia 10 números num vetor e mostre a média e quantos estão acima dela.'],
  ['C / C++', 'intermediario', 'ponteiros', 'Troca com ponteiros', 'Em C, escreva void troca(int *a, int *b) e explique por que a versão sem ponteiros não funciona.'],
  ['C / C++', 'avancado', 'memória', 'Vetor dinâmico', 'Em C, leia n, aloque um vetor com malloc, preencha, mostre e libere a memória. Trate falha de alocação.'],
  ['C / C++', 'avancado', 'structs', 'Agenda com struct', 'Em C++, crie uma struct Contato e um std::vector de contatos com busca por nome.'],
  ['C#', 'basico', 'variáveis', 'IMC em C#', 'Escreva um programa C# que lê peso e altura e mostra o IMC com duas casas decimais.'],
  ['C#', 'basico', 'condições', 'Classificar a nota', 'Leia uma nota de 0 a 10 e mostre "Aprovado", "Recuperação" (5 a 6,9) ou "Reprovado". Valide a entrada.'],
  ['C#', 'intermediario', 'listas', 'Lista de tarefas', 'Use List<string> para adicionar, remover e listar tarefas num menu de console.'],
  ['C#', 'intermediario', 'LINQ', 'Filtrar com LINQ', 'Dada uma lista de produtos (Nome, Preco), use LINQ para pegar os 3 mais caros, em ordem.'],
  ['C#', 'avancado', 'classes', 'Herança de funcionários', 'Crie Funcionario e Gerente (herança) com cálculo de salário diferente (override). Mostre a folha total.'],
  ['C#', 'avancado', 'async', 'Tarefas em paralelo', 'Use async/await e Task.WhenAll para simular 3 downloads de tempos diferentes e mostrar quando todos terminam.'],
  ['PHP', 'basico', 'variáveis', 'Saudação em PHP', 'Escreva um script PHP que guarda nome e idade em variáveis e mostra "Olá, Ana! Você tem 17 anos."'],
  ['PHP', 'basico', 'arrays', 'Lista de compras', 'Crie um array de itens e mostre-os numa lista HTML (<ul>) com foreach.'],
  ['PHP', 'intermediario', 'formulários', 'Formulário de contato', 'Crie um formulário com nome e e-mail, receba por POST e valide (campos vazios e e-mail com filter_var).'],
  ['PHP', 'intermediario', 'funções', 'Formatar preço', 'Escreva formatarPreco($valor) que devolve "R$ 1.234,50" usando number_format.'],
  ['PHP', 'avancado', 'banco de dados', 'Listar com PDO', 'Conecte num banco SQLite com PDO e liste produtos com prepared statement (sem concatenar SQL).'],
  ['PHP', 'avancado', 'segurança', 'Login seguro', 'Implemente cadastro e login usando password_hash e password_verify. Explique por que não guardar a senha pura.'],
  ['HTML e CSS', 'basico', 'estrutura', 'Cartão de perfil', 'Faça uma página com um cartão de perfil: foto, nome, uma frase e dois links. Use tags semânticas (header, main, section).'],
  ['HTML e CSS', 'basico', 'formulários', 'Formulário acessível', 'Crie um formulário de cadastro com label ligado a cada input, tipos certos (email, password) e um botão.'],
  ['HTML e CSS', 'intermediario', 'flexbox', 'Barra de navegação', 'Faça um menu horizontal com flexbox: logo à esquerda, links à direita, e que vira coluna em telas pequenas.'],
  ['HTML e CSS', 'intermediario', 'grid', 'Galeria em grid', 'Monte uma galeria de 6 imagens com CSS Grid: 3 colunas no computador, 1 no celular.'],
  ['HTML e CSS', 'avancado', 'responsivo', 'Landing page responsiva', 'Construa uma página com seção principal, 3 benefícios e rodapé, usando variáveis CSS e media queries.'],
  ['HTML e CSS', 'avancado', 'acessibilidade', 'Revisão de acessibilidade', 'Pegue uma página sua e corrija: contraste, textos alternativos, foco visível e navegação por teclado.'],
  ['SQL', 'basico', 'consultas', 'Primeira consulta', 'Numa tabela alunos(id, nome, idade, cidade), escreva a consulta que lista nome e idade de quem mora em "Blumenau".'],
  ['SQL', 'basico', 'ordenação', 'Ordenar e limitar', 'Liste os 5 produtos mais caros de produtos(id, nome, preco), do mais caro para o mais barato.'],
  ['SQL', 'intermediario', 'agregação', 'Vendas por mês', 'Em vendas(id, data, valor), mostre o total vendido por mês, usando GROUP BY e SUM.'],
  ['SQL', 'intermediario', 'relacionamentos', 'Pedidos e clientes', 'Com clientes(id, nome) e pedidos(id, cliente_id, total), liste o nome de cada cliente e quantos pedidos ele fez (incluindo quem fez zero).'],
  ['SQL', 'avancado', 'subconsultas', 'Acima da média', 'Liste os produtos com preço acima da média de preço da própria categoria.'],
  ['SQL', 'avancado', 'modelagem', 'Modelar uma biblioteca', 'Modele as tabelas de uma biblioteca (livros, autores, empréstimos) com chaves primárias e estrangeiras, e escreva o CREATE TABLE.'],
  ['Kotlin', 'basico', 'variáveis', 'val e var', 'Em Kotlin, crie um programa que calcula o preço com frete, usando val e var corretamente. Explique a diferença.'],
  ['Kotlin', 'basico', 'condições', 'when em Kotlin', 'Use when para mostrar o nome do dia da semana a partir de um número de 1 a 7.'],
  ['Kotlin', 'intermediario', 'coleções', 'Filtrar e mapear', 'Dada uma lista de nomes, use filter e map para pegar os que começam com "A" em maiúsculas.'],
  ['Kotlin', 'intermediario', 'classes', 'Data class', 'Crie data class Produto(nome, preco) e ordene uma lista de produtos pelo preço.'],
  ['Kotlin', 'avancado', 'null safety', 'Sem NullPointerException', 'Escreva uma função que recebe String? e devolve o tamanho, usando ?. e ?: sem !!. Explique cada operador.'],
  ['Kotlin', 'avancado', 'coroutines', 'Coroutines', 'Use coroutines (launch e delay) para rodar duas tarefas ao mesmo tempo e mostrar quando cada uma termina.'],
];
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const GUIADOS: Guiado[] = C.map(([tecnologia, nivel, topico, titulo, enunciado]) => ({ id: `g-${slug(tecnologia)}-${slug(titulo)}`, tecnologia, nivel, topico, titulo, enunciado }));
export const findGuiado = (id: string): Guiado | null => GUIADOS.find((g) => g.id === id) || null;

// Tecnologias quando a pessoa não escolheu nenhuma: deduz pelo objetivo.
const PELO_OBJETIVO: Record<string, string[]> = {
  'Ir bem no curso ou na escola': ['Lógica', 'Python'],
  'Conseguir meu primeiro emprego': ['JavaScript', 'SQL'],
  'Criar meus próprios apps e sites': ['HTML e CSS', 'JavaScript'],
  'Criar jogos': ['Python', 'Lógica'],
  'Faculdade, vestibular ou olimpíada': ['Lógica', 'Python'],
};
const NIVEL_DO_QUIZ: Record<string, NivelPlano> = { zero: 'basico', basic: 'basico', intermediate: 'intermediario', advanced: 'avancado' };
const NIVEL_DA_EXPERIENCIA: Record<string, NivelPlano> = { 'Nunca programei': 'basico', 'Já fiz alguns exercícios': 'basico', 'Programo com frequência': 'intermediario', 'Faço projetos grandes ou trabalho com isso': 'avancado' };

export function planoDe(perfil: unknown, progress: Progresso = {}): TPlano {
  const p: Perfil = perfil && typeof perfil === 'object' && !Array.isArray(perfil) ? perfil as Perfil : {};
  const temQuiz = Boolean(p.level);
  const feito = (id: string) => Boolean(progress[id]?.done);
  const trilha = (id: string) => TRACKS.find((t) => t.id === id);
  const feitos = (t: Trilha) => t.exercises.filter((e) => feito(e.id)).length;
  const completa = (t: Trilha) => feitos(t) === t.exercises.length;

  // ---- tecnologias e nível (só valores conhecidos; o resto é ignorado)
  const declaradas = (Array.isArray(p.languages) ? p.languages : []).filter((l): l is string => typeof l === 'string' && TECNOLOGIAS.includes(l));
  const peloObjetivo = (p.goal && PELO_OBJETIVO[p.goal]) || [];
  const tecnologias = declaradas.length ? declaradas : peloObjetivo.length ? peloObjetivo : ['Lógica', 'Python'];
  const nivel: NivelPlano = (p.level && NIVEL_DO_QUIZ[p.level]) || (p.experience && NIVEL_DA_EXPERIENCIA[p.experience]) || 'basico';
  const iNivel = NIVEIS.indexOf(nivel);

  // ---- focos: para cada tecnologia, trilha pronta (com testes) ou exercícios guiados do catálogo
  const focos: Foco[] = tecnologias.slice(0, 4).map((tec): Foco => {
    const trilhas = (TRILHAS_DA[tec] || []).filter((id) => trilha(id));
    const guiados = GUIADOS.filter((g) => g.tecnologia === tec);
    if (tec === 'HTML e CSS') return { tecnologia: tec, tipo: 'adaptado', trilhas, guiados: guiados.length };
    return trilhas.length ? { tecnologia: tec, tipo: 'trilha', trilhas, guiados: guiados.length } : { tecnologia: tec, tipo: 'guiado', trilhas: [], guiados: guiados.length };
  });
  const tipos = new Set(focos.map((f) => f.tipo));
  const tipo: TipoPlano = !temQuiz && !declaradas.length && !peloObjetivo.length ? 'inicial'
    : tipos.size === 1 && tipos.has('trilha') ? 'trilha'
      : tipos.has('trilha') || tipos.has('adaptado') ? 'adaptada' : 'montada';

  // ---- ordem das trilhas com testes (o mais indicado primeiro; concluídas vão para o fim)
  const motivos: Record<string, string[]> = {};
  const pontos = (t: Trilha) => {
    const m: string[] = []; let n = 0;
    if (completa(t)) return { n: -100, m: ['concluída'] };
    const daTec = focos.find((f) => f.trilhas.includes(t.id));
    if (daTec) { n += 3; m.push(declaradas.length ? `você escolheu ${daTec.tecnologia}` : 'combina com o seu objetivo'); }
    const basica = t.id === 'python-basico' || t.id === 'js-zero';
    if (nivel === 'basico' && basica) { n += 2; m.push('combina com o seu nível'); }
    if (nivel !== 'basico' && !basica) { n += 2; m.push('você já passou do básico'); }
    if (nivel === 'avancado' && basica) n -= 2; // quem já sabe não precisa refazer o básico
    if (p.goal === 'Criar jogos' && t.id === 'proj-adivinhacao') { n += 2; m.push('seu objetivo é criar jogos'); }
    if (p.goal === 'Faculdade, vestibular ou olimpíada' && t.id === 'logica') { n += 2; m.push('lógica cai em provas e olimpíadas'); }
    if (p.goal === 'Conseguir meu primeiro emprego' && t.projeto) { n += 1; m.push('projetos contam no portfólio'); }
    if (feitos(t) > 0) { n += 1.5; m.push('você já começou'); }
    return { n, m };
  };
  const ordem = TRACKS.map((t) => { const r = pontos(t); motivos[t.id] = r.m; return { id: t.id, n: r.n }; })
    .sort((a, b) => b.n - a.n).map((x) => x.id);
  const indicadas = new Set(focos.flatMap((f) => f.trilhas));
  const recomendada = ordem.map(trilha).find((t) => t && indicadas.has(t.id) && !completa(t))?.id || null;

  // ---- exercícios guiados do plano: tecnologias do plano, do nível da pessoa para cima (e o anterior, se for avançado)
  const guiadosDoPlano = GUIADOS
    .filter((g) => focos.some((f) => f.tipo !== 'trilha' && f.tecnologia === g.tecnologia) || (tipo === 'inicial' && g.tecnologia === 'Lógica'))
    .filter((g) => NIVEIS.indexOf(g.nivel) >= Math.max(0, iNivel - 1) && NIVEIS.indexOf(g.nivel) <= iNivel + 1)
    .sort((a, b) => Math.abs(NIVEIS.indexOf(a.nivel) - iNivel) - Math.abs(NIVEIS.indexOf(b.nivel) - iNivel) || NIVEIS.indexOf(a.nivel) - NIVEIS.indexOf(b.nivel))
    .map((g) => ({ ...g, feito: feito(g.id) }));

  // ---- próximo passo: trilha recomendada, senão guiado pendente, senão qualquer trilha pendente
  let proximo: Passo | null = null;
  const rec = recomendada ? trilha(recomendada) : undefined;
  const exRec = rec?.exercises.find((e) => !feito(e.id));
  const guiadoPendente = guiadosDoPlano.find((g) => !g.feito);
  const guiadoPrimeiro = focos[0] && focos[0].tipo !== 'trilha';
  if (guiadoPrimeiro && guiadoPendente) proximo = { tipo: 'guiado', id: guiadoPendente.id, titulo: guiadoPendente.titulo, tecnologia: guiadoPendente.tecnologia };
  else if (rec && exRec) proximo = { tipo: 'trilha', trackId: rec.id, exerciseId: exRec.id, titulo: exRec.title, tecnologia: rec.id === 'logica' ? 'Lógica' : rec.lang === 'python' ? 'Python' : 'JavaScript' };
  else if (guiadoPendente) proximo = { tipo: 'guiado', id: guiadoPendente.id, titulo: guiadoPendente.titulo, tecnologia: guiadoPendente.tecnologia };
  // tudo do plano feito: oferece um desafio novo (guiado de nível acima ou qualquer trilha pendente), sem erro
  let novoDesafio: Passo | null = null;
  if (!proximo) {
    const acima = GUIADOS.find((g) => tecnologias.includes(g.tecnologia) && !feito(g.id) && NIVEIS.indexOf(g.nivel) >= iNivel);
    const outraTrilha = ordem.map(trilha).find((t) => t && !completa(t));
    const ex = outraTrilha?.exercises.find((e) => !feito(e.id));
    novoDesafio = acima ? { tipo: 'guiado', id: acima.id, titulo: acima.titulo, tecnologia: acima.tecnologia }
      : outraTrilha && ex ? { tipo: 'trilha', trackId: outraTrilha.id, exerciseId: ex.id, titulo: ex.title }
        : { tipo: 'chat', titulo: `Peça ao Gyde um desafio ${NOME_NIVEL[NIVEIS[Math.min(2, iNivel + 1)]]} de ${tecnologias[0]}` };
  }

  const tentados = Object.entries(progress);
  const plano: TPlano = {
    versao: 2,
    tipo,
    explicacao: {
      trilha: 'Plano com trilhas que têm testes automáticos para o que você escolheu.',
      adaptada: 'Plano adaptado: trilhas com testes automáticos mais exercícios guiados (corrigidos pelo Gyde no chat) para o que ainda não tem trilha.',
      montada: 'Ainda não há trilha com testes automáticos para o que você escolheu, então o plano foi montado com exercícios guiados: você resolve e o Gyde corrige no chat.',
      inicial: 'Plano inicial: sem dados do questionário, começa por lógica e Python, do básico. Responder o questionário personaliza o plano.',
    }[tipo],
    nivel: NOME_NIVEL[nivel],
    tecnologias,
    tecnologiasDeduzidas: !declaradas.length,
    temQuiz,
    declarado: temQuiz ? { experiencia: p.experience || null, linguagens: Array.isArray(p.languages) ? p.languages.filter((l): l is string => typeof l === 'string') : [], objetivo: p.goal || null, estilo: p.style || null, em: p.takenAt || null } : null,
    medido: temQuiz ? { nivel: p.levelLabel || null, acertos: p.score ?? null, total: p.total ?? null, reforcar: p.weak || [], anteriores: p.anteriores || [] } : null,
    observado: {
      feitos: tentados.filter(([, v]) => v.done).length,
      tentativasComErro: tentados.reduce((s, [, v]) => s + (v.fails || 0), 0),
      travados: tentados.filter(([, v]) => (v.fails || 0) > 0 && !v.done).map(([id]) => id),
    },
    focos,
    ordem,
    motivos,
    recomendada,
    guiados: guiadosDoPlano,
    proximo,
    concluido: !proximo,
    novoDesafio,
    semTrilha: focos.filter((f) => f.tipo === 'guiado').map((f) => f.tecnologia),
  };
  return plano;
}

export type Plano = TPlano;
