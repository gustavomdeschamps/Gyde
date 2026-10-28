// Painel de conversa do Gyde dentro do VS Code (webview). Quem fala com o servidor é o extension.js.
import { marked } from './marked.esm.js';
import DOMPurify from './purify.es.mjs';

const vscode = acquireVsCodeApi();
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (t) => DOMPurify.sanitize(marked.parse(t || '', { gfm: true }));

let userName = '';
let current = null; // resposta sendo escrita

// logo do Gyde (mesmo desenho do logo.svg do site)
const logo = (cls = 'logo') => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="gbg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#gbg)"/><path d="M15 50C15 38 31 42 31 31S47 24 46 17" fill="none" stroke="#dbeafe" stroke-width="5" stroke-linecap="round"/><circle cx="15" cy="50" r="4.5" fill="#93c5fd"/><circle cx="15" cy="50" r="1.8" fill="#1e3a8a"/><path d="M46 6Q47.3 14.2 54 15.5Q47.3 16.8 46 25Q44.7 16.8 38 15.5Q44.7 14.2 46 6Z" fill="#fff"/></svg>`;
const quem = `<div class="quem">${logo()}Gyde</div>`;
const ic = {
  explicar: '<svg viewBox="0 0 24 24"><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 18h.01"/><circle cx="12" cy="12" r="9.5"/></svg>',
  revisar: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14l2 2 4-4"/></svg>',
  erro: '<svg viewBox="0 0 24 24"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/></svg>',
  exercicio: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/></svg>',
  nova: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
};

function renderConnect(error) {
  app.innerHTML = `<section class="connect">
    ${logo('logo big')}
    <h1>Conectar ao Gyde</h1>
    <p>Leva menos de um minuto, e só precisa fazer uma vez.</p>
    <ol class="steps">
      <li><span>Deixe o Gyde aberto no computador (o app do Gyde ou o <code>iniciar.bat</code>).</span></li>
      <li><span>No Gyde, abra <b>Configurações → Extensões → Gerar token</b> e copie.</span></li>
      <li><span>Clique no botão abaixo e cole o token.</span></li>
    </ol>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}
    <button class="btn primary" id="connect">Colar token</button>
  </section>`;
  document.getElementById('connect').onclick = () => vscode.postMessage({ type: 'connect' });
}

function renderChat() {
  app.innerHTML = `<main class="chat">
    <header class="topo">${logo()}<b>Gyde</b><span class="status">conectado</span>
      <button class="icon-btn" id="nova" title="Nova conversa" aria-label="Nova conversa">${ic.nova}</button></header>
    <div class="messages" id="messages">${hello()}</div>
    <form class="composer" id="composer">
      <div class="caixa">
        <textarea id="input" rows="1" placeholder="Pergunte ao Gyde ou cole um erro"></textarea>
        <button class="send" id="send" aria-label="Enviar" disabled><svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>
      </div>
      <p class="dica"><kbd>Enter</kbd> envia · <kbd>Shift</kbd>+<kbd>Enter</kbd> pula linha</p>
    </form>
  </main>`;
  const input = document.getElementById('input'), send = document.getElementById('send');
  const atualizar = () => { send.disabled = !current && !input.value.trim(); };
  document.getElementById('composer').onsubmit = (e) => { e.preventDefault(); submit(); atualizar(); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); atualizar(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 160)}px`; atualizar(); });
  send.onclick = (e) => {
    if (current) { e.preventDefault(); vscode.postMessage({ type: 'stop' }); }
  };
  document.getElementById('nova').onclick = () => vscode.postMessage({ type: 'cmd', id: 'gyde.novaConversa' });
  bindHello();
}

function hello() {
  const card = (attr, icone, titulo, sub) => `<button class="card" ${attr}><span class="ic">${icone}</span><span><b>${titulo}</b><small>${sub}</small></span></button>`;
  return `<div class="hello" id="hello">
    ${logo('logo big')}
    <h2>Oi${userName ? `, ${esc(userName)}` : ''}! Bora programar?</h2>
    <p>Pergunte qualquer coisa ou use um atalho com o código que está aberto no editor.</p>
    <div class="cards">
      ${card('data-cmd="gyde.explicar"', ic.explicar, 'Explicar a seleção', 'Selecione um trecho no editor')}
      ${card('data-cmd="gyde.revisar"', ic.revisar, 'Revisar o arquivo', 'Dicas de melhoria e bugs')}
      ${card('data-cmd="gyde.explicarErro"', ic.erro, 'Explicar o erro da linha', 'O erro sublinhado no cursor')}
      ${card('data-q="Me passe um exercício de programação no meu nível, sem a resposta."', ic.exercicio, 'Me passa um exercício', 'No seu nível, sem a resposta')}
    </div>
    <p class="dica"><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>G</kbd> abre o chat ou explica a seleção</p>
  </div>`;
}
function bindHello() {
  document.querySelectorAll('[data-q]').forEach((b) => { b.onclick = () => vscode.postMessage({ type: 'send', text: b.dataset.q }); });
  document.querySelectorAll('[data-cmd]').forEach((b) => { b.onclick = () => vscode.postMessage({ type: 'cmd', id: b.dataset.cmd }); });
}

