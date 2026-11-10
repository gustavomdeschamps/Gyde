// "Mostrar o erro": recebe um print de tela e pede a um modelo que enxerga a região do problema (em porcentagem da
// imagem) e uma explicação curta. A posição é uma estimativa do modelo; a tela avisa isso. Resposta fora do formato
// (sem JSON, números fora da imagem) troca para o próximo modelo com visão.
import type { Express } from 'express';
import type { Router, AsyncRoute } from './tipos.ts';
import { comoErro, erroGyde } from './tipos.ts';
import type { Uso } from './uso.ts';
import { CADEIAS, completar, extrairJson } from './motor.ts';
import * as C from '../compartilhado/contratos.ts';
import { responder } from './contratos-servidor.ts';

const IMAGEM = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX = 8 * 1024 * 1024;

const SISTEMA = [
  'Você recebe um print de tela de alguém aprendendo a programar. Encontre o erro: uma mensagem de erro, a linha de código com problema ou o elemento visual que está errado.',
  'Responda SÓ com um objeto JSON, sem texto em volta:',
  '{"achou": true, "x": 12, "y": 40, "largura": 50, "altura": 8, "explicacao": "..."}',
  'x, y, largura e altura são porcentagens da imagem (0 a 100); x e y são o canto superior esquerdo da região. Marque uma região justa, só em volta do problema.',
  'Se não houver erro visível, responda {"achou": false, "explicacao": "..."}.',
  'A explicação é em português do Brasil, de 1 a 3 frases, para iniciantes, sem emojis, e não entrega o código corrigido inteiro.',
].join('\n');

export interface Apontamento { achou: boolean; regiao: { x: number; y: number; largura: number; altura: number } | null; explicacao: string }
// confere e normaliza a resposta do modelo; null = formato inválido
export function lerApontamento(texto: string): Apontamento | null {
  const o = extrairJson(texto);
  if (!o || typeof o.achou !== 'boolean' || typeof o.explicacao !== 'string' || !o.explicacao.trim()) return null;
  const explicacao = o.explicacao.trim().slice(0, 700);
  if (!o.achou) return { achou: false, regiao: null, explicacao };
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const x = n(o.x), y = n(o.y), largura = n(o.largura), altura = n(o.altura);
  if ([x, y, largura, altura].some(Number.isNaN) || x < 0 || y < 0 || largura <= 0 || altura <= 0 || x >= 100 || y >= 100) return null;
  // aceita até 2 pontos de sobra (arredondamento do modelo) e corta na borda da imagem
  if (x + largura > 102 || y + altura > 102) return null;
  return { achou: true, regiao: { x, y, largura: Math.min(largura, 100 - x), altura: Math.min(altura, 100 - y) }, explicacao };
}

export function setupApontar(app: Express, { router, asyncRoute, uso }: { router: Router; asyncRoute: AsyncRoute; uso?: Uso }) {
  app.post('/api/apontar', asyncRoute(async (req, res) => {
    const imagem = String(req.body?.imagem || '');
    if (!IMAGEM.test(imagem)) return res.status(400).json({ error: 'Envie um print em PNG, JPG, WEBP ou GIF.' });
    if (imagem.length * 0.75 > MAX) return res.status(400).json({ error: 'O print passa de 8 MB.' });
    const pergunta = String(req.body?.pergunta || '').trim().slice(0, 500);
    const registro = uso?.iniciar(req.user.id, 'apontar');
    try {
      const { texto, modelo } = await completar(router, {
        cadeia: CADEIAS.apontar ?? ['auto'], max_tokens: 500, temperature: 0.1, registro,
        messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: [
          { type: 'text', text: pergunta ? `O que a pessoa disse: ${pergunta}` : 'Onde está o erro neste print?' },
          { type: 'image_url', image_url: { url: imagem } },
        ] }],
        valida: (t) => Boolean(lerApontamento(t)),
      });
      registro?.fim('ok');
      responder(res, C.Apontamento, { ...lerApontamento(texto)!, modelo });
    } catch (err) {
      if (registro && uso) registro.fim(uso.resultadoDe(err), comoErro(err).message);
      const e = comoErro(err);
      if (e.status === 429 || e.final) throw err;
      throw erroGyde('Nenhum modelo com visão conseguiu analisar o print agora. Tente de novo em instantes.', { status: 502 });
    }
  }));
}
