// Configurações deste computador (modo pessoal): chave do FreeLLMAPI, imagens, modo da IA e cópia de segurança.
// Tudo que é segredo vai para o .env local e nunca volta para a tela.
import express from 'express';
import type { Express, Response } from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AsyncRoute, Db } from './tipos.ts';
import type { Provedores } from './provedores.ts';
import type { Imagens } from './imagens.ts';
import { gerarCopia, prepararRestauracao } from './copia.ts';
import * as C from '../compartilhado/contratos.ts';
import { responder } from './contratos-servidor.ts';

const CHAVE_FREELLMAPI = /^freellmapi-[A-Za-z0-9_-]{8,200}$/;

interface Opcoes { arquivoEnv: string; routerUrl: string; provedores: Provedores; imagens: Imagens; db: Db; pastaDados: string; asyncRoute: AsyncRoute }

export function setupConfiguracao(app: Express, { arquivoEnv, routerUrl, provedores, imagens, db, pastaDados, asyncRoute }: Opcoes) {
  // no modo público (servidor de uma turma) quem configura é o dono do servidor, não a tela
  const soPessoal = (res: Response, o_que: string) => {
    if (process.env.GYDE_MODE !== 'publico') return true;
    res.status(403).json({ error: `No modo público ${o_que} é feito no servidor.` });
    return false;
  };

  // grava (ou apaga, com null) variáveis no .env deste computador e já aplica no processo
  function gravarNoEnv(pares: Record<string, string | null>) {
    const nomes = Object.keys(pares);
    const linhas = (existsSync(arquivoEnv) ? readFileSync(arquivoEnv, 'utf8').split(/\r?\n/) : [])
      .filter((l) => l.trim() && !nomes.some((n) => new RegExp(`^\\s*${n}\\s*=`).test(l)));
    for (const [nome, valor] of Object.entries(pares)) {
      if (valor === null) delete process.env[nome];
      else { linhas.push(`${nome}=${valor}`); process.env[nome] = valor; }
    }
    mkdirSync(path.dirname(arquivoEnv), { recursive: true });
    writeFileSync(arquivoEnv, `${linhas.join('\n')}\n`, { mode: 0o600 });
  }

  app.put('/api/config/chave-freellmapi', (req, res) => {
    if (!soPessoal(res, 'configurar as chaves')) return;
    const chave = String(req.body?.chave ?? '').trim();
    if (!CHAVE_FREELLMAPI.test(chave)) return res.status(400).json({ error: 'Isso não parece a chave do FreeLLMAPI (ela começa com "freellmapi-"). Use o "Copy Key" no ícone do FreeLLMAPI.' });
    gravarNoEnv({ FREELLMAPI_KEY: chave, ...(process.env.FREELLMAPI_URL ? {} : { FREELLMAPI_URL: routerUrl }) });
    provedores.definirChave(chave);
    res.json({ ok: true });
  });

  // imagens (Cloudflare Workers AI): confere conta e token antes de gravar, sem gastar a cota de imagens
  app.put('/api/config/imagens', asyncRoute(async (req, res) => {
    if (!soPessoal(res, 'configurar as chaves')) return;
    const conta = String(req.body?.conta ?? '').match(/[0-9a-fA-F]{32}/)?.[0]?.toLowerCase(); // aceita o ID com espaços ou texto junto
    const token = String(req.body?.token ?? '').trim();
    if (!conta) return res.status(400).json({ error: 'O Account ID tem 32 caracteres, só números e letras de a até f. Ele fica no painel da Cloudflare, no menu da conta ("Copy account ID").' });
    if (!/^[A-Za-z0-9_-]{30,200}$/.test(token)) return res.status(400).json({ error: 'Isso não parece um API Token da Cloudflare. Crie um com o modelo "Workers AI" e cole aqui.' });
    let status: number;
    try { status = await imagens.conferir(conta, token); } catch { return res.status(502).json({ error: 'Não consegui falar com a Cloudflare. Confira a internet e tente de novo.' }); }
    if (status === 401 || status === 403) return res.status(400).json({ error: 'A Cloudflare recusou: confira se o token tem a permissão "Workers AI" e se o Account ID é da mesma conta.' });
    if (status < 200 || status > 299) return res.status(502).json({ error: `A Cloudflare respondeu com erro ${status}. Tente de novo daqui a pouco.` });
    gravarNoEnv({ CLOUDFLARE_ACCOUNT_ID: conta, CLOUDFLARE_API_TOKEN: token });
    res.json({ ok: true });
  }));
  app.delete('/api/config/imagens', (_req, res) => {
    if (!soPessoal(res, 'configurar as chaves')) return;
    gravarNoEnv({ CLOUDFLARE_ACCOUNT_ID: null, CLOUDFLARE_API_TOKEN: null });
    res.json({ ok: true });
  });

  // trocar entre online, offline e automático (vale para o Gyde inteiro)
  app.post('/api/uso/modo', (req, res) => {
    if (!soPessoal(res, 'escolher o modo da IA')) return;
    res.json({ modo: provedores.definirModo(String(req.body?.modo || '')) });
  });

  // cópia de segurança: o banco tem todas as contas deste computador. Restaurar vale na próxima abertura.
  app.get('/api/dados/copia', (_req, res) => {
    if (!soPessoal(res, 'a cópia de segurança')) return;
    const zip = gerarCopia(db, pastaDados);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="gyde-copia-${new Date().toISOString().slice(0, 10)}.zip"`);
    res.send(Buffer.from(zip));
  });
  app.post('/api/dados/restaurar', express.raw({ type: () => true, limit: '1gb' }), (req, res) => {
    if (!soPessoal(res, 'a cópia de segurança')) return;
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Envie o arquivo .zip da cópia.' });
    responder(res, C.RestauracaoPreparada, { ...prepararRestauracao(new Uint8Array(req.body), pastaDados), reiniciar: true });
  });
}
