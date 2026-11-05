// Tarefas da avaliação da IA do Gyde, uma correção automática para cada: código roda contra testes, SQL roda num banco de
// verdade, números são conferidos com o valor calculado aqui. O que não dá para corrigir por máquina (a graça de um
// poema) não é medido: as tarefas de escrita só conferem as regras pedidas e o pronto-para-usar.
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import path from 'node:path';
import { PROMPT_REVISOR } from '../pacotes/servidor/ia/prompts.ts';

// ---------- imagem de teste: PNG 64x64 vermelho com um quadrado azul no canto ----------
function png(largura, altura, pixel) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const bloco = (tipo, dados) => { const t = Buffer.from(tipo); const len = Buffer.alloc(4); len.writeUInt32BE(dados.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, dados]))); return Buffer.concat([len, t, dados, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(largura, 0); ihdr.writeUInt32BE(altura, 4); ihdr[8] = 8; ihdr[9] = 2;
  const linhas = [];
  for (let y = 0; y < altura; y++) { linhas.push(0); for (let x = 0; x < largura; x++) linhas.push(...pixel(x, y)); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), bloco('IHDR', ihdr), bloco('IDAT', deflateSync(Buffer.from(linhas))), bloco('IEND', Buffer.alloc(0))]);
}
const IMAGEM = `data:image/png;base64,${png(64, 64, (x, y) => (x < 16 && y < 16 ? [20, 60, 220] : [220, 30, 30])).toString('base64')}`;

// ---------- ajudas das correções ----------
export const blocoDeCodigo = (texto, linguagem) => {
  const blocos = [...texto.matchAll(/```(\w*)\s*\n([\s\S]*?)```/g)];
  const certo = blocos.find((b) => b[1].toLowerCase().startsWith(linguagem)) ?? blocos[0];
  return certo ? certo[2] : texto;
};
// roda funções JS geradas num contexto separado; `nome` precisa existir no fim
function rodarJs(codigo, nome) {
  const ctx = vm.createContext({});
  vm.runInContext(`${codigo.replace(/^\s*export\s+(default\s+)?/gm, '').replace(/module\.exports[^\n]*/g, '')}\n;globalThis.__f = typeof ${nome} === 'function' ? ${nome} : null;`, ctx, { timeout: 1000 });
  if (!ctx.__f) throw new Error(`não definiu ${nome}`);
  return (...args) => JSON.parse(vm.runInContext(`JSON.stringify(__f(...${JSON.stringify(args)}))`, ctx, { timeout: 1000 }) ?? 'null');
}
const casosJs = (texto, nome, casos, comparar = (a, b) => JSON.stringify(a) === JSON.stringify(b)) => {
  try {
    const f = rodarJs(blocoDeCodigo(texto, 'js'), nome);
    const falhas = casos.filter(([e, s]) => { try { return !comparar(f(...e), s); } catch { return true; } });
    return { ok: !falhas.length, motivo: falhas.length ? `${falhas.length}/${casos.length} casos errados` : `${casos.length}/${casos.length} casos` };
  } catch (e) { return { ok: false, motivo: `não rodou: ${e.message.slice(0, 80)}` }; }
};
function rodarPython(codigo, testes) {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-aval-'));
  try {
    const arquivo = path.join(pasta, 't.py');
    writeFileSync(arquivo, `${codigo}\n\n${testes}\nprint("ok")\n`);
    const r = spawnSync('python', [arquivo], { encoding: 'utf8', timeout: 10_000 });
    return { ok: r.status === 0 && /ok/.test(r.stdout), motivo: r.status === 0 ? 'testes passaram' : (r.stderr.trim().split('\n').pop() || 'falhou').slice(0, 100) };
  } finally { rmSync(pasta, { recursive: true, force: true }); }
}
const resposta = (texto) => (texto.match(/RESPOSTA:\s*\**\s*([^\n*]+)/i)?.[1] ?? '').trim();
const palavras = (t) => t.trim().split(/\s+/).filter(Boolean).length;
const temEmoji = (t) => /\p{Extended_Pictographic}/u.test(t.replace(/✓|✗|→|•|⚠\uFE0E?|★/gu, ''));
const emPortugues = (t) => (t.match(/\b(você|não|que|para|com|uma|são|está|como|por)\b/gi) || []).length >= 2;
export const jsonDe = (texto) => { const i = texto.indexOf('{'), f = texto.lastIndexOf('}'); try { return JSON.parse(texto.slice(i, f + 1)); } catch { return null; } };
const regra = (...itens) => { const falhas = itens.filter(([ok]) => !ok).map(([, m]) => m); return { ok: !falhas.length, motivo: falhas.join(', ') || 'todas as regras cumpridas' }; };

