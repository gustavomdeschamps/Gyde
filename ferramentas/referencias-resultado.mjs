// Respostas de referência das tarefas de resultado: cada uma precisa tirar nota 1, e uma resposta vazia, 0.
// Garante que as conferências escondidas medem o resultado e não têm erro (pacotes/servidor/testes/tarefas-resultado.test.mjs).
const F = '```';
const js = (c) => `${F}js\n${c}\n${F}`;
export const REFERENCIAS = {
  'regex-celular': js('const re = /^(\\(\\d{2}\\) 9\\d{4}-\\d{4}|\\d{2}9\\d{8})$/;'),
  lig4: js(`function vencedor(g) {
  const d = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let l = 0; l < 6; l++) for (let c = 0; c < 7; c++) {
    const v = g[l][c]; if (!v) continue;
    for (const [dl, dc] of d) { let k = 1; while (k < 4 && g[l + dl * k]?.[c + dc * k] === v) k++; if (k === 4) return v; }
  }
  return null;
}`),
  'refatorar-frete': js(`function frete(peso, regiao, expresso) {
  const tabela = { sul: [10, 4], norte: [18, 6] };
  const [base, porKg] = tabela[regiao] ?? [14, 5];
  let valor = peso <= 1 ? base : base + (peso - 1) * porKg;
  if (expresso) valor *= 1.5;
  return Math.round(valor * 100) / 100;
}`),
  'testes-cupom': js(`import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarCupom } from './cupom.js';
test('DEZ', () => assert.equal(aplicarCupom(100, 'DEZ'), 90));
test('METADE', () => assert.equal(aplicarCupom(100, 'METADE'), 50));
test('sem cupom', () => assert.equal(aplicarCupom(100, null), 100));
test('inválido', () => assert.throws(() => aplicarCupom(100, 'X'), /Cupom inválido/));
test('negativo', () => assert.throws(() => aplicarCupom(-1, 'DEZ'), /Preço inválido/));`),
  'pares-rapido': js(`function contarPares(lista, alvo) {
  const vistos = new Map(); let n = 0;
  for (const x of lista) { n += vistos.get(alvo - x) ?? 0; vistos.set(x, (vistos.get(x) ?? 0) + 1); }
  return n;
}`),
  'erro-itens': js('function totalPedido(pedido) { return (pedido?.itens ?? []).reduce((s, i) => s + i.preco * i.qtd, 0); }'),
  'revisar-media': js(`function mediaAprovados(alunos) {
  const a = alunos.filter((x) => x.nota >= 6);
  return a.length ? a.reduce((s, x) => s + x.nota, 0) / a.length : 0;
}`),
  'estatistica-notas': 'A média é 7,57, a mediana é 8 e a moda é 8.',
  'csv-aspas': js(`function csvParaObjetos(texto) {
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === ';') { linha.push(campo); campo = ''; }
    else if (c === '\\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\\r') campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cab, ...resto] = linhas;
  return resto.filter((l) => l.some((x) => x !== '')).map((l) => Object.fromEntries(cab.map((h, i) => [h, l[i] ?? ''])));
}`),
  'limpar-clientes': js(`function limparClientes(lista) {
  const vistos = new Set();
  return lista.filter((c) => { const k = c.email.trim().toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .map((c) => ({ ...c, cidade: c.cidade.trim().toLowerCase().replace(/(^|\\s)\\p{L}/gu, (m) => m.toUpperCase()) }));
}`),
  'sql-gastos': `${F}sql\nSELECT c.nome, SUM(p.valor) AS total FROM clientes c JOIN pedidos p ON p.cliente_id = c.id GROUP BY c.id HAVING SUM(p.valor) > 100 ORDER BY total DESC;\n${F}`,
  'sql-nunca-vendido': `${F}sql\nSELECT p.nome FROM produtos p LEFT JOIN vendas v ON v.produto_id = p.id WHERE v.id IS NULL;\n${F}`,
  'modelar-biblioteca': `${F}sql\nCREATE TABLE livros (id INTEGER PRIMARY KEY, titulo TEXT NOT NULL);\nCREATE TABLE leitores (id INTEGER PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE);\nCREATE TABLE emprestimos (id INTEGER PRIMARY KEY, livro_id INTEGER NOT NULL REFERENCES livros(id), leitor_id INTEGER NOT NULL REFERENCES leitores(id), data TEXT NOT NULL);\n${F}`,
  'indice-pedidos': `${F}sql\nCREATE INDEX idx_pedidos_loja_data ON pedidos (loja_id, criado_em);\n${F}`,
  'vender-estoque': js(`function vender(db, produtoId, qtd) {
  db.exec('BEGIN');
  try {
    const r = db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?').run(qtd, produtoId, qtd);
    if (r.changes === 0) throw new Error('Estoque insuficiente');
    db.prepare('INSERT INTO vendas (produto_id, qtd) VALUES (?, ?)').run(produtoId, qtd);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}`),
  'injecao-busca': js(`function buscarUsuario(db, nome) { return db.prepare('SELECT id, nome FROM usuarios WHERE nome = ?').all(nome); }
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function cartaoComentario(texto) { return '<p class="comentario">' + escapar(texto) + '</p>'; }`),
  'hash-senha': js(`import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const s = promisify(scrypt);
async function criarHash(senha) { const sal = randomBytes(16); const h = await s(senha, sal, 64); return sal.toString('hex') + ':' + h.toString('hex'); }
async function conferirSenha(senha, salvo) { const [sal, h] = salvo.split(':'); const x = await s(senha, Buffer.from(sal, 'hex'), 64); return timingSafeEqual(x, Buffer.from(h, 'hex')); }`),
  'pedido-do-dono': js("function pedidoDe(db, usuarioLogadoId, pedidoId) { return db.prepare('SELECT * FROM pedidos WHERE id = ? AND usuario_id = ?').get(pedidoId, usuarioLogadoId) ?? null; }"),
  'git-branch-errada': `${F}bash\ngit branch busca\ngit reset --hard HEAD~1\n${F}`,
  'git-env-vazado': `${F}bash\necho .env >> .gitignore\ngit rm --cached .env\ngit add .gitignore\ngit commit -m "Para de acompanhar o .env"\n${F}`,
  'cron-relatorio': `${F}\n30 7 * * 1-5 /opt/app/relatorio.sh >> /var/log/relatorio.log 2>&1\n${F}`,
  'ps-maiores': `${F}powershell\nGet-ChildItem -Recurse -File | Sort-Object Length -Descending | Select-Object -First 3 -ExpandProperty Name\n${F}`,
  'organizar-fotos': `${F}python
import sys, shutil, datetime
from pathlib import Path
pasta = Path(sys.argv[1])
executar = '--executar' in sys.argv[2:]
for f in sorted(pasta.glob('*.jpg')):
    ano = datetime.datetime.fromtimestamp(f.stat().st_mtime).year
    destino = pasta / str(ano) / f.name
    print(f'{f.name} -> {ano}/{f.name}')
    if executar:
        destino.parent.mkdir(exist_ok=True)
        shutil.move(str(f), str(destino))
${F}`,
  'manifest-receitas': `${F}json\n{ "name": "Receitas da Vó", "short_name": "Receitas", "start_url": "/", "display": "standalone", "background_color": "#ffffff", "theme_color": "#b45309", "icons": [{ "src": "/icone-192.png", "sizes": "192x192", "type": "image/png" }, { "src": "/icone-512.png", "sizes": "512x512", "type": "image/png" }] }\n${F}`,
  'versao-semver': '(a) 2.8.0, porque é função nova compatível. (b) 3.0.0, porque quebra compatibilidade.',
  'ler-servidor': 'Escuta na porta 4321 (ou na variável PORTA), aceita no máximo 25 tarefas e devolve 507 quando passa do limite.',
  'segundo-maior': js('function segundoMaior(lista) { const u = [...new Set(lista)].sort((a, b) => b - a); return u.length > 1 ? u[1] : null; }'),
  'nave-movimento': js(`function atualizar(nave, dt, teclas) {
  let x = nave.x;
  if (teclas.has('ArrowRight')) x += 300 * dt;
  if (teclas.has('ArrowLeft')) x -= 300 * dt;
  return { ...nave, x: Math.min(Math.max(x, 0), 800 - nave.largura) };
}`),
  'api-tarefas': js(`const express = require('express');
const app = express();
app.use(express.json());
let tarefas = []; let proximo = 1;
app.get('/tarefas', (req, res) => res.json(tarefas));
app.post('/tarefas', (req, res) => { if (!req.body?.titulo) return res.status(400).json({ erro: 'titulo obrigatório' }); const t = { id: proximo++, titulo: req.body.titulo }; tarefas.push(t); res.status(201).json(t); });
app.delete('/tarefas/:id', (req, res) => { const i = tarefas.findIndex((t) => t.id === Number(req.params.id)); if (i < 0) return res.status(404).json({ erro: 'não existe' }); tarefas.splice(i, 1); res.status(204).end(); });
module.exports = app;`),
  'buscar-produtos': js(`async function buscarProdutos(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error('Falha ' + r.status);
  return r.json();
}`),
  'workflow-testes': `${F}yaml
name: Testes
on: [push, pull_request]
jobs:
  testes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test
${F}`,
  'rotas-netlify': `Crie o arquivo public/_redirects com:\n${F}\n/*  /index.html  200\n${F}`,
  'jsdoc-tipos': js(`/**
 * Divide um total em parcelas iguais com juros.
 * @param {number} total Valor total.
 * @param {number} vezes Número de parcelas (1 ou mais).
 * @param {number} juros Juros totais (0.02 = 2%).
 * @returns {number[]} O valor de cada parcela.
 */
function parcelas(total, vezes, juros) {
  if (vezes < 1) throw new Error('Vezes inválidas');
  const valor = (total * (1 + juros)) / vezes;
  return Array.from({ length: vezes }, () => Math.round(valor * 100) / 100);
}`),
  'conflito-precos': js('const TAXA = 0.07;\nfunction comDesconto(v) { return v * 0.9; }\nfunction comTaxa(v) { return v * (1 + TAXA); }'),
  'pagina-contato': `${F}html
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Contato</title>
<style>body{font-family:sans-serif;margin:0;padding:16px;color:#1d2329;background:#fff}form{display:grid;gap:12px;max-width:480px}input,textarea{font:inherit;padding:8px;border:1px solid #5b6670;width:100%;box-sizing:border-box}button{padding:10px;background:#1d4ed8;color:#fff;border:0}</style></head>
<body><main><h1>Fale com a padaria</h1><form><label for="n">Nome</label><input id="n" name="nome" required><label for="e">E-mail</label><input id="e" type="email" name="email" required><label for="m">Mensagem</label><textarea id="m" name="mensagem" required></textarea><button type="submit">Enviar</button></form></main></body></html>
${F}`,
  'pagina-galeria': `${F}html
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Galeria</title></head><body><main>
<ul class="galeria"><li><button type="button" onclick="abrir(1)"><img src="praia.jpg" alt="Praia ao entardecer"></button></li><li><button type="button" onclick="abrir(2)"><img src="serra.jpg" alt="Serra com neblina"></button></li></ul>
<button type="button" class="fechar" onclick="fechar()" aria-label="Fechar">X</button>
<p style="color:#5b6670;background:#fff">Escolha uma foto para ampliar</p></main></body></html>
${F}`,
  'pagina-curso': `${F}html
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Python para iniciantes</title>
<style>body{margin:0;font-family:sans-serif;color:#1d2329;background:#f7f8fa}main{max-width:720px;margin:0 auto;padding:24px 16px}a.botao{display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px}</style></head>
<body><main><h1>Python do zero, de graça</h1><p>Aprenda a programar em 6 semanas, no seu ritmo.</p><a class="botao" href="#inscricao">Quero me inscrever</a></main></body></html>
${F}`,
  'cartoes-quatro': `${F}html
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cartões</title>
<style>body{margin:0}.cartoes{display:grid;gap:16px;padding:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.cartao{padding:16px;border:1px solid #ccc}</style></head>
<body><section class="cartoes"><article class="cartao">Um</article><article class="cartao">Dois</article><article class="cartao">Três</article><article class="cartao">Quatro</article></section></body></html>
${F}`,
};
