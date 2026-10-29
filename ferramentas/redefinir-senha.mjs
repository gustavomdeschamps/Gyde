// Troca a senha de uma conta do Gyde direto no banco (modo pessoal: não há e-mail).
// Uso: node ferramentas/redefinir-senha.mjs --listar
//      GYDE_EMAIL=... GYDE_NOVA_SENHA=... node ferramentas/redefinir-senha.mjs
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hashPassword } from '../pacotes/servidor/auth.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbFile = path.join(process.env.DATA_DIR || path.join(ROOT, 'data'), 'chat.db');
if (!existsSync(dbFile)) { console.log('ERRO: ainda não existe nenhuma conta (abra o Gyde e crie uma).'); process.exit(1); }
const db = new DatabaseSync(dbFile);

if (process.argv.includes('--listar')) {
  for (const u of db.prepare('SELECT name, email FROM users ORDER BY created_at').all()) console.log(`${u.email}  (${u.name})`);
  process.exit(0);
}

const email = String(process.env.GYDE_EMAIL || '').trim().toLowerCase();
const senha = String(process.env.GYDE_NOVA_SENHA || '');
const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (!user) { console.log('ERRO: não existe conta com esse e-mail.'); process.exit(1); }
if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) { console.log('ERRO: a senha precisa ter 8+ caracteres, com letras e números.'); process.exit(1); }

db.prepare('UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?').run(await hashPassword(senha), user.id);
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id); // sai de todos os navegadores
console.log('OK');