function submit() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text || current) return;
  input.value = '';
  input.style.height = 'auto';
  vscode.postMessage({ type: 'send', text });
}

function add(role, html) {
  document.getElementById('hello')?.remove();
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.innerHTML = html;
  const list = document.getElementById('messages');
  list.append(el);
  list.scrollTop = list.scrollHeight;
  return el;
}

const userHtml = (text, tags) => `<div class="bubble">${esc(text)}</div>${tags?.length ? `<div class="tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}`;

// Botões em cada bloco de código da resposta.
function decorate(root) {
  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.code-bar')) return;
    const el = pre.querySelector('code');
    const code = el?.innerText ?? pre.innerText;
    const lang = (el?.className.match(/language-([\w+#-]+)/) || [])[1] || 'código';
    const bar = document.createElement('div');
    bar.className = 'code-bar';
    bar.innerHTML = `<span>${esc(lang)}</span><button data-a="insert" title="Colocar no cursor do editor (substitui a seleção)">Inserir</button><button data-a="copy">Copiar</button>`;
    bar.querySelector('[data-a="insert"]').onclick = () => vscode.postMessage({ type: 'insert', code });
    bar.querySelector('[data-a="copy"]').onclick = () => vscode.postMessage({ type: 'copy', code });
    pre.prepend(bar);
  });
}

function setBusy(on) {
  const send = document.getElementById('send');
  if (!send) return;
  send.classList.toggle('stop', on);
  send.setAttribute('aria-label', on ? 'Parar' : 'Enviar');
  send.disabled = !on && !document.getElementById('input')?.value.trim();
}

window.addEventListener('message', ({ data: m }) => {
  if (m.type === 'state') {
    if (!m.connected) return renderConnect(m.error);
    userName = m.userName || '';
    if (!document.getElementById('messages')) renderChat();
  } else if (m.type === 'clear') {
    current = null;
    renderChat();
  } else if (m.type === 'history') {
    const list = document.getElementById('messages');
    if (!list || !m.messages.length) return;
    list.innerHTML = `<div class="history-note">Continuando: <b>${esc(m.title)}</b> · <a href="#" id="openWeb">abrir no Gyde</a></div>`;
    document.getElementById('openWeb').onclick = (e) => { e.preventDefault(); vscode.postMessage({ type: 'openWeb' }); };
    for (const x of m.messages) {
      if (x.role === 'user') add('user', userHtml(x.content, x.tags));
      else decorate(add('assistant', `${quem}<div class="md">${md(x.content)}</div>`));
    }
  } else if (m.type === 'user') {
    if (!document.getElementById('messages')) renderChat();
    add('user', userHtml(m.text, m.tags));
    current = add('assistant', `${quem}<div class="md"><div class="thinking"><i></i><i></i><i></i></div></div>`);
    setBusy(true);
  } else if (m.type === 'skills' && current) {
    current.querySelector('.quem').insertAdjacentHTML('afterend', `<div class="skills">${m.skills.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`);
  } else if (m.type === 'delta' && current) {
    const out = current.querySelector('.md');
    out.innerHTML = md(m.text);
    out.lastElementChild?.classList.add('cursor');
    const list = document.getElementById('messages');
    list.scrollTop = list.scrollHeight;
  } else if (m.type === 'done' && current) {
    const out = current.querySelector('.md');
    if (m.text) out.innerHTML = md(m.text);
    else out.querySelector('.cursor')?.classList.remove('cursor');
    if (m.stopped) out.insertAdjacentHTML('beforeend', '<p class="muted">Resposta interrompida.</p>');
    decorate(out);
    current = null;
    setBusy(false);
  } else if (m.type === 'error') {
    if (current) current.querySelector('.md').innerHTML = `<div class="error">${esc(m.message)}</div>`;
    current = null;
    setBusy(false);
  }
});

vscode.postMessage({ type: 'ready' });
