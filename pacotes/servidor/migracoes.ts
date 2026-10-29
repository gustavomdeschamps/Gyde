// Migrações do banco, em ordem. Cada uma roda uma vez só, dentro de uma transação, e o número da última aplicada
// fica no próprio arquivo do banco (PRAGMA user_version). Regras:
// - nunca editar uma migração que já saiu: o jeito de mudar o banco é acrescentar a próxima;
// - nada de apagar coluna ou tabela com dados sem migrar esses dados antes;
// - a 1 é idempotente de propósito: bancos de antes das migrações (versão 0) já têm parte das tabelas.
import type { Db } from './tipos.ts';

export interface Migracao { versao: number; nome: string; aplicar: (db: Db) => void }

const temColuna = (db: Db, tabela: string, coluna: string) =>
  Boolean(db.prepare(`SELECT 1 FROM pragma_table_info('${tabela}') WHERE name = ?`).get(coluna));

export const MIGRACOES: Migracao[] = [
  {
    versao: 1,
    nome: 'esquema inicial (o que cada módulo criava sozinho até a versão 2 do Gyde)',
    aplicar(db) {
      db.exec(`
        -- conversas do chat
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT 'Nova conversa',
          model TEXT NOT NULL DEFAULT 'auto',
          pinned INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          attachments TEXT NOT NULL DEFAULT '[]',
          model TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

        -- contas, sessões, códigos de e-mail e tokens das extensões (só hashes)
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          email_verified INTEGER NOT NULL DEFAULT 0,
          profile TEXT NOT NULL DEFAULT '{}',
          onboarded INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS email_codes (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          purpose TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, purpose)
        );
        CREATE TABLE IF NOT EXISTS api_tokens (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          last_used INTEGER
        );

        -- memória do Gyde sobre a pessoa
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, text TEXT NOT NULL, source TEXT NOT NULL, created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_mem_user ON memories(user_id, created_at);

        -- Prática
        CREATE TABLE IF NOT EXISTS skill_progress (
          user_id TEXT NOT NULL, exercise_id TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0,
          code TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, exercise_id)
        );
        CREATE TABLE IF NOT EXISTS xp_events (user_id TEXT NOT NULL, amount INTEGER NOT NULL, kind TEXT NOT NULL, ref TEXT, at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_xp_user ON xp_events(user_id, at);
        CREATE TABLE IF NOT EXISTS activity_days (user_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day));
        CREATE TABLE IF NOT EXISTS review_queue (user_id TEXT NOT NULL, exercise_id TEXT NOT NULL, level INTEGER NOT NULL, due_at INTEGER NOT NULL, PRIMARY KEY (user_id, exercise_id));
        CREATE TABLE IF NOT EXISTS daily_challenge (user_id TEXT NOT NULL, day TEXT NOT NULL, exercise_id TEXT NOT NULL, rewarded INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day));
        CREATE TABLE IF NOT EXISTS friends (user_id TEXT NOT NULL, friend_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, friend_id));

        -- Turmas
        CREATE TABLE IF NOT EXISTS turmas (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, owner_id TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS turma_membros (turma_id TEXT NOT NULL REFERENCES turmas(id) ON DELETE CASCADE, user_id TEXT NOT NULL, joined_at INTEGER NOT NULL, PRIMARY KEY (turma_id, user_id));
        CREATE TABLE IF NOT EXISTS turma_tarefas (id TEXT PRIMARY KEY, turma_id TEXT NOT NULL REFERENCES turmas(id) ON DELETE CASCADE, exercise_id TEXT NOT NULL, prazo TEXT, created_at INTEGER NOT NULL);

        -- Skills
        CREATE TABLE IF NOT EXISTS user_skills (
          user_id TEXT NOT NULL, skill_id TEXT NOT NULL, installed_at INTEGER NOT NULL, PRIMARY KEY (user_id, skill_id)
        );
        CREATE TABLE IF NOT EXISTS custom_skills (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS skill_loja (
          id TEXT PRIMARY KEY, source_id TEXT NOT NULL UNIQUE, author_id TEXT NOT NULL, data TEXT NOT NULL,
          installs INTEGER NOT NULL DEFAULT 0, published_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );

        -- Forja (o "Desfazer" guarda a cópia dos arquivos antes de cada tarefa; fica só no banco local)
        CREATE TABLE IF NOT EXISTS agente_sessoes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, pasta TEXT NOT NULL, titulo TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS agente_eventos (id INTEGER PRIMARY KEY AUTOINCREMENT, sessao_id TEXT NOT NULL REFERENCES agente_sessoes(id) ON DELETE CASCADE, tipo TEXT NOT NULL, dados TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS agente_desfazer (id TEXT PRIMARY KEY, sessao_id TEXT NOT NULL, dados TEXT NOT NULL, desfeito INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);

        -- uso e limites
        CREATE TABLE IF NOT EXISTS uso_registros (
          id TEXT PRIMARY KEY, user_id TEXT, origem TEXT NOT NULL, provedor TEXT, modelo TEXT,
          resultado TEXT NOT NULL, chamadas INTEGER NOT NULL DEFAULT 0, chamadas_falhas INTEGER NOT NULL DEFAULT 0,
          tokens_entrada INTEGER, tokens_saida INTEGER, erro TEXT, inicio INTEGER NOT NULL, duracao_ms INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_uso_user ON uso_registros(user_id, inicio);
      `);
      // colunas que entraram depois nas versões antigas (o banco pode ou não já ter)
      if (!temColuna(db, 'conversations', 'user_id')) db.exec('ALTER TABLE conversations ADD COLUMN user_id TEXT');
      if (!temColuna(db, 'skill_progress', 'fails')) db.exec('ALTER TABLE skill_progress ADD COLUMN fails INTEGER NOT NULL DEFAULT 0');
      db.exec('CREATE INDEX IF NOT EXISTS idx_convs_user ON conversations(user_id, updated_at)');
      // nome antigo (Bugo -> Gyde) nos modelos salvos
      db.exec(`UPDATE conversations SET model = 'gyde' || substr(model, 5) WHERE model LIKE 'bugo-%';
               UPDATE messages SET model = 'gyde' || substr(model, 5) WHERE model LIKE 'bugo-%';`);
    },
  },
  {
    versao: 2,
    nome: 'tentativas de login e de código guardadas no banco (o limite não zera quando o servidor reinicia)',
    aplicar(db) {
      // a chave é o hash de "tipo:e-mail" ou "tipo:IP": o banco não guarda o e-mail nem o IP de quem tentou
      db.exec(`CREATE TABLE tentativas (chave TEXT NOT NULL, em INTEGER NOT NULL);
               CREATE INDEX idx_tentativas ON tentativas(chave, em);`);
    },
  },
];
