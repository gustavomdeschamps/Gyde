// Servidor do Gyde: carrega a configuração, abre o banco e monta os módulos (cada um com as próprias rotas).
import express from 'express';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import path from 'node:path';
import { abrirBanco } from './banco.ts';
import { aplicarRestauracaoPendente } from './copia.ts';
import { setupAuth } from './auth.ts';
import { setupPratica } from './pratica-servidor.ts';
import { setupMemoria } from './memoria.ts';
import { setupTurmas } from './turmas.ts';
import { setupAgente } from './agente.ts';
import { setupCodigoAgente } from './codigo-agente.ts';
import { setupSkills } from './skills-sistema.ts';
import { setupChat } from './chat.ts';
import { setupConfiguracao } from './configuracao.ts';
import { setupPerfil, criarPreferencias, profileSummary } from './perfil.ts';
import { criarImagens } from './imagens.ts';
import { criarProvedores } from './provedores.ts';
import { criarUso } from './uso.ts';
import type { Request, Response, NextFunction } from 'express';
import type { ErroGyde, AsyncRoute } from './tipos.ts';
import { consulta } from './tipos.ts';
import * as C from '../compartilhado/contratos.ts';
import { responder } from './contratos-servidor.ts';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// O .env do Gyde sempre vence variáveis do Windows com o mesmo nome
// (process.loadEnvFile não sobrescreve as que já existem).
const BASE = path.join(ROOT, '..', '..'); // pasta principal do Gyde (.env, data/, node_modules/)
// no app de desktop o .env fica na pasta de dados do usuário (GYDE_ENV_FILE), não na pasta do programa
const ENV_FILE = process.env.GYDE_ENV_FILE ? path.resolve(process.env.GYDE_ENV_FILE) : path.join(BASE, '.env');
if (existsSync(ENV_FILE)) {
  const doDesktop = process.env.GYDE_DESKTOP === '1' ? { PORT: process.env.PORT, DATA_DIR: process.env.DATA_DIR } : {};
  Object.assign(process.env, parseEnv(readFileSync(ENV_FILE, 'utf8')), doDesktop); // porta e pasta de dados são do app de desktop
}

const PORT = Number(process.env.PORT || 3210);
const ROUTER_URL = (process.env.FREELLMAPI_URL || 'http://127.0.0.1:31415').replace(/\/+$/, '');
// IA offline: Ollama no próprio computador. GYDE_MODO_IA = online | offline | auto (padrão: auto)
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const OLLAMA_MODELO = process.env.OLLAMA_MODELO || 'qwen2.5:3b';
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(BASE, 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const DIST = path.join(ROOT, '..', 'interface', 'dist'); // interface gerada pelo Vite (pacotes/interface)

// ---------- Banco de dados (SQLite embutido no Node) ----------
mkdirSync(IMAGES_DIR, { recursive: true });
// o esquema vem das migrações (migracoes.ts); bancos antigos são atualizados aqui, com cópia antes
const PASTA_COPIAS = path.join(DATA_DIR, 'copias-banco');
aplicarRestauracaoPendente(path.join(DATA_DIR, 'chat.db'), DATA_DIR, PASTA_COPIAS); // cópia restaurada pelas Configurações
const db = abrirBanco(path.join(DATA_DIR, 'chat.db'), { pastaCopias: PASTA_COPIAS });
const preferencias = criarPreferencias(db);

// ---------- Provedor de IA (FreeLLMAPI online ou Ollama offline) ----------
const uso = criarUso(db); // registro de uso do Gyde (uso.ts): um registro por pedido, com o que o provedor informou
const provedores = criarProvedores({ routerUrl: ROUTER_URL, routerKey: process.env.FREELLMAPI_KEY || '', ollamaUrl: OLLAMA_URL, ollamaModelo: OLLAMA_MODELO, modo: process.env.GYDE_MODO_IA || 'auto', uso });
const router = provedores.router;
const imagens = criarImagens({ pasta: IMAGES_DIR });

// ---------- API ----------
const app = express();
app.use(express.json({ limit: '30mb' }));

const asyncRoute: AsyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Cadastro/login (/api/auth/*). Tudo abaixo de /api exige usuário logado, menos o status.
const { requireAuth } = setupAuth(app, db);
const reivindicarOrfas = db.prepare('UPDATE conversations SET user_id = ? WHERE user_id IS NULL');
let orphansClaimed = false;
app.use(['/api', '/images'], (req, res, next) => {
  if (req.baseUrl === '/api' && req.path === '/status') return next();
  requireAuth(req, res, () => {
    // Conversas criadas antes do login existir ficam com a primeira conta confirmada.
    if (!orphansClaimed) {
      const first = consulta<{ id: string }>(db, 'SELECT id FROM users WHERE email_verified = 1 ORDER BY created_at LIMIT 1').get();
      if (first?.id === req.user.id) reivindicarOrfas.run(req.user.id);
      if (first) orphansClaimed = true;
    }
    next();
  });
});

// Versão do código: se os arquivos do Gyde mudarem no disco depois que o servidor iniciou (atualização sem reiniciar
// o iniciar.bat), o navegador recebe telas novas de um servidor antigo. O status avisa para a tela pedir o reinício.
const impressaoDoCodigo = () => {
  const pastas = [ROOT, DIST];
  let h = 0;
  for (const dir of pastas) for (const f of existsSync(dir) ? readdirSync(dir).sort() : []) {
    if (!/\.(ts|js|mjs|html|css)$/.test(f)) continue;
    const t = statSync(path.join(dir, f)).mtimeMs;
    for (const c of `${f}:${t}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  }
  return h;
};
const VERSAO_INICIO = impressaoDoCodigo();

app.get('/api/status', asyncRoute(async (_req, res) => {
  const u = await provedores.resumo({ mostrarConta: false });
  let desatualizado = false;
  try { desatualizado = impressaoDoCodigo() !== VERSAO_INICIO; } catch { /* sem como checar */ }
  responder(res, C.Status, { keyConfigured: provedores.temChave(), routerOnline: u.online.disponivel, iaAtiva: u.ativo, offlineDisponivel: u.offline.disponivel, imagesEnabled: imagens.ativas(), desatualizado, pessoal: process.env.GYDE_MODE !== 'publico' });
}));

