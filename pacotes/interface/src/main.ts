// Casca do Gyde: login, rotas, barra lateral e montagem das telas. Cada tela vive no seu módulo (chat/, forja/,
// config/); aqui só se liga uma coisa na outra.
import { mount } from 'svelte';
import * as C from '$contratos';
import { pedir, enviar as api, corpo } from './api.ts';
import { toast, copiarTexto } from './util.ts';
import { renderMarkdown } from './markdown.ts';
import { tocarAbertura, aberturaJaVista } from './abertura.ts';
import { mostrarLogin, mostrarQuestionario, esconderEntrada } from './entrada.ts';
import { createSkillsPage } from './skills.svelte.ts';
import { createAgentePage } from './agente.ts';
import { aplicarTema, definirTema, temaAtual } from './tema.ts';
import { vigiarErros } from './diagnostico.ts';
import { desktop } from './desktop.ts';

vigiarErros(); // guarda os erros desta tela para o relatório de erro (Configurações > Geral)
import { montarConfiguracoes } from './config.ts';
import { atualizarUso } from './config/uso.svelte.ts';
import { chat, abrirConversa, novaConversa, carregarConversas, carregarModelos, restaurarModeloPadrao } from './chat/estado.svelte.ts';
import ListaConversas from './chat/ListaConversas.svelte';
import Mensagens from './chat/Mensagens.svelte';
import Compositor from './chat/Compositor.svelte';
import SeletorModelo from './chat/SeletorModelo.svelte';

interface Usuario { name: string; email: string; onboarded: boolean; profile?: { levelLabel?: string } }
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const app = $('.app'), banner = $('#banner');
// aberto pelo atalho antigo "Instalar como app" do navegador (ver o fim deste arquivo)
const APP_ANTIGO = !desktop && matchMedia('(display-mode: standalone)').matches;
let usuario: Usuario | null = null;
let inicioAplicado = false;

mount(SeletorModelo, { target: $('#topoChatRaiz') });
mount(Mensagens, { target: $('#threadRaiz') });
mount(Compositor, { target: $('#composerRaiz') });
mount(ListaConversas, { target: $('#convList') });

// ---------- telas ----------
const skills = createSkillsPage({ root: $('#skillsView'), renderMarkdown });
const forja = createAgentePage({ root: $('#agenteView'), toast, renderMarkdown });

// ---------- rotas ----------
async function rota() {
  app.classList.remove('sidebar-open');
  const h = location.hash;
  const s = h.match(/^#\/skills(?:\/([\w-]+))?/), a = h.match(/^#\/agente(?:\/([\w-]+))?/);
  const secao = s ? 'skills' : a ? 'agente' : 'chat';
  $('.main').dataset.page = secao;
  document.querySelectorAll<HTMLElement>('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.nav === secao));
  if (a) { document.title = 'Forja · Gyde'; return forja.show(a[1]); }
  if (s) { document.title = 'Skills · Gyde'; return skills.show(s[1]); }
  const c = h.match(/^#\/c\/([\w-]+)/);
  if (c) { if (c[1] !== chat.convId) await abrirConversa(c[1]!); }
  else { novaConversa(); $('#input')?.focus(); }
}
addEventListener('hashchange', rota);

const nova = () => { if (location.hash === '#/' || !location.hash) { novaConversa(); $('#input')?.focus(); } else location.hash = '#/'; };
$('#newChat').addEventListener('click', nova);
document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); nova(); } });
let esperaBusca: ReturnType<typeof setTimeout>;
$<HTMLInputElement>('#search').addEventListener('input', (e) => {
  chat.busca = (e.currentTarget as HTMLInputElement).value;
  clearTimeout(esperaBusca); esperaBusca = setTimeout(carregarConversas, 200);
});
$('#openSidebar').addEventListener('click', () => app.classList.add('sidebar-open'));
$('#closeSidebar').addEventListener('click', () => app.classList.remove('sidebar-open'));
$('#scrim').addEventListener('click', () => app.classList.remove('sidebar-open'));

