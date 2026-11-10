// Contexto compartilhado: a memória é do Gyde, não de um modelo. Aqui se decide o que cada modelo recebe da conversa.
// Mandar a conversa inteira gastava a cota de tokens por minuto (413 nos provedores grátis) e fazia uma imagem antiga travar
// modelos sem visão. Agora: a mensagem atual vai inteira; as anteriores entram das mais novas para as mais velhas até o
// limite, sem imagens e com anexos cortados; o que sobra vira um resumo.
import type { MensagemIA, ParteConteudo } from '../tipos.ts';
import { ARQUIVO_SECRETO, redigir } from '../seguranca.ts';

export interface Anexo { kind: 'file' | 'image'; name: string; text?: string; dataUrl?: string }
export interface MensagemHistorico { role: 'user' | 'assistant'; content: string; attachments: Anexo[] }

const MAX_ANEXO = 100_000; // caracteres por anexo na mensagem atual (projetos inteiros cabem)
const MAX_ANEXO_ANTIGO = 1500;
const MAX_MENSAGEM_ANTIGA = 6000;
const CUSTO_IMAGEM = 3000; // caracteres equivalentes de uma imagem, para estimar o tamanho do pedido
export const LIMITE_HISTORICO = 24_000; // caracteres (cerca de 7 mil tokens) de conversa anterior

// Mensagem salva -> formato de chat. Arquivos de senhas nunca vão para o modelo; segredos nos outros viram [segredo removido].
export function paraApi(m: MensagemHistorico): MensagemIA {
  if (m.role !== 'user' || m.attachments.length === 0) return { role: m.role, content: m.content };
  const images = m.attachments.filter((a) => a.kind === 'image');
  let text = m.content;
  for (const f of m.attachments.filter((a) => a.kind === 'file')) {
    if (ARQUIVO_SECRETO.test(f.name || '')) { text += `\n\n--- Arquivo anexado: ${f.name} (não enviado: é um arquivo de senhas ou chaves) ---`; continue; }
    const conteudo = f.text ?? '';
    text += `\n\n--- Arquivo anexado: ${f.name} ---\n${redigir(conteudo.slice(0, MAX_ANEXO))}`;
    if (conteudo.length > MAX_ANEXO) text += '\n[arquivo cortado por ser muito grande]';
  }
  if (images.length === 0) return { role: 'user', content: text };
  return { role: 'user', content: [{ type: 'text', text }, ...images.map((i): ParteConteudo => ({ type: 'image_url', image_url: { url: i.dataUrl ?? '' } }))] };
}

// mensagem antiga mais leve: imagem vira nota (a pessoa já recebeu a análise) e anexo fica só no começo
function leve(m: MensagemHistorico): MensagemIA {
  let text = m.content.length > MAX_MENSAGEM_ANTIGA ? `${m.content.slice(0, MAX_MENSAGEM_ANTIGA)}\n[mensagem antiga cortada]` : m.content;
  for (const a of m.attachments) {
    if (a.kind === 'image') { text += `\n[a pessoa enviou a imagem ${a.name} nesta mensagem]`; continue; }
    if (ARQUIVO_SECRETO.test(a.name || '')) { text += `\n[arquivo ${a.name} não enviado: senhas ou chaves]`; continue; }
    const c = a.text ?? '';
    text += `\n\n--- Arquivo anexado: ${a.name} ---\n${redigir(c.slice(0, MAX_ANEXO_ANTIGO))}${c.length > MAX_ANEXO_ANTIGO ? '\n[anexo antigo cortado]' : ''}`;
  }
  return { role: m.role, content: text };
}

// Tamanho aproximado de um pedido, em caracteres.
export function tamanhoDe(mensagens: MensagemIA[]): number {
  let total = 0;
  for (const m of mensagens) {
    if (typeof m.content === 'string') total += m.content.length;
    else for (const p of m.content) total += p.type === 'text' ? p.text.length : CUSTO_IMAGEM;
  }
  return total;
}

export function selecionarHistorico(historico: MensagemHistorico[], { limite = LIMITE_HISTORICO, resumo = '' } = {}): { mensagens: MensagemIA[]; cortadas: number; nota: string } {
  if (!historico.length) return { mensagens: [], cortadas: 0, nota: '' };
  const atual = paraApi(historico.at(-1)!);
  const anteriores: MensagemIA[] = [];
  let usado = 0, i = historico.length - 2;
  for (; i >= 0; i--) {
    const m = leve(historico[i]!);
    const custo = tamanhoDe([m]);
    if (usado + custo > limite && anteriores.length >= 2) break;
    usado += custo;
    anteriores.unshift(m);
  }
  // alguns provedores exigem que a conversa comece com a pessoa
  while (anteriores[0]?.role === 'assistant') { anteriores.shift(); i++; }
  const cortadas = Math.max(0, i + 1);
  let nota = '';
  if (cortadas > 0) {
    nota = resumo
      ? `Resumo do começo desta conversa (você participou dela; não repita o que já foi dito):\n${resumo}`
      : `Começo desta conversa (você participou dela). A pessoa já pediu:\n${historico.slice(0, cortadas).filter((m) => m.role === 'user').slice(-8).map((m) => `- ${m.content.replace(/\s+/g, ' ').slice(0, 200)}`).join('\n')}`;
  }
  return { mensagens: [...anteriores, atual], cortadas, nota };
}

// Especialistas internos recebem só o necessário: as últimas mensagens, em texto (sem as imagens).
export function textoRecente(mensagens: MensagemIA[], quantas = 4, porMensagem = 3000): string {
  const paraTexto = (c: MensagemIA['content']) => (typeof c === 'string' ? c : c.map((p) => (p.type === 'text' ? p.text : '[imagem]')).join('\n'));
  return mensagens.filter((m) => m.role !== 'system').slice(-quantas)
    .map((m) => `${m.role === 'user' ? 'Pessoa' : 'Gyde'}: ${paraTexto(m.content).slice(0, porMensagem)}`).join('\n\n');
}
