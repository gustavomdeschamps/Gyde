// Cópia de segurança do Gyde: um .zip com o banco (cópia consistente, mesmo com o Gyde aberto) e as imagens geradas.
// Restaurar não troca o banco com o servidor rodando: a cópia validada fica em <dados>/restaurar-pendente e é aplicada
// na próxima abertura, antes de qualquer módulo abrir o banco. O banco atual vai antes para <dados>/copias-banco.
import { DatabaseSync } from 'node:sqlite';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync, zipSync } from 'fflate';
import { erroGyde } from './tipos.ts';
import { MIGRACOES } from './migracoes.ts';
import { copiarBanco } from './banco.ts';

const PENDENTE = 'restaurar-pendente';
const MAX_ARQUIVO = 50 * 1024 * 1024; // por arquivo dentro do .zip
const IMAGEM = /^images\/[\w-]+\.(jpg|png|webp)$/;

// confere se um arquivo é um banco do Gyde que esta versão consegue abrir
export function validarBanco(arquivo: string) {
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(arquivo, { readOnly: true });
    if ((db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check !== 'ok') throw new Error('o banco está corrompido');
    const versao = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
    if (versao > MIGRACOES.length) throw new Error('a cópia é de uma versão mais nova do Gyde; atualize o Gyde antes');
    const tabelas = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name));
    if (!tabelas.has('users') || !tabelas.has('conversations')) throw new Error('não é um banco do Gyde');
    const contas = Number((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n);
    const conversas = Number((db.prepare('SELECT COUNT(*) AS n FROM conversations').get() as { n: number }).n);
    return { versao, contas, conversas };
  } catch (e) {
    throw erroGyde(`Cópia inválida: ${e instanceof Error ? e.message : String(e)}.`, { status: 400 });
  } finally { db?.close(); }
}

export function gerarCopia(db: DatabaseSync, pastaDados: string): Uint8Array {
  const temp = mkdtempSync(path.join(tmpdir(), 'gyde-copia-'));
  try {
    const banco = path.join(temp, 'chat.db');
    db.prepare('VACUUM INTO ?').run(banco);
    const arquivos: Record<string, Uint8Array> = { 'chat.db': readFileSync(banco) };
    const imagens = path.join(pastaDados, 'images');
    if (existsSync(imagens)) for (const f of readdirSync(imagens)) {
      if (IMAGEM.test(`images/${f}`) && statSync(path.join(imagens, f)).size <= MAX_ARQUIVO) arquivos[`images/${f}`] = readFileSync(path.join(imagens, f));
    }
    arquivos['LEIA-ME.txt'] = new TextEncoder().encode([
      'Cópia de segurança do Gyde', `Gerada em ${new Date().toLocaleString('pt-BR')}`, `Esquema do banco: ${MIGRACOES.length}`, '',
      'Tem as contas deste computador (com a senha guardada só como hash), conversas, progresso, memória e imagens.',
      'Guarde em lugar seguro. Para usar: Gyde > Configurações > Privacidade e dados > Restaurar cópia.',
    ].join('\r\n'));
    return zipSync(arquivos, { level: 6 });
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

// recebe o .zip, valida e deixa pronto para a próxima abertura
export function prepararRestauracao(zip: Uint8Array, pastaDados: string) {
  let conteudo: Record<string, Uint8Array>;
  try {
    conteudo = unzipSync(zip, { filter: (f) => (f.name === 'chat.db' || IMAGEM.test(f.name)) && f.originalSize <= 2 * 1024 * 1024 * 1024 });
  } catch { throw erroGyde('Cópia inválida: o arquivo não é um .zip de cópia do Gyde.', { status: 400 }); }
  if (!conteudo['chat.db']) throw erroGyde('Cópia inválida: falta o chat.db dentro do .zip.', { status: 400 });
  return montarPendente(pastaDados, (novo) => {
    mkdirSync(path.join(novo, 'images'), { recursive: true });
    writeFileSync(path.join(novo, 'chat.db'), conteudo['chat.db']!);
    const resumo = validarBanco(path.join(novo, 'chat.db'));
    for (const [nome, dados] of Object.entries(conteudo)) if (IMAGEM.test(nome)) writeFileSync(path.join(novo, nome), dados);
    return resumo;
  });
}

// monta a cópia numa pasta ao lado e só troca a pendência quando tudo foi conferido
// (uma cópia ruim nunca apaga uma boa que já estava esperando)
function montarPendente<T>(pastaDados: string, montar: (pasta: string) => T): T {
  const novo = path.join(pastaDados, `${PENDENTE}.novo`);
  rmSync(novo, { recursive: true, force: true });
  mkdirSync(novo, { recursive: true });
  try {
    const resumo = montar(novo);
    rmSync(path.join(pastaDados, PENDENTE), { recursive: true, force: true });
    renameSync(novo, path.join(pastaDados, PENDENTE));
    return resumo;
  } catch (e) { rmSync(novo, { recursive: true, force: true }); throw e; }
}

// importa direto de uma pasta de dados do Gyde (ex.: a pasta data\ do Gyde rodando pelo código)
export function prepararDePasta(pastaOrigem: string, pastaDados: string) {
  const banco = path.join(pastaOrigem, 'chat.db');
  if (!existsSync(banco)) throw erroGyde('Não achei o chat.db nessa pasta.', { status: 400 });
  return montarPendente(pastaDados, (novo) => {
    const origem = new DatabaseSync(banco, { readOnly: true });
    try { origem.prepare('VACUUM INTO ?').run(path.join(novo, 'chat.db')); } finally { origem.close(); }
    const resumo = validarBanco(path.join(novo, 'chat.db'));
    if (existsSync(path.join(pastaOrigem, 'images'))) cpSync(path.join(pastaOrigem, 'images'), path.join(novo, 'images'), { recursive: true });
    return resumo;
  });
}

export const temRestauracaoPendente = (pastaDados: string) => existsSync(path.join(pastaDados, PENDENTE, 'chat.db'));

// chamado ao abrir, antes do banco: troca o banco pelo da cópia e guarda o atual
export function aplicarRestauracaoPendente(arquivoBanco: string, pastaDados: string, pastaCopias: string, log: Pick<Console, 'log'> = console) {
  if (!temRestauracaoPendente(pastaDados)) return false;
  const pendente = path.join(pastaDados, PENDENTE);
  if (existsSync(arquivoBanco)) {
    const atual = new DatabaseSync(arquivoBanco);
    try { copiarBanco(atual, pastaCopias, Number((atual.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)); } finally { atual.close(); }
  }
  for (const f of [arquivoBanco, `${arquivoBanco}-wal`, `${arquivoBanco}-shm`]) rmSync(f, { force: true });
  renameSync(path.join(pendente, 'chat.db'), arquivoBanco);
  // imagens: as da cópia entram ao lado das que já existiam (os nomes são aleatórios, não colidem)
  if (existsSync(path.join(pendente, 'images'))) cpSync(path.join(pendente, 'images'), path.join(pastaDados, 'images'), { recursive: true });
  rmSync(pendente, { recursive: true, force: true });
  log.log('  Cópia de segurança restaurada (o banco anterior foi guardado em copias-banco).');
  return true;
}
