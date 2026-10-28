// Estado do chat do Gyde: conversas, mensagens, a resposta em andamento (streaming), anexos e modelos.
// Os componentes (ListaConversas, Mensagens, Compositor, SeletorModelo) só leem este estado e chamam as ações daqui.
import * as C from '$contratos';
import type { TMensagem, TResumoConversa } from '$contratos';
import { pedir, enviar as enviarApi, corpo, mensagemDe } from '../api.ts';
import { toast } from '../util.ts';
import { registrarUltima, atualizarUso, uso, nomeModelo, numero, type Consumo } from '../config/uso.svelte.ts';
import { projectFromFolder, projectFromZip } from '../projeto.ts';
import { lerEventos } from './sse.ts';

export const MODELO_PADRAO = 'gyde-1';
const LADO_MAX_IMAGEM = 1600;
const MAX_ARQUIVO = 25 * 1024 * 1024;

export type Anexo = { kind: 'image' | 'file'; name: string; dataUrl?: string; text?: string };
export type Pendente = Anexo & { carregando: boolean; sub?: string };
export interface SkillAtiva { id: string; nome: string; simbolo: string }
export interface SkillInstalada { comando: string; nome: string; descricao: string; simbolo: string }
type Opcao = { id: string; label: string; hint: string };
type Modo = 'new' | 'regenerate' | 'edit' | 'retry';
interface Envio { mode: Modo; messageId?: string; content?: string; attachments?: Anexo[]; model: string; kind: 'chat' | 'image' }

export const chat = $state({
  nome: '', // primeiro nome de quem está usando (saudação)
  convId: null as string | null,
  titulo: '',
  modeloConversa: null as string | null,
  mensagens: [] as TMensagem[],
  // extras que só existem nesta sessão: modelo real e tokens da resposta que acabou de chegar
  metaExtra: {} as Record<string, string>,
  metaSkills: {} as Record<string, SkillAtiva[]>, // skills que guiaram cada resposta (selo acima dela)
  conversas: [] as TResumoConversa[],
  busca: '',
  listaCarregada: false,
  pendentes: [] as Pendente[],
  texto: '',
  transmitindo: false,
  temporaria: null as { content: string; attachments: Anexo[] } | null, // pergunta enviada, ainda não confirmada
  resposta: null as null | { texto: string; status: string; skills: SkillAtiva[]; erro: string | null; envio: Envio | null },
  marcas: [{ id: MODELO_PADRAO, label: 'Gyde 1', hint: '' }] as Opcao[],
  modelos: [] as Opcao[],
  modelo: MODELO_PADRAO,
  modoImagem: false,
  imagensAtivas: false,
  skills: [] as SkillInstalada[],
  rolar: 0, // incrementa para pedir "descer até o fim" (forçado)
});

let controle: AbortController | null = null;
const salvo = () => { try { return (localStorage.getItem('model') || MODELO_PADRAO).replace(/^bugo-/, 'gyde-'); } catch { return MODELO_PADRAO; } };
export const rotuloModelo = (id: string | null | undefined) => [...chat.marcas, ...chat.modelos].find((m) => m.id === id)?.label ?? (id === 'auto' ? 'Automático' : id ?? '');

// ---------- conversas ----------
export async function carregarConversas() {
  try {
    const termo = chat.busca.trim();
    chat.conversas = (await pedir(`/api/conversations${termo ? `?q=${encodeURIComponent(termo)}` : ''}`, C.ListaConversas)).conversations;
  } catch (e) { toast(mensagemDe(e)); }
  chat.listaCarregada = true;
}

