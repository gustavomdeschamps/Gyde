// Cenários da avaliação das skills (ferramentas/avaliar-skills.mjs): o mesmo pedido COM e SEM a skill, com critérios
// objetivos. Cada critério é uma conferência automática no texto da resposta; alguns rodam o código da resposta
// (só JavaScript, numa pasta temporária, com tempo limite). Uma skill fica no catálogo só se, na média, cumprir mais
// critérios com ela do que sem ela.
//
// Os critérios conferem o que a skill promete (o checklist dela): por isso uma resposta boa SEM a skill pode cumprir
// alguns, e a comparação é justa. A conferência é por padrões no texto: é aproximada e está descrita em cada item.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { apagarSeguro } from './limpeza-segura.mjs';

const tem = (re) => (t) => re.test(t);
const todos = (...res) => (t) => res.every((re) => re.test(t));
const contar = (re, min) => (t) => (t.match(re) || []).length >= min;
export const blocos = (t, linguagens = null) => [...t.matchAll(/```([\w+-]*)[^\n]*\n([\s\S]*?)```/g)]
  .filter((m) => !linguagens || linguagens.includes(m[1].toLowerCase())).map((m) => m[2]);

// Roda JavaScript (ESM) numa pasta temporária com tempo limite. Devolve true se saiu com código 0.
export function rodarJs(codigo, { arquivos = {}, args = [], tempo = 15_000 } = {}) {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-aval-skill-'));
  try {
    for (const [nome, conteudo] of Object.entries(arquivos)) writeFileSync(path.join(pasta, nome), conteudo);
    writeFileSync(path.join(pasta, 'principal.mjs'), codigo);
    const r = spawnSync(process.execPath, [...args, 'principal.mjs'], { cwd: pasta, timeout: tempo, encoding: 'utf8', env: { PATH: process.env.PATH } });
    return r.status === 0;
  } finally { try { apagarSeguro(pasta); } catch { /* arquivo preso */ } }
}

// regex: pega a primeira /.../flags de um bloco de código e confere os exemplos
function regexDaResposta(t) {
  for (const b of blocos(t)) {
    const m = b.match(/\/((?:\\\/|[^/\n])+)\/([gimsuy]*)/);
    if (m) { try { return new RegExp(m[1], m[2].replace('g', '')); } catch { /* inválida */ } }
    const p = b.match(/r?["'](\^[^"'\n]+\$)["']/);
    if (p) { try { return new RegExp(p[1]); } catch { /* inválida */ } }
  }
  return null;
}
const regexValida = (casam, naoCasam) => (t) => { const re = regexDaResposta(t); return !!re && casam.every((x) => re.test(x)) && naoCasam.every((x) => !re.test(x)); };

