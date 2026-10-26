// Gyde para Chrome — painel lateral: conversa com o servidor do Gyde e envia contexto da aba
// (texto da página, seleção ou print da tela).
import { marked } from './vendor/marked.esm.js';
import DOMPurify from './vendor/purify.es.mjs';
import { createAgent } from './agente.js';

const $ = (s) => document.querySelector(s);
const MAX_PAGE_CHARS = 30_000;
const state = { server: '', token: '', convId: null, ctx: [], busy: false };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (t) => DOMPurify.sanitize(marked.parse(t, { gfm: true }));

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---------- Servidor ----------
async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(state.server + path, {
      ...options,
      headers: { Authorization: `Bearer ${state.token}`, 'x-gyde': '1', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
  } catch {
    throw new Error('Não consegui falar com o Gyde. Ele está aberto (iniciar.bat)?');
  }
  if (res.status === 401) throw Object.assign(new Error('Token inválido ou revogado. Gere outro em Personalizar.'), { auth: true });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return res;
}

// ---------- Configuração ----------
async function showSetup(message) {
  $('#chat').hidden = true;
  $('#setup').hidden = false;
  $('#server').value = state.server || 'http://127.0.0.1:3210';
  const err = $('#setupError');
  err.textContent = message || '';
  err.hidden = !message;
  $('#token').focus();
}

$('#connect').onclick = async () => {
  const server = $('#server').value.trim().replace(/\/+$/, '');
  const token = $('#token').value.trim();
  if (!/^gyde_[0-9a-f]{48}$/.test(token)) return showSetup('Esse não parece um token do Gyde (começa com gyde_).');
  if (!/^http:\/\/(127\.0\.0\.1|localhost):3210$/.test(server)) return showSetup('Por enquanto a extensão só conecta ao Gyde deste computador (http://127.0.0.1:3210).');
  state.server = server;
  state.token = token;
  $('#connect').disabled = true;
  try {
    await start();
    await chrome.storage.local.set({ server, token });
    $('#token').value = '';
  } catch (e) {
    showSetup(e.message);
  }
  $('#connect').disabled = false;
};
$('#openSettings').onclick = () => showSetup();

async function start() {
  const me = await (await api('/api/auth/me')).json();
  if (!me.user) throw Object.assign(new Error('Token inválido ou revogado.'), { auth: true });
  $('#userName').textContent = me.user.name.split(' ')[0];
  $('#setup').hidden = true;
  $('#chat').hidden = false;
  await restoreConversation();
  $('#input').focus();
  checkPending();
}

// Mostra de novo a última conversa do painel (ela fica salva no Gyde).
async function restoreConversation() {
  if (!state.convId) return;
  try {
    const conv = await (await api(`/api/conversations/${state.convId}`)).json();
    if (!conv.messages.length) return;
    $('#messages').innerHTML = `<div class="history-note">Continuando: <b>${esc(conv.title)}</b> · <a href="${state.server}/#/c/${conv.id}" target="_blank" rel="noopener">abrir no Gyde</a></div>`;
    for (const m of conv.messages) {
      if (m.role === 'user') {
        const tags = (m.attachments || []).map((a) => `<span class="tag">${esc(a.kind === 'image' ? 'Print da tela' : a.name)}</span>`).join('');
        addMessage('user', `${m.content ? `<div class="bubble">${esc(m.content)}</div>` : ''}${tags ? `<div class="tags">${tags}</div>` : ''}`);
      } else {
        addMessage('assistant', `<div class="md">${md(m.content)}</div>`);
      }
    }
  } catch {
    // Conversa apagada no site: começa uma nova.
    state.convId = null;
    await chrome.storage.local.remove('convId');
  }
}

// ---------- Contexto da aba ----------
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Ler páginas pede permissão uma vez (você pode revogar nas configurações da extensão).
// O pedido precisa ser a primeira coisa depois do clique; se já houver permissão, volta true na hora.
function ensurePageAccess() {
  return chrome.permissions.request({ origins: ['<all_urls>'] });
}

function readPageInTab() {
  const main = document.querySelector('main, article, [role="main"]') || document.body;
  const code = [...document.querySelectorAll('pre, code')].map((el) => el.innerText).filter((t) => t.length > 20).slice(0, 20);
  return { title: document.title, url: location.href, text: main.innerText, selection: String(getSelection()), code };
}

async function grab(kind, tabOverride) {
  if (!(await ensurePageAccess())) throw new Error('Sem permissão para ler a página.');
  const tab = tabOverride || (await activeTab());
  if (!tab || /^(chrome|edge|about|chrome-extension|devtools):/.test(tab.url || '')) {
    throw new Error('Não dá para ler esta aba (páginas internas do navegador são protegidas).');
  }
  if (kind === 'shot') {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 72 });
    return { kind: 'image', name: `Print: ${tab.title}`, dataUrl, label: 'Print da tela', thumb: dataUrl };
  }
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPageInTab });
  if (kind === 'selection') {
    if (!result.selection.trim()) throw new Error('Selecione um texto na página primeiro.');
    return { kind: 'file', name: `Trecho selecionado em ${result.title}`, text: result.selection, label: 'Seleção' };
  }
  let text = `Título: ${result.title}\nEndereço: ${result.url}\n\n${result.text}`;
  if (result.code.length) text += `\n\n--- Blocos de código encontrados ---\n${result.code.join('\n\n')}`;
  return { kind: 'file', name: `Página: ${result.title}`, text: text.slice(0, MAX_PAGE_CHARS), label: `Página: ${result.title}` };
}

