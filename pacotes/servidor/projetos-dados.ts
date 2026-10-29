// Projetos guiados: um projeto de verdade para cada tecnologia do questionário, feito em etapas.
// A pessoa escreve o código no próprio editor e cola na etapa; o servidor confere critérios objetivos da estrutura do
// código (a função existe, o erro é tratado, a consulta usa JOIN...). Não é execução: é uma conferência do que a etapa
// pede. Cada etapa tem uma solução de referência que fica só no servidor; os testes provam que a referência passa em
// todos os critérios e que os arquivos iniciais não passam (ou seja, o critério mede alguma coisa).
import type { NivelPlano } from './pratica-plano.ts';

export interface Criterio { descricao: string; padrao: string; flags?: string; ausente?: boolean }
export interface Etapa {
  id: string; titulo: string; explicacao: string; arquivo: string; tarefas: string[]; criterios: Criterio[]; dica: string; xp: number;
  referencia: string; // só no servidor
}
export interface Projeto {
  id: string; tecnologia: string; nome: string; descricao: string; objetivo: string; tecnologias: string[]; nivel: NivelPlano;
  prerequisitos: string[]; resultado: string; arquivos: { nome: string; conteudo: string }[]; etapas: Etapa[];
  explicacaoSolucao: string; proximosDesafios: string[];
}

const R = String.raw;

