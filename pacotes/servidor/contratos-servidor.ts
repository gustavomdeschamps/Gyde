// Lado do servidor dos contratos: confere cada resposta antes de enviar.
// GYDE_CONTRATOS=estrito (usado nos testes): resposta fora do contrato vira erro 500 na hora, para o bug aparecer.
// Sem isso (uso normal): registra no console e envia assim mesmo, para não derrubar a tela de ninguém.
import type { Response } from 'express';
import type { z } from 'zod';

const ESTRITO = process.env.GYDE_CONTRATOS === 'estrito';

export function responder<S extends z.ZodTypeAny>(res: Response, esquema: S, dados: z.input<S>, status = 200) {
  const r = esquema.safeParse(dados);
  if (!r.success) {
    const onde = `${res.req.method} ${res.req.originalUrl}`;
    const problemas = r.error.issues.slice(0, 4).map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`).join('; ');
    console.error(`[Gyde] resposta fora do contrato em ${onde}: ${problemas}`);
    if (ESTRITO) return res.status(500).json({ error: `Resposta fora do contrato em ${onde}: ${problemas}` });
  }
  return res.status(status).json(dados);
}