// cada abertura ganha um número; uma resposta que chega depois de outra abertura (ou de "Nova conversa") é ignorada,
// senão a conversa antiga voltaria para a tela por cima da nova
let ultimaAbertura = 0;
export async function abrirConversa(id: string, { manterRolagem = false } = {}) {
  const esta = ++ultimaAbertura;
  try {
    const c = await pedir(`/api/conversations/${id}`, C.Conversa);
    if (esta !== ultimaAbertura) return;
    chat.convId = c.id; chat.titulo = c.title === 'Nova conversa' ? '' : c.title; chat.modeloConversa = c.model;
    chat.mensagens = c.messages ?? []; chat.resposta = null; chat.temporaria = null;
    chat.modelo = c.model.replace(/^bugo-/, 'gyde-');
    document.title = c.title === 'Nova conversa' ? 'Gyde' : `${c.title} · Gyde`;
    if (!manterRolagem) chat.rolar++;
  } catch {
    if (esta !== ultimaAbertura) return;
    toast('Conversa não encontrada');
    location.hash = '#/';
  }
}

export function novaConversa() {
  ultimaAbertura++;
  controle?.abort();
  Object.assign(chat, { convId: null, titulo: '', modeloConversa: null, mensagens: [], resposta: null, temporaria: null });
  chat.modelo = salvo();
  try { localStorage.setItem('model', chat.modelo); } catch { /* sem storage */ }
  document.title = 'Gyde';
}

export async function definirModelo(id: string) {
  chat.modelo = id;
  try { localStorage.setItem('model', id); } catch { /* sem storage */ }
  if (chat.convId) await enviarApi(`/api/conversations/${chat.convId}`, { method: 'PATCH', body: JSON.stringify({ model: id }) }).catch(() => {});
}
export function restaurarModeloPadrao() { try { localStorage.removeItem('model'); } catch { /* sem storage */ } chat.modelo = MODELO_PADRAO; }

export async function carregarModelos() {
  try { const r = await pedir('/api/models', C.Modelos); chat.marcas = r.brand; chat.modelos = r.models; } catch { /* fica só com o Gyde 1 */ }
}

export async function renomear(id: string, titulo: string) {
  await enviarApi(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title: titulo }) }).catch((e) => toast(mensagemDe(e)));
  if (id === chat.convId) chat.titulo = titulo;
  carregarConversas();
}
export async function fixar(c: TResumoConversa) {
  try { await enviarApi(`/api/conversations/${c.id}`, { method: 'PATCH', body: JSON.stringify({ pinned: !c.pinned }) }); carregarConversas(); } catch (e) { toast(mensagemDe(e)); }
}
export async function excluir(c: TResumoConversa) {
  if (!confirm(`Excluir a conversa "${c.title}"? Isso não pode ser desfeito.`)) return;
  try { await enviarApi(`/api/conversations/${c.id}`, { method: 'DELETE' }); if (c.id === chat.convId) location.hash = '#/'; carregarConversas(); } catch (e) { toast(mensagemDe(e)); }
}
export async function exportar(id: string) {
  const c = await pedir(`/api/conversations/${id}`, C.Conversa);
  const linhas = [`# ${c.title}`, ''];
  for (const m of c.messages ?? []) linhas.push(m.role === 'user' ? '## Você' : `## Gyde${m.model ? ` (${m.model})` : ''}`, '', m.content, '');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([linhas.join('\n')], { type: 'text/markdown' })), download: `${c.title.replace(/[\\/:*?"<>|]/g, '')}.md` });
  a.click(); URL.revokeObjectURL(a.href);
}

// ---------- anexos ----------
function reduzirImagem(arquivo: File) {
  return new Promise<string>((ok, falha) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, LADO_MAX_IMAGEM / Math.max(img.width, img.height));
      const tela = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * escala), height: Math.round(img.height * escala) });
      tela.getContext('2d')!.drawImage(img, 0, 0, tela.width, tela.height);
      URL.revokeObjectURL(img.src);
      ok(tela.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => falha(new Error(`Não consegui abrir a imagem ${arquivo.name}.`));
    img.src = URL.createObjectURL(arquivo);
  });
}