// ---------- documento longo para a análise: os valores certos saem daqui, não do modelo ----------
const SERVICOS = ['login', 'pagamentos', 'busca', 'relatorios'];
const LOG = [];
{
  let semente = 42; const sorte = (n) => { semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente % n; };
  for (let i = 0; i < 320; i++) LOG.push({ h: `10:${String(i % 60).padStart(2, '0')}:${String(sorte(60)).padStart(2, '0')}`, servico: SERVICOS[sorte(4)], status: [200, 200, 200, 201, 404, 500][sorte(6)], ms: 40 + sorte(900) });
}
const LOG_TEXTO = LOG.map((l) => `${l.h} servico=${l.servico} status=${l.status} ms=${l.ms}`).join('\n');
const ERROS_PAGAMENTOS = LOG.filter((l) => l.servico === 'pagamentos' && l.status === 500).length;
const MAIOR_MS = LOG.reduce((a, b) => (b.ms > a.ms ? b : a));

// ---------- banco para o SQL ----------
const dadosSql = (db) => db.exec(`CREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);
  CREATE TABLE pedidos (id INTEGER PRIMARY KEY, cliente_id INTEGER, valor REAL, status TEXT);
  INSERT INTO clientes VALUES (1,'Ana'),(2,'Bia'),(3,'Caio'),(4,'Davi');
  INSERT INTO pedidos VALUES (1,1,80,'pago'),(2,1,50,'pago'),(3,2,500,'cancelado'),(4,2,90,'pago'),(5,3,300,'pago'),(6,3,10,'aberto'),(7,1,5,'cancelado');`);

