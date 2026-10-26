// Cadastro, login, confirmação de e-mail e sessões do Gyde.
import { randomBytes, randomInt, randomUUID, scrypt as scryptCb, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import express from 'express';
import nodemailer from 'nodemailer';

const scrypt = promisify(scryptCb);
const SESSION_COOKIE = 'gyde_session';
const SESSION_DAYS = 30;
const CODE_MINUTES = 15;
const MAX_CODE_ATTEMPTS = 5;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const normEmail = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function checkPassword(password, stored) {
  const [, saltHex, keyHex] = String(stored).split('$');
  if (!saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(key, Buffer.from(keyHex, 'hex'));
}

function passwordProblem(p) {
  if (typeof p !== 'string' || p.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (p.length > 200) return 'Senha longa demais.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use letras e números na senha.';
  return null;
}

// Limite simples em memória: no máximo `max` tentativas por chave dentro da janela.
function makeLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    return list.length <= max;
  };
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setupAuth(app, db, { log = console } = {}) {
  db.exec(`
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
  `);

  const q = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    countUsers: db.prepare('SELECT COUNT(*) AS n FROM users'),
    insertUser: db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'),
    setVerified: db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?'),
    setPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    sessionUser: db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                             WHERE s.token_hash = ? AND s.expires_at > ?`),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    upsertCode: db.prepare(`INSERT INTO email_codes (user_id, purpose, code_hash, expires_at, attempts) VALUES (?, ?, ?, ?, 0)
                            ON CONFLICT(user_id, purpose) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`),
    getCode: db.prepare('SELECT * FROM email_codes WHERE user_id = ? AND purpose = ?'),
    bumpCode: db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE user_id = ? AND purpose = ?'),
    deleteCode: db.prepare('DELETE FROM email_codes WHERE user_id = ? AND purpose = ?'),
  };
  q.purgeSessions.run(Date.now());

  // ---------- E-mail ----------
  const smtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  // "pessoal" (padrão): uma pessoa, no próprio computador, sem confirmação por e-mail.
  // "publico": várias pessoas num servidor; exige e-mail configurado para confirmar contas.
  const personal = process.env.GYDE_MODE !== 'publico';
  const devConsole = process.env.EMAIL_DEV_CONSOLE === '1';
  const transporter = smtpReady
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 465),
        secure: Number(process.env.SMTP_PORT || 465) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : null;
  const mailFrom = process.env.MAIL_FROM || (process.env.SMTP_USER ? `Gyde <${process.env.SMTP_USER}>` : 'Gyde');

  async function sendCode(user, purpose) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    q.upsertCode.run(user.id, purpose, sha256(code), Date.now() + CODE_MINUTES * 60_000);
    const subject = purpose === 'verify' ? `${code} é o seu código do Gyde` : `${code} é o código para trocar sua senha do Gyde`;
    const intro = purpose === 'verify' ? 'Falta só confirmar seu e-mail para começar a usar o Gyde.' : 'Recebemos um pedido para trocar a senha da sua conta.';
    const text = `Oi, ${user.name}!\n\n${intro}\n\nSeu código: ${code}\n\nEle vale por ${CODE_MINUTES} minutos. Se não foi você, ignore este e-mail.\n\n— Gyde`;
    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:440px;margin:auto;padding:24px;color:#1d1d1b">
      <h2 style="margin:0 0 12px">Oi, ${user.name.replace(/[<>&"]/g, '')}!</h2>
      <p>${intro}</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;background:#fff4dc;border-radius:12px;padding:14px;text-align:center">${code}</p>
      <p style="color:#6c6c66;font-size:13px">O código vale por ${CODE_MINUTES} minutos. Se não foi você, ignore este e-mail.</p></div>`;
    if (!transporter) {
      // Só para testes automáticos (variável EMAIL_DEV_CONSOLE=1). No uso normal, o e-mail é obrigatório.
      if (devConsole) {
        log.log(`\n  [Gyde] Código de ${purpose === 'verify' ? 'confirmação' : 'troca de senha'} para ${user.email}: ${code}\n`);
        return { delivered: false };
      }
      throw Object.assign(new Error('O envio de e-mail ainda não foi configurado. Rode o configurar-email.bat (pasta configurar do Gyde).'), { status: 503 });
    }
    try {
      await transporter.sendMail({ from: mailFrom, to: user.email, subject, text, html });
    } catch (err) {
      log.error('[Gyde] Falha ao enviar e-mail:', err.code || '', err.message);
      throw Object.assign(new Error('Não consegui enviar o e-mail agora. Confira o endereço e tente de novo em instantes.'), { status: 502 });
    }
    return { delivered: true };
  }

  function checkCode(user, purpose, code) {
    const row = q.getCode.get(user.id, purpose);
    if (!row || row.expires_at < Date.now()) return 'O código expirou. Peça um novo.';
    if (row.attempts >= MAX_CODE_ATTEMPTS) return 'Muitas tentativas erradas. Peça um novo código.';
    const ok = /^\d{6}$/.test(String(code || '')) && timingSafeEqual(Buffer.from(sha256(String(code))), Buffer.from(row.code_hash));
    if (!ok) { q.bumpCode.run(user.id, purpose); return 'Código incorreto.'; }
    q.deleteCode.run(user.id, purpose);
    return null;
  }

  // ---------- Sessão ----------
  const secureCookie = process.env.COOKIE_SECURE === '1';
  function startSession(res, userId) {
    const token = randomBytes(32).toString('hex');
    const expires = Date.now() + SESSION_DAYS * 86_400_000;
    q.insertSession.run(sha256(token), userId, expires);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secureCookie ? '; Secure' : ''}`);
  }
  function clearCookie(res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie ? '; Secure' : ''}`);
  }
  // Tokens de extensão (Authorization: Bearer gyde_...). Guardamos só o hash.
  db.exec(`CREATE TABLE IF NOT EXISTS api_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used INTEGER
  )`);
  const tq = {
    user: db.prepare('SELECT u.* FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?'),
    touch: db.prepare('UPDATE api_tokens SET last_used = ? WHERE token_hash = ?'),
    list: db.prepare('SELECT substr(token_hash, 1, 12) AS id, name, created_at, last_used FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC'),
    insert: db.prepare('INSERT INTO api_tokens (token_hash, user_id, name, created_at) VALUES (?, ?, ?, ?)'),
    remove: db.prepare('DELETE FROM api_tokens WHERE user_id = ? AND substr(token_hash, 1, 12) = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM api_tokens WHERE user_id = ?'),
  };

  function currentUser(req) {
    const bearer = /^Bearer (gyde_[0-9a-f]{48})$/.exec(req.get('authorization') || '')?.[1];
    if (bearer) {
      const h = sha256(bearer);
      const user = tq.user.get(h);
      if (user) tq.touch.run(Date.now(), h);
      return user || null;
    }
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    return q.sessionUser.get(sha256(token), Date.now()) || null;
  }
  const publicUser = (u) => ({
    id: u.id, email: u.email, name: u.name, emailVerified: Boolean(u.email_verified),
    onboarded: Boolean(u.onboarded), profile: JSON.parse(u.profile || '{}'),
  });

  // Toda requisição que muda dados precisa deste cabeçalho: um site de terceiros não consegue enviá-lo (CSRF).
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.get('x-gyde') !== '1') return res.status(403).json({ error: 'Requisição recusada.' });
    next();
  });

  const loginLimiter = makeLimiter(10, 15 * 60_000);
  const codeLimiter = makeLimiter(5, 15 * 60_000);
  const ipKey = (req) => req.ip || req.socket.remoteAddress || 'local';
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  r.post('/register', wrap(async (req, res) => {
    const email = normEmail(req.body?.email);
    const name = String(req.body?.name || '').trim().slice(0, 60);
    const password = req.body?.password;
    if (!name) return res.status(400).json({ error: 'Diga como podemos te chamar.' });
    if (!validEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ error: problem });
    if (!codeLimiter(`reg:${ipKey(req)}`)) return res.status(429).json({ error: 'Muitas tentativas. Espere alguns minutos.' });

    let user = q.userByEmail.get(email);
    if (user?.email_verified) return res.status(409).json({ error: 'Já existe uma conta com esse e-mail. Faça login.' });
    if (user) {
      // Cadastro anterior não confirmado: atualiza os dados e reenvia o código.
      q.setPassword.run(await hashPassword(password), user.id);
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
    } else {
      const id = randomUUID();
      q.insertUser.run(id, email, name, await hashPassword(password), Date.now());
    }
    user = q.userByEmail.get(email);
    if (personal) {
      // Modo pessoal: a conta só existe neste computador, então não há e-mail para confirmar.
      q.setVerified.run(user.id);
      startSession(res, user.id);
      return res.status(201).json({ user: publicUser(q.userById.get(user.id)) });
    }
    const { delivered } = await sendCode(user, 'verify');
    res.status(201).json({ needsVerification: true, email, delivered });
  }));

  r.post('/verify', wrap(async (req, res) => {
    const user = q.userByEmail.get(normEmail(req.body?.email));
    if (!user) return res.status(400).json({ error: 'Conta não encontrada.' });
    if (!codeLimiter(`verify:${user.id}`)) return res.status(429).json({ error: 'Muitas tentativas. Espere alguns minutos.' });
    const problem = checkCode(user, 'verify', req.body?.code);
    if (problem) return res.status(400).json({ error: problem });
    q.setVerified.run(user.id);
    startSession(res, user.id);
    res.json({ user: publicUser(q.userById.get(user.id)) });
  }));

  r.post('/resend', wrap(async (req, res) => {
    const user = q.userByEmail.get(normEmail(req.body?.email));
    if (!codeLimiter(`resend:${normEmail(req.body?.email)}`)) return res.status(429).json({ error: 'Espere alguns minutos antes de pedir outro código.' });
    // Resposta igual exista ou não a conta, para não revelar quem está cadastrado.
    let delivered = false;
    if (user && !user.email_verified) ({ delivered } = await sendCode(user, 'verify'));
    res.json({ ok: true, delivered });
  }));

  r.post('/login', wrap(async (req, res) => {
    const email = normEmail(req.body?.email);
    if (!loginLimiter(`login:${ipKey(req)}`) || !loginLimiter(`login:${email}`)) {
      return res.status(429).json({ error: 'Muitas tentativas. Espere alguns minutos.' });
    }
    const user = q.userByEmail.get(email);
    const ok = user && (await checkPassword(String(req.body?.password || ''), user.password_hash));
    if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    if (!user.email_verified && personal) q.setVerified.run(user.id); // contas antigas não confirmadas
    else if (!user.email_verified) {
      const { delivered } = await sendCode(user, 'verify');
      return res.status(403).json({ needsVerification: true, email, delivered, error: 'Confirme seu e-mail para entrar.' });
    }
    startSession(res, user.id);
    res.json({ user: publicUser(user) });
  }));

  r.post('/logout', (req, res) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) q.deleteSession.run(sha256(token));
    clearCookie(res);
    res.json({ ok: true });
  });

  r.post('/forgot', wrap(async (req, res) => {
    if (personal) return res.status(400).json({ local: true, error: 'No modo pessoal, troque a senha com o redefinir-senha.bat (pasta configurar do Gyde).' });
    const email = normEmail(req.body?.email);
    if (!codeLimiter(`forgot:${email}`) || !codeLimiter(`forgot-ip:${ipKey(req)}`)) {
      return res.status(429).json({ error: 'Espere alguns minutos antes de pedir outro código.' });
    }
    const user = q.userByEmail.get(email);
    let delivered = false;
    if (user) ({ delivered } = await sendCode(user, 'reset'));
    res.json({ ok: true, delivered });
  }));

  r.post('/reset', wrap(async (req, res) => {
    const user = q.userByEmail.get(normEmail(req.body?.email));
    if (!user) return res.status(400).json({ error: 'Código incorreto.' });
    if (!codeLimiter(`reset:${user.id}`)) return res.status(429).json({ error: 'Muitas tentativas. Espere alguns minutos.' });
    const pwProblem = passwordProblem(req.body?.password);
    if (pwProblem) return res.status(400).json({ error: pwProblem });
    const problem = checkCode(user, 'reset', req.body?.code);
    if (problem) return res.status(400).json({ error: problem });
    q.setPassword.run(await hashPassword(req.body.password), user.id);
    q.setVerified.run(user.id); // quem recebeu o código no e-mail provou que é dono dele
    q.deleteUserSessions.run(user.id); // derruba sessões antigas
    startSession(res, user.id);
    res.json({ user: publicUser(q.userById.get(user.id)) });
  }));

  r.get('/me', (req, res) => {
    const user = currentUser(req);
    res.json({ user: user ? publicUser(user) : null, mode: personal ? 'pessoal' : 'publico', emailMode: smtpReady ? 'smtp' : devConsole ? 'console' : 'off' });
  });

  app.use('/api/auth', express.json({ limit: '20kb' }), r);

  // Exige login (e e-mail confirmado) no resto da API.
  function requireAuth(req, res, next) {
    const user = currentUser(req);
    if (!user || !user.email_verified) return res.status(401).json({ error: 'Faça login para continuar.' });
    req.user = user;
    next();
  }

  // Gerenciar tokens de extensão (exige login normal pelo site, não pelo próprio token).
  const viaCookie = (req, res, next) => {
    if (req.get('authorization')) return res.status(403).json({ error: 'Gerencie os tokens pelo site do Gyde.' });
    requireAuth(req, res, next);
  };
  app.get('/api/tokens', viaCookie, (req, res) => res.json({ tokens: tq.list.all(req.user.id) }));
  app.post('/api/tokens', express.json({ limit: '4kb' }), viaCookie, (req, res) => {
    if (tq.count.get(req.user.id).n >= 10) return res.status(400).json({ error: 'Limite de 10 tokens. Revogue um antigo.' });
    const name = String(req.body?.name || 'Extensão').trim().slice(0, 60) || 'Extensão';
    const token = `gyde_${randomBytes(24).toString('hex')}`;
    tq.insert.run(sha256(token), req.user.id, name, Date.now());
    res.status(201).json({ token, tokens: tq.list.all(req.user.id) }); // o token aparece só agora
  });
  app.delete('/api/tokens/:id', viaCookie, (req, res) => {
    tq.remove.run(req.user.id, String(req.params.id).slice(0, 12));
    res.json({ tokens: tq.list.all(req.user.id) });
  });

  return { requireAuth, publicUser, smtpReady, firstUser: () => q.countUsers.get().n === 1 };
}
