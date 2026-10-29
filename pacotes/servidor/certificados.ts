// Certificados dos projetos guiados: emitidos quando todas as etapas de um projeto passam nos critérios (um por
// pessoa e projeto). O código de verificação é aleatório e confere neste Gyde quem fez, qual projeto e quando.
// A conferência é local: não existe servidor central, e a tela diz isso.
import { randomInt } from 'node:crypto';
import type { Express } from 'express';
import type { Db, Usuario } from './tipos.ts';
import { consulta } from './tipos.ts';
import { PROJETOS, chaveEtapa } from './projetos-dados.ts';
import * as C from '../compartilhado/contratos.ts';
import { responder } from './contratos-servidor.ts';

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I/L, que confundem quem digita
export const novoCodigo = () => `GYDE-${Array.from({ length: 4 }, () => LETRAS[randomInt(LETRAS.length)]).join('')}-${Array.from({ length: 4 }, () => LETRAS[randomInt(LETRAS.length)]).join('')}`;
export const formatoCodigo = /^GYDE-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

interface Linha { codigo: string; projeto_id: string; pessoa: string; projeto: string; tecnologia: string; etapas: number; emitido_em: number }

export function setupCertificados(app: Express, db: Db) {
  const q = {
    doUsuario: consulta<Linha>(db, 'SELECT codigo, projeto_id, pessoa, projeto, tecnologia, etapas, emitido_em FROM certificados WHERE user_id = ? ORDER BY emitido_em DESC'),
    porCodigo: consulta<Linha>(db, 'SELECT codigo, projeto_id, pessoa, projeto, tecnologia, etapas, emitido_em FROM certificados WHERE codigo = ?'),
    feitas: consulta<{ exercise_id: string }>(db, 'SELECT exercise_id FROM skill_progress WHERE user_id = ? AND done = 1'),
    emitir: db.prepare('INSERT OR IGNORE INTO certificados (codigo, user_id, projeto_id, pessoa, projeto, tecnologia, etapas, emitido_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  };
  const publico = (l: Linha) => ({ codigo: l.codigo, projetoId: l.projeto_id, pessoa: l.pessoa, projeto: l.projeto, tecnologia: l.tecnologia, etapas: l.etapas, emitidoEm: l.emitido_em });

  // emite os certificados que faltam (projetos com todas as etapas feitas); seguro chamar várias vezes
  function emitirPendentes(user: Usuario) {
    const feitas = new Set(q.feitas.all(user.id).map((r) => r.exercise_id));
    for (const p of PROJETOS) {
      if (!p.etapas.every((e) => feitas.has(chaveEtapa(p.id, e.id)))) continue;
      q.emitir.run(novoCodigo(), user.id, p.id, user.name, p.nome, p.tecnologia, p.etapas.length, Date.now());
    }
  }

  app.get('/api/certificados', (req, res) => {
    emitirPendentes(req.user);
    responder(res, C.ListaCertificados, { certificados: q.doUsuario.all(req.user.id).map(publico) });
  });
  // conferir um código: qualquer conta deste Gyde (ex.: o professor da turma) vê quem fez, o projeto e a data
  app.get('/api/certificados/:codigo', (req, res) => {
    const codigo = String(req.params.codigo).toUpperCase();
    const l = formatoCodigo.test(codigo) ? q.porCodigo.get(codigo) : undefined;
    if (!l) return res.status(404).json({ error: 'Nenhum certificado com esse código neste Gyde.' });
    responder(res, C.Certificado, publico(l));
  });
  return { emitirPendentes };
}