export const TAREFAS = [
  { id: 'conversa', categoria: 'conversa', mensagens: [{ role: 'system', content: 'Você é o Gyde, tutor de programação brasileiro.' }, { role: 'user', content: 'oi, tudo bem? hoje tô meio cansado de estudar programação' }],
    corrigir: (t) => regra([palavras(t) <= 70, `longa demais (${palavras(t)} palavras)`], [!/^#|\n#/.test(t), 'usou título'], [!temEmoji(t), 'usou emoji'], [emPortugues(t), 'não está em português']) },
  { id: 'objetiva', categoria: 'objetiva', mensagens: [{ role: 'user', content: 'Qual código de status HTTP significa que o recurso foi criado? Responda em uma frase curta.' }],
    corrigir: (t) => regra([/\b201\b/.test(t), 'não disse 201'], [palavras(t) <= 30, `longa demais (${palavras(t)} palavras)`]) },
  { id: 'raciocinio-conta', categoria: 'raciocinio', mensagens: [{ role: 'user', content: 'A caixa A tem o dobro de bolas da caixa B. A caixa C tem 5 bolas a menos que a A. No total são 35 bolas. Quantas bolas tem a caixa C? Termine com uma linha "RESPOSTA: <número>".' }],
    corrigir: (t) => regra([resposta(t).replace(/\D/g, '') === '11', `resposta: ${resposta(t) || 'sem a linha'}`]) },
  { id: 'raciocinio-ordem', categoria: 'raciocinio', mensagens: [{ role: 'user', content: 'Cinco tarefas A, B, C, D, E. B vem antes de A. A vem antes de C. C vem antes de E. E vem antes de D. Qual é a ordem? Termine com uma linha "RESPOSTA: X,X,X,X,X".' }],
    corrigir: (t) => regra([resposta(t).replace(/\s/g, '').toUpperCase() === 'B,A,C,E,D', `resposta: ${resposta(t) || 'sem a linha'}`]) },
  { id: 'raciocinio-conjuntos', categoria: 'raciocinio', mensagens: [{ role: 'user', content: 'Um bug aparece nos valores de x, de 1 a 100, em que x é múltiplo de 6 ou de 10. Em quantos valores o bug aparece? Termine com uma linha "RESPOSTA: <número>".' }],
    corrigir: (t) => regra([resposta(t).replace(/\D/g, '') === '23', `resposta: ${resposta(t) || 'sem a linha'}`]) },
  { id: 'codigo-js', categoria: 'codigo', mensagens: [{ role: 'user', content: 'Escreva uma função JavaScript `segundoMaior(lista)` que devolve o segundo maior valor DISTINTO de uma lista de números, ou null se não existir. Responda só com o código num bloco ```js.' }],
    corrigir: (t) => casosJs(t, 'segundoMaior', [[[[3, 1, 4, 1, 5]], 4], [[[7, 7, 7]], null], [[[]], null], [[[-2, -5, -1]], -2], [[[10, 9]], 9], [[[2, 2, 1]], 1]]) },
  { id: 'codigo-python', categoria: 'codigo', mensagens: [{ role: 'user', content: 'Este código Python tem dois bugs: dá erro com lista vazia e a média sai errada. Corrija e responda só com o código corrigido num bloco ```python.\n\n```python\ndef media(notas):\n    total = 0\n    for i in range(1, len(notas)):\n        total += notas[i]\n    return total / len(notas)\n```' }],
    corrigir: (t) => rodarPython(blocoDeCodigo(t, 'py'), 'assert media([7, 8, 9]) == 8\nassert media([10]) == 10\nassert media([5, 6]) == 5.5\nassert media([]) in (0, 0.0, None)') },
  { id: 'sql', categoria: 'sql', mensagens: [{ role: 'user', content: 'Tabelas SQLite: clientes(id, nome) e pedidos(id, cliente_id, valor, status). Escreva uma consulta que devolve nome e total (soma de valor) só dos pedidos com status "pago", só de clientes com total acima de 100, do maior total para o menor. Colunas: nome, total. Responda só com a consulta num bloco ```sql.' }],
    corrigir: (t) => {
      const db = new DatabaseSync(':memory:');
      try {
        dadosSql(db);
        const linhas = db.prepare(blocoDeCodigo(t, 'sql').trim().replace(/;\s*$/, '')).all();
        const certo = JSON.stringify(linhas.map((l) => [l.nome, l.total])) === JSON.stringify([['Caio', 300], ['Ana', 130]]);
        return { ok: certo, motivo: certo ? 'linhas certas' : `linhas: ${JSON.stringify(linhas).slice(0, 80)}` };
      } catch (e) { return { ok: false, motivo: `não rodou: ${e.message.slice(0, 80)}` }; } finally { db.close(); }
    } },
  { id: 'frontend', categoria: 'frontend', mensagens: [{ role: 'user', content: 'Escreva a função JavaScript `listaHtml(itens)`: recebe uma lista de textos e devolve a string `<ul><li>a</li><li>b</li></ul>`, sem espaços entre as tags, escapando &, < e > de cada texto para que o HTML do usuário não rode. Lista vazia devolve `<p>Nada encontrado</p>`. Só o código num bloco ```js.' }],
    corrigir: (t) => casosJs(t, 'listaHtml', [[[['a', 'b']], '<ul><li>a</li><li>b</li></ul>'], [[[]], '<p>Nada encontrado</p>'], [[['<script>']], '<ul><li>&lt;script&gt;</li></ul>'], [[['a&b']], '<ul><li>a&amp;b</li></ul>']]) },
  { id: 'backend-validar', categoria: 'backend', mensagens: [{ role: 'user', content: 'Escreva a função JavaScript `validarCadastro(corpo)` de uma rota de API. Regras: `email` precisa ter um @ com texto antes e depois; `senha` precisa ter 8 caracteres ou mais; `idade`, se vier, precisa ser inteiro de 13 a 120. Devolve `{ status: 201, erros: [] }` se estiver certo, ou `{ status: 400, erros: [...] }` com os nomes dos campos errados, na ordem email, senha, idade. `corpo` pode não ser objeto (null). Só o código num bloco ```js.' }],
    corrigir: (t) => casosJs(t, 'validarCadastro', [
      [[{ email: 'a@b.c', senha: '12345678' }], { status: 201, erros: [] }],
      [[{ email: 'a@b.c', senha: '12345678', idade: 30 }], { status: 201, erros: [] }],
      [[{ email: 'sem', senha: '123' }], { status: 400, erros: ['email', 'senha'] }],
      [[{ email: '@b', senha: '12345678' }], { status: 400, erros: ['email'] }],
      [[{ email: 'a@b.c', senha: '12345678', idade: 12 }], { status: 400, erros: ['idade'] }],
      [[{ email: 'a@b.c', senha: '12345678', idade: 20.5 }], { status: 400, erros: ['idade'] }],
      [[null], { status: 400, erros: ['email', 'senha'] }],
    ]) },
  { id: 'backend-limite', categoria: 'backend', mensagens: [{ role: 'user', content: 'Escreva em JavaScript a função `criarLimitador(max, janelaMs)` que devolve uma função `permitir(chave, agora)`: true se a chave fez menos de `max` pedidos permitidos nos últimos `janelaMs` milissegundos (janela deslizante: um pedido feito em t deixa de contar em t + janelaMs), senão false. Pedidos recusados não contam. Chaves são independentes. `agora` é um número passado por quem chama. Só o código num bloco ```js.' }],
    corrigir: (t) => {
      try {
        const ctx = vm.createContext({});
        vm.runInContext(`${blocoDeCodigo(t, 'js').replace(/^\s*export\s+(default\s+)?/gm, '')}\n;globalThis.p = criarLimitador(2, 100);`, ctx, { timeout: 1000 });
        const seq = [['a', 0, true], ['a', 10, true], ['a', 20, false], ['b', 20, true], ['a', 99, false], ['a', 100, true], ['a', 109, false], ['a', 110, true]];
        const erradas = seq.filter(([c, n, e]) => vm.runInContext(`p(${JSON.stringify(c)}, ${n})`, ctx, { timeout: 500 }) !== e);
        return { ok: !erradas.length, motivo: erradas.length ? `${erradas.length}/${seq.length} passos errados` : 'janela certa' };
      } catch (e) { return { ok: false, motivo: `não rodou: ${e.message.slice(0, 80)}` }; }
    } },
  { id: 'escrita-acrostico', categoria: 'escrita', mensagens: [{ role: 'user', content: 'Escreva um poema de exatamente 4 versos sobre aprender a programar, em português. Os versos começam, em ordem, com as letras G, Y, D, E. Não use as palavras "código" nem "computador". Entregue só os 4 versos.' }],
    corrigir: (t) => { const v = t.trim().split(/\n+/).map((l) => l.replace(/^[\s*_>#-]+/, '').trim()).filter(Boolean); return regra([v.length === 4, `${v.length} versos`], [v.map((l) => l[0]?.toUpperCase()).join('') === 'GYDE', `letras: ${v.map((l) => l[0]).join('')}`], [!/c[óo]digo|computador/i.test(t), 'usou palavra proibida'], [!temEmoji(t), 'usou emoji']); } },
  { id: 'escrita-pronta', categoria: 'escrita', mensagens: [{ role: 'user', content: 'Escreva um e-mail curto para a professora Marta pedindo mais dois dias de prazo no trabalho de banco de dados, porque fiquei doente. Assine como Lucas. Quero pronto para enviar.' }],
    corrigir: (t) => regra([!/^\s*(claro|certo|aqui est|segue|com certeza|ok\b)/i.test(t), 'começou comentando'], [/Marta/.test(t), 'sem o nome da professora'], [/Lucas/.test(t), 'sem a assinatura'], [/dois dias|2 dias/i.test(t), 'sem o prazo'], [!/\[[^\]]+\]/.test(t), 'deixou lacuna entre colchetes'], [palavras(t) <= 130, `longo demais (${palavras(t)} palavras)`]) },
  { id: 'analise-log', categoria: 'analise', mensagens: [{ role: 'user', content: `Log de um sistema:\n\n${LOG_TEXTO}\n\nQuantas linhas têm servico=pagamentos com status=500? Qual o maior valor de ms e em que serviço aconteceu? Responda só no formato: erros=<n>; maior=<ms>; servico=<nome>` }],
    corrigir: (t) => { const e = t.match(/erros\s*=\s*(\d+)/i)?.[1], m = t.match(/maior\s*=\s*(\d+)/i)?.[1], s = t.match(/servico\s*=\s*(\w+)/i)?.[1]; return regra([Number(e) === ERROS_PAGAMENTOS, `erros=${e} (certo: ${ERROS_PAGAMENTOS})`], [Number(m) === MAIOR_MS.ms, `maior=${m} (certo: ${MAIOR_MS.ms})`], [s === MAIOR_MS.servico, `servico=${s}`]); } },
  { id: 'analise-sem-resposta', categoria: 'analise', mensagens: [{ role: 'user', content: 'Com base só neste trecho, qual é a versão do Node que o projeto usa?\n\n"O projeto Lumen usa PostgreSQL 16 e roda em containers. O deploy acontece toda sexta-feira."' }],
    corrigir: (t) => regra([/n[ãa]o (é |está |foi |h[áa] |tem |diz|informa|menciona|cita|d[áa] para|consta)|sem (essa )?informa/i.test(t), 'não disse que a informação não está lá'], [!/node\s*(\.js\s*)?(v|vers[ãa]o\s*)?\d/i.test(t), 'inventou uma versão']) },
  { id: 'instrucoes', categoria: 'instrucoes', mensagens: [{ role: 'user', content: 'Siga exatamente: responda só com um objeto JSON, sem cerca de código, com as chaves "linguagens" (lista com Rust, C e Python em ordem alfabética), "total" (o tamanho da lista como número) e "nota" (texto de no máximo 5 palavras, sem a letra z).' }],
    corrigir: (t) => { let o; try { o = JSON.parse(t.trim()); } catch { return { ok: false, motivo: 'não é só JSON' }; } return regra([JSON.stringify(o.linguagens) === '["C","Python","Rust"]', 'lista errada'], [o.total === 3, 'total errado'], [typeof o.nota === 'string' && palavras(o.nota) <= 5, 'nota longa'], [!/z/i.test(o.nota ?? ''), 'nota com z'], [Object.keys(o).length === 3, 'chaves a mais']); } },
  { id: 'contexto', categoria: 'contexto', mensagens: [
    { role: 'user', content: 'Meu projeto se chama Lumen e usa Python com FastAPI. Não gosto de explicação longa.' },
    { role: 'assistant', content: 'Anotado: Lumen, Python e FastAPI, com explicações curtas.' },
    { role: 'user', content: 'Outra coisa: o que é um índice em banco de dados?' },
    { role: 'assistant', content: 'Uma estrutura que acelera buscas numa coluna, como o índice de um livro.' },
    { role: 'user', content: 'Voltando ao meu projeto: escreva a rota GET /status que devolve {"ok": true}. Só o código.' },
  ], corrigir: (t) => regra([/fastapi|@\w+\.get/i.test(t), 'não usou o framework da conversa'], [/\/status/.test(t), 'sem a rota'], [!/flask|express/i.test(t), 'usou outro framework'], [palavras(t) <= 60, 'longo demais para quem pediu só o código']) },
  { id: 'etapas', categoria: 'etapas', mensagens: [{ role: 'user', content: 'Faça na ordem: 1) calcule a soma dos números pares de 1 a 20; 2) escreva o resultado em hexadecimal; 3) escreva a função Python `soma_pares(n)` que calcula isso para qualquer n. Primeira linha da resposta: SOMA=<valor>; HEX=<valor>. Depois um bloco ```python com a função.' }],
    corrigir: (t) => { const l = t.trim().split('\n')[0]; const ok = /SOMA\s*=\s*110/.test(l) && /HEX\s*=\s*(0x)?6e/i.test(l); const p = rodarPython(blocoDeCodigo(t, 'py'), 'assert soma_pares(20) == 110\nassert soma_pares(1) == 0\nassert soma_pares(0) == 0'); return regra([ok, `primeira linha: ${l.slice(0, 40)}`], [p.ok, p.motivo]); } },
  { id: 'tutor', categoria: 'tutor', mensagens: [
    { role: 'system', content: 'Você é o Gyde, tutor de programação para iniciantes brasileiros. Responda em português do Brasil, sem emojis.' },
    { role: 'user', content: 'Sou iniciante. Meu código Python dá "IndexError: list index out of range":\n\n```python\nl = [1, 2, 3]\nfor i in range(len(l) + 1):\n    print(l[i])\n```\n\nExplique o que está errado, mas NÃO me dê o código corrigido: quero tentar sozinho.' },
  ], corrigir: (t) => regra([emPortugues(t), 'não está em português'], [/índice|indice|posição|posicao|len\(l\)|range/i.test(t), 'não explica o índice'], [!/for\s+\w+\s+in\s+range\s*\(\s*len\s*\(\s*l\s*\)\s*\)\s*:|for\s+\w+\s+in\s+l\s*:/.test(t), 'entregou o código corrigido'], [!temEmoji(t), 'usou emoji']) },
  { id: 'agente', categoria: 'agente', mensagens: [
    { role: 'system', content: 'Você é um agente de código. Ferramentas: listar {"caminho": ".", "profundidade": 2}, ler {"caminho": "..."}, editar {"caminho": "...", "procurar": "...", "substituir": "..."}, executar {"comando": "..."}.\nRESPONDA SEMPRE com UM objeto JSON e nada mais: {"pensamento": "...", "acoes": [{"ferramenta": "...", "args": {...}}]} para agir, ou {"pensamento": "...", "resposta": "..."} para responder ao usuário.' },
    { role: 'user', content: 'PASTA DO PROJETO: C:\\projeto\nNOVA MENSAGEM DO USUÁRIO: rode os testes do projeto (npm test) e leia o package.json ao mesmo tempo.' },
  ], corrigir: (t) => { const o = jsonDe(t); if (!o) return { ok: false, motivo: 'não é JSON' }; const acoes = Array.isArray(o.acoes) ? o.acoes : []; const ok = acoes.some((a) => a.ferramenta === 'executar' && /npm\s+test/.test(a.args?.comando || '')) && acoes.some((a) => a.ferramenta === 'ler' && /package\.json/.test(a.args?.caminho || '')); return { ok, motivo: ok ? 'duas ações certas' : `ações: ${acoes.map((a) => a.ferramenta).join(', ') || 'nenhuma'}` }; } },
  // projeto de verdade tem tamanho: pedidos grandes separam quem aguenta de quem recusa por cota de tokens
  { id: 'agente-grande', categoria: 'agente-grande', mensagens: [
    { role: 'system', content: 'Você é a Forja, um agente de código. Ferramentas: ler {"caminho": "..."}, editar {"caminho": "...", "procurar": "...", "substituir": "..."}, executar {"comando": "..."}.\nRESPONDA SEMPRE com UM objeto JSON e nada mais: {"pensamento": "...", "acoes": [{"ferramenta": "...", "args": {...}}]} para agir, ou {"pensamento": "...", "resposta": "..."} para responder ao usuário.' },
    { role: 'user', content: `PASTA DO PROJETO: C:\\projeto\nARQUIVOS:\n${Array.from({ length: 40 }, (_, i) => `--- src/modulo${i}.js ---\n${Array.from({ length: 22 }, (__, l) => `export function etapa${i}_${l}(valor) { return valor + ${l}; } // passo ${l} do modulo ${i}`).join('\n')}`).join('\n\n')}\n\n--- src/soma.js ---\nexport function soma(a, b) {\n  return a - b;\n}\n\nNOVA MENSAGEM DO USUÁRIO: a função soma está subtraindo. Corrija e rode npm test.` },
  ], corrigir: (t) => { const o = jsonDe(t); if (!o) return { ok: false, motivo: 'não é JSON' }; const a = Array.isArray(o.acoes) ? o.acoes : []; const ok = a.some((x) => /soma\.js/.test(x.args?.caminho || '') && (x.ferramenta === 'ler' || (x.ferramenta === 'editar' && /a\s*-\s*b/.test(x.args?.procurar || '') && /a\s*\+\s*b/.test(x.args?.substituir || '')))); return { ok, motivo: ok ? 'foi direto ao arquivo certo' : `ações: ${a.map((x) => `${x.ferramenta} ${x.args?.caminho || ''}`).join(', ') || 'nenhuma'}` }; } },
  { id: 'revisao-com-bug', categoria: 'revisao', mensagens: [{ role: 'system', content: PROMPT_REVISOR }, { role: 'user', content: 'PEDIDO: função Python que devolve o maior número de uma lista, sem usar max().\n\nRASCUNHO:\n```python\ndef maior(lista):\n    m = 0\n    for x in lista:\n        if x > m:\n            m = x\n    return m\n```' }],
    corrigir: (t) => { const o = jsonDe(t); const p = Array.isArray(o?.problemas) ? o.problemas : null; if (!p) return { ok: false, motivo: 'não é o JSON pedido' }; const achou = p.some((x) => /negativ|m\s*=\s*0|inicia|zero|vazia/i.test(`${x.erro} ${x.correcao} ${x.onde}`)); return { ok: achou, motivo: achou ? 'achou o bug' : `${p.length} problemas, nenhum é o bug` }; } },
  { id: 'revisao-sem-bug', categoria: 'revisao', mensagens: [{ role: 'system', content: PROMPT_REVISOR }, { role: 'user', content: 'PEDIDO: função Python que soma os números de uma lista, sem usar sum().\n\nRASCUNHO:\n```python\ndef soma(lista):\n    total = 0\n    for x in lista:\n        total += x\n    return total\n```' }],
    corrigir: (t) => { const o = jsonDe(t); const p = Array.isArray(o?.problemas) ? o.problemas : null; if (!p) return { ok: false, motivo: 'não é o JSON pedido' }; const altos = p.filter((x) => x.gravidade === 'alta'); return { ok: altos.length === 0, motivo: altos.length ? 'inventou um problema grave' : 'não inventou problema' }; } },
  { id: 'visao', categoria: 'visao', mensagens: [{ role: 'user', content: [{ type: 'text', text: 'Qual é a cor que ocupa quase toda a imagem e qual a cor do quadrado pequeno no canto? Responda no formato: fundo=<cor>; quadrado=<cor>, em português.' }, { type: 'image_url', image_url: { url: IMAGEM } }] }],
    corrigir: (t) => { const f = /fundo\s*=\s*\**\s*vermelh/i.test(t), q = /quadrado\s*=\s*\**\s*azul/i.test(t); return { ok: f && q, motivo: f && q ? 'viu as duas cores' : `resposta: ${t.slice(0, 60).replace(/\s+/g, ' ')}` }; } },
  { id: 'ferramentas', categoria: 'ferramentas', mensagens: [{ role: 'user', content: 'Quanto está fazendo em Curitiba agora? Use a ferramenta.' }],
    extra: { tools: [{ type: 'function', function: { name: 'clima', description: 'Temperatura atual de uma cidade', parameters: { type: 'object', properties: { cidade: { type: 'string' } }, required: ['cidade'] } } }] },
    corrigirBruto: (j) => { const c = j.choices?.[0]?.message?.tool_calls?.[0]; const ok = c?.function?.name === 'clima' && /curitiba/i.test(c.function.arguments || ''); return { ok, motivo: ok ? 'chamou a ferramenta' : 'não chamou a ferramenta nativa' }; } },
];
