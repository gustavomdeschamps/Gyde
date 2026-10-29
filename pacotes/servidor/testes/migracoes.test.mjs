// Migrações do banco: banco novo, banco de antes das migrações (com dados), repetir, versão mais nova, falha e cópia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { migrar, versaoDoBanco, copiarBanco, abrirBanco } from '../banco.ts';
import { MIGRACOES } from '../migracoes.ts';

const tabelas = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
const colunas = (db, t) => db.prepare(`SELECT name FROM pragma_table_info('${t}')`).all().map((r) => r.name);
const ESPERADAS = ['activity_days', 'agente_desfazer', 'agente_eventos', 'agente_sessoes', 'api_tokens', 'conversations', 'custom_skills', 'daily_challenge',
  'email_codes', 'friends', 'memories', 'messages', 'review_queue', 'sessions', 'settings', 'skill_loja', 'skill_progress', 'tentativas', 'turma_membros', 'turma_tarefas',
  'turmas', 'user_skills', 'users', 'uso_registros', 'xp_events'];

test('banco novo: cria todas as tabelas e marca a última versão', () => {
  const db = new DatabaseSync(':memory:');
  const r = migrar(db);
  assert.equal(r.de, 0);
  assert.equal(r.para, MIGRACOES.length);
  assert.equal(versaoDoBanco(db), MIGRACOES.length);
  assert.deepEqual(tabelas(db), ESPERADAS);
  assert.ok(colunas(db, 'conversations').includes('user_id'));
  assert.ok(colunas(db, 'skill_progress').includes('fails'));
  assert.equal(r.copia, null, 'banco vazio não precisa de cópia');
});

test('banco de antes das migrações: atualiza sem perder dados e acrescenta as colunas que faltavam', () => {
  const db = new DatabaseSync(':memory:');
  // como o Gyde antigo deixava o banco: tabelas sem user_id/fails, nome antigo do modelo e user_version 0
  db.exec(`
    CREATE TABLE conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT 'Nova conversa', model TEXT NOT NULL DEFAULT 'auto', pinned INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, attachments TEXT NOT NULL DEFAULT '[]', model TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE skill_progress (user_id TEXT NOT NULL, exercise_id TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, code TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, exercise_id));
    INSERT INTO conversations VALUES ('c1', 'Minha conversa', 'bugo-1', 1, 10, 20);
    INSERT INTO messages VALUES ('m1', 'c1', 'user', 'oi', '[]', NULL, 11), ('m2', 'c1', 'assistant', 'olá', '[]', 'bugo-1', 12);
    INSERT INTO skill_progress VALUES ('u1', 'py-ola', 1, 'print(1)', 30);
  `);
  let copiou = null;
  const r = migrar(db, { copiar: (v) => { copiou = v; return 'copia-de-teste'; } });
  assert.equal(copiou, 0, 'banco com dados ganha cópia antes de mudar');
  assert.equal(r.copia, 'copia-de-teste');
  assert.deepEqual(tabelas(db), ESPERADAS);
  const c = db.prepare('SELECT * FROM conversations').get();
  assert.equal(c.title, 'Minha conversa');
  assert.equal(c.model, 'gyde-1', 'nome antigo do modelo atualizado');
  assert.equal(c.user_id, null, 'coluna nova entra vazia');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages').get().n, 2);
  assert.equal(db.prepare("SELECT model FROM messages WHERE id = 'm2'").get().model, 'gyde-1');
  const p = db.prepare('SELECT * FROM skill_progress').get();
  assert.equal(p.code, 'print(1)');
  assert.equal(p.fails, 0, 'coluna nova com o valor padrão');
});

test('rodar de novo não faz nada', () => {
  const db = new DatabaseSync(':memory:');
  migrar(db);
  let copiou = false;
  const r = migrar(db, { copiar: () => { copiou = true; return 'x'; } });
  assert.deepEqual(r.aplicadas, []);
  assert.equal(copiou, false);
});

test('banco de um Gyde mais novo: recusa abrir em vez de estragar', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA user_version = ${MIGRACOES.length + 1}`);
  assert.throws(() => migrar(db), /versão mais nova do Gyde/);
});

test('migração que falha é desfeita inteira e a versão não muda', () => {
  const db = new DatabaseSync(':memory:');
  migrar(db);
  const quebrada = [...MIGRACOES, { versao: MIGRACOES.length + 1, nome: 'teste que quebra', aplicar: (d) => { d.exec('CREATE TABLE meio_feita (x INTEGER)'); d.exec('SELECT * FROM tabela_que_nao_existe'); } }];
  assert.throws(() => migrar(db, { migracoes: quebrada }), /teste que quebra.*desfeita/);
  assert.equal(versaoDoBanco(db), MIGRACOES.length);
  assert.ok(!tabelas(db).includes('meio_feita'), 'nada da migração quebrada fica no banco');
});

test('lista de migrações fora de ordem é recusada', () => {
  const db = new DatabaseSync(':memory:');
  assert.throws(() => migrar(db, { migracoes: [{ versao: 2, nome: 'pulou a 1', aplicar() {} }] }), /fora de ordem/);
});

test('arquivo de verdade: abrir migra, cópia é um banco válido e só as 5 últimas ficam', () => {
  const pasta = mkdtempSync(path.join(tmpdir(), 'gyde-mig-'));
  try {
    const arquivo = path.join(pasta, 'chat.db');
    const velho = new DatabaseSync(arquivo);
    velho.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO settings VALUES ('a', 'b');");
    velho.close();
    const copias = path.join(pasta, 'copias');
    const db = abrirBanco(arquivo, { pastaCopias: copias, log: { log() {} } });
    assert.equal(versaoDoBanco(db), MIGRACOES.length);
    const [copia] = readdirSync(copias);
    const antes = new DatabaseSync(path.join(copias, copia), { readOnly: true });
    assert.equal(antes.prepare('SELECT value FROM settings').get().value, 'b');
    assert.equal(versaoDoBanco(antes), 0, 'a cópia é do banco como estava antes');
    antes.close();
    for (let i = 0; i < 7; i++) copiarBanco(db, copias, i);
    assert.equal(readdirSync(copias).length, 5);
    db.close();
  } finally { rmSync(pasta, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); }
});
