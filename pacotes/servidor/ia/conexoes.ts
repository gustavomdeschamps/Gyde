// Conectar IA: chaves dos provedores grátis (NVIDIA, Google, Groq), direto, sem o FreeLLMAPI.
// - Testar chave faz uma chamada de verdade, de 1 token: a lista de modelos da NVIDIA abre até sem chave, então ela não prova nada.
// - A chave vai para o .env deste computador e nunca volta para a tela.
// - O roteador usa a lista de modelos AO VIVO de cada provedor: modelo que sumiu sai da fila sozinho.
import type { Express, Response } from 'express';
import type { AsyncRoute } from '../tipos.ts';
import * as C from '../../compartilhado/contratos.ts';
import { responder } from '../contratos-servidor.ts';
import { redigir } from '../seguranca.ts';
import type { ProvedorExtraLido } from './adaptadores.ts';
import type { Medicoes } from './catalogo.ts';
import { AVISO_IDADE, PROVEDORES_GRATIS, urlDe, type ProvedorGratis } from './provedores-gratis.ts';

const VALE_LISTA = 10 * 60_000;
// o que não é modelo de conversa (embeddings, moderação, voz, imagem...) nunca entra na fila
const NAO_CONVERSA = /(embed|guard|safety|moderation|whisper|tts|transcri|ocr|parse|reward|clip|translate|live|audio|image|vision-detector|fim|rerank|retriever)/i;

const maiuscula = (t: string) => t[0]!.toUpperCase() + t.slice(1);

export interface ResultadoTeste { ok: boolean; mensagem: string; modelo?: string }