// Consumo e limites de IA: só o que o provedor informa (nada inventado).
app.get('/api/uso', asyncRoute(async (req, res) => {
  const pessoal = process.env.GYDE_MODE !== 'publico';
  responder(res, C.Uso, { ...(await provedores.resumo({ mostrarConta: pessoal })), gyde: uso.resumo(req.user.id, { mostrarInternas: pessoal }) });
}));
app.delete('/api/uso', (req, res) => { uso.apagarDe(req.user.id); res.json({ ok: true }); });

// ---------- Módulos (cada um registra as próprias rotas) ----------
const skills = setupSkills(app, db, { root: ROOT }); // skills instaláveis (skills-catalogo/*.md + as de cada pessoa)
const memoria = setupMemoria(app, db, { router, ...preferencias }); // memória entre conversas
setupConfiguracao(app, { arquivoEnv: ENV_FILE, routerUrl: ROUTER_URL, provedores, imagens, db, pastaDados: DATA_DIR, asyncRoute }); // chaves e cópia de segurança
setupChat(app, db, { router, provedores, uso, imagens, asyncRoute, preferencias, skills, memoria }); // conversas e mensagens
setupPratica(app, db, { router, profileSummary, asyncRoute, uso }); // exercícios, projetos, revisão, desafio do dia, amigos
setupTurmas(app, db); // modo turma
setupAgente(app, { router, asyncRoute }); // agente do navegador da extensão do Chrome
setupCodigoAgente(app, db, { router, asyncRoute, dataDir: DATA_DIR, uso }); // Forja: trabalha numa pasta de projeto
setupPerfil(app, db, preferencias); // questionário e preferências

// ---------- Arquivos estáticos ----------
const nm = (p: string) => path.join(BASE, 'node_modules', p);
app.use('/images', express.static(IMAGES_DIR, { maxAge: '30d', immutable: true }));
app.use('/vendor/hljs', express.static(nm('@highlightjs/cdn-assets'))); // temas de cor do código (claro/escuro), trocados em tempo de execução
app.get('/favicon.ico', (_req, res) => res.sendFile(path.join(DIST, 'gyde.ico'), { maxAge: 0 }));
// interface já compilada pelo Vite (npm run build). Arquivos com hash no nome podem ficar em cache por muito tempo.
app.use('/assets', express.static(path.join(DIST, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(DIST));
app.get('/', (_req, res) => res.status(503).type('text').send('A interface do Gyde ainda não foi gerada. Rode: npm run build (o iniciar.bat e o app de desktop já vêm com ela gerada).'));

app.use((err: ErroGyde, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500;
  if (status >= 500 && status !== 502 && status !== 503) console.error(err);
  if (res.headersSent) return res.end();
  res.status(status).json({ error: err.message || 'Erro interno.' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Gyde rodando em http://127.0.0.1:${PORT}`);
  console.log(`  FreeLLMAPI: ${ROUTER_URL}  |  chave: ${provedores.temChave() ? 'configurada' : 'FALTANDO (cole em Configurações > IA e modelos)'}`);
  console.log(`  IA: modo ${process.env.GYDE_MODO_IA || 'auto'}  |  offline: Ollama ${OLLAMA_MODELO}\n`);
});