// ---------- tema e configurações ----------
$('#toggleTheme').addEventListener('click', () => definirTema(temaAtual() === 'dark' ? 'light' : 'dark'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicarTema);
const config = montarConfiguracoes({
  toast, copiar: copiarTexto,
  verAbertura: () => { tocarAbertura(); },
  refazerQuiz: () => { mostrarQuestionario({ nome: usuario?.name ?? '', onfim: () => iniciar() }); },
  restaurarModelo: restaurarModeloPadrao,
  recarregarConversas: carregarConversas,
});
$('#openSettings').addEventListener('click', () => config.abrir());

// ---------- conta ----------
function mostrarUsuario(u: Usuario) {
  $('#userAvatar').textContent = (u.name.trim()[0] || '?').toUpperCase();
  $('#userName').textContent = u.name;
  $('#userLevel').textContent = u.profile?.levelLabel ? `Nível: ${u.profile.levelLabel}` : u.email;
  chat.nome = u.name.trim().split(/\s+/)[0] ?? '';
}
$('#logoutBtn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.hash = '#/';
  location.reload();
});

// ---------- início ----------
function aviso(texto: string, html = false) { if (html) banner.innerHTML = texto; else banner.textContent = texto; banner.hidden = false; }
async function conferirStatus() {
  try {
    const s = await pedir('/api/status', C.Status);
    chat.imagensAtivas = s.imagesEnabled;
    atualizarUso();
    // código novo no disco, servidor antigo na memória: telas e servidor não combinam
    if (s.desatualizado) { aviso('O Gyde foi atualizado, mas o servidor ainda está rodando a versão anterior. Feche o Gyde e abra de novo para terminar a atualização.'); return true; }
    if (s.keyConfigured && !s.routerOnline && s.iaAtiva === 'offline') { aviso('Sem conexão com a IA online: usando o modelo local (offline). Ele é mais simples e mais lento.'); return true; }
    if (!s.keyConfigured) {
      aviso('A IA ainda não está conectada. É grátis e leva uns 2 minutos: <button type="button" class="link" id="bannerConfigIa">Conectar IA</button>.', true);
      $('#bannerConfigIa')?.addEventListener('click', () => config.abrir('conectar'));
    }
    else if (!s.routerOnline) aviso('A IA online não está respondendo. Se você usa o FreeLLMAPI, abra o app dele (ícone na bandeja) e recarregue a página.');
    else { if (!APP_ANTIGO) banner.hidden = true; return true; }
  } catch { aviso('Não consegui falar com o servidor do Gyde.'); }
  return false;
}

// ---------- "Pedir à Forja" vindo do VS Code ----------
// A extensão só deixa um rascunho guardado (pasta + pedido). Aqui ele aparece num cartão: "Abrir na Forja" abre a Forja
// daquela pasta com o pedido escrito, e quem envia é a pessoa (botão Enviar). "Descartar" apaga o rascunho.
let rascunhoVisto = 0;
async function conferirRascunho() {
  if (!usuario || document.hidden || document.querySelector('.rascunho-forja')) return;
  let r: C.TRascunhoForja['rascunho'];
  try { r = (await pedir('/api/forja/rascunho', C.RascunhoForja)).rascunho; } catch { return; }
  if (!r || r.em === rascunhoVisto || document.querySelector('.rascunho-forja')) return;
  rascunhoVisto = r.em;
  const caixa = document.createElement('div');
  caixa.className = 'rascunho-forja';
  caixa.setAttribute('role', 'dialog');
  caixa.setAttribute('aria-labelledby', 'rascunhoTitulo');
  caixa.innerHTML = `<h2 id="rascunhoTitulo"></h2><p class="rascunho-pasta"></p><pre class="rascunho-pedido"></pre>
    <p class="rascunho-nota">Nada roda sozinho: a Forja abre com o pedido escrito e você confere antes de enviar.</p>
    <div class="rascunho-acoes"><button type="button" class="btn ghost" data-a="descartar">Descartar</button><button type="button" class="btn primary" data-a="abrir">Abrir na Forja</button></div>`;
  caixa.querySelector('h2')!.textContent = `O ${r.origem} pediu à Forja`;
  caixa.querySelector('.rascunho-pasta')!.textContent = `Pasta: ${r.pasta}`;
  caixa.querySelector('.rascunho-pedido')!.textContent = r.pedido;
  const fechar = () => caixa.remove();
  const rasc = r;
  caixa.querySelector<HTMLButtonElement>('[data-a="descartar"]')!.onclick = async () => { await api('/api/forja/rascunho', { method: 'DELETE' }).catch(() => {}); fechar(); };
  caixa.querySelector<HTMLButtonElement>('[data-a="abrir"]')!.onclick = async (e) => {
    if (forja.ocupado()) { toast('A Forja está trabalhando. Espere ela terminar e clique de novo.'); return; }
    (e.currentTarget as HTMLButtonElement).disabled = true;
    try {
      const mesma = (await pedir('/api/codigo/sessoes', C.ListaSessoes)).sessoes.find((s) => s.pasta.toLowerCase() === rasc.pasta.toLowerCase());
      const id = mesma?.id ?? (await api<{ id: string }>('/api/codigo/sessoes', corpo({ pasta: rasc.pasta }))).id;
      (globalThis as { __forjaRascunho?: string | null }).__forjaRascunho = rasc.pedido; // a Forja escreve no campo, sem enviar
      await api('/api/forja/rascunho', { method: 'DELETE' }).catch(() => {});
      fechar();
      if (location.hash === `#/agente/${id}`) await rota(); else location.hash = `#/agente/${id}`;
    } catch (erro) { toast(erro instanceof Error ? erro.message : String(erro)); (e.currentTarget as HTMLButtonElement | null)?.removeAttribute('disabled'); }
  };
  document.body.append(caixa);
  caixa.querySelector<HTMLButtonElement>('[data-a="abrir"]')!.focus();
}
addEventListener('focus', () => { conferirRascunho(); });
document.addEventListener('visibilitychange', () => { conferirRascunho(); });
setInterval(() => { conferirRascunho(); }, 4000); // pedido local e leve; só olha com a janela visível