export function criarConexoes({ medicoes, buscar = fetch }: { medicoes: Medicoes; buscar?: typeof fetch }) {
  const aoVivo = new Map<string, { modelos: string[] | null; em: number }>();
  const naTela = PROVEDORES_GRATIS.filter((p) => p.naTela);
  const conectados = () => naTela.filter((p) => Boolean(process.env[p.chaveEnv]));
  const medidosDe = (p: ProvedorGratis) => Object.keys(medicoes.modelos).filter((id) => id.startsWith(`${p.id}:`)).map((id) => id.slice(p.id.length + 1));

  async function listar(p: ProvedorGratis, chave = process.env[p.chaveEnv] ?? ''): Promise<string[] | null> {
    try {
      const r = await buscar(`${urlDe(p)}/models`, { headers: { Authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) return null;
      const j = await r.json() as { data?: { id: string }[] };
      return (j.data ?? []).map((m) => m.id.replace(/^models\//, ''));
    } catch { return null; }
  }

  // Lista ao vivo de quem está conectado, no máximo a cada 10 minutos. Sem resposta do provedor: fica a última.
  async function atualizar() {
    await Promise.all(conectados().map(async (p) => {
      const atual = aoVivo.get(p.id);
      if (atual && Date.now() - atual.em < VALE_LISTA) return;
      const modelos = await listar(p);
      aoVivo.set(p.id, { modelos: modelos ?? atual?.modelos ?? null, em: Date.now() });
    }));
  }

  // Modelos que entram na fila: os medidos que o provedor ainda oferece. Se todos sumirem, os de conversa que ele oferece agora.
  function modelosDe(p: ProvedorGratis): string[] {
    const vivos = aoVivo.get(p.id)?.modelos ?? null;
    const medidos = medidosDe(p);
    if (!vivos) return medidos;
    const ficam = medidos.filter((m) => vivos.includes(m));
    return ficam.length ? ficam : vivos.filter((m) => !NAO_CONVERSA.test(m)).slice(0, 4);
  }

  const extras = (): ProvedorExtraLido[] => conectados().map((p) => ({ id: p.id, url: urlDe(p), chaveEnv: p.chaveEnv, modelos: modelosDe(p).map((id) => ({ id })) }));

  // Chamada de 1 token com a chave: a única prova de que ela funciona.
  async function testar(p: ProvedorGratis, chave: string): Promise<ResultadoTeste> {
    if (!p.formatoChave.test(chave)) {
      return { ok: false, mensagem: p.prefixo ? `Isso não parece uma chave ${p.de}: ela começa com "${p.prefixo}". Copie a chave inteira, sem espaços.` : `Isso não parece uma chave ${p.de}.` };
    }
    const vivos = await listar(p, chave);
    const tentar = [...new Set([...medidosDe(p).filter((m) => !vivos || vivos.includes(m)), ...(vivos ?? []).filter((m) => !NAO_CONVERSA.test(m))])].slice(0, 3);
    if (!tentar.length) return { ok: false, mensagem: `Não consegui falar com ${p.artigo}. Confira a internet e tente de novo.` };
    let ultimo = '';
    for (const modelo of tentar) {
      let r: globalThis.Response;
      try {
        r = await buscar(`${urlDe(p)}/chat/completions`, {
          method: 'POST', signal: AbortSignal.timeout(30_000),
          headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelo, max_tokens: 1, messages: [{ role: 'user', content: 'Responda só: ok' }] }),
        });
      } catch { return { ok: false, mensagem: `Não consegui falar com ${p.artigo}. Confira a internet e tente de novo.` }; }
      if (r.ok) return { ok: true, mensagem: `Funcionou! O Gyde já pode usar ${p.artigo}.`, modelo };
      const corpo = redigir(await r.text().catch(() => ''));
      if (r.status === 429) return { ok: true, mensagem: `A chave funciona. ${maiuscula(p.artigo)} disse que o limite deste minuto acabou: o Gyde espera e usa quando liberar.`, modelo };
      if (r.status === 401 || r.status === 403 || (r.status === 400 && /api.?key|invalid|unauthori/i.test(corpo))) {
        return { ok: false, mensagem: `${maiuscula(p.artigo)} recusou essa chave. Confira se copiou ela inteira, sem espaços, ou crie uma nova no site.` };
      }
      ultimo = `${maiuscula(p.artigo)} respondeu com erro ${r.status}.`; // modelo fora do ar ou que sumiu: tenta o próximo
    }
    return { ok: false, mensagem: `${ultimo} A chave pode estar certa, mas o serviço não respondeu agora. Tente de novo em alguns minutos.` };
  }

  function estado() {
    return {
      avisoIdade: AVISO_IDADE,
      provedores: naTela.map((p) => ({ id: p.id, nome: p.nome, artigo: p.artigo, de: p.de, papel: p.papel, descricao: p.descricao, avisos: p.avisos, linkChave: p.linkChave, prefixo: p.prefixo, conectado: Boolean(process.env[p.chaveEnv]) })),
      freellmapi: Boolean(process.env.FREELLMAPI_KEY),
    };
  }

  return { atualizar, extras, testar, estado, ids: () => conectados().map((p) => p.id), conectados };
}
export type Conexoes = ReturnType<typeof criarConexoes>;


export function setupConexoes(app: Express, { conexoes, gravarNoEnv, asyncRoute, aoMudar }: {
  conexoes: Conexoes; gravarNoEnv: (pares: Record<string, string | null>) => void; asyncRoute: AsyncRoute; aoMudar: () => void;
}) {
  const soPessoal = (res: Response) => {
    if (process.env.GYDE_MODE !== 'publico') return true;
    res.status(403).json({ error: 'Neste Gyde, quem conecta a IA é quem cuida do servidor.' });
    return false;
  };
  const provedor = (id: string) => PROVEDORES_GRATIS.find((p) => p.naTela && p.id === id);

  app.get('/api/ia/conexoes', (_req, res) => responder(res, C.Conexoes, conexoes.estado()));

  // Testa e, se funcionar, salva. Com "chave" vazia, testa a que já está salva (botão "Testar de novo").
  app.post('/api/ia/conexoes/:id/testar', asyncRoute(async (req, res) => {
    if (!soPessoal(res)) return;
    const p = provedor(String(req.params.id));
    if (!p) return res.status(404).json({ error: 'Provedor desconhecido.' });
    const nova = String(req.body?.chave ?? '').trim();
    const chave = nova || process.env[p.chaveEnv] || '';
    if (!chave) return res.status(400).json({ error: 'Cole a chave no campo antes de testar.' });
    const r = await conexoes.testar(p, chave);
    if (r.ok && nova) { gravarNoEnv({ [p.chaveEnv]: nova }); aoMudar(); }
    responder(res, C.ResultadoTesteChave, { ok: r.ok, mensagem: r.mensagem, conexoes: conexoes.estado() });
  }));

  app.delete('/api/ia/conexoes/:id', (req, res) => {
    if (!soPessoal(res)) return;
    const p = provedor(String(req.params.id));
    if (!p) return res.status(404).json({ error: 'Provedor desconhecido.' });
    gravarNoEnv({ [p.chaveEnv]: null });
    aoMudar();
    responder(res, C.Conexoes, conexoes.estado());
  });
}
