// Casca do Gyde: login, rotas, barra lateral e montagem das telas. Cada tela vive no seu módulo (chat/, forja/,
// pratica/, config/); aqui só se liga uma coisa na outra.
import { mount } from 'svelte';
import * as C from '$contratos';
import { pedir, enviar as api } from './api.ts';
import { toast, copiarTexto } from './util.ts';
import { renderMarkdown } from './markdown.ts';
import { tocarAbertura, aberturaJaVista } from './abertura.ts';
import { mostrarLogin, mostrarQuestionario, esconderEntrada } from './entrada.ts';
import { createPractice } from './pratica.svelte.ts';
import { createSkillsPage } from './skills.svelte.ts';
import { createTurmasPage } from './turmas.svelte.ts';
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
const pratica = createPractice({
  root: $('#praticaView'), toast, renderMarkdown,
  onXp: (xp: number) => { $('#xpBadge').textContent = xp ? `${xp} XP` : ''; },
});
const skills = createSkillsPage({ root: $('#skillsView'), renderMarkdown });
const forja = createAgentePage({ root: $('#agenteView'), toast, renderMarkdown });
const turmas = createTurmasPage({ root: $('#turmasView') });

// ---------- rotas ----------
async function rota() {
  app.classList.remove('sidebar-open');
  const h = location.hash;
  const p = h.match(/^#\/pratica(?:\/([\w-]+))?(?:\/([\w-]+))?/), s = h.match(/^#\/skills(?:\/([\w-]+))?/);
  const t = h.match(/^#\/turmas(?:\/([\w-]+))?/), a = h.match(/^#\/agente(?:\/([\w-]+))?/);
  const secao = p ? 'pratica' : s ? 'skills' : t ? 'turmas' : a ? 'agente' : 'chat';
  $('.main').dataset.page = secao;
  document.querySelectorAll<HTMLElement>('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.nav === secao));
  if (a) { document.title = 'Forja · Gyde'; return forja.show(a[1]); }
  if (t) { document.title = 'Turmas · Gyde'; return turmas.show(t[1]); }
  if (p) { document.title = 'Prática · Gyde'; return pratica.show([p[1], p[2]].filter((x): x is string => Boolean(x))); }
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
    if (s.keyConfigured && !s.routerOnline && s.iaAtiva === 'offline') { aviso('Sem conexão com o FreeLLMAPI: usando o modelo local (offline). Ele é mais simples e mais lento.'); return true; }
    if (!s.keyConfigured) {
      aviso('A chave do FreeLLMAPI ainda não foi configurada. No ícone do FreeLLMAPI, clique em <b>Copy Key</b> e cole em <button type="button" class="link" id="bannerConfigIa">Configurações &gt; IA e modelos</button>.', true);
      $('#bannerConfigIa')?.addEventListener('click', () => config.abrir('ia'));
    }
    else if (!s.routerOnline) aviso('O FreeLLMAPI não está respondendo. Abra o app FreeLLMAPI (ícone na bandeja) e recarregue a página.');
    else { if (!APP_ANTIGO) banner.hidden = true; return true; }
  } catch { aviso('Não consegui falar com o servidor do Gyde.'); }
  return false;
}

addEventListener('gyde:status', () => { conferirStatus(); }); // ex.: chave salva nas Configurações

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
  pratica.refreshXp();
  skills.refresh();
  await rota();
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