// ex.: chave salva nas Configurações: confere de novo e, se o FreeLLMAPI responder, recarrega a lista de modelos
addEventListener('gyde:status', () => { conferirStatus().then((ok) => { if (ok) carregarModelos(); }); });

// login -> quiz (só na primeira vez) -> app
async function iniciar() {
  let me: { user: Usuario | null; mode?: string; emailMode?: string };
  try { me = await fetch('/api/auth/me').then((r) => r.json()); } catch { aviso('Não consegui falar com o servidor do Gyde.'); return; }
  if (!me.user) return mostrarLogin({ modo: me.mode, modoEmail: me.emailMode, onentrar: () => iniciar() });
  if (!me.user.onboarded) return mostrarQuestionario({ nome: me.user.name, onfim: () => iniciar() });
  esconderEntrada();
  usuario = me.user;
  mostrarUsuario(me.user);
  // status e modelos rodam em paralelo: conferir o FreeLLMAPI e o Ollama pode levar uns 2 s quando um deles está
  // fechado (no Windows, conectar numa porta fechada demora), e a tela não precisa esperar por isso
  conferirStatus().then((ok) => { if (ok) carregarModelos(); });
  await carregarConversas();
  if (!inicioAplicado) { // página inicial escolhida em Configurações (só ao entrar, sem atropelar um link)
    inicioAplicado = true;
    if (!location.hash || location.hash === '#/') {
      const pref = await pedir('/api/settings', C.Preferencias).then((p) => p.pagina_inicial).catch(() => 'chat');
      if (pref !== 'chat') history.replaceState(null, '', `#/${pref}`);
    }
  }
  chat.convId = null; // força a rota a recarregar a conversa atual
  skills.refresh();
  await rota();
  conferirRascunho();
}

// o vídeo de abertura toca só na primeira vez; a tela real é montada por trás dele, perto do fim
aplicarTema();
(async () => {
  let comecou = false;
  const comecar = () => { if (!comecou) { comecou = true; iniciar(); } };
  if (!aberturaJaVista()) await tocarAbertura({ preparar: comecar });
  comecar();
})();

// ---------- app antigo do navegador ----------
// Versões antigas ofereciam "Instalar o Gyde como app" pelo navegador: um atalho que só abre 127.0.0.1:3210 e depende
// de o servidor já estar rodando. O jeito certo agora é o app de desktop. Aqui o service worker antigo é desligado
// (o cache dele podia servir telas velhas) e quem abriu por aquele atalho recebe um aviso de como trocar.
navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
if (APP_ANTIGO) {
  aviso('Você abriu o Gyde pelo atalho antigo do navegador, que só funciona com o servidor aberto. Instale o app Gyde para Windows (página <b>Releases</b> do GitHub do Gyde) e depois remova este atalho em <b>edge://apps</b>.', true);
}