export const PROJETOS: Projeto[] = [
  {
    id: 'pj-python-gastos', tecnologia: 'Python', nome: 'Controle de gastos no terminal', nivel: 'basico',
    descricao: 'Um programa de terminal para anotar gastos, ver o total e guardar tudo num arquivo que continua lá quando você abre de novo.',
    objetivo: 'Praticar funções, listas de dicionários, validação com exceções, arquivos JSON e um menu com laço.',
    tecnologias: ['Python 3', 'módulo json'],
    prerequisitos: ['variáveis e tipos', 'if/elif/else', 'laço while', 'listas'],
    resultado: 'Um gastos.py que abre um menu (adicionar, listar, total, sair), não aceita valor zero ou negativo e guarda os gastos em gastos.json.',
    arquivos: [{ nome: 'gastos.py', conteudo: '# Controle de gastos\n# Etapa 1: escreva aqui a função adicionar_gasto\n\ngastos = []\n' }],
    etapas: [
      {
        id: 'registrar', titulo: 'Registrar um gasto', arquivo: 'gastos.py', xp: 20,
        explicacao: 'Cada gasto vira um dicionário com descrição e valor, guardado numa lista. Valor zero ou negativo não faz sentido: o programa precisa recusar.',
        tarefas: ['Crie adicionar_gasto(gastos, descricao, valor).', 'Se valor for zero ou negativo, lance ValueError com uma mensagem clara.', 'Acrescente {"descricao": ..., "valor": ...} na lista.'],
        criterios: [
          { descricao: 'define adicionar_gasto(gastos, descricao, valor)', padrao: R`def\s+adicionar_gasto\s*\(\s*gastos\s*,\s*descricao\s*,\s*valor\s*\)\s*:` },
          { descricao: 'recusa valor zero ou negativo', padrao: R`if\s+(valor\s*<=\s*0|not\s+valor\s*>\s*0|valor\s*<\s*=\s*0|0\s*>=\s*valor)` },
          { descricao: 'lança ValueError', padrao: R`raise\s+ValueError\s*\(` },
          { descricao: 'acrescenta o gasto na lista', padrao: R`gastos\.append\s*\(` },
        ],
        dica: 'Comece pela validação: um if no topo da função que dá raise ValueError("...") já resolve o caso ruim. Depois, gastos.append({...}).',
        referencia: 'def adicionar_gasto(gastos, descricao, valor):\n    if valor <= 0:\n        raise ValueError("O valor precisa ser maior que zero")\n    gastos.append({"descricao": descricao, "valor": valor})\n',
      },
      {
        id: 'resumo', titulo: 'Total e maior gasto', arquivo: 'gastos.py', xp: 20,
        explicacao: 'Com os gastos guardados, o programa precisa responder duas perguntas: quanto gastei no total e qual foi o maior gasto. A lista pode estar vazia.',
        tarefas: ['Crie total(gastos) que devolve a soma dos valores.', 'Crie maior_gasto(gastos) que devolve o gasto de maior valor.', 'Se a lista estiver vazia, maior_gasto devolve None.'],
        criterios: [
          { descricao: 'define total(gastos)', padrao: R`def\s+total\s*\(\s*gastos\s*\)\s*:` },
          { descricao: 'define maior_gasto(gastos)', padrao: R`def\s+maior_gasto\s*\(\s*gastos\s*\)\s*:` },
          { descricao: 'trata a lista vazia', padrao: R`if\s+(not\s+gastos|len\s*\(\s*gastos\s*\)\s*==\s*0)` },
          { descricao: 'devolve None quando não há gastos', padrao: R`return\s+None` },
        ],
        dica: 'sum(g["valor"] for g in gastos) soma tudo numa linha. Para o maior, max(gastos, key=lambda g: g["valor"]) funciona, mas só depois de conferir se a lista tem algo.',
        referencia: 'def total(gastos):\n    return sum(g["valor"] for g in gastos)\n\ndef maior_gasto(gastos):\n    if not gastos:\n        return None\n    return max(gastos, key=lambda g: g["valor"])\n',
      },
      {
        id: 'arquivo', titulo: 'Guardar em arquivo', arquivo: 'gastos.py', xp: 25,
        explicacao: 'Sem arquivo, tudo some quando o programa fecha. JSON guarda a lista do jeito que ela é. Na primeira vez o arquivo ainda não existe, e isso não pode ser um erro.',
        tarefas: ['import json no topo.', 'Crie salvar(gastos, caminho) usando with open(..., "w") e json.dump.', 'Crie carregar(caminho) com json.load, devolvendo [] se o arquivo não existir (FileNotFoundError).'],
        criterios: [
          { descricao: 'importa o módulo json', padrao: R`^\s*import\s+json` },
          { descricao: 'define salvar(gastos, caminho) com json.dump', padrao: R`def\s+salvar\s*\(\s*gastos\s*,\s*caminho\s*\)[\s\S]*json\.dump\s*\(` },
          { descricao: 'abre o arquivo com with open', padrao: R`with\s+open\s*\(` },
          { descricao: 'define carregar(caminho) com json.load', padrao: R`def\s+carregar\s*\(\s*caminho\s*\)[\s\S]*json\.load\s*\(` },
          { descricao: 'trata o arquivo que ainda não existe', padrao: R`except\s+FileNotFoundError` },
        ],
        dica: 'try: with open(caminho, encoding="utf-8") as f: return json.load(f) / except FileNotFoundError: return []. O with fecha o arquivo sozinho.',
        referencia: 'import json\n\ndef salvar(gastos, caminho):\n    with open(caminho, "w", encoding="utf-8") as f:\n        json.dump(gastos, f, ensure_ascii=False)\n\ndef carregar(caminho):\n    try:\n        with open(caminho, encoding="utf-8") as f:\n            return json.load(f)\n    except FileNotFoundError:\n        return []\n',
      },
      {
        id: 'menu', titulo: 'O menu', arquivo: 'gastos.py', xp: 35,
        explicacao: 'Agora junta tudo: um laço que mostra as opções, lê a escolha e chama a função certa, até a pessoa escolher sair. Valor digitado errado não pode derrubar o programa.',
        tarefas: ['Crie main() com um while True que mostra o menu e lê a opção com input.', 'Converta o valor com float dentro de try/except ValueError.', 'Saia do laço com break e salve antes de sair.', 'Chame main() dentro de if __name__ == "__main__":.'],
        criterios: [
          { descricao: 'define main()', padrao: R`def\s+main\s*\(\s*\)\s*:` },
          { descricao: 'laço while True', padrao: R`while\s+True\s*:` },
          { descricao: 'lê a opção com input', padrao: R`input\s*\(` },
          { descricao: 'converte o valor com float', padrao: R`float\s*\(` },
          { descricao: 'trata valor inválido', padrao: R`except\s+ValueError` },
          { descricao: 'sai do laço com break', padrao: R`\bbreak\b` },
          { descricao: 'usa if __name__ == "__main__"', padrao: R`if\s+__name__\s*==\s*["']__main__["']\s*:` },
        ],
        dica: 'Dentro do while: opcao = input("..."). if opcao == "1": ... elif opcao == "4": salvar(...); break. O try/except ValueError em volta do float(input(...)) cobre o "abc" digitado no valor e também o raise da etapa 1.',
        referencia: 'def main():\n    gastos = carregar("gastos.json")\n    while True:\n        opcao = input("1 adicionar, 2 listar, 3 total, 4 sair: ")\n        if opcao == "1":\n            descricao = input("Descrição: ")\n            try:\n                adicionar_gasto(gastos, descricao, float(input("Valor: ")))\n            except ValueError as e:\n                print("Valor inválido:", e)\n        elif opcao == "2":\n            for g in gastos:\n                print(g["descricao"], g["valor"])\n        elif opcao == "3":\n            print("Total:", total(gastos))\n        elif opcao == "4":\n            salvar(gastos, "gastos.json")\n            break\n\nif __name__ == "__main__":\n    main()\n',
      },
    ],
    explicacaoSolucao: 'O programa separa a regra (adicionar_gasto, total, maior_gasto) da entrada e saída (main). Isso permite testar as funções sem digitar nada, e a validação fica num lugar só: o raise ValueError da etapa 1 é tratado no menu pelo mesmo except que cobre o float inválido. O arquivo JSON é lido uma vez ao abrir e gravado ao sair; o FileNotFoundError transforma "primeira vez" num caso normal, em vez de um erro.',
    proximosDesafios: ['Adicione uma categoria a cada gasto e mostre o total por categoria (dicionário de somas).', 'Salve a cada gasto adicionado, não só ao sair (e se o programa fechar no meio?).', 'Escreva testes com assert para total e maior_gasto, incluindo a lista vazia.'],
  },
  {
    id: 'pj-js-pomodoro', tecnologia: 'JavaScript', nome: 'Cronômetro Pomodoro no navegador', nivel: 'basico',
    descricao: 'Um cronômetro de 25 minutos com botões de começar, pausar e reiniciar, que mostra o tempo no formato mm:ss.',
    objetivo: 'Praticar manipulação do DOM, eventos de clique, setInterval/clearInterval e formatação de texto.',
    tecnologias: ['HTML', 'JavaScript no navegador'],
    prerequisitos: ['funções', 'variáveis let/const', 'if/else', 'noções de HTML'],
    resultado: 'Uma página que conta de 25:00 até 00:00, pausa e continua de onde parou, reinicia e avisa quando o tempo acaba.',
    arquivos: [
      { nome: 'index.html', conteudo: '<!doctype html>\n<html lang="pt-BR">\n<head><meta charset="utf-8"><title>Pomodoro</title></head>\n<body>\n  <h1 id="tempo">25:00</h1>\n  <button id="comecar">Começar</button>\n  <button id="pausar">Pausar</button>\n  <button id="reiniciar">Reiniciar</button>\n  <script src="app.js"></script>\n</body>\n</html>\n' },
      { nome: 'app.js', conteudo: '// Pomodoro\n// Etapa 1: escreva aqui a função formatar(segundos)\n\nlet restante = 25 * 60;\n' },
    ],
    etapas: [
      {
        id: 'formatar', titulo: 'Mostrar o tempo como mm:ss', arquivo: 'app.js', xp: 20,
        explicacao: 'O cronômetro guarda os segundos que faltam como um número. Para mostrar na tela, 1500 vira "25:00" e 65 vira "01:05": minutos e segundos sempre com dois dígitos.',
        tarefas: ['Crie formatar(segundos) que devolve o texto mm:ss.', 'Use Math.floor para os minutos e % 60 para os segundos.', 'Complete com zero à esquerda usando padStart(2, "0").'],
        criterios: [
          { descricao: 'define formatar(segundos)', padrao: R`(function\s+formatar\s*\(\s*segundos\s*\)|const\s+formatar\s*=\s*\(?\s*segundos\s*\)?\s*=>)` },
          { descricao: 'calcula os minutos com Math.floor', padrao: R`Math\.floor\s*\(\s*segundos\s*\/\s*60\s*\)` },
          { descricao: 'calcula os segundos com % 60', padrao: R`segundos\s*%\s*60` },
          { descricao: 'completa com zero à esquerda', padrao: R`padStart\s*\(\s*2\s*,\s*['"]0['"]\s*\)` },
        ],
        dica: 'String(5).padStart(2, "0") dá "05". Monte o texto com template string: `${mm}:${ss}`.',
        referencia: 'function formatar(segundos) {\n  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");\n  const ss = String(segundos % 60).padStart(2, "0");\n  return `${mm}:${ss}`;\n}\n',
      },
      {
        id: 'contar', titulo: 'Contar de verdade', arquivo: 'app.js', xp: 25,
        explicacao: 'setInterval chama uma função a cada segundo. Ela tira um segundo do restante e atualiza a tela. Clicar duas vezes em Começar não pode criar dois intervalos (o tempo andaria em dobro).',
        tarefas: ['Pegue o elemento #tempo e o botão #comecar com document.querySelector.', 'No clique de Começar, crie o intervalo com setInterval(..., 1000) e guarde o id numa variável.', 'Se já houver um intervalo rodando, não crie outro.', 'A cada segundo, diminua restante e mostre com textContent.'],
        criterios: [
          { descricao: 'pega os elementos com querySelector ou getElementById', padrao: R`document\.(querySelector|getElementById)\s*\(` },
          { descricao: 'reage ao clique com addEventListener', padrao: R`addEventListener\s*\(\s*['"]click['"]` },
          { descricao: 'conta a cada 1000 ms com setInterval', padrao: R`setInterval\s*\([\s\S]*?,\s*1000\s*\)` },
          { descricao: 'guarda o id do intervalo numa variável', padrao: R`\w+\s*=\s*setInterval\s*\(` },
          { descricao: 'evita dois intervalos ao mesmo tempo', padrao: R`if\s*\(\s*(\w+\s*(!==?|===?)\s*null|!?\s*\w+)\s*\)\s*(return|\{)` },
          { descricao: 'mostra o tempo com textContent (não innerHTML)', padrao: R`\.textContent\s*=` },
        ],
        dica: 'let intervalo = null; no clique: if (intervalo) return; intervalo = setInterval(() => { restante--; tempo.textContent = formatar(restante); }, 1000);',
        referencia: 'const tempo = document.querySelector("#tempo");\nlet intervalo = null;\n\ndocument.querySelector("#comecar").addEventListener("click", () => {\n  if (intervalo) return;\n  intervalo = setInterval(() => {\n    restante--;\n    tempo.textContent = formatar(restante);\n  }, 1000);\n});\n',
      },
      {
        id: 'controles', titulo: 'Pausar, reiniciar e terminar', arquivo: 'app.js', xp: 35,
        explicacao: 'Pausar é parar o intervalo sem mexer no restante. Reiniciar é parar e voltar para 25:00. Quando chega a zero, o cronômetro para sozinho e avisa.',
        tarefas: ['No clique de Pausar, chame clearInterval e volte a variável do intervalo para null.', 'No clique de Reiniciar, pare e volte restante para 25 * 60.', 'Quando restante chegar a 0, pare o intervalo e avise (alert ou um texto na página).'],
        criterios: [
          { descricao: 'para o intervalo com clearInterval', padrao: R`clearInterval\s*\(` },
          { descricao: 'libera a variável do intervalo (= null)', padrao: R`\w+\s*=\s*null\s*;?` },
          { descricao: 'reinicia para 25 minutos', padrao: R`restante\s*=\s*25\s*\*\s*60` },
          { descricao: 'percebe quando o tempo acaba', padrao: R`if\s*\(\s*restante\s*(<=|===?)\s*0\s*\)` },
          { descricao: 'tem os três botões ligados', padrao: R`#?comecar[\s\S]*#?pausar[\s\S]*#?reiniciar|#?pausar[\s\S]*#?reiniciar[\s\S]*#?comecar` },
        ],
        dica: 'Escreva uma função parar() { clearInterval(intervalo); intervalo = null; } e use nos três lugares: Pausar, Reiniciar e quando restante chega a 0.',
        referencia: 'const tempo = document.querySelector("#tempo");\nlet intervalo = null;\nfunction parar() {\n  clearInterval(intervalo);\n  intervalo = null;\n}\ndocument.querySelector("#comecar").addEventListener("click", () => {\n  if (intervalo) return;\n  intervalo = setInterval(() => {\n    restante--;\n    tempo.textContent = formatar(restante);\n    if (restante <= 0) { parar(); alert("Hora da pausa!"); }\n  }, 1000);\n});\ndocument.querySelector("#pausar").addEventListener("click", parar);\ndocument.querySelector("#reiniciar").addEventListener("click", () => {\n  parar();\n  restante = 25 * 60;\n  tempo.textContent = formatar(restante);\n});\n',
      },
    ],
    explicacaoSolucao: 'O estado inteiro do cronômetro são duas variáveis: restante (quanto falta) e intervalo (se está rodando). Toda ação muda essas duas e depois a tela é atualizada a partir delas. A função parar() evita repetir o mesmo código em três lugares, e o if (intervalo) return impede dois setInterval ao mesmo tempo, o bug mais comum nesse projeto. textContent é usado no lugar de innerHTML porque só escreve texto, sem interpretar HTML.',
    proximosDesafios: ['Alterne automaticamente entre 25 minutos de foco e 5 de pausa, contando os ciclos.', 'Mostre o tempo também no título da aba (document.title).', 'Guarde quantos pomodoros foram feitos hoje no localStorage.'],
  },
  {
    id: 'pj-java-biblioteca', tecnologia: 'Java', nome: 'Biblioteca no console', nivel: 'intermediario',
    descricao: 'Um sistema de console para cadastrar livros, emprestar, devolver e buscar por autor.',
    objetivo: 'Praticar classes com encapsulamento, ArrayList, exceções e um menu com Scanner.',
    tecnologias: ['Java 17 ou mais novo'],
    prerequisitos: ['tipos e variáveis', 'if/else e laços', 'métodos', 'noção de classe e objeto'],
    resultado: 'Um programa com as classes Livro, Biblioteca e Main que empresta e devolve livros e recusa emprestar um livro já emprestado.',
    arquivos: [
      { nome: 'Livro.java', conteudo: '// Etapa 1: a classe Livro\npublic class Livro {\n}\n' },
      { nome: 'Biblioteca.java', conteudo: '// Etapa 2: a classe Biblioteca\npublic class Biblioteca {\n}\n' },
      { nome: 'Main.java', conteudo: '// Etapa 3: o menu\npublic class Main {\n    public static void main(String[] args) {\n    }\n}\n' },
    ],
    etapas: [
      {
        id: 'livro', titulo: 'A classe Livro', arquivo: 'Livro.java', xp: 25,
        explicacao: 'Um livro tem título, autor e se está emprestado. Os campos ficam private: quem usa a classe só mexe neles pelos métodos, e é a classe que garante as regras.',
        tarefas: ['Campos private: titulo, autor (String) e emprestado (boolean).', 'Construtor Livro(String titulo, String autor) que começa não emprestado.', 'Getters getTitulo, getAutor e isEmprestado.', 'Métodos emprestar() e devolver(); emprestar() lança IllegalStateException se já estiver emprestado.'],
        criterios: [
          { descricao: 'campos private', padrao: R`private\s+(final\s+)?String\s+titulo[\s\S]*private\s+(final\s+)?String\s+autor[\s\S]*private\s+boolean\s+emprestado` },
          { descricao: 'construtor Livro(String titulo, String autor)', padrao: R`public\s+Livro\s*\(\s*String\s+titulo\s*,\s*String\s+autor\s*\)` },
          { descricao: 'usa this. para os campos', padrao: R`this\.titulo\s*=\s*titulo` },
          { descricao: 'getters', padrao: R`getTitulo\s*\(\s*\)[\s\S]*getAutor\s*\(\s*\)[\s\S]*isEmprestado\s*\(\s*\)` },
          { descricao: 'recusa emprestar duas vezes', padrao: R`throw\s+new\s+IllegalStateException\s*\(` },
          { descricao: 'método devolver()', padrao: R`void\s+devolver\s*\(\s*\)` },
        ],
        dica: 'Em emprestar(): if (emprestado) throw new IllegalStateException("Livro já emprestado"); emprestado = true;',
        referencia: 'public class Livro {\n    private final String titulo;\n    private final String autor;\n    private boolean emprestado;\n\n    public Livro(String titulo, String autor) {\n        this.titulo = titulo;\n        this.autor = autor;\n    }\n    public String getTitulo() { return titulo; }\n    public String getAutor() { return autor; }\n    public boolean isEmprestado() { return emprestado; }\n    public void emprestar() {\n        if (emprestado) throw new IllegalStateException("Livro já emprestado");\n        emprestado = true;\n    }\n    public void devolver() { emprestado = false; }\n}\n',
      },
      {
        id: 'biblioteca', titulo: 'A classe Biblioteca', arquivo: 'Biblioteca.java', xp: 30,
        explicacao: 'A biblioteca guarda os livros numa lista e oferece as operações: cadastrar, buscar por autor e listar os disponíveis.',
        tarefas: ['Campo private List<Livro> livros = new ArrayList<>().', 'Método adicionar(Livro livro).', 'Método buscarPorAutor(String autor) que devolve uma List<Livro> (ignore maiúsculas).', 'Método disponiveis() que devolve só os não emprestados.'],
        criterios: [
          { descricao: 'importa List e ArrayList', padrao: R`import\s+java\.util\.(\*|List|ArrayList)` },
          { descricao: 'lista private de livros', padrao: R`private\s+(final\s+)?List<Livro>\s+livros\s*=\s*new\s+ArrayList<>\s*\(\s*\)` },
          { descricao: 'método adicionar(Livro livro)', padrao: R`void\s+adicionar\s*\(\s*Livro\s+\w+\s*\)` },
          { descricao: 'buscarPorAutor devolve List<Livro>', padrao: R`List<Livro>\s+buscarPorAutor\s*\(\s*String\s+\w+\s*\)` },
          { descricao: 'compara ignorando maiúsculas', padrao: R`equalsIgnoreCase\s*\(|toLowerCase\s*\(` },
          { descricao: 'disponiveis() filtra os não emprestados', padrao: R`List<Livro>\s+disponiveis\s*\(\s*\)[\s\S]*!\s*\w+\.isEmprestado\s*\(\s*\)` },
        ],
        dica: 'Com streams: livros.stream().filter(l -> l.getAutor().equalsIgnoreCase(autor)).toList(). Com for também vale: uma lista nova e um if dentro do laço.',
        referencia: 'import java.util.ArrayList;\nimport java.util.List;\n\npublic class Biblioteca {\n    private final List<Livro> livros = new ArrayList<>();\n\n    public void adicionar(Livro livro) { livros.add(livro); }\n    public List<Livro> buscarPorAutor(String autor) {\n        return livros.stream().filter(l -> l.getAutor().equalsIgnoreCase(autor)).toList();\n    }\n    public List<Livro> disponiveis() {\n        return livros.stream().filter(l -> !l.isEmprestado()).toList();\n    }\n}\n',
      },
      {
        id: 'menu', titulo: 'O menu no console', arquivo: 'Main.java', xp: 35,
        explicacao: 'O Main conversa com a pessoa: lê opções com Scanner e chama a Biblioteca. A exceção de "já emprestado" vira uma mensagem, sem derrubar o programa.',
        tarefas: ['Crie um Scanner lendo System.in.', 'Laço que mostra o menu até a pessoa escolher sair.', 'Use switch para as opções.', 'Ao emprestar, trate IllegalStateException com try/catch e mostre a mensagem.'],
        criterios: [
          { descricao: 'importa e cria o Scanner', padrao: R`new\s+Scanner\s*\(\s*System\.in\s*\)` },
          { descricao: 'cria a Biblioteca', padrao: R`new\s+Biblioteca\s*\(\s*\)` },
          { descricao: 'laço do menu', padrao: R`while\s*\(|do\s*\{` },
          { descricao: 'switch nas opções', padrao: R`switch\s*\(` },
          { descricao: 'trata o livro já emprestado', padrao: R`catch\s*\(\s*IllegalStateException\s+\w+\s*\)` },
          { descricao: 'lê a entrada com nextLine', padrao: R`\.nextLine\s*\(\s*\)` },
        ],
        dica: 'Ler tudo com nextLine() e converter com Integer.parseInt evita o problema clássico de misturar nextInt() com nextLine().',
        referencia: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        Biblioteca b = new Biblioteca();\n        boolean rodando = true;\n        while (rodando) {\n            System.out.println("1 cadastrar, 2 emprestar, 3 disponíveis, 0 sair");\n            switch (sc.nextLine()) {\n                case "1" -> b.adicionar(new Livro(sc.nextLine(), sc.nextLine()));\n                case "2" -> {\n                    for (Livro l : b.buscarPorAutor(sc.nextLine())) {\n                        try { l.emprestar(); System.out.println("Emprestado: " + l.getTitulo()); }\n                        catch (IllegalStateException e) { System.out.println(e.getMessage()); }\n                    }\n                }\n                case "3" -> b.disponiveis().forEach(l -> System.out.println(l.getTitulo()));\n                case "0" -> rodando = false;\n                default -> System.out.println("Opção inválida");\n            }\n        }\n    }\n}\n',
      },
    ],
    explicacaoSolucao: 'Cada classe cuida de uma coisa: Livro protege a regra "não emprestar duas vezes", Biblioteca organiza a coleção e Main só conversa com a pessoa. Como os campos são private, não existe jeito de marcar um livro como emprestado sem passar por emprestar(), e a regra não pode ser esquecida. A exceção sobe do Livro até o Main, que é quem sabe falar com a pessoa.',
    proximosDesafios: ['Guarde a data do empréstimo (LocalDate) e mostre os atrasados há mais de 14 dias.', 'Salve os livros num arquivo CSV e carregue ao abrir.', 'Escreva testes com JUnit para Livro.emprestar() e Biblioteca.disponiveis().'],
  },
  {
    id: 'pj-c-agenda', tecnologia: 'C / C++', nome: 'Agenda de contatos em C', nivel: 'intermediario',
    descricao: 'Uma agenda de terminal em C que cadastra contatos, lista e salva num arquivo de texto.',
    objetivo: 'Praticar struct, vetores com limite, leitura segura de texto, funções com ponteiros e arquivos.',
    tecnologias: ['C (C99 ou mais novo)', 'gcc ou outro compilador'],
    prerequisitos: ['tipos e printf/scanf', 'laços', 'vetores', 'noção de ponteiro'],
    resultado: 'Um agenda.c que guarda até 100 contatos, não estoura o vetor nem as strings e grava os contatos em agenda.txt.',
    arquivos: [{ nome: 'agenda.c', conteudo: '#include <stdio.h>\n\n/* Etapa 1: a struct Contato */\n\nint main(void) {\n    return 0;\n}\n' }],
    etapas: [
      {
        id: 'struct', titulo: 'A struct e o vetor', arquivo: 'agenda.c', xp: 25,
        explicacao: 'Um contato tem nome e telefone, com tamanho máximo. A agenda é um vetor de contatos com um contador de quantos estão em uso.',
        tarefas: ['#define MAX 100.', 'struct Contato com char nome[50] e char telefone[20].', 'Um vetor struct Contato agenda[MAX] e int total = 0.'],
        criterios: [
          { descricao: 'define o limite com #define MAX', padrao: R`#define\s+MAX\s+\d+` },
          { descricao: 'struct Contato com nome e telefone', padrao: R`struct\s+Contato\s*\{[\s\S]*char\s+nome\s*\[\s*\d+\s*\][\s\S]*char\s+telefone\s*\[\s*\d+\s*\][\s\S]*\}` },
          { descricao: 'vetor de contatos com MAX posições', padrao: R`struct\s+Contato\s+\w+\s*\[\s*MAX\s*\]` },
          { descricao: 'contador de contatos', padrao: R`int\s+total\s*=\s*0` },
        ],
        dica: 'typedef ajuda a não repetir "struct", mas não é obrigatório aqui. O contador total diz qual a próxima posição livre.',
        referencia: '#include <stdio.h>\n#define MAX 100\n\nstruct Contato {\n    char nome[50];\n    char telefone[20];\n};\n\nstruct Contato agenda[MAX];\nint total = 0;\n',
      },
      {
        id: 'adicionar', titulo: 'Adicionar sem estourar', arquivo: 'agenda.c', xp: 30,
        explicacao: 'O jeito mais comum de quebrar um programa em C é escrever além do fim de um vetor ou de uma string. Aqui a agenda recusa o 101º contato e a leitura nunca passa do tamanho do campo.',
        tarefas: ['Função int adicionar(const char *nome, const char *telefone) que devolve 0 se a agenda estiver cheia e 1 se deu certo.', 'Copie as strings com snprintf ou strncpy, respeitando sizeof.', 'Leia a entrada com fgets (nunca gets).'],
        criterios: [
          { descricao: 'função adicionar com ponteiros para char', padrao: R`int\s+adicionar\s*\(\s*const\s+char\s*\*\s*\w+\s*,\s*const\s+char\s*\*\s*\w+\s*\)` },
          { descricao: 'confere se a agenda está cheia', padrao: R`if\s*\(\s*total\s*>=\s*MAX\s*\)` },
          { descricao: 'copia com limite de tamanho', padrao: R`(snprintf|strncpy)\s*\([\s\S]*?sizeof` },
          { descricao: 'lê com fgets', padrao: R`fgets\s*\(` },
          { descricao: 'não usa gets', padrao: R`\bgets\s*\(`, ausente: true },
        ],
        dica: 'snprintf(agenda[total].nome, sizeof agenda[total].nome, "%s", nome) copia e sempre termina a string com \\0. fgets guarda o \\n do Enter: troque por \\0 com strcspn.',
        referencia: '#include <stdio.h>\n#include <string.h>\n#define MAX 100\nstruct Contato { char nome[50]; char telefone[20]; };\nstruct Contato agenda[MAX];\nint total = 0;\n\nint adicionar(const char *nome, const char *telefone) {\n    if (total >= MAX) return 0;\n    snprintf(agenda[total].nome, sizeof agenda[total].nome, "%s", nome);\n    snprintf(agenda[total].telefone, sizeof agenda[total].telefone, "%s", telefone);\n    total++;\n    return 1;\n}\n\nvoid ler(char *destino, int tamanho) {\n    if (fgets(destino, tamanho, stdin)) destino[strcspn(destino, "\\n")] = \'\\0\';\n}\n',
      },
      {
        id: 'arquivo', titulo: 'Salvar em arquivo', arquivo: 'agenda.c', xp: 30,
        explicacao: 'Para a agenda sobreviver ao fechar o programa, grave cada contato numa linha de agenda.txt. Abrir um arquivo pode falhar (sem permissão, disco cheio): o programa precisa conferir.',
        tarefas: ['Função void salvar(const char *caminho).', 'Abra com fopen(caminho, "w") e confira se voltou NULL.', 'Grave com fprintf, uma linha por contato.', 'Feche com fclose.'],
        criterios: [
          { descricao: 'função salvar', padrao: R`void\s+salvar\s*\(\s*const\s+char\s*\*\s*\w+\s*\)` },
          { descricao: 'abre com fopen para escrita', padrao: R`fopen\s*\(\s*\w+\s*,\s*"w"\s*\)` },
          { descricao: 'confere se o arquivo abriu', padrao: R`if\s*\(\s*(!\s*\w+|\w+\s*==\s*NULL)\s*\)` },
          { descricao: 'grava com fprintf', padrao: R`fprintf\s*\(` },
          { descricao: 'fecha com fclose', padrao: R`fclose\s*\(` },
        ],
        dica: 'FILE *f = fopen(caminho, "w"); if (!f) { perror("agenda"); return; } e depois um for de 0 até total com fprintf(f, "%s;%s\\n", ...).',
        referencia: 'void salvar(const char *caminho) {\n    FILE *f = fopen(caminho, "w");\n    if (!f) { perror("agenda"); return; }\n    for (int i = 0; i < total; i++) fprintf(f, "%s;%s\\n", agenda[i].nome, agenda[i].telefone);\n    fclose(f);\n}\n',
      },
    ],
    explicacaoSolucao: 'Os três cuidados do projeto são os mesmos de qualquer programa em C: nunca escrever além do fim do vetor (o if total >= MAX), nunca escrever além do fim de uma string (snprintf com sizeof, fgets no lugar de gets) e conferir toda operação que pode falhar (o fopen que devolve NULL). O resto é organização: a struct junta o que pertence a um contato, e o contador total diz quanto do vetor está em uso.',
    proximosDesafios: ['Escreva carregar(caminho) que lê agenda.txt de volta com fgets e strtok.', 'Troque o vetor fixo por um vetor dinâmico com malloc/realloc, sem limite de 100.', 'Reescreva em C++ com std::vector<Contato> e std::string e compare o que deixou de ser preocupação.'],
  },
  {
    id: 'pj-csharp-estoque', tecnologia: 'C#', nome: 'Controle de estoque', nivel: 'intermediario',
    descricao: 'Um app de console para cadastrar produtos, dar baixa no estoque e ver o que está acabando.',
    objetivo: 'Praticar classes com propriedades, List<T>, LINQ e validação de entrada com TryParse.',
    tecnologias: ['C# 10 ou mais novo', '.NET 6 ou mais novo'],
    prerequisitos: ['tipos e variáveis', 'if/else e laços', 'métodos', 'noção de classe'],
    resultado: 'Um projeto de console que cadastra produtos, recusa baixa maior que o estoque e lista os produtos com estoque baixo, do menor para o maior.',
    arquivos: [{ nome: 'Program.cs', conteudo: '// Controle de estoque\n// Etapa 1: a classe Produto\n\nConsole.WriteLine("Estoque");\n' }],
    etapas: [
      {
        id: 'produto', titulo: 'A classe Produto', arquivo: 'Program.cs', xp: 25,
        explicacao: 'Um produto tem nome, preço e quantidade. A quantidade só muda pelo método DarBaixa, que não deixa ficar negativa.',
        tarefas: ['Classe Produto com propriedades Nome e Preco ({ get; set; } ou init).', 'Propriedade Quantidade com private set.', 'Método DarBaixa(int qtd) que lança InvalidOperationException se qtd for maior que a Quantidade.'],
        criterios: [
          { descricao: 'classe Produto', padrao: R`class\s+Produto\b` },
          { descricao: 'propriedades Nome e Preco', padrao: R`string\s+Nome\s*\{\s*get;[\s\S]*decimal\s+Preco\s*\{\s*get;` },
          { descricao: 'Quantidade com private set', padrao: R`int\s+Quantidade\s*\{\s*get;\s*private\s+set;\s*\}` },
          { descricao: 'método DarBaixa(int ...)', padrao: R`void\s+DarBaixa\s*\(\s*int\s+\w+\s*\)` },
          { descricao: 'recusa baixa maior que o estoque', padrao: R`throw\s+new\s+InvalidOperationException\s*\(` },
        ],
        dica: 'decimal é o tipo certo para dinheiro em C# (double tem erros de arredondamento). Com private set, só a própria classe muda a Quantidade.',
        referencia: 'class Produto\n{\n    public string Nome { get; set; } = "";\n    public decimal Preco { get; set; }\n    public int Quantidade { get; private set; }\n    public Produto(string nome, decimal preco, int quantidade) { Nome = nome; Preco = preco; Quantidade = quantidade; }\n    public void DarBaixa(int qtd)\n    {\n        if (qtd > Quantidade) throw new InvalidOperationException("Estoque insuficiente");\n        Quantidade -= qtd;\n    }\n}\n',
      },
      {
        id: 'consultas', titulo: 'Consultas com LINQ', arquivo: 'Program.cs', xp: 30,
        explicacao: 'Com os produtos numa List<Produto>, o LINQ responde perguntas em uma linha: o que está acabando, quanto vale o estoque.',
        tarefas: ['Crie uma List<Produto> com alguns produtos.', 'Use Where e OrderBy para pegar os produtos com Quantidade menor que 5, do menor para o maior.', 'Use Sum para calcular o valor total do estoque (Preco * Quantidade).'],
        criterios: [
          { descricao: 'lista de produtos', padrao: R`List<Produto>\s+\w+\s*=\s*new` },
          { descricao: 'filtra com Where', padrao: R`\.Where\s*\(\s*\w+\s*=>\s*\w+\.Quantidade\s*<` },
          { descricao: 'ordena com OrderBy', padrao: R`\.OrderBy\s*\(\s*\w+\s*=>\s*\w+\.Quantidade\s*\)` },
          { descricao: 'soma o valor com Sum', padrao: R`\.Sum\s*\(\s*\w+\s*=>\s*\w+\.Preco\s*\*\s*\w+\.Quantidade\s*\)` },
        ],
        dica: 'var acabando = produtos.Where(p => p.Quantidade < 5).OrderBy(p => p.Quantidade); e para o valor: produtos.Sum(p => p.Preco * p.Quantidade).',
        referencia: 'List<Produto> produtos = new() { new("Caneta", 2.5m, 3), new("Caderno", 18m, 10) };\nvar acabando = produtos.Where(p => p.Quantidade < 5).OrderBy(p => p.Quantidade);\ndecimal valor = produtos.Sum(p => p.Preco * p.Quantidade);\n',
      },
      {
        id: 'entrada', titulo: 'Entrada que não quebra', arquivo: 'Program.cs', xp: 30,
        explicacao: 'int.Parse("abc") derruba o programa. TryParse devolve false em vez de lançar erro, e o programa pode pedir de novo.',
        tarefas: ['Leia a quantidade da baixa com Console.ReadLine.', 'Converta com int.TryParse e peça de novo se não for número.', 'Chame DarBaixa dentro de try/catch (InvalidOperationException) e mostre a mensagem.'],
        criterios: [
          { descricao: 'lê com Console.ReadLine', padrao: R`Console\.ReadLine\s*\(\s*\)` },
          { descricao: 'converte com int.TryParse', padrao: R`int\.TryParse\s*\(` },
          { descricao: 'não usa int.Parse sem proteção', padrao: R`int\.Parse\s*\(`, ausente: true },
          { descricao: 'trata a baixa recusada', padrao: R`catch\s*\(\s*InvalidOperationException\s+\w+\s*\)` },
        ],
        dica: 'while (!int.TryParse(Console.ReadLine(), out int qtd)) Console.WriteLine("Digite um número."); depois o try { produto.DarBaixa(qtd); } catch (InvalidOperationException e) { ... }.',
        referencia: 'int qtd;\nwhile (!int.TryParse(Console.ReadLine(), out qtd)) Console.WriteLine("Digite um número.");\ntry { produtos[0].DarBaixa(qtd); }\ncatch (InvalidOperationException e) { Console.WriteLine(e.Message); }\n',
      },
    ],
    explicacaoSolucao: 'A regra do estoque mora dentro de Produto: com private set, nenhum outro código consegue deixar a quantidade negativa. O LINQ substitui laços de filtrar, ordenar e somar por expressões que dizem o que se quer, não como fazer. E TryParse transforma entrada errada num caso normal (pedir de novo) em vez de uma exceção.',
    proximosDesafios: ['Salve os produtos em JSON com System.Text.Json e carregue ao abrir.', 'Registre cada baixa com data e mostre o histórico de um produto.', 'Crie testes com xUnit para DarBaixa.'],
  },
  {
    id: 'pj-php-recados', tecnologia: 'PHP', nome: 'Mural de recados', nivel: 'intermediario',
    descricao: 'Uma página onde as pessoas deixam recados com nome e mensagem, guardados num banco SQLite.',
    objetivo: 'Praticar formulários com POST, validação, proteção contra XSS e SQL injection e PDO.',
    tecnologias: ['PHP 8', 'PDO com SQLite', 'HTML'],
    prerequisitos: ['variáveis e arrays em PHP', 'formulários HTML', 'noção de SQL'],
    resultado: 'Um index.php que mostra os recados e um formulário; recado vazio é recusado e nada do que a pessoa digita vira código na página.',
    arquivos: [{ nome: 'index.php', conteudo: '<?php\n// Mural de recados\n// Etapa 1: conectar no banco\n?>\n<!doctype html>\n<html lang="pt-BR">\n<head><meta charset="utf-8"><title>Mural</title></head>\n<body>\n  <h1>Mural de recados</h1>\n</body>\n</html>\n' }],
    etapas: [
      {
        id: 'banco', titulo: 'Conectar no banco', arquivo: 'index.php', xp: 25,
        explicacao: 'O PDO conecta no SQLite (um arquivo, sem servidor de banco). A tabela é criada na primeira vez com CREATE TABLE IF NOT EXISTS.',
        tarefas: ['Crie a conexão new PDO("sqlite:" . __DIR__ . "/mural.db").', 'Ative os erros como exceção (PDO::ERRMODE_EXCEPTION).', 'Crie a tabela recados (id, nome, mensagem, criado_em) se ela não existir.'],
        criterios: [
          { descricao: 'conecta com PDO no SQLite', padrao: R`new\s+PDO\s*\(\s*['"]sqlite:` },
          { descricao: 'erros do banco viram exceção', padrao: R`PDO::ERRMODE_EXCEPTION` },
          { descricao: 'cria a tabela se não existir', padrao: R`CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+recados`, flags: 'i' },
          { descricao: 'tabela com chave primária', padrao: R`id\s+INTEGER\s+PRIMARY\s+KEY`, flags: 'i' },
        ],
        dica: '$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); faz qualquer erro de SQL aparecer, em vez de falhar em silêncio.',
        referencia: '<?php\n$pdo = new PDO("sqlite:" . __DIR__ . "/mural.db");\n$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);\n$pdo->exec("CREATE TABLE IF NOT EXISTS recados (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, mensagem TEXT NOT NULL, criado_em TEXT NOT NULL)");\n',
      },
      {
        id: 'gravar', titulo: 'Receber e gravar com segurança', arquivo: 'index.php', xp: 35,
        explicacao: 'Nunca junte texto do usuário dentro do SQL: alguém pode digitar um pedaço de SQL e apagar a tabela (SQL injection). O prepared statement manda os valores separados da consulta.',
        tarefas: ['Só grave quando $_SERVER["REQUEST_METHOD"] for "POST".', 'Pegue nome e mensagem de $_POST com trim e recuse se estiverem vazios.', 'Grave com $pdo->prepare(...) e execute([...]), usando ? ou :nome.'],
        criterios: [
          { descricao: 'só grava em POST', padrao: R`\$_SERVER\s*\[\s*['"]REQUEST_METHOD['"]\s*\]\s*===?\s*['"]POST['"]` },
          { descricao: 'limpa espaços com trim', padrao: R`trim\s*\(\s*\$_POST` },
          { descricao: 'recusa campos vazios', padrao: R`if\s*\([^)]*(===?\s*['"]['"]|empty\s*\()` },
          { descricao: 'usa prepare e execute', padrao: R`->prepare\s*\([\s\S]*->execute\s*\(\s*\[` },
          { descricao: 'não junta $_POST dentro do SQL', padrao: R`(INSERT|SELECT|UPDATE|DELETE)[^;]*(\$_POST|\.\s*\$\w+\s*\.)`, flags: 'i', ausente: true },
        ],
        dica: '$st = $pdo->prepare("INSERT INTO recados (nome, mensagem, criado_em) VALUES (?, ?, ?)"); $st->execute([$nome, $mensagem, date("c")]);',
        referencia: 'if ($_SERVER["REQUEST_METHOD"] === "POST") {\n    $nome = trim($_POST["nome"] ?? "");\n    $mensagem = trim($_POST["mensagem"] ?? "");\n    if ($nome === "" || $mensagem === "") {\n        $erro = "Preencha nome e mensagem.";\n    } else {\n        $st = $pdo->prepare("INSERT INTO recados (nome, mensagem, criado_em) VALUES (?, ?, ?)");\n        $st->execute([$nome, $mensagem, date("c")]);\n        header("Location: index.php");\n        exit;\n    }\n}\n',
      },
      {
        id: 'mostrar', titulo: 'Mostrar sem abrir brecha', arquivo: 'index.php', xp: 30,
        explicacao: 'Se alguém escrever <script> no recado e a página mostrar como está, o código roda no navegador de quem lê (XSS). htmlspecialchars transforma os sinais em texto.',
        tarefas: ['Busque os recados do mais novo para o mais antigo (ORDER BY ... DESC).', 'Mostre cada um num foreach.', 'Passe nome e mensagem por htmlspecialchars antes de mostrar.', 'Tenha o formulário com method="post" e os campos nome e mensagem.'],
        criterios: [
          { descricao: 'ordena do mais novo para o mais antigo', padrao: R`ORDER\s+BY\s+\w+\s+DESC`, flags: 'i' },
          { descricao: 'percorre com foreach', padrao: R`foreach\s*\(` },
          { descricao: 'escapa o texto com htmlspecialchars', padrao: R`htmlspecialchars\s*\(` },
          { descricao: 'formulário com method="post"', padrao: R`<form[^>]*method\s*=\s*["']post["']`, flags: 'i' },
          { descricao: 'campos nome e mensagem', padrao: R`name\s*=\s*["']nome["'][\s\S]*name\s*=\s*["']mensagem["']|name\s*=\s*["']mensagem["'][\s\S]*name\s*=\s*["']nome["']` },
        ],
        dica: 'Uma função curta ajuda: function e($t) { return htmlspecialchars($t, ENT_QUOTES, "UTF-8"); } e depois <?= e($r["nome"]) ?>.',
        referencia: '<?php function e($t) { return htmlspecialchars($t, ENT_QUOTES, "UTF-8"); }\n$recados = $pdo->query("SELECT nome, mensagem FROM recados ORDER BY id DESC")->fetchAll(); ?>\n<form method="post">\n  <input name="nome" required>\n  <textarea name="mensagem" required></textarea>\n  <button>Enviar</button>\n</form>\n<?php foreach ($recados as $r): ?>\n  <article><b><?= e($r["nome"]) ?></b><p><?= e($r["mensagem"]) ?></p></article>\n<?php endforeach; ?>\n',
      },
    ],
    explicacaoSolucao: 'As duas brechas mais comuns em PHP estão fechadas: SQL injection (os valores vão separados da consulta pelo prepare/execute) e XSS (tudo o que veio de alguém passa por htmlspecialchars antes de ir para a página). O redirecionamento depois do POST evita que atualizar a página envie o recado de novo. O SQLite deixa o projeto rodar só com o PHP, sem instalar um servidor de banco.',
    proximosDesafios: ['Limite o tamanho do nome (60) e da mensagem (500) e mostre o erro ao lado do campo.', 'Adicione paginação: 10 recados por página com LIMIT e OFFSET.', 'Proteja o formulário com um token CSRF guardado na sessão.'],
  },
  {
    id: 'pj-web-portfolio', tecnologia: 'HTML e CSS', nome: 'Portfólio responsivo', nivel: 'basico',
    descricao: 'Uma página pessoal com apresentação, projetos e contato, que fica boa no computador e no celular e funciona com teclado.',
    objetivo: 'Praticar HTML semântico, variáveis CSS, flexbox, grid, media queries e acessibilidade.',
    tecnologias: ['HTML5', 'CSS3'],
    prerequisitos: ['tags básicas de HTML', 'seletores e propriedades de CSS'],
    resultado: 'Um index.html e um estilo.css: menu no topo, seção de projetos em grade (3 colunas no computador, 1 no celular) e contato, com imagens descritas e foco visível.',
    arquivos: [
      { nome: 'index.html', conteudo: '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <title>Meu portfólio</title>\n  <link rel="stylesheet" href="estilo.css">\n</head>\n<body>\n  <!-- Etapa 1: estrutura semântica -->\n</body>\n</html>\n' },
      { nome: 'estilo.css', conteudo: '/* Etapa 2: variáveis e layout */\n' },
    ],
    etapas: [
      {
        id: 'estrutura', titulo: 'Estrutura semântica', arquivo: 'index.html', xp: 25,
        explicacao: 'Tags semânticas dizem o que cada parte é. Leitores de tela usam isso para navegar, e buscadores para entender a página. Uma página feita só de div é igual para eles.',
        tarefas: ['Use header com um nav de links para as seções.', 'Coloque o conteúdo em main, com uma section para projetos (id="projetos") e outra para contato (id="contato").', 'Termine com footer.', 'Coloque a meta viewport no head (sem ela, o celular mostra a página encolhida).', 'Toda img tem alt descrevendo a imagem.'],
        criterios: [
          { descricao: 'meta viewport no head', padrao: R`<meta[^>]+name\s*=\s*["']viewport["'][^>]*width\s*=\s*device-width`, flags: 'i' },
          { descricao: 'header com nav', padrao: R`<header[\s\S]*<nav[\s\S]*<\/nav>[\s\S]*<\/header>`, flags: 'i' },
          { descricao: 'main com as seções', padrao: R`<main[\s\S]*<section[^>]*id\s*=\s*["']projetos["'][\s\S]*<section[^>]*id\s*=\s*["']contato["'][\s\S]*<\/main>`, flags: 'i' },
          { descricao: 'links do menu apontam para as seções', padrao: R`href\s*=\s*["']#projetos["']`, flags: 'i' },
          { descricao: 'footer', padrao: R`<footer`, flags: 'i' },
          { descricao: 'nenhuma imagem sem alt', padrao: R`<img(?![^>]*\balt\s*=)[^>]*>`, flags: 'i', ausente: true },
        ],
        dica: 'Pense no índice de um livro: header (capa e sumário), main (capítulos, cada um uma section) e footer (contracapa).',
        referencia: '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Meu portfólio</title>\n  <link rel="stylesheet" href="estilo.css">\n</head>\n<body>\n  <header>\n    <nav><a href="#projetos">Projetos</a> <a href="#contato">Contato</a></nav>\n  </header>\n  <main>\n    <section id="projetos">\n      <h2>Projetos</h2>\n      <div class="grade">\n        <article><img src="p1.png" alt="Tela do app de tarefas"><h3>Tarefas</h3></article>\n      </div>\n    </section>\n    <section id="contato"><h2>Contato</h2><a href="mailto:eu@exemplo.com">eu@exemplo.com</a></section>\n  </main>\n  <footer>Feito por mim</footer>\n</body>\n</html>\n',
      },
      {
        id: 'layout', titulo: 'Variáveis, menu e grade', arquivo: 'estilo.css', xp: 30,
        explicacao: 'Variáveis CSS guardam as cores num lugar só: mudar o tema vira mudar uma linha. Flexbox alinha o menu numa linha; grid monta a grade de projetos.',
        tarefas: ['Defina as cores em :root com variáveis (--cor-fundo, --cor-texto, --cor-destaque).', 'Use as variáveis com var(...).', 'Deixe o nav em display: flex com gap.', 'Monte .grade com display: grid e grid-template-columns de 3 colunas.'],
        criterios: [
          { descricao: 'variáveis em :root', padrao: R`:root\s*\{[^}]*--[\w-]+\s*:` },
          { descricao: 'usa as variáveis com var()', padrao: R`var\s*\(\s*--[\w-]+\s*\)` },
          { descricao: 'menu com flexbox', padrao: R`nav\s*\{[^}]*display\s*:\s*flex` },
          { descricao: 'espaço com gap', padrao: R`gap\s*:` },
          { descricao: 'grade com display: grid', padrao: R`display\s*:\s*grid` },
          { descricao: 'três colunas', padrao: R`grid-template-columns\s*:\s*(repeat\s*\(\s*3\s*,|(1fr\s+){2}1fr)` },
        ],
        dica: 'grid-template-columns: repeat(3, 1fr) divide o espaço em 3 partes iguais. gap substitui as margens entre os itens.',
        referencia: ':root {\n  --cor-fundo: #fbfaf7;\n  --cor-texto: #1d1d1f;\n  --cor-destaque: #2f6bff;\n}\nbody { background: var(--cor-fundo); color: var(--cor-texto); font-family: system-ui, sans-serif; }\nnav { display: flex; gap: 16px; }\nnav a { color: var(--cor-destaque); }\n.grade { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }\n',
      },
      {
        id: 'responsivo', titulo: 'Celular e teclado', arquivo: 'estilo.css', xp: 30,
        explicacao: 'No celular, três colunas viram cartões espremidos: a grade passa a ter uma coluna. E quem navega com Tab precisa ver onde está (foco visível).',
        tarefas: ['Crie uma media query para telas de até 700px.', 'Dentro dela, a grade passa a ter 1 coluna e o menu vira coluna.', 'Mostre o foco do teclado com :focus-visible e outline.', 'Não esconda o foco com outline: none sem colocar outro no lugar.'],
        criterios: [
          { descricao: 'media query para telas estreitas', padrao: R`@media\s*\(\s*max-width\s*:\s*\d+px\s*\)` },
          { descricao: 'grade de uma coluna no celular', padrao: R`@media[\s\S]*grid-template-columns\s*:\s*1fr` },
          { descricao: 'menu em coluna no celular', padrao: R`@media[\s\S]*flex-direction\s*:\s*column` },
          { descricao: 'foco visível com :focus-visible', padrao: R`:focus-visible\s*\{[^}]*outline\s*:\s*(?!none)` },
        ],
        dica: 'A media query fica no fim do arquivo e só sobrescreve o que muda: @media (max-width: 700px) { .grade { grid-template-columns: 1fr; } nav { flex-direction: column; } }.',
        referencia: ':focus-visible { outline: 3px solid var(--cor-destaque); outline-offset: 2px; }\n@media (max-width: 700px) {\n  .grade { grid-template-columns: 1fr; }\n  nav { flex-direction: column; }\n}\n',
      },
    ],
    explicacaoSolucao: 'O HTML descreve o que cada parte é, e o CSS decide como aparece. Por isso a mesma página serve no computador, no celular e num leitor de tela. As variáveis deixam o tema num lugar só, flexbox resolve alinhamento em uma direção (o menu) e grid em duas (a grade). A media query só sobrescreve o que muda no celular, e o :focus-visible mostra o foco para quem usa teclado sem incomodar quem usa mouse.',
    proximosDesafios: ['Adicione um tema escuro com @media (prefers-color-scheme: dark) trocando só as variáveis.', 'Confira o contraste das cores (no mínimo 4.5:1 para texto) e ajuste o que não passar.', 'Publique a página no GitHub Pages.'],
  },
  {
    id: 'pj-sql-escola', tecnologia: 'SQL', nome: 'Banco de dados de uma escola', nivel: 'intermediario',
    descricao: 'Modele e consulte o banco de uma escola: alunos, turmas e notas, com relatórios de médias.',
    objetivo: 'Praticar modelagem com chaves primárias e estrangeiras, INSERT, JOIN, GROUP BY e HAVING.',
    tecnologias: ['SQL (SQLite, PostgreSQL ou MySQL)'],
    prerequisitos: ['SELECT, WHERE e ORDER BY', 'noção de tabela e coluna'],
    resultado: 'Um escola.sql que cria as tabelas, insere dados de exemplo e responde: a média de cada aluno, a média de cada turma e quem está abaixo de 6.',
    arquivos: [{ nome: 'escola.sql', conteudo: '-- Banco da escola\n-- Etapa 1: crie as tabelas turmas, alunos e notas\n' }],
    etapas: [
      {
        id: 'tabelas', titulo: 'Criar as tabelas', arquivo: 'escola.sql', xp: 30,
        explicacao: 'Cada aluno pertence a uma turma, e cada nota pertence a um aluno. As chaves estrangeiras garantem que não exista nota de aluno que não existe.',
        tarefas: ['turmas(id, nome).', 'alunos(id, nome, turma_id) com turma_id apontando para turmas.', 'notas(id, aluno_id, disciplina, valor) com aluno_id apontando para alunos.', 'valor só pode ir de 0 a 10 (CHECK).'],
        criterios: [
          { descricao: 'cria turmas com chave primária', padrao: R`CREATE\s+TABLE\s+turmas\s*\([\s\S]*?PRIMARY\s+KEY`, flags: 'i' },
          { descricao: 'cria alunos', padrao: R`CREATE\s+TABLE\s+alunos\s*\(`, flags: 'i' },
          { descricao: 'alunos.turma_id aponta para turmas', padrao: R`(FOREIGN\s+KEY\s*\(\s*turma_id\s*\)\s*)?REFERENCES\s+turmas\s*\(\s*id\s*\)`, flags: 'i' },
          { descricao: 'notas.aluno_id aponta para alunos', padrao: R`REFERENCES\s+alunos\s*\(\s*id\s*\)`, flags: 'i' },
          { descricao: 'nota entre 0 e 10', padrao: R`CHECK\s*\(\s*valor\s+(BETWEEN\s+0\s+AND\s+10|>=\s*0\s+AND\s+valor\s*<=\s*10)\s*\)`, flags: 'i' },
        ],
        dica: 'Crie na ordem das dependências: primeiro turmas, depois alunos (que aponta para turmas), por último notas.',
        referencia: 'CREATE TABLE turmas (\n  id INTEGER PRIMARY KEY,\n  nome TEXT NOT NULL\n);\nCREATE TABLE alunos (\n  id INTEGER PRIMARY KEY,\n  nome TEXT NOT NULL,\n  turma_id INTEGER NOT NULL REFERENCES turmas(id)\n);\nCREATE TABLE notas (\n  id INTEGER PRIMARY KEY,\n  aluno_id INTEGER NOT NULL REFERENCES alunos(id),\n  disciplina TEXT NOT NULL,\n  valor REAL NOT NULL CHECK (valor BETWEEN 0 AND 10)\n);\n',
      },
      {
        id: 'dados', titulo: 'Inserir dados de exemplo', arquivo: 'escola.sql', xp: 20,
        explicacao: 'Sem dados não dá para conferir as consultas. Insira poucos dados, mas pensados: pelo menos uma turma com dois alunos e um aluno com nota baixa.',
        tarefas: ['Insira 2 turmas, 4 alunos e algumas notas.', 'Liste as colunas no INSERT (INSERT INTO tabela (colunas) VALUES ...).', 'Garanta que pelo menos um aluno tenha média abaixo de 6.'],
        criterios: [
          { descricao: 'insere turmas listando as colunas', padrao: R`INSERT\s+INTO\s+turmas\s*\([^)]+\)\s*VALUES`, flags: 'i' },
          { descricao: 'insere alunos listando as colunas', padrao: R`INSERT\s+INTO\s+alunos\s*\([^)]+\)\s*VALUES`, flags: 'i' },
          { descricao: 'insere notas listando as colunas', padrao: R`INSERT\s+INTO\s+notas\s*\([^)]+\)\s*VALUES`, flags: 'i' },
          { descricao: 'várias linhas num INSERT ou vários INSERTs', padrao: R`VALUES\s*\([^)]*\)\s*,\s*\(|(INSERT\s+INTO\s+notas[\s\S]*){2}`, flags: 'i' },
        ],
        dica: 'Um INSERT aceita várias linhas: INSERT INTO turmas (id, nome) VALUES (1, \'1º A\'), (2, \'1º B\');',
        referencia: "INSERT INTO turmas (id, nome) VALUES (1, '1º A'), (2, '1º B');\nINSERT INTO alunos (id, nome, turma_id) VALUES (1, 'Ana', 1), (2, 'Bruno', 1), (3, 'Carla', 2), (4, 'Davi', 2);\nINSERT INTO notas (aluno_id, disciplina, valor) VALUES (1, 'Matemática', 9), (1, 'Português', 8), (2, 'Matemática', 4), (2, 'Português', 5), (3, 'Matemática', 7), (4, 'Matemática', 6.5);\n",
      },
      {
        id: 'relatorios', titulo: 'Relatórios', arquivo: 'escola.sql', xp: 35,
        explicacao: 'As perguntas da escola cruzam tabelas: o nome está em alunos, a nota em notas, a turma em turmas. JOIN junta as tabelas; GROUP BY agrupa para calcular médias; HAVING filtra depois de agrupar.',
        tarefas: ['Média de cada aluno, com o nome (JOIN alunos e notas, GROUP BY aluno).', 'Média de cada turma (dois JOINs).', 'Alunos com média abaixo de 6, usando HAVING.', 'Não use SELECT *.'],
        criterios: [
          { descricao: 'junta tabelas com JOIN ... ON', padrao: R`JOIN\s+\w+(\s+\w+)?\s+ON\s+`, flags: 'i' },
          { descricao: 'calcula média com AVG', padrao: R`AVG\s*\(`, flags: 'i' },
          { descricao: 'agrupa com GROUP BY', padrao: R`GROUP\s+BY`, flags: 'i' },
          { descricao: 'filtra depois de agrupar com HAVING', padrao: R`HAVING\s+AVG\s*\([^)]*\)\s*<\s*6`, flags: 'i' },
          { descricao: 'liga as três tabelas para a média da turma', padrao: R`(JOIN[\s\S]*?){2}`, flags: 'i' },
          { descricao: 'não usa SELECT *', padrao: R`SELECT\s+\*`, flags: 'i', ausente: true },
        ],
        dica: 'WHERE filtra linhas antes de agrupar; HAVING filtra grupos depois. "Média abaixo de 6" só existe depois do GROUP BY, por isso vai no HAVING.',
        referencia: 'SELECT a.nome, ROUND(AVG(n.valor), 1) AS media\nFROM alunos a JOIN notas n ON n.aluno_id = a.id\nGROUP BY a.id, a.nome;\n\nSELECT t.nome, ROUND(AVG(n.valor), 1) AS media\nFROM turmas t\nJOIN alunos a ON a.turma_id = t.id\nJOIN notas n ON n.aluno_id = a.id\nGROUP BY t.id, t.nome;\n\nSELECT a.nome, AVG(n.valor) AS media\nFROM alunos a JOIN notas n ON n.aluno_id = a.id\nGROUP BY a.id, a.nome\nHAVING AVG(n.valor) < 6;\n',
      },
    ],
    explicacaoSolucao: 'Cada informação mora num lugar só (o nome da turma está só em turmas) e as tabelas se ligam pelas chaves. Por isso as consultas precisam de JOIN, e é também por isso que não existe nota "órfã": a chave estrangeira não deixa. O CHECK protege o dado na entrada, e GROUP BY com HAVING responde perguntas sobre grupos, que um WHERE não consegue.',
    proximosDesafios: ['Inclua alunos sem nota e mostre-os também na média, usando LEFT JOIN (média vazia).', 'Crie uma VIEW medias_alunos e use-a nas outras consultas.', 'Crie um índice em notas(aluno_id) e explique quando ele ajuda.'],
  },
  {
    id: 'pj-kotlin-habitos', tecnologia: 'Kotlin', nome: 'Rastreador de hábitos', nivel: 'intermediario',
    descricao: 'Um programa de console para cadastrar hábitos, marcar os dias em que foram feitos e ver a sequência atual.',
    objetivo: 'Praticar data class, coleções imutáveis e mutáveis, null safety, when e funções de coleção.',
    tecnologias: ['Kotlin 1.9 ou mais novo'],
    prerequisitos: ['val e var', 'funções', 'if e when', 'listas'],
    resultado: 'Um Main.kt que cadastra hábitos, marca o dia, mostra os hábitos do dia e não quebra com entrada vazia ou inválida.',
    arquivos: [{ nome: 'Main.kt', conteudo: '// Rastreador de hábitos\n// Etapa 1: a data class Habito\n\nfun main() {\n}\n' }],
    etapas: [
      {
        id: 'modelo', titulo: 'O modelo', arquivo: 'Main.kt', xp: 25,
        explicacao: 'data class dá de graça equals, toString e copy. Um hábito tem nome e o conjunto de dias em que foi feito (um Set não deixa repetir o mesmo dia).',
        tarefas: ['data class Habito(val nome: String, val dias: Set<LocalDate> = emptySet()).', 'Função marcar(habito: Habito, dia: LocalDate): Habito que devolve uma cópia com o dia incluído (use copy).', 'import java.time.LocalDate.'],
        criterios: [
          { descricao: 'importa LocalDate', padrao: R`import\s+java\.time\.LocalDate` },
          { descricao: 'data class Habito com val', padrao: R`data\s+class\s+Habito\s*\(\s*val\s+nome\s*:\s*String` },
          { descricao: 'dias num Set de LocalDate', padrao: R`val\s+dias\s*:\s*Set<LocalDate>` },
          { descricao: 'marcar devolve uma cópia', padrao: R`fun\s+marcar\s*\([^)]*\)\s*:\s*Habito[\s\S]*\.copy\s*\(` },
        ],
        dica: 'habito.copy(dias = habito.dias + dia) cria um novo Habito com o dia a mais e não muda o antigo.',
        referencia: 'import java.time.LocalDate\n\ndata class Habito(val nome: String, val dias: Set<LocalDate> = emptySet())\n\nfun marcar(habito: Habito, dia: LocalDate): Habito = habito.copy(dias = habito.dias + dia)\n',
      },
      {
        id: 'sequencia', titulo: 'A sequência de dias', arquivo: 'Main.kt', xp: 30,
        explicacao: 'A sequência conta quantos dias seguidos, até hoje, o hábito foi feito. Se não foi feito hoje, conta a partir de ontem (o dia ainda não acabou).',
        tarefas: ['Função sequencia(habito: Habito, hoje: LocalDate): Int.', 'Comece de hoje (ou de ontem, se hoje não estiver marcado).', 'Ande para trás com minusDays(1) enquanto o dia estiver no conjunto.'],
        criterios: [
          { descricao: 'função sequencia devolve Int', padrao: R`fun\s+sequencia\s*\([^)]*\)\s*:\s*Int` },
          { descricao: 'anda para trás com minusDays', padrao: R`minusDays\s*\(\s*1\s*\)` },
          { descricao: 'confere se o dia está no conjunto', padrao: R`(\w+\s+in\s+\w+\.dias|\.dias\.contains\s*\()` },
          { descricao: 'laço while', padrao: R`while\s*\(` },
        ],
        dica: 'var dia = if (hoje in habito.dias) hoje else hoje.minusDays(1); var n = 0; while (dia in habito.dias) { n++; dia = dia.minusDays(1) }',
        referencia: 'fun sequencia(habito: Habito, hoje: LocalDate): Int {\n    var dia = if (hoje in habito.dias) hoje else hoje.minusDays(1)\n    var n = 0\n    while (dia in habito.dias) {\n        n++\n        dia = dia.minusDays(1)\n    }\n    return n\n}\n',
      },
      {
        id: 'menu', titulo: 'O menu sem NullPointerException', arquivo: 'Main.kt', xp: 30,
        explicacao: 'readLine() pode devolver null, e "abc".toInt() lança exceção. Com ?. , ?: e toIntOrNull, entrada ruim vira um caso tratado, sem !! nem try.',
        tarefas: ['Guarde os hábitos numa mutableListOf<Habito>().', 'Leia a opção com readlnOrNull() ou readLine() e converta com toIntOrNull().', 'Use when para as opções, com else para opção inválida.', 'Não use !!.'],
        criterios: [
          { descricao: 'lista mutável de hábitos', padrao: R`mutableListOf<Habito>\s*\(\s*\)` },
          { descricao: 'lê a entrada', padrao: R`readlnOrNull\s*\(\s*\)|readLine\s*\(\s*\)` },
          { descricao: 'converte com toIntOrNull', padrao: R`toIntOrNull\s*\(\s*\)` },
          { descricao: 'when com else', padrao: R`when\s*\([\s\S]*else\s*->` },
          { descricao: 'trata o nulo com ?: ou ?.', padrao: R`\?:|\?\.` },
          { descricao: 'não usa !!', padrao: R`!!`, ausente: true },
        ],
        dica: 'val opcao = readlnOrNull()?.trim()?.toIntOrNull() ?: continue resolve entrada vazia, nula e inválida numa linha.',
        referencia: 'fun main() {\n    val habitos = mutableListOf<Habito>()\n    while (true) {\n        println("1 novo, 2 marcar hoje, 3 ver, 0 sair")\n        val opcao = readlnOrNull()?.trim()?.toIntOrNull() ?: continue\n        when (opcao) {\n            1 -> readlnOrNull()?.trim()?.takeIf { it.isNotEmpty() }?.let { habitos.add(Habito(it)) }\n            2 -> habitos.replaceAll { marcar(it, LocalDate.now()) }\n            3 -> habitos.forEach { println("${it.nome}: ${sequencia(it, LocalDate.now())} dia(s)") }\n            0 -> return\n            else -> println("Opção inválida")\n        }\n    }\n}\n',
      },
    ],
    explicacaoSolucao: 'O Habito é imutável: marcar devolve um novo valor em vez de mudar o antigo, e isso deixa a sequência fácil de calcular e de testar. O Set de datas evita marcar o mesmo dia duas vezes. No menu, o sistema de tipos do Kotlin obriga a tratar o null do readlnOrNull, e o ?: continue transforma "a pessoa só apertou Enter" num caso normal, sem !!.',
    proximosDesafios: ['Mostre a maior sequência de todos os tempos, além da atual.', 'Salve os hábitos num arquivo com kotlinx.serialization.', 'Escreva testes com kotlin.test para sequencia(), incluindo o caso de hoje não marcado.'],
  },
  {
    id: 'pj-logica-caixa', tecnologia: 'Lógica', nome: 'Caixa eletrônico', nivel: 'basico',
    descricao: 'O algoritmo de um caixa eletrônico: dado um valor, entregar com o menor número de notas, ou dizer que não dá.',
    objetivo: 'Praticar o raciocínio de um algoritmo guloso, divisão inteira, resto, laços e casos impossíveis. Escrito em Python, mas a lógica vale para qualquer linguagem.',
    tecnologias: ['Python 3 (ou pseudocódigo traduzido para Python)'],
    prerequisitos: ['variáveis', 'if/else', 'laço for', 'listas'],
    resultado: 'Uma função sacar(valor) que devolve quantas notas de cada valor entregar (ex.: 380 = 3 de 100, 1 de 50, 1 de 20, 1 de 10) e recusa valores que não dá para pagar.',
    arquivos: [{ nome: 'caixa.py', conteudo: '# Caixa eletrônico\n# Etapa 1: escreva o algoritmo em passos, como comentário, e depois a função\n\nNOTAS = [100, 50, 20, 10, 5, 2]\n' }],
    etapas: [
      {
        id: 'guloso', titulo: 'Maior nota primeiro', arquivo: 'caixa.py', xp: 25,
        explicacao: 'O caixa entrega o maior número possível da maior nota, e depois passa para a próxima com o que sobrou. Divisão inteira (//) diz quantas notas cabem; o resto (%) diz quanto sobra.',
        tarefas: ['Crie sacar(valor) que devolve um dicionário {nota: quantidade}.', 'Percorra NOTAS com for, da maior para a menor.', 'Use // para quantas notas e % (ou subtração) para o que sobra.', 'Só inclua no resultado as notas usadas.'],
        criterios: [
          { descricao: 'define sacar(valor)', padrao: R`def\s+sacar\s*\(\s*valor\s*\)\s*:` },
          { descricao: 'percorre as notas com for', padrao: R`for\s+\w+\s+in\s+NOTAS` },
          { descricao: 'quantidade com divisão inteira', padrao: R`\w+\s*//\s*\w+` },
          { descricao: 'o que sobra com % ou subtração', padrao: R`\w+\s*%=?\s*\w+|-=\s*\w+\s*\*\s*\w+` },
          { descricao: 'devolve o resultado', padrao: R`return\s+\w+` },
        ],
        dica: 'Para 380 e nota 100: 380 // 100 = 3 notas, e sobram 380 % 100 = 80. Repita com 50, 20, 10...',
        referencia: 'NOTAS = [100, 50, 20, 10, 5, 2]\n\ndef sacar(valor):\n    entregar = {}\n    for nota in NOTAS:\n        qtd = valor // nota\n        if qtd > 0:\n            entregar[nota] = qtd\n            valor %= nota\n    return entregar\n',
      },
      {
        id: 'impossivel', titulo: 'Quando não dá', arquivo: 'caixa.py', xp: 30,
        explicacao: 'Sem nota de 1, os valores 1 e 3 não podem ser pagos, e um valor negativo não faz sentido. O algoritmo também não pode "sumir" com o resto que não coube em nenhuma nota.',
        tarefas: ['Recuse valores menores ou iguais a zero com ValueError.', 'Depois do laço, se ainda sobrar valor, lance ValueError dizendo que não dá para pagar com essas notas.', 'Teste com assert: sacar(380), sacar(8) e que sacar(3) dá erro.'],
        criterios: [
          { descricao: 'recusa zero ou negativo', padrao: R`if\s+valor\s*<=\s*0` },
          { descricao: 'confere se sobrou valor depois do laço', padrao: R`if\s+(valor\s*(!=|>)\s*0|valor\s*:)` },
          { descricao: 'lança ValueError', padrao: R`raise\s+ValueError\s*\(` },
          { descricao: 'testa com assert', padrao: R`assert\s+sacar\s*\(` },
        ],
        dica: 'Teste o 8 à mão: 5 e sobram 3; 2 e sobra 1. Sobrou! Mas 8 dá para pagar com quatro notas de 2. O guloso falha aqui. Pense: como saber se o resto final é zero? E o que fazer quando não é? (O desafio seguinte vai mais fundo.)',
        referencia: 'NOTAS = [100, 50, 20, 10, 5, 2]\n\ndef sacar(valor):\n    if valor <= 0:\n        raise ValueError("Valor precisa ser positivo")\n    entregar = {}\n    for nota in NOTAS:\n        qtd = valor // nota\n        if qtd > 0:\n            entregar[nota] = qtd\n            valor %= nota\n    if valor != 0:\n        raise ValueError("Não dá para pagar esse valor com essas notas")\n    return entregar\n\nassert sacar(380) == {100: 3, 50: 1, 20: 1, 10: 1}\nassert sacar(10) == {10: 1}\ntry:\n    sacar(3)\n    assert False\nexcept ValueError:\n    pass\n',
      },
    ],
    explicacaoSolucao: 'O algoritmo guloso (pegar sempre a maior nota possível) é simples e rápido, e funciona para a maioria dos valores com essas notas. Mas não para todos: com 5 e 2, o 8 deixa resto 1 pelo caminho guloso, mesmo podendo ser pago com quatro notas de 2. Por isso a conferência do resto no fim é obrigatória, nunca opcional. Descobrir onde uma estratégia simples falha é parte do raciocínio lógico.',
    proximosDesafios: ['Resolva o 8 (e outros casos parecidos): quando sobrar resto, tente usar uma nota de 5 a menos e veja se o resto fecha com notas de 2.', 'Resolva o problema geral com programação dinâmica: o menor número de notas para cada valor de 1 até n.', 'Adicione um limite de notas disponíveis no caixa (ex.: só 10 notas de 100).'],
  },
];

