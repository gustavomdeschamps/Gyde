// Relatório de erro: guarda os últimos erros do servidor (com segredos e caminhos pessoais removidos) e monta um resumo
// do ambiente. Nada é enviado para lugar nenhum: a tela copia o texto e a pessoa decide onde colar (ex.: uma issue).
import type { Express } from 'express';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AsyncRoute, Db, ErroGyde } from './tipos.ts';
import type { Provedores } from './provedores.ts';
import { versaoDoBanco } from './banco.ts';
import { redigir } from './seguranca.ts';
import * as C from '../compartilhado/contratos.ts';
import { responder } from './contratos-servidor.ts';

const MAX = 30;
const erros: { em: string; onde: string; mensagem: string; pilha: string }[] = [];

// caminhos sem o nome da pessoa: a pasta do Gyde vira <gyde> e a pasta do usuário vira ~ (com / ou \, com ou sem file:///)
const barras = (s: string) => s.replaceAll('\\', '/');
const RAIZ_GYDE = barras(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const CASA = barras(os.homedir());
const trocarSemCaixa = (texto: string, de: string, para: string) => texto.replace(new RegExp(de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), para);
export const semCaminhosPessoais = (texto: string) =>
  trocarSemCaixa(trocarSemCaixa(barras(texto).replaceAll('file:///', ''), RAIZ_GYDE, '<gyde>'), CASA, '~');

export function registrarErro(e: ErroGyde, onde: string) {
  const limpar = (t: string) => semCaminhosPessoais(redigir(t));
  erros.push({
    em: new Date().toISOString(),
    onde: onde.slice(0, 120),
    mensagem: limpar(String(e.message ?? e)).slice(0, 500),
    pilha: limpar((e.stack ?? '').split('\n').slice(1, 6).join('\n')).slice(0, 1500), // só as primeiras linhas
  });
  if (erros.length > MAX) erros.shift();
}

export function setupDiagnostico(app: Express, { db, provedores, raiz, asyncRoute }: { db: Db; provedores: Provedores; raiz: string; asyncRoute: AsyncRoute }) {
  let versao = 'desconhecida';
  try { versao = (JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8')) as { version?: string }).version ?? versao; } catch { /* sem package.json */ }
  app.get('/api/diagnostico', asyncRoute(async (_req, res) => {
    const pessoal = process.env.GYDE_MODE !== 'publico';
    const p = await provedores.resumo({ mostrarConta: false });
    responder(res, C.Diagnostico, {
      gyde: versao,
      node: process.versions.node,
      sistema: `${os.type()} ${os.release()} (${os.arch()})`,
      modo: pessoal ? 'pessoal' : 'publico',
      desktop: process.env.GYDE_DESKTOP === '1',
      esquemaBanco: versaoDoBanco(db),
      ia: { modo: p.modo, ativo: p.ativo, online: p.online.disponivel, offline: p.offline.disponivel, chave: provedores.temChave() },
      // no modo público os erros podem ser de outras contas: ficam só no servidor
      erros: pessoal ? [...erros] : [],
    });
  }));
}