// projeto inteiro (pasta ou .zip) vira um anexo só, com a árvore e os arquivos de código
export async function adicionarProjeto(rotulo: string, montar: () => Promise<{ text: string; sub?: string }>) {
  const item: Pendente = { name: rotulo, kind: 'file', carregando: true };
  chat.pendentes.push(item);
  const i = chat.pendentes.length - 1;
  try {
    Object.assign(chat.pendentes[i]!, await montar(), { carregando: false });
    if (!chat.texto.trim()) chat.texto = '/revisar Revise este projeto: entenda a estrutura, aponte bugs e más práticas em ordem de importância e me diga o que melhorar primeiro.';
  } catch (e) {
    chat.pendentes.splice(chat.pendentes.indexOf(chat.pendentes[i]!), 1);
    toast(`Não consegui ler o projeto: ${mensagemDe(e)}`);
  }
}
export const adicionarPasta = (arquivos: FileList) => { if (arquivos.length) adicionarProjeto((arquivos[0] as File & { webkitRelativePath: string }).webkitRelativePath.split('/')[0]!, () => projectFromFolder(arquivos)); };
export const adicionarZip = (arquivo: File) => adicionarProjeto(arquivo.name, () => projectFromZip(arquivo));

export async function adicionarArquivos(arquivos: File[]) {
  for (const arquivo of arquivos) {
    if (arquivo.size > MAX_ARQUIVO) { toast(`${arquivo.name} passa de 25 MB`); continue; }
    if (/\.zip$/i.test(arquivo.name)) { await adicionarZip(arquivo); continue; }
    chat.pendentes.push({ name: arquivo.name, carregando: true, kind: arquivo.type.startsWith('image/') ? 'image' : 'file' });
    const item = chat.pendentes[chat.pendentes.length - 1]!;
    try {
      if (item.kind === 'image') item.dataUrl = await reduzirImagem(arquivo);
      else if (arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name)) {
        const r = await enviarApi<{ text: string; pages: number }>('/api/extract', { method: 'POST', body: arquivo });
        if (!r.text) throw new Error(`O PDF ${arquivo.name} não tem texto selecionável.`);
        item.text = r.text; item.sub = `PDF · ${r.pages} pág.`;
      } else { item.text = await arquivo.text(); item.sub = 'Texto'; }
      item.carregando = false;
    } catch (e) {
      chat.pendentes.splice(chat.pendentes.indexOf(item), 1);
      toast(mensagemDe(e));
    }
  }
}

// ---------- enviar e receber a resposta em streaming ----------
export const podeEnviar = () => chat.transmitindo || Boolean(chat.texto.trim()) || chat.pendentes.some((a) => !a.carregando);
export function parar() { controle?.abort(); }

