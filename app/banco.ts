// Abre o banco do Gyde e aplica as migrações pendentes (migracoes.ts). Antes de mexer num banco que já tem dados,
// guarda uma cópia inteira dele em <dados>/copias-banco, para dar para voltar atrás se algo der errado.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { Db } from './tipos.ts';
import { erroGyde, comoErro } from './tipos.ts';
import { MIGRACOES, type Migracao } from './migracoes.ts';

const COPIAS_GUARDADAS = 5;

export const versaoDoBanco = (db: Db) => Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
const temTabelas = (db: Db) => Number((db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get() as { n: number }).n) > 0;

function conferirLista(migracoes: Migracao[]) {
  migracoes.forEach((m, i) => {
    if (m.versao !== i + 1) throw new Error(`Migração fora de ordem: a posição ${i + 1} tem a versão ${m.versao}.`);
  });
}

export interface ResultadoMigracao { de: number; para: number; aplicadas: string[]; copia: string | null }

export function migrar(db: Db, { migracoes = MIGRACOES, copiar }: { migracoes?: Migracao[]; copiar?: (versaoAtual: number) => string | null } = {}): ResultadoMigracao {
  conferirLista(migracoes);
  const de = versaoDoBanco(db);
  const ultima = migracoes.length;
  // banco gravado por um Gyde mais novo: rodar a versão antiga em cima dele poderia estragar os dados
  if (de > ultima) {
    throw erroGyde(`O banco de dados é de uma versão mais nova do Gyde (esquema ${de}; esta versão conhece até o ${ultima}). Atualize o Gyde para abrir estes dados.`, { status: 500 });
  }
  const pendentes = migracoes.slice(de);
  if (!pendentes.length) return { de, para: de, aplicadas: [], copia: null };
  const copia = temTabelas(db) && copiar ? copiar(de) : null;
  for (const m of pendentes) {
    db.exec('BEGIN IMMEDIATE');
    try {
      m.aplicar(db);
      db.exec(`PRAGMA user_version = ${m.versao}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw erroGyde(`A migração ${m.versao} do banco (${m.nome}) falhou e foi desfeita: ${comoErro(e).message}`, { status: 500 });
    }
  }
  return { de, para: ultima, aplicadas: pendentes.map((m) => `${m.versao}: ${m.nome}`), copia };
}

// cópia consistente do banco inteiro (VACUUM INTO funciona com o banco aberto e em modo WAL)
export function copiarBanco(db: Db, pasta: string, versaoAtual: number) {
  mkdirSync(pasta, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
  let arquivo = path.join(pasta, `chat-esquema${versaoAtual}-${carimbo}.db`);
  for (let n = 2; existsSync(arquivo); n++) arquivo = path.join(pasta, `chat-esquema${versaoAtual}-${carimbo}-${n}.db`);
  db.prepare('VACUUM INTO ?').run(arquivo);
  // guarda só as mais recentes
  const copias = readdirSync(pasta).filter((f) => /^chat-esquema\d+-.*\.db$/.test(f)).sort();
  for (const velha of copias.slice(0, Math.max(0, copias.length - COPIAS_GUARDADAS))) rmSync(path.join(pasta, velha), { force: true });
  return arquivo;
}

export function abrirBanco(arquivo: string, { pastaCopias, log = console }: { pastaCopias: string; log?: Pick<Console, 'log'> }) {
  const db = new DatabaseSync(arquivo);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const r = migrar(db, { copiar: (v) => copiarBanco(db, pastaCopias, v) });
  if (r.aplicadas.length) {
    log.log(`  Banco atualizado do esquema ${r.de} para o ${r.para}${r.copia ? ` (cópia antes da mudança: ${r.copia})` : ''}`);
  }
  return db;
}