// função JS da resposta testada contra casos: junta o primeiro bloco js com os asserts
const funcaoPassa = (nome, asserts) => (t) => {
  const codigo = blocos(t, ['js', 'javascript', 'mjs', '']).find((b) => new RegExp(`function\\s+${nome}\\b|(const|let)\\s+${nome}\\s*=`).test(b));
  if (!codigo) return false;
  const limpo = codigo.replace(/^\s*export\s+(default\s+)?/gm, '').replace(/^\s*(import|const .*=\s*require\().*$/gm, '');
  return rodarJs(`${limpo}\nimport assert from 'node:assert/strict';\n${asserts}\n`);
};

// testes escritos pela resposta (node:test) rodados contra uma implementação correta e uma com defeito
const testesPegamDefeito = (implCerta, implErrada) => (t) => {
  const teste = blocos(t, ['js', 'javascript', 'mjs']).find((b) => /node:test|\btest\(|\bit\(|describe\(/.test(b) && /assert|expect/.test(b));
  if (!teste) return false;
  const corpo = teste.replace(/^\s*import\s+.*from\s+['"]\.\/?[^'"]*['"];?\s*$/gm, '').replace(/^\s*const\s+\{?[^=]*\}?\s*=\s*require\(['"]\.\/?[^'"]*['"]\);?\s*$/gm, '');
  const cabeca = "import { test, it, describe } from 'node:test';\nimport assert from 'node:assert/strict';\n";
  const semImports = corpo.replace(/^\s*import\s+.*['"]node:(test|assert)(\/strict)?['"];?\s*$/gm, '');
  const certo = rodarJs(`${cabeca}${implCerta}\n${semImports}`, { args: ['--test'] });
  const errado = rodarJs(`${cabeca}${implErrada}\n${semImports}`, { args: ['--test'] });
  return certo && !errado;
};

export const CENARIOS = [
  // Sites e design
  { skill: 'front-end', pedido: 'Faça o HTML e o CSS de um cabeçalho com logo à esquerda e um menu com 4 links à direita.', criterios: [
    ['meta viewport', tem(/name=["']viewport["']/i)], ['tags semânticas header e nav', todos(/<header/i, /<nav/i)],
    ['media query para outra largura', tem(/@media/i)], ['unidades relativas (rem)', tem(/\d(\.\d+)?rem\b/)]] },
  { skill: 'design-visual', pedido: 'Meu site é só texto preto em fundo branco e parece amador. Me ajuda a deixar o visual melhor?', criterios: [
    ['cores em variáveis CSS', todos(/:root/, /--[\w-]+\s*:/)], ['escala de espaçamento explícita', tem(/escala|8px.*16px|4.*8.*16.*24|--esp|--space/i)],
    ['fala de contraste', tem(/contraste/i)], ['limita as fontes', tem(/(duas|2) fontes|no máximo (2|duas)|família/i)]] },
  { skill: 'acessibilidade-web', pedido: 'Corrija este botão: <div class="btn" onclick="salvar()"><img src="disquete.svg"></div>', criterios: [
    ['troca div por button', tem(/<button/i)], ['nome acessível (aria-label ou texto)', tem(/aria-label=|alt=["'][^"']+["']/i)],
    ['ícone decorativo escondido ou alt vazio', tem(/aria-hidden=["']true|alt=["']["']/i)], ['fala de foco visível', tem(/focus/i)]] },
  { skill: 'landing-page', pedido: 'Faça uma landing page para meu app de lista de tarefas.', criterios: [
    ['seção de perguntas frequentes', tem(/perguntas frequentes|faq/i)], ['passos de como funciona', tem(/como funciona/i)],
    ['avisa para não inventar depoimento/números', tem(/(seus|suas) (próprios|reais|depoimentos)|substitua|depoimentos reais|não invent/i)],
    ['media query', tem(/@media/i)]] },
  { skill: 'layout-css', pedido: 'Quero 3 cartões lado a lado que viram um por linha no celular. Como faço no CSS?', criterios: [
    ['justifica flex ou grid', tem(/(grid|flexbox).{0,120}(porque|por que|pois|ideal|melhor)/is)], ['usa gap', tem(/\bgap\s*:/)],
    ['auto-fit/minmax ou flex-wrap', tem(/auto-fit|auto-fill|minmax|flex-wrap/)]] },
  { skill: 'formulario-web', pedido: 'Faça um formulário de cadastro com nome, e-mail e senha.', criterios: [
    ['labels nos campos', contar(/<label/gi, 3)], ['validação no servidor', tem(/servidor|back-?end|server/i)],
    ['autocomplete', tem(/autocomplete=/i)], ['erro ligado ao campo (aria-describedby)', tem(/aria-describedby/i)]] },
  // Aplicativos e APIs
  { skill: 'planejador-projetos', pedido: 'Quero criar um app de controle de gastos pessoais. Por onde começo?', criterios: [
    ['o que fica fora da primeira versão', tem(/fora da primeira|fica(m)? de fora|deixe para depois|não entra|depois da primeira/i)],
    ['estrutura de pastas em bloco', (t) => blocos(t).some((b) => /\/\s*$|├|└|src\//m.test(b))],
    ['primeiro passo concreto', tem(/primeiro passo/i)]] },
  { skill: 'api-rest', pedido: 'Como faço uma API para cadastrar e listar tarefas?', criterios: [
    ['tabela de rotas', tem(/\|\s*(GET|POST)\s*\|/i)], ['201 na criação', tem(/\b201\b/)], ['404 quando não existe', tem(/\b404\b/)],
    ['exemplo com curl', tem(/curl\s/)]] },
  { skill: 'consumir-api', pedido: 'Como busco a lista de produtos da minha API em JavaScript e mostro na tela?', criterios: [
    ['confere res.ok', tem(/\.ok\b/)], ['tempo limite', tem(/AbortSignal\.timeout|AbortController|timeout/)],
    ['estado de carregando', tem(/carregando/i)], ['estado vazio', tem(/vazi[oa]|nenhum produto/i)]] },
  { skill: 'componentes-react', pedido: 'Faça em React uma lista de tarefas com filtro (todas, feitas, pendentes).', criterios: [
    ['key estável (id)', tem(/key=\{[\w.]*id\}/)], ['lista filtrada calculada sem outro useState', (t) => /\.filter\(/.test(t) && !/useState\([^)]*\)\s*;?\s*\/\/.*filtrad|\[\s*\w*(filtrad|visive)\w*\s*,\s*set/i.test(t)],
    ['atualiza estado sem mutar (spread ou map/filter)', tem(/\[\s*\.\.\.\w+|\.map\(|\.filter\(/)],
    // o que a skill acrescenta: filtro acessível e lista vazia tratada
    ['botões de filtro com aria-pressed', tem(/aria-pressed/)], ['mensagem de lista vazia', tem(/length\s*===?\s*0|nenhuma tarefa|lista vazia/i)]] },
  { skill: 'node-express', pedido: 'Faça um servidor em Node com Express com uma rota para cadastrar usuário.', criterios: [
    ['express.json', tem(/express\.json\(\)/)], ['400 com validação', tem(/status\(400\)/)], ['tratador de erro central', tem(/\(err,\s*req,\s*res,\s*next\)/)],
    ['porta de process.env', tem(/process\.env\.PORT/)]] },
  { skill: 'python-flask', pedido: 'Faça uma rota em Flask para cadastrar um livro.', criterios: [
    ['ambiente virtual', tem(/venv/)], ['400 na validação', tem(/,\s*400/)], ['201 na criação', tem(/,\s*201/)], ['get_json(silent=True) ou tratamento', tem(/silent=True|is_json|get_json\(\)\s*or/)]] },
  { skill: 'app-celular', pedido: 'Quero que meu site de receitas vire um app no celular. Como faço?', criterios: [
    ['manifest', tem(/manifest/i)], ['ícones 192 e 512', todos(/192/, /512/)], ['service worker', tem(/service ?worker|serviceWorker/i)], ['HTTPS', tem(/https/i)]] },
  // Jogos
  { skill: 'jogo-canvas', pedido: 'Faça um jogo simples em JavaScript de uma nave que desvia de asteroides.', criterios: [
    ['requestAnimationFrame', tem(/requestAnimationFrame/)], ['movimento com dt', tem(/\bdt\b|delta/i)], ['função de colisão', tem(/function\s+\w*colis|colide|collides|intersect/i)],
    ['fim de jogo e recomeço', tem(/(game ?over|fim de jogo).{0,400}(reinici|recome|restart)|(reinici|recome|restart).{0,400}(game ?over|fim de jogo)/is)]] },
  { skill: 'logica-de-jogo', pedido: 'Como faço a lógica do jogo da velha em JavaScript?', criterios: [
    ['trata empate', tem(/empate/i)], ['valida jogada em casa ocupada', tem(/ocupad|já (está|foi) preenchid|casa vazia|!==? *null|jogadaValida/i)],
    ['vencedor funciona', funcaoPassa('vencedor', "assert.equal(vencedor(['X','X','X',null,'O','O',null,null,null]), 'X');\nassert.ok([null,undefined,false,''].includes(vencedor(['X','O',null,null,null,null,null,null,null])));")],
    ['testes das regras', tem(/assert|expect\(|test\(/)]] },
  { skill: 'jogo-python', pedido: 'Faça um joguinho em Python em que uma cesta pega maçãs caindo.', criterios: [
    ['tick limita quadros', tem(/\.tick\(/)], ['trata QUIT', tem(/pygame\.QUIT/)], ['colisão com Rect', tem(/colliderect/)], ['pontuação desenhada', tem(/font.*render|render\(/i)],
    // o que a skill acrescenta: velocidade por segundo (dt) e fim de jogo com recomeço
    ['movimento com dt', tem(/\bdt\b/)], ['fim de jogo e recomeço', tem(/(game ?over|fim de jogo|perdeu).{0,600}(reinici|recome|restart|K_r\b)|(reinici|recome|restart|K_r\b).{0,600}(game ?over|fim de jogo|perdeu)/is)]] },
  { skill: 'design-de-jogo', pedido: 'Tenho a ideia de um jogo para treinar digitação. Como deixo ele divertido?', criterios: [
    ['laço central em uma frase', tem(/laço (central|principal)|core loop|ciclo (central|principal)/i)], ['fases com dificuldade crescente', tem(/fase\s*[1-4]|nível\s*[1-4]|\|\s*fase/i)],
    ['retorno ao jogador (som/animação)', tem(/som|animação|feedback|retorno/i)], ['protótipo antes da arte', tem(/protótipo/i)]] },
  // Dados e planilhas
  { skill: 'planilhas-formulas', pedido: 'No Excel, como busco o preço de um produto pelo código numa outra aba chamada Produtos?', criterios: [
    ['separador ;', tem(/=\w+\([^)]*;/)], ['referência absoluta com $', tem(/\$[A-Z]\$\d/)], ['trata não encontrado', tem(/SEERRO|IFERROR|não encontrado|"N\/?A"/i)]] },
  { skill: 'analise-pandas', pedido: 'Tenho um vendas.csv com colunas data e valor. Como vejo o total por mês com pandas?', criterios: [
    ['inspeção inicial', tem(/\.head\(|\.info\(|\.dtypes|\.shape/)], ['converte datas', tem(/to_datetime/)], ['groupby', tem(/groupby|resample/)], ['CSV brasileiro (sep ou encoding)', tem(/sep=|encoding=|decimal=/)]] },
  { skill: 'graficos-dados', pedido: 'Quero mostrar as vendas de cada vendedor num gráfico. Qual gráfico e como faço?', criterios: [
    ['justifica o tipo', tem(/barras?.{0,160}(porque|por que|pois|ideal|comparar)/is)], ['título', tem(/title|título/i)], ['eixos com nome', tem(/xlabel|ylabel|eixo/i)], ['ordena', tem(/sort|orden/i)]] },
  { skill: 'limpar-dados', pedido: 'Minha planilha de clientes tem e-mails repetidos e cidades escritas de jeitos diferentes. Como limpo?', criterios: [
    ['preserva o original', tem(/original|cópia|arquivo novo|novo arquivo/i)], ['conta antes e depois', tem(/antes e depois|len\(|\.shape|quantas linhas/i)],
    ['normaliza texto', tem(/strip|lower|title|upper|acento/i)], ['define a chave do duplicado', tem(/subset|drop_duplicates|coluna .{0,30}(identifica|chave)/i)]] },
  { skill: 'estatistica-basica', pedido: 'Os salários da equipe são 2000, 2200, 2100 e 15000. Qual é a média?', criterios: [
    ['média correta 5325', tem(/5[.,]?325/)], ['mediana 2150', tem(/2[.,]?150/)], ['explica o valor extremo', tem(/extrem|outlier|puxa|distorc/i)]] },
  // Banco de dados
  { skill: 'sql-na-pratica', pedido: 'Como listo os clientes que nunca fizeram nenhum pedido?', criterios: [
    ['LEFT JOIN ou NOT EXISTS', tem(/LEFT JOIN|NOT EXISTS|NOT IN/i)], ['tabelas de exemplo', contar(/\|\s*id\s*\|/gi, 1)], ['resultado esperado', tem(/resultado/i)]] },
  { skill: 'modelagem-banco', pedido: 'Preciso de um banco para uma escola com alunos e disciplinas. Como modelo?', criterios: [
    ['tabela de ligação', tem(/matricul|aluno_disciplina|alunos_disciplinas/i)], ['FOREIGN KEY', tem(/FOREIGN KEY|REFERENCES/i)], ['NOT NULL ou UNIQUE', tem(/NOT NULL|UNIQUE/i)], ['cardinalidade', tem(/N:N|muitos para muitos|1:N|um para muitos/i)]] },
  { skill: 'indices-consultas', pedido: "Esta consulta está lenta: SELECT * FROM pedidos WHERE cliente_id = 7 AND data > '2026-01-01'. O que faço?", criterios: [
    ['EXPLAIN', tem(/EXPLAIN/i)], ['índice composto na ordem certa', tem(/\(\s*cliente_id\s*,\s*data\s*\)/i)], ['custo do índice', tem(/INSERT|escrita|espaço/i)], ['evitar SELECT *', tem(/SELECT \*/i)]] },
  { skill: 'banco-no-codigo', pedido: 'No meu app em Node, como salvo um pedido e diminuo o estoque do produto no SQLite?', criterios: [
    ['consulta parametrizada', tem(/\?\s*[,)]|\$1/)], ['transação', tem(/BEGIN|transaction|COMMIT/i)], ['rollback', tem(/ROLLBACK/i)],
    // o que a skill acrescenta: baixar o estoque só se houver (na própria consulta) e conferir as linhas afetadas
    ['estoque conferido na própria consulta', tem(/estoque\s*>=\s*\?|estoque\s*>=\s*@|estoque\s*>=\s*\$\d/i)], ['confere as linhas afetadas', tem(/\.changes\b|changes\s*===?\s*0|rowCount|affectedRows/)]] },
  // Testes e qualidade
  { skill: 'testes-automatizados', pedido: "Escreva testes em JavaScript (node:test) para a função media(lista), que devolve a média e lança new Error('Lista vazia') com lista vazia. A função está em media.js.", criterios: [
    ['testes pegam defeito', testesPegamDefeito("function media(l){ if(!l.length) throw new Error('Lista vazia'); return l.reduce((a,b)=>a+b,0)/l.length; }", "function media(l){ return l.reduce((a,b)=>a+b,0)/(l.length||1); }")],
    ['testa erro', tem(/throws|rejects|toThrow/)], ['lista os casos antes', tem(/casos( de teste)?\b|vamos testar|cenários/i)], ['comando para rodar', tem(/node --test|npm test/)]] },
  { skill: 'revisor-codigo', pedido: 'Revise: function media(itens) { let t = 0; for (let i = 0; i <= itens.length; i++) t += itens[i]; return t / itens.length; }', criterios: [
    ['acha o <= (fora do limite)', tem(/<=|fora do (limite|array)|undefined|NaN/i)], ['acha lista vazia', tem(/vazi[oa]|divisão por zero|length\s*===?\s*0/i)],
    ['gravidade', tem(/grave|médio|leve|crític/i)], ['começa pelo que está bom', tem(/^[\s\S]{0,400}(bom|bem|positivo|acert)/i)]] },
  { skill: 'refatorador', pedido: "Refatore: function d(p,t){ if(t=='vip'){ if(p>100){ return p*0.8 } else { return p*0.9 } } else { if(p>100){ return p*0.95 } else { return p } } }", criterios: [
    ['mesmo comportamento', funcaoPassa('\\w+', '')], // substituído abaixo
    ['exemplos de entrada e saída', tem(/→|=>\s*\d|retorna \d|devolve \d/)], ['passos nomeados', tem(/passo\s*\d|1\.\s|primeiro/i)]] },
  { skill: 'debug-socratico', pedido: 'Meu laço soma errado e não sei por quê: let t=0; for(let i=1;i<lista.length;i++){ t+=lista[i] }', criterios: [
    ['não entrega a correção logo', (t) => !/i\s*=\s*0\s*;/.test(t)], ['propõe experimento concreto', tem(/console\.log|print\(/)], ['faz pergunta', tem(/\?/)]] },
  { skill: 'explicador-erros', pedido: "Deu este erro: TypeError: Cannot read properties of undefined (reading 'nome') at carregar (app.js:12:20)", criterios: [
    ['aponta app.js linha 12', tem(/linha 12|app\.js:12/i)], ['causas em ordem', tem(/caus(a|as) (mais )?prováve|mais comum/i)], ['como confirmar', tem(/confirm|conferir|verifique|console\.log/i)]] },
  { skill: 'desempenho-codigo', pedido: 'Achar nomes repetidos numa lista de 100 mil nomes está muito lento: for (const n of nomes) if (nomes.indexOf(n) !== nomes.lastIndexOf(n)) repetidos.push(n)', criterios: [
    ['mede antes e depois', tem(/console\.time|performance\.now|perf_counter|medi/i)], ['complexidade', tem(/O\(n\s*(²|\^2|\*\s*n)\)|O\(n\)/)], ['usa Set ou Map', tem(/new (Set|Map)/)]] },
  // Segurança
  { skill: 'senhas-seguras', pedido: 'Como salvo a senha do usuário no cadastro do meu site em Node?', criterios: [
    ['hash lento (bcrypt/scrypt/argon2)', tem(/bcrypt|scrypt|argon2/i)], ['limite de tentativas', tem(/tentativas|rate.?limit/i)], ['mensagem que não revela conta', tem(/mesma mensagem|não revel|genéric|e-mail ou senha/i)], ['cookie HttpOnly', tem(/httponly/i)]] },
  { skill: 'injecao-xss', pedido: 'Tem algo errado nisso? db.query("SELECT * FROM u WHERE nome = \'" + nome + "\'"); div.innerHTML = comentario;', criterios: [
    ['parametriza o SQL', tem(/\?\s*['"]?\s*,\s*\[|\$1/)], ['textContent ou sanitizador', tem(/textContent|DOMPurify|sanitiz/i)], ['exemplo de ataque', tem(/' OR|OR '1'='1|onerror|<script/i)]] },
  { skill: 'segredos-env', pedido: 'Subi sem querer minha chave de API para o GitHub. E agora?', criterios: [
    ['revogar a chave primeiro', tem(/revog|invalid|gere uma nova|gerar uma nova/i)], ['.gitignore', tem(/\.gitignore/)], ['.env.example', tem(/\.env\.example/)], ['apagar o commit não basta', tem(/não basta|histórico|continua (no|acessível)/i)]] },
  { skill: 'revisao-seguranca', pedido: 'Minha rota GET /pedidos/:id busca o pedido pelo id e devolve. Está segura?', criterios: [
    ['acesso a pedido de outra pessoa', tem(/outr[oa] (pessoa|usuário|cliente)|IDOR|dono/i)], ['filtra pelo dono', tem(/usuario_id|user_id|userId|dono/i)], ['gravidade', tem(/grave|crític|alto/i)], ['dependências', tem(/npm audit|pip-audit|dependênc/i)]] },
  // Git e publicação
  { skill: 'git-sem-medo', pedido: 'Fiz um commit na branch errada. Como conserto?', criterios: [
    ['git status', tem(/git status/)], ['reflog como rede', tem(/reflog/)], ['avisa comando perigoso', tem(/cuidado|perig|--hard|atenção/i)], ['conferência no final', tem(/git log/)]] },
  { skill: 'commits-claros', pedido: 'Mudei o CSS do botão e corrigi o cálculo do frete. Que mensagem de commit eu ponho?', criterios: [
    ['separa em dois commits', tem(/dois commits|2 commits|separ/i)], ['git add -p ou diff --staged', tem(/add -p|diff --staged|--cached/)], ['título no imperativo', tem(/(Corrige|Ajusta|Melhora|Aumenta|Adiciona|fix|feat)[: ]/)]] },
  { skill: 'conflitos-git', pedido: 'Apareceu isso no meu arquivo depois do merge: <<<<<<< HEAD preco = 10 ======= preco = calcularPreco() >>>>>>> main. O que faço?', criterios: [
    ['explica os lados', tem(/HEAD.{0,120}(sua|atual|seu)|sua versão|outra versão/is)], ['remover marcadores', tem(/(apag|remov|tir).{0,40}marcador|<<<<<<</i)], ['testar antes de commitar', tem(/test|rode|rodar/i)], ['como abortar', tem(/--abort/)]] },
  { skill: 'publicar-site', pedido: 'Como coloco no ar meu site feito em React com Vite?', criterios: [
    ['comando de build e pasta dist', todos(/npm run build/, /\bdist\b/)], ['rotas (redirect ou fallback)', tem(/_redirects|rewrites|index\.html 200|fallback/i)], ['variáveis de ambiente no painel', tem(/variáve(l|is) de ambiente|environment/i)], ['conferência', tem(/confer|teste no celular|console/i)]] },
  { skill: 'github-actions', pedido: 'Quero que o GitHub rode o npm test sozinho a cada push. Como faço?', criterios: [
    ['caminho .github/workflows', tem(/\.github\/workflows\//)], ['npm ci', tem(/npm ci/)], ['cache', tem(/cache:/)], ['permissões mínimas', tem(/permissions:/)]] },
  // Documentação
  { skill: 'documentador', pedido: 'Documente esta função: function frete(peso, cep) { if (!/^\\d{8}$/.test(cep)) throw new Error("CEP inválido"); return 10 + peso * 6.75; }', criterios: [
    ['JSDoc', tem(/\/\*\*/)], ['@param e @returns', todos(/@param/, /@returns?/)], ['@throws', tem(/@throws/)], ['@example', tem(/@example/)]] },
  { skill: 'readme-projeto', pedido: 'Escreva o README da minha API de tarefas em Node com Express e SQLite.', criterios: [
    ['pré-requisitos com versão', tem(/Node(\.js)?\s*\d{2}|versão \d/i)], ['instalação com comando', tem(/npm (install|ci)/)], ['tabela de variáveis', tem(/\|\s*`?[A-Z_]{3,}`?\s*\|/)], ['testes', tem(/npm test|testes/i)]] },
  { skill: 'documentar-api', pedido: 'Documente a rota POST /tarefas que recebe titulo (obrigatório) e prazo (opcional).', criterios: [
    ['tabela de parâmetros', tem(/\|\s*`?titulo`?\s*\|/i)], ['exemplo curl', tem(/curl/)], ['resposta de exemplo', tem(/"id"\s*:/)], ['erros com código', tem(/\b400\b/)]] },
  { skill: 'changelog-versoes', pedido: 'Estou na versão 1.3.2. Adicionei filtro por data e corrigi o login que caía. Qual a próxima versão e como escrevo as notas?', criterios: [
    ['1.4.0', tem(/1\.4\.0/)], ['grupos novidades/correções', todos(/novidades|adicionado|added/i, /corre(ç|c)(õ|o)es|corrigido|fixed/i)], ['data AAAA-MM-DD', tem(/\d{4}-\d{2}-\d{2}/)]] },
  // Estudar e aprender
  { skill: 'entrevista-tecnica', pedido: 'Quero treinar para uma entrevista de front-end júnior.', criterios: [
    ['uma pergunta só', (t) => (t.match(/\?/g) || []).length <= 3], ['numera a pergunta', tem(/pergunta\s*1|1\s*de\s*\d/i)]] },
  { skill: 'explicar-conceito', pedido: 'O que é uma Promise em JavaScript?', criterios: [
    ['analogia', tem(/como (se|um|uma)|imagine|analogia|pense (em|n)/i)], ['exemplo de código', (t) => blocos(t).length >= 1], ['pergunta de fixação no fim', (t) => /\?\s*$/.test(t.trim().split('\n').slice(-3).join(' '))]] },
  { skill: 'exercicios-praticos', pedido: 'Me dá um exercício de laço em Python, sou iniciante.', criterios: [
    ['casos de teste', contar(/→|->|==|deve (retornar|devolver)|saída/gi, 3)], ['sem solução junto', (t) => !blocos(t, ['python', 'py']).some((b) => /for .* in .*:\s*\n[\s\S]*return/.test(b))]] },
  { skill: 'plano-de-estudos', pedido: 'Quero aprender JavaScript e tenho 5 horas por semana. Monta um plano?', criterios: [
    ['semanas', contar(/semana\s*\d/gi, 3)], ['projeto por etapa', contar(/projeto/gi, 3)], ['revisão', tem(/revis/i)], ['fonte oficial (MDN)', tem(/MDN|developer\.mozilla|documentação oficial/i)]] },
  { skill: 'logica-programacao', pedido: 'Não sei como começar a fazer um programa que acha o maior número de uma lista.', criterios: [
    ['pseudocódigo', tem(/pseudoc[oó]digo|algoritmo .*:\s*\n|\bpara cada\b/i)], ['teste de mesa', tem(/teste de mesa|\|\s*passo|\|\s*maior/i)], ['entradas e saída', tem(/entrada/i)]] },
  { skill: 'ler-codigo', pedido: "Explique o que este código faz: const express=require('express');const app=express();app.use(express.json());const notas=[];const LIMITE=50;app.post('/notas',(req,res)=>{if(notas.length>=LIMITE)return res.status(429).end();notas.push(req.body);res.status(201).json(req.body)});app.get('/notas',(req,res)=>res.json(notas));app.listen(3000)", criterios: [
    ['ponto de entrada', tem(/listen|ponto de entrada|começa/i)], ['fluxo numerado', tem(/\n\s*[1-3][.)]\s/)], ['onde mexer', tem(/para mudar|se quiser (mudar|alterar)|mexa em/i)], ['risco (memória/sem validação)', tem(/memória|perde|valida|reinici/i)]] },
  // Automação e scripts
  { skill: 'regex', pedido: 'Preciso de uma regex em JavaScript para validar CEP no formato 00000-000 ou 00000000.', criterios: [
    ['regex funciona', regexValida(['88010-000', '88010000', '01001-000'], ['8801-000', '88010-00a', '880100000', 'abc88010-000'])],
    ['tabela trecho | o que faz', tem(/\|\s*`?\^`?\s*\|/)], ['3 que casam e 3 que não', todos(/não casa|não passa|inválid/i, /casa|válid/i)]] },
  { skill: 'scripts-arquivos', pedido: 'Faça um script em Python que organiza as fotos .jpg de uma pasta em subpastas por ano.', criterios: [
    ['pathlib', tem(/pathlib|Path\(/)], ['simulação antes', tem(/simula|--executar|dry.?run/i)], ['não sobrescreve', tem(/exists\(\)|já existe/i)], ['caminho por argumento', tem(/argv|argparse/)]] },
  { skill: 'linha-de-comando', pedido: 'Como listo os 10 arquivos maiores de uma pasta no terminal do Windows?', criterios: [
    ['PowerShell', tem(/Get-ChildItem|gci|ls -r/i)], ['ordena por tamanho', tem(/Sort-Object\s+(-Property\s+)?Length/i)], ['explica o comando', tem(/\|\s*`?Sort|cada parte|o que faz/i)]] },
  { skill: 'tarefas-agendadas', pedido: 'Quero rodar meu backup.py todo dia às 2 da manhã no Linux.', criterios: [
    ['linha do cron', tem(/0\s+2\s+\*\s+\*\s+\*/)], ['caminho absoluto', tem(/\/usr\/bin\/python|\/home\//)], ['log', tem(/>>\s*\S+\.log/)], ['como testar agora', tem(/testar|rodar agora|manualmente/i)]] },
  { skill: 'json-csv', pedido: 'Como converto um usuarios.json para CSV que abra certinho no Excel, em Python?', criterios: [
    ['módulo csv', tem(/import csv|DictWriter/)], ['utf-8-sig', tem(/utf-8-sig/)], ['separador ;', tem(/delimiter=['"];/)], ['newline=""', tem(/newline=['"]['"]/)]] },
];

// refatorador: o código refatorado precisa dar o mesmo resultado nos mesmos casos (nome da função livre)
const casosDesconto = [[150, 'vip'], [50, 'vip'], [150, 'comum'], [50, 'comum'], [100, 'vip'], [100, 'comum']];
const original = (p, t) => { if (t == 'vip') { return p > 100 ? p * 0.8 : p * 0.9; } return p > 100 ? p * 0.95 : p; };
CENARIOS.find((c) => c.skill === 'refatorador').criterios[0] = ['mesmo comportamento', (t) => {
  const codigo = blocos(t, ['js', 'javascript', '']).at(-1);
  if (!codigo) return false;
  const nome = codigo.match(/function\s+(\w+)/)?.[1] ?? codigo.match(/(?:const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>/)?.[1];
  if (!nome) return false;
  const esperado = JSON.stringify(casosDesconto.map(([p, x]) => original(p, x)));
  return rodarJs(`${codigo.replace(/^\s*export\s+(default\s+)?/gm, '')}\nconst r = JSON.stringify(${JSON.stringify(casosDesconto)}.map(([p, x]) => ${nome}(p, x)));\nif (r !== ${JSON.stringify(esperado)}) { console.error(r); process.exit(1); }`);
}];
