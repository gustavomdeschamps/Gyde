// Tipos compartilhados pelo servidor do Gyde.
import type { DatabaseSync, SQLInputValue, StatementResultingChanges } from 'node:sqlite';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export type Db = DatabaseSync;

// Usuário como está no banco (tabela users). `profile` é o JSON do questionário.
export interface Usuario {
  id: string;
  name: string;
  email: string;
  profile: string;
  onboarded?: number;
  email_verified?: number;
  [coluna: string]: unknown;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- é assim que o Express deixa acrescentar req.user
  namespace Express {
    interface Request { user: Usuario }
  }
}

// Consumo informado pelo provedor (campo usage da API no formato OpenAI).
export interface UsoInformado { prompt_tokens?: number | null; completion_tokens?: number | null; total_tokens?: number | null }

export type Resultado = 'ok' | 'erro' | 'cancelado' | 'limite';
export type Provedor = 'online' | 'offline';

// Registro de UM pedido do usuário (uso.ts); recebe cada ida ao provedor.
export interface Registro {
  id: string;
  chamada(c: { provedor?: string | null; modelo?: string | null; ok: boolean }): void;
  tokens(u?: UsoInformado | null): void;
  fim(resultado: Resultado, erro?: string | null): void;
}

export interface RouterInit extends RequestInit { registro?: Registro | undefined }
// Todos os módulos falam com a IA por aqui (provedores.ts decide se vai para o FreeLLMAPI ou para o Ollama).
export type Router = (caminho: string, init?: RouterInit) => Promise<globalThis.Response>;

// Erro com informação para a resposta HTTP e para a troca de modelo.
export interface ErroGyde extends Error { status?: number; final?: boolean; limite?: string }
export const erroGyde = (mensagem: string, extra: Partial<ErroGyde> = {}): ErroGyde => Object.assign(new Error(mensagem), extra);
export const comoErro = (e: unknown): ErroGyde => (e instanceof Error ? e : new Error(String(e)));

export type AsyncRoute = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => RequestHandler;

// Mensagem no formato da API de chat (texto ou partes com imagem).
export type ParteConteudo = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export interface MensagemIA { role: 'system' | 'user' | 'assistant'; content: string | ParteConteudo[] }

// Consulta preparada com as colunas tipadas (o node:sqlite devolve linhas genéricas). `T` descreve as colunas do SELECT.
export interface Consulta<T> {
  get(...p: SQLInputValue[]): T | undefined;
  all(...p: SQLInputValue[]): T[];
  run(...p: SQLInputValue[]): StatementResultingChanges;
}
export function consulta<T = never>(db: Db, sql: string): Consulta<T> {
  const st = db.prepare(sql);
  return { get: (...p) => st.get(...p) as T | undefined, all: (...p) => st.all(...p) as T[], run: (...p) => st.run(...p) };
}