function renderCtx() {
  $('#ctxChips').innerHTML = state.ctx.map((c, i) => `<span>${c.thumb ? `<img src="${c.thumb}" alt="">` : ''}<em>${esc(c.label)}</em><button type="button" data-rm="${i}" aria-label="Remover">×</button></span>`).join('');
}
$('#ctxChips').onclick = (e) => {
  const i = e.target.dataset?.rm;
  if (i === undefined) return;
  state.ctx.splice(Number(i), 1);
  renderCtx();
};

async function addCtx(kind, tab) {
  try {
    const item = await grab(kind, tab);
    state.ctx = state.ctx.filter((c) => c.label !== item.label);
    state.ctx.push(item);
    renderCtx();
    return true;
  } catch (e) {
    toast(e.message);
    return false;
  }
}

document.querySelectorAll('.ctx-buttons [data-ctx]').forEach((b) => { b.onclick = () => addCtx(b.dataset.ctx); });
document.querySelectorAll('.quick [data-quick]').forEach((b) => {
  b.onclick = async () => {
    if (!(await addCtx(b.dataset.ctx))) return;
    $('#input').value = b.dataset.quick;
    send();
  };
});

// ---------- Conversa ----------
function addMessage(role, html) {
  $('#hello')?.remove();
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.innerHTML = html;
  $('#messages').append(el);
  $('#messages').scrollTop = $('#messages').scrollHeight;
  return el;
}

// ---------- Modo agente ----------
const agent = createAgent({
  api, addMessage, esc, md, ensurePageAccess, activeTab,
  askEveryStep: () => $('#agentAsk').checked,
  onBusy(on) {
    $('#agentStop').hidden = !on;
    $('#agentToggle').disabled = on;
  },
});
let agentMode = false;
function setAgentMode(on) {
  agentMode = on;
  $('#agentToggle').setAttribute('aria-pressed', String(on));
  $('#agentBar').hidden = !on;
  document.querySelectorAll('.ctx-buttons [data-ctx]').forEach((b) => { b.disabled = on; });
  $('#input').placeholder = on ? 'Ex.: procure no MDN como usar fetch e abra o exemplo' : 'Pergunte ao Gyde…';
  $('#input').focus();
}
$('#agentToggle').onclick = () => setAgentMode(!agentMode);
chrome.storage.local.get('agentAsk').then(({ agentAsk }) => { $('#agentAsk').checked = Boolean(agentAsk); });
$('#agentAsk').onchange = (e) => chrome.storage.local.set({ agentAsk: e.target.checked });
$('#agentStop').onclick = () => agent.stop();