export const findProjeto = (id: string) => PROJETOS.find((p) => p.id === id) ?? null;

// Tira comentários antes de conferir (um critério não pode passar só porque a palavra aparece num comentário).
export function semComentarios(codigo: string, tecnologia: string): string {
  let s = codigo;
  if (tecnologia === 'HTML e CSS') return s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (tecnologia === 'SQL') return s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (tecnologia === 'Python' || tecnologia === 'Lógica') return s.replace(/(^|\s)#[^\n]*/g, '$1');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'\\])\/\/[^\n]*/g, '$1');
  if (tecnologia === 'PHP') s = s.replace(/(^|\s)#[^\n[]*/g, '$1');
  return s;
}

export interface ResultadoCriterio { descricao: string; ok: boolean }
export function conferirEtapa(projeto: Projeto, etapa: Etapa, codigo: string): { ok: boolean; criterios: ResultadoCriterio[] } {
  const limpo = semComentarios(codigo, projeto.tecnologia);
  const criterios = etapa.criterios.map((c) => {
    const achou = new RegExp(c.padrao, c.flags ?? 'm').test(limpo);
    return { descricao: c.descricao, ok: c.ausente ? !achou : achou };
  });
  return { ok: criterios.every((c) => c.ok), criterios };
}

// O que vai para o navegador: sem a referência e sem os padrões; a explicação da solução só depois de concluir.
export const chaveEtapa = (projetoId: string, etapaId: string) => `${projetoId}:${etapaId}`;
export function projetoPublico(p: Projeto, feito: (id: string) => boolean) {
  const etapas = p.etapas.map(({ referencia: _r, criterios, ...e }) => ({ ...e, criterios: criterios.map((c) => c.descricao), feita: feito(chaveEtapa(p.id, e.id)) }));
  const concluido = etapas.every((e) => e.feita);
  return { ...p, etapas, concluido, explicacaoSolucao: concluido ? p.explicacaoSolucao : null };
}
