// Cópia de segurança: gerar, restaurar na próxima abertura, importar de pasta e recusar o que não é cópia do Gyde.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync, zipSync } from 'fflate';
import { migrar } from '../banco.ts';
import { MIGRACOES } from '../migracoes.ts';
import { gerarCopia, prepararRestauracao, prepararDePasta, aplicarRestauracaoPendente, temRestauracaoPendente } from '../copia.ts';

const pastas = [];
after(() => { for (const p of pastas) rmSync(p, { recursive: true, force: true }); });
const pasta = () => { const p = mkdtempSync(path.join(tmpdir(), 'gyde-copia-teste-')); pastas.push(p); return p; };

// um Gyde com uma conta, uma conversa e uma imagem
function gydeComDados(nomeConta) {
  const dados = pasta();
  mkdirSync(path.join(dados, 'images'));
  writeFileSync(path.join(dados, 'images', 'abc123.jpg'), 'imagem-de-teste');
  const db = new DatabaseSync(path.join(dados, 'chat.db'));
  migrar(db);
  db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES ('u1', ?, ?, 'hash', 1)").run(`${nomeConta}@t.test`, nomeConta);
  db.prepare("INSERT INTO conversations (id, title, created_at, updated_at, user_id) VALUES ('c1', ?, 1, 1, 'u1')").run(`Conversa de ${nomeConta}`);
  return { dados, db };
}
const quem = (arquivo) => { const d = new DatabaseSync(arquivo, { readOnly: true }); const n = d.prepare('SELECT name FROM users').get().name; d.close(); return n; };

test('gerar e restaurar: a cópia substitui o banco na próxima abertura e o banco anterior fica guardado', () => {
  const origem = gydeComDados('Ana');
  const zip = gerarCopia(origem.db, origem.dados);
  const conteudo = unzipSync(zip);
  assert.ok(conteudo['chat.db'] && conteudo['images/abc123.jpg'] && conteudo['LEIA-ME.txt']);

  const destino = gydeComDados('Bia');
  destino.db.close();
  const resumo = prepararRestauracao(zip, destino.dados);
  assert.deepEqual(resumo, { versao: MIGRACOES.length, contas: 1, conversas: 1 });
  assert.ok(temRestauracaoPendente(destino.dados));
  assert.equal(quem(path.join(destino.dados, 'chat.db')), 'Bia', 'nada muda antes de reabrir');

  const copias = path.join(destino.dados, 'copias-banco');
  assert.equal(aplicarRestauracaoPendente(path.join(destino.dados, 'chat.db'), destino.dados, copias, { log() {} }), true);
  assert.equal(quem(path.join(destino.dados, 'chat.db')), 'Ana', 'agora o banco é o da cópia');
  assert.equal(readFileSync(path.join(destino.dados, 'images', 'abc123.jpg'), 'utf8'), 'imagem-de-teste');
  const [guardada] = readdirSync(copias);
  assert.equal(quem(path.join(copias, guardada)), 'Bia', 'o banco anterior foi guardado');
  assert.ok(!temRestauracaoPendente(destino.dados));
  assert.equal(aplicarRestauracaoPendente(path.join(destino.dados, 'chat.db'), destino.dados, copias, { log() {} }), false, 'sem pendência, não faz nada');
  origem.db.close();
});

test('importar da pasta data de outro Gyde (com o banco aberto por ele)', () => {
  const antigo = gydeComDados('Caio'); // fica aberto, como o Gyde rodando pelo código
  const novo = pasta();
  assert.deepEqual(prepararDePasta(antigo.dados, novo), { versao: MIGRACOES.length, contas: 1, conversas: 1 });
  aplicarRestauracaoPendente(path.join(novo, 'chat.db'), novo, path.join(novo, 'copias-banco'), { log() {} });
  assert.equal(quem(path.join(novo, 'chat.db')), 'Caio');
  assert.ok(existsSync(path.join(novo, 'images', 'abc123.jpg')));
  antigo.db.close();
});

test('recusa o que não é cópia do Gyde e não deixa restauração pela metade', () => {
  const destino = pasta();
  const recusa = (zip, motivo) => {
    assert.throws(() => prepararRestauracao(zip, destino), (e) => e.status === 400 && motivo.test(e.message));
    assert.ok(!temRestauracaoPendente(destino));
  };
  recusa(new TextEncoder().encode('não sou um zip'), /não é um \.zip/);
  recusa(zipSync({ 'outra-coisa.txt': new TextEncoder().encode('x') }), /falta o chat\.db/);
  recusa(zipSync({ 'chat.db': new TextEncoder().encode('lixo que não é sqlite') }), /Cópia inválida/);

  const qualquer = path.join(pasta(), 'outro.db');
  const d = new DatabaseSync(qualquer); d.exec('CREATE TABLE coisas (x)'); d.close();
  recusa(zipSync({ 'chat.db': readFileSync(qualquer) }), /não é um banco do Gyde/);

  const futuro = gydeComDados('Davi');
  futuro.db.exec(`PRAGMA user_version = ${MIGRACOES.length + 1}`);
  futuro.db.close();
  recusa(zipSync({ 'chat.db': readFileSync(path.join(futuro.dados, 'chat.db')) }), /versão mais nova/);
});

test('uma cópia ruim não apaga a cópia boa que já esperava a reabertura', () => {
  const origem = gydeComDados('Fabi');
  const boa = gerarCopia(origem.db, origem.dados);
  origem.db.close();
  const destino = pasta();
  prepararRestauracao(boa, destino);
  assert.throws(() => prepararRestauracao(zipSync({ 'chat.db': new TextEncoder().encode('lixo') }), destino));
  assert.ok(temRestauracaoPendente(destino));
  assert.equal(quem(path.join(destino, 'restaurar-pendente', 'chat.db')), 'Fabi');
  assert.ok(!existsSync(path.join(destino, 'restaurar-pendente.novo')));
});

test('arquivos estranhos dentro do .zip são ignorados (só chat.db e imagens)', () => {
  const origem = gydeComDados('Eva');
  const conteudo = unzipSync(gerarCopia(origem.db, origem.dados));
  origem.db.close();
  conteudo['../../fora.txt'] = new TextEncoder().encode('tentativa de sair da pasta');
  conteudo['images/../../tambem-fora.jpg'] = new TextEncoder().encode('x');
  const destino = pasta();
  prepararRestauracao(zipSync(conteudo), destino);
  assert.ok(!existsSync(path.join(destino, '..', 'fora.txt')));
  assert.ok(!existsSync(path.join(destino, '..', 'tambem-fora.jpg')));
  assert.deepEqual(readdirSync(path.join(destino, 'restaurar-pendente', 'images')), ['abc123.jpg']);
});