async function send() {
  const content = $('#input').value.trim();
  if (agentMode) {
    if (!content) return;
    if (agent.waiting) { $('#input').value = ''; agent.answer(content); return; }
    if (agent.running) return toast('O agente ainda está trabalhando. Clique em Parar para começar outra tarefa.');
    $('#input').value = '';
    agent.start(content); // pede a permissão de páginas logo de cara, ainda dentro do clique
    return;
  }
  if (state.busy || (!content && !state.ctx.length)) return;
  state.busy = true;
  $('#send').disabled = true;
  const attachments = state.ctx.map(({ kind, name, text, dataUrl }) => ({ kind, name, text, dataUrl }));
  const tags = state.ctx.map((c) => `<span class="tag">${esc(c.label)}</span>`).join('');
  addMessage('user', `${content ? `<div class="bubble">${esc(content)}</div>` : ''}${tags ? `<div class="tags">${tags}</div>` : ''}`);
  $('#input').value = '';
  state.ctx = [];
  renderCtx();
  const answer = addMessage('assistant', '<div class="md"><div class="thinking"><i></i><i></i><i></i></div></div>');
  const out = answer.querySelector('.md');
  let text = '';
  try {
    if (!state.convId) {
      const conv = await (await api('/api/conversations', { method: 'POST', body: '{}' })).json();
      state.convId = conv.id;
      await chrome.storage.local.set({ convId: conv.id });
    }
    const res = await api(`/api/conversations/${state.convId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: content || 'Me ajude com isto.', attachments, mode: 'new' }),
    });
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let sep;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (!raw.startsWith('data: ')) continue;
        const ev = JSON.parse(raw.slice(6));
        if (ev.type === 'skills') {
          answer.insertAdjacentHTML('afterbegin', ev.skills.map((s) => `<span class="skill-chip">${esc(s.simbolo)} ${esc(s.nome)}</span>`).join(''));
        } else if (ev.type === 'delta') {
          text += ev.text;
          out.innerHTML = md(text);
          out.lastElementChild?.classList.add('cursor');
          $('#messages').scrollTop = $('#messages').scrollHeight;
        } else if (ev.type === 'done') {
          out.innerHTML = md(ev.message.content);
        } else if (ev.type === 'error') {
          throw new Error(ev.error);
        }
      }
    }
  } catch (e) {
    out.innerHTML = `<div class="msg-error">${esc(e.message)}</div>`;
    if (e.auth) showSetup(e.message);
  }
  state.busy = false;
  $('#send').disabled = false;
  $('#input').focus();
}

$('#composer').onsubmit = (e) => { e.preventDefault(); send(); };
$('#input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
});
$('#input').addEventListener('input', (e) => {
  e.target.style.height = 'auto';
  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
});
$('#newChat').onclick = async () => {
  state.convId = null;
  await chrome.storage.local.remove('convId');
  $('#messages').innerHTML = '';
  addMessage('assistant', '<div class="md"><p>Nova conversa. Escolha Página, Seleção ou Print e pergunte.</p></div>');
};

// Pedidos vindos do menu do botão direito.
async function checkPending() {
  const { pending } = await chrome.storage.session.get('pending');
  if (!pending || Date.now() - pending.at > 60_000) return;
  await chrome.storage.session.remove('pending');
  if (pending.selection) {
    state.ctx.push({ kind: 'file', name: `Trecho selecionado em ${pending.title}`, text: pending.selection, label: 'Seleção' });
    renderCtx();
  } else if (pending.readPage) {
    const tab = await chrome.tabs.get(pending.tabId).catch(() => null);
    if (!(await addCtx('page', tab || undefined))) return;
  }
  $('#input').value = pending.prompt;
  send();
}
chrome.storage.session.onChanged.addListener((changes) => { if (changes.pending?.newValue && !$('#chat').hidden) checkPending(); });

// ---------- Início ----------
(async () => {
  const saved = await chrome.storage.local.get(['server', 'token']);
  const session = await chrome.storage.local.get('convId');
  state.server = saved.server || 'http://127.0.0.1:3210';
  state.token = saved.token || '';
  state.convId = session.convId || null;
  if (!state.token) return showSetup();
  try {
    await start();
  } catch (e) {
    showSetup(e.message);
  }
})();
