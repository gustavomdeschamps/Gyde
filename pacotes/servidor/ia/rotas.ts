// Preferências da inteligência de cada conta e a tela "Como o Gyde funciona". O automático é o padrão: nada aqui é obrigatório.
import type { Express } from 'express';
import type { AsyncRoute } from '../tipos.ts';
import type { Preferencias } from '../perfil.ts';
import * as C from '../../compartilhado/contratos.ts';
import { responder } from '../contratos-servidor.ts';
import type { Catalogo, ModoResposta } from './catalogo.ts';
import type { Desempenho } from './desempenho.ts';

export interface PreferenciasIA { modo: ModoResposta; especialistas: boolean; desligados: string[] }
const MODOS: ModoResposta[] = ['rapido', 'equilibrado', 'capricho'];

export function setupIA(app: Express, { preferencias, catalogo, desempenho, avisoExtras, asyncRoute }: { preferencias: Preferencias; catalogo: Catalogo; desempenho: Desempenho; avisoExtras: string | null; asyncRoute: AsyncRoute }) {
  const { getSetting, setSetting } = preferencias;
  function preferenciasIA(userId: string): PreferenciasIA {
    const modo = getSetting(userId, 'ia_modo', 'equilibrado') as ModoResposta;
    let desligados: string[] = [];
    try { const d = JSON.parse(getSetting(userId, 'ia_desligados', '[]')) as unknown; if (Array.isArray(d)) desligados = d.filter((x): x is string => typeof x === 'string'); } catch { /* fica vazio */ }
    return { modo: MODOS.includes(modo) ? modo : 'equilibrado', especialistas: getSetting(userId, 'ia_especialistas', '1') === '1', desligados };
  }

  app.get('/api/ia/preferencias', (req, res) => responder(res, C.PreferenciasIA, preferenciasIA(req.user.id)));
  app.put('/api/ia/preferencias', (req, res) => {
    const { modo, especialistas, desligados } = req.body ?? {};
    if (modo !== undefined && !MODOS.includes(modo)) return res.status(400).json({ error: 'Modo de resposta inválido.' });
    if (modo) setSetting(req.user.id, 'ia_modo', modo);
    if (typeof especialistas === 'boolean') setSetting(req.user.id, 'ia_especialistas', especialistas ? '1' : '0');
    if (Array.isArray(desligados)) setSetting(req.user.id, 'ia_desligados', JSON.stringify(desligados.filter((x) => typeof x === 'string').slice(0, 100)));
    responder(res, C.PreferenciasIA, preferenciasIA(req.user.id));
  });

  // Só o medido e o observado neste computador; o que não foi medido fica como null, sem nota inventada.
  app.get('/api/ia/modelos', asyncRoute(async (req, res) => {
    await catalogo.atualizar();
    responder(res, C.ModelosIA, {
      medidoEm: catalogo.medidoEm, aviso: avisoExtras, modelos: catalogo.perfis(),
      estrategias: desempenho.resumoDecisoes(req.user.id).map((e) => ({ estrategia: e.estrategia, pedidos: e.n, chamadas: e.chamadas, ms: Math.round(e.ms), mudou: e.mudou })),
    });
  }));

  return { preferenciasIA };
}