export async function enviar({ mode = 'new', messageId, content, attachments }: { mode?: Modo; messageId?: string; content?: string; attachments?: Anexo[] } = {}) {
  if (chat.transmitindo) return;
  if (!chat.convId) {
    try {
      const c = await pedir('/api/conversations', C.Conversa, corpo({ model: chat.modelo }));
      chat.convId = c.id; chat.modeloConversa = c.model;
      history.replaceState(null, '', `#/c/${c.id}`);
    } catch (e) { toast(mensagemDe(e)); return; }
  }
  if (mode === 'new' && content === undefined) {
    content = chat.texto;
    attachments = chat.pendentes.filter((a) => !a.carregando).map(({ kind, name, dataUrl, text }) => ({ kind, name, dataUrl, text }));
    if (!content.trim() && !attachments.length) return;
    chat.texto = ''; chat.pendentes = [];
  }
  // tira do estado local o que o servidor também vai apagar
  if (mode === 'regenerate' || mode === 'edit') {
    const i = chat.mensagens.findIndex((m) => m.id === messageId);
    if (i !== -1) chat.mensagens = chat.mensagens.slice(0, i);
  }
  const envio: Envio = { mode, messageId, content, attachments, model: chat.modelo, kind: mode === 'new' && chat.modoImagem ? 'image' : 'chat' };
  if (envio.kind === 'image') chat.modoImagem = false;
  controle = new AbortController();
  chat.transmitindo = true;
  chat.temporaria = mode === 'new' || mode === 'edit' ? { content: content ?? '', attachments: attachments ?? [] } : null;
  chat.resposta = { texto: '', status: '', skills: [], erro: null, envio };
  chat.rolar++;

  // o texto chega em pedaços: junta e desenha no máximo uma vez por quadro
  let acumulado = '', quadro = 0;
  const desenhar = () => { quadro = 0; if (chat.resposta) chat.resposta.texto = acumulado; };
  try {
    const res = await fetch(`/api/conversations/${chat.convId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gyde': '1' }, body: JSON.stringify(envio), signal: controle.signal });
    if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || `Erro ${res.status}`);
    const leitor = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      const lidos = lerEventos(buffer + value);
      buffer = lidos.resto;
      for (const ev of lidos.eventos) {
        if (ev.type === 'user') { chat.mensagens.push(C.Mensagem.parse(ev.message)); chat.temporaria = null; }
        else if (ev.type === 'skills' && chat.resposta) chat.resposta.skills = ev.skills as SkillAtiva[];
        else if (ev.type === 'status' && chat.resposta) chat.resposta.status = String(ev.text);
        else if (ev.type === 'delta') { acumulado += String(ev.text); if (!quadro) quadro = requestAnimationFrame(desenhar); }
        else if (ev.type === 'done') {
          cancelAnimationFrame(quadro);
          const m = C.Mensagem.parse(ev.message);
          const consumo = ev.consumo as Consumo | undefined;
          if (consumo) { // modelo que respondeu de verdade e tokens, como o provedor informou
            registrarUltima(consumo);
            const partes = [nomeModelo(consumo.modelo), consumo.tokens?.total != null ? `${numero(consumo.tokens.total)} tokens` : '', consumo.provedor === 'offline' ? 'modelo local, sem internet' : ''].filter(Boolean);
            if (partes.length) chat.metaExtra[m.id] = partes.join(' · ');
            // troca automática para o modelo local muda a qualidade: avisa em vez de trocar em silêncio
            if (consumo.provedor === 'offline' && uso.dados?.modo === 'auto') toast('O FreeLLMAPI não respondeu: esta resposta veio do modelo local, que é mais simples.');
            atualizarUso();
          }
          if (chat.resposta?.skills.length) chat.metaSkills[m.id] = chat.resposta.skills;
          chat.mensagens.push(m);
          chat.resposta = null;
        } else if (ev.type === 'title') {
          chat.titulo = String(ev.title); document.title = `${ev.title} · Gyde`;
          carregarConversas();
        } else if (ev.type === 'error') throw new Error(String(ev.error));
      }
    }
  } catch (e) {
    cancelAnimationFrame(quadro);
    if (e instanceof DOMException && e.name === 'AbortError') {
      // parado pelo usuário: o servidor salva o que já chegou; recarrega para ficar em sincronia
      chat.transmitindo = false; controle = null;
      await abrirConversa(chat.convId!, { manterRolagem: true });
    } else if (chat.resposta) {
      chat.resposta.erro = mensagemDe(e); chat.rolar++;
    }
  } finally {
    controle = null;
    chat.transmitindo = false;
    carregarConversas();
  }
}

// "Tentar de novo" depois de um erro: se a pergunta já foi salva, pede só uma resposta nova; senão, reenvia tudo
export function tentarDeNovo() {
  const envio = chat.resposta?.envio;
  chat.resposta = null;
  if (chat.mensagens.at(-1)?.role === 'user') enviar({ mode: 'retry' });
  else if (envio) { chat.temporaria = null; enviar({ mode: envio.mode, messageId: envio.messageId, content: envio.content, attachments: envio.attachments }); }
}
