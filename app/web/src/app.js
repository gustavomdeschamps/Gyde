import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from '@highlightjs/cdn-assets/es/highlight.min.js';
import { showAuth, showQuiz, hideGate } from './onboarding.js';
import { createPractice } from './pratica.js';
import { createSkillsPage } from './skills.js';
import { execute, RUNNABLE } from './runner.js';
import { openTrace } from './passo-a-passo.js';
import { projectFromFolder, projectFromZip } from './projeto.js';
import { createTurmasPage } from './turmas.js';
import { createAgentePage } from './agente.ts';

const $ = (sel) => document.querySelector(sel);
const els = {
  app: $('.app'), convList: $('#convList'), search: $('#search'), newChat: $('#newChat'),
  model: $('#model'), title: $('#convTitle'), banner: $('#banner'), thread: $('#thread'),
  messages: $('#messages'), composer: $('#composer'), input: $('#input'), send: $('#sendBtn'),
  attachBtn: $('#attachBtn'), fileInput: $('#fileInput'), attachments: $('#attachments'),
  settingsDialog: $('#settingsDialog'), settingsForm: $('#settingsForm'), toast: $('#toast'),
};

const MAX_IMAGE_SIDE = 1600;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const state = {
  convId: null,
  conv: null,
  messages: [],
  pending: [],          // anexos ainda não enviados
  streaming: null,      // AbortController da resposta em andamento
  brand: [{ id: 'gyde-1', label: 'Gyde 1', hint: '' }],
  models: [],
  imageMode: false,     // próxima mensagem vira imagem
  imagesEnabled: false,
  skills: [],           // skills instaladas (para o menu "/")
};

// ---------- Utilidades ----------
const icon = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 5v14l11-7z"/></svg>',
  steps: '<svg viewBox="0 0 24 24"><path d="M4 6h10M4 12h6M4 18h10M17 9l3 3-3 3"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  zip: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M11 6h1M11 9h1M11 12h1M10.5 15h2v3h-2z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 4 4H6l4-4-1-6zM12 14v6"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  speaker: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7 9l5-5 5 5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>',
};

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Todo pedido leva "x-gyde": o servidor recusa pedidos sem ele (proteção contra CSRF).
const BASE_HEADERS = { 'x-gyde': '1' };

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: options.body && !(options.body instanceof Blob)
      ? { 'Content-Type': 'application/json', ...BASE_HEADERS, ...options.headers }
      : { ...BASE_HEADERS, ...options.headers },
  });
  if (res.status === 401 && !path.startsWith('/api/auth')) {
    location.reload(); // sessão expirou: volta para a tela de login
    throw new Error('Sessão expirada.');
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

let toastTimer;
function toast(text) {
  els.toast.textContent = text;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2200);
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const old = button.innerHTML;
      button.innerHTML = button.dataset.label ? `${icon.check}Copiado` : icon.check;
      setTimeout(() => { button.innerHTML = old; }, 1500);
    } else toast('Copiado');
  } catch {
    toast('Não consegui copiar');
  }
}

const DEFAULT_MODEL = 'gyde-1';
const modelLabel = (id) => [...state.brand, ...state.models].find((m) => m.id === id)?.label ?? (id === 'auto' ? 'Automático' : id);

// ---------- Markdown ----------
marked.setOptions({ gfm: true, breaks: false });
const renderer = new marked.Renderer();
renderer.code = ({ text, lang }) => {
  const language = (lang || '').trim().split(/\s+/)[0].toLowerCase();
  const known = language && hljs.getLanguage(language);
  const html = known ? hljs.highlight(text, { language, ignoreIllegals: true }).value : escapeHtml(text);
  const runLang = RUNNABLE[language];
  const actions = [
    runLang ? `<button type="button" class="run-code" data-lang="${runLang}" title="Executar este código no navegador">${icon.play}Executar</button>` : '',
    runLang === 'python' ? `<button type="button" class="trace-code" title="Ver a execução linha por linha">${icon.steps}Passo a passo</button>` : '',
    `<button type="button" class="copy-code" data-label="1">${icon.copy}Copiar</button>`,
  ].join('');
  return `<div class="code-block"><div class="code-head"><span>${escapeHtml(language || 'código')}</span>
    <div class="code-actions">${actions}</div></div>
    <pre><code class="hljs">${html}</code></pre></div>`;
};
renderer.link = ({ href, title, text }) =>
  `<a href="${escapeHtml(href || '')}" target="_blank" rel="noopener noreferrer"${title ? ` title="${escapeHtml(title)}"` : ''}>${text}</a>`;
marked.use({ renderer });

function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text), { ADD_ATTR: ['target'] });
}

// ---------- Sidebar ----------
function groupLabel(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = (today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000;
  if (diff <= 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return 'Últimos 7 dias';
  if (diff < 30) return 'Últimos 30 dias';
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

let searchTimer;
let animateList = true; // só anima a lista na primeira vez (ela recarrega a cada mensagem)
async function loadConversations() {
  const term = els.search.value.trim();
  if (animateList && !els.convList.children.length) els.convList.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  const { conversations } = await api(`/api/conversations${term ? `?q=${encodeURIComponent(term)}` : ''}`);
  els.convList.innerHTML = '';
  els.convList.classList.toggle('no-anim', !animateList);
  animateList = false;
  if (conversations.length === 0) {
    els.convList.innerHTML = `<p class="empty-list">${term ? 'Nenhuma conversa encontrada.' : 'Suas conversas aparecem aqui.'}</p>`;
    return;
  }
  let lastGroup = null;
  let n = 0;
  for (const c of conversations) {
    const group = c.pinned ? 'Fixadas' : groupLabel(c.updated_at);
    if (group !== lastGroup) {
      const h = document.createElement('div');
      h.className = 'conv-group';
      h.textContent = group;
      els.convList.append(h);
      lastGroup = group;
    }
    const row = document.createElement('div');
    row.className = 'conv' + (c.id === state.convId ? ' active' : '');
    row.dataset.id = c.id;
    row.style.setProperty('--i', Math.min(n++, 24));
    row.innerHTML = `<a href="#/c/${c.id}"></a>${c.pinned ? icon.pin.replace('<svg', '<svg class="pin"') : ''}
      <button class="conv-menu-btn" aria-label="Opções da conversa" aria-haspopup="menu" aria-expanded="false">${icon.dots}</button>`;
    row.querySelector('a').textContent = c.title;
    row.querySelector('a').title = c.title;
    row.querySelector('.conv-menu-btn').addEventListener('click', (e) => openConvMenu(e.currentTarget, c));
    els.convList.append(row);
  }
}

function closeMenus() {
  document.querySelectorAll('.menu').forEach((m) => m.remove());
  document.querySelectorAll('.conv-menu-btn[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

function openConvMenu(button, conv) {
  const wasOpen = button.getAttribute('aria-expanded') === 'true';
  closeMenus();
  if (wasOpen) return;
  button.setAttribute('aria-expanded', 'true');
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <button role="menuitem" data-act="rename">${icon.edit}Renomear</button>
    <button role="menuitem" data-act="pin">${icon.pin}${conv.pinned ? 'Desafixar' : 'Fixar'}</button>
    <button role="menuitem" data-act="export">${icon.share}Exportar (.md)</button>
    <button role="menuitem" data-act="delete" class="danger">${icon.trash}Excluir</button>`;
  document.body.append(menu);
  const r = button.getBoundingClientRect();
  menu.style.top = `${Math.min(r.bottom + 4, innerHeight - menu.offsetHeight - 8)}px`;
  menu.style.left = `${Math.min(r.left, innerWidth - menu.offsetWidth - 8)}px`;
  menu.addEventListener('click', async (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (!act) return;
    closeMenus();
    try {
      if (act === 'rename') startRename(conv);
      if (act === 'pin') { await api(`/api/conversations/${conv.id}`, { method: 'PATCH', body: JSON.stringify({ pinned: !conv.pinned }) }); loadConversations(); }
      if (act === 'export') exportConversation(conv.id);
      if (act === 'delete') {
        if (!confirm(`Excluir a conversa "${conv.title}"? Isso não pode ser desfeito.`)) return;
        await api(`/api/conversations/${conv.id}`, { method: 'DELETE' });
        if (conv.id === state.convId) location.hash = '#/';
        loadConversations();
      }
    } catch (err) { toast(err.message); }
  });
}

function startRename(conv) {
  const row = els.convList.querySelector(`.conv[data-id="${conv.id}"]`);
  if (!row) return;
  const input = document.createElement('input');
  input.className = 'conv-rename';
  input.value = conv.title;
  row.replaceChildren(input);
  input.focus();
  input.select();
  let done = false;
  const finish = async (save) => {
    if (done) return;
    done = true;
    const title = input.value.trim();
    if (save && title && title !== conv.title) {
      await api(`/api/conversations/${conv.id}`, { method: 'PATCH', body: JSON.stringify({ title }) }).catch((e) => toast(e.message));
      if (conv.id === state.convId) els.title.textContent = title;
    }
    loadConversations();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  input.addEventListener('blur', () => finish(true));
}

async function exportConversation(id) {
  const conv = await api(`/api/conversations/${id}`);
  const lines = [`# ${conv.title}`, ''];
  for (const m of conv.messages) {
    lines.push(m.role === 'user' ? '## Você' : `## Gyde${m.model ? ` (${m.model})` : ''}`, '', m.content, '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${conv.title.replace(/[\\/:*?"<>|]/g, '')}.md` });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Mensagens ----------
function attachmentsHtml(list) {
  if (!list?.length) return '';
  return `<div class="msg-attachments">${list.map((a) => a.kind === 'image'
    ? `<img src="${a.dataUrl}" alt="${escapeHtml(a.name)}">`
    : `<span class="file-pill">${icon.file}<span>${escapeHtml(a.name)}</span></span>`).join('')}</div>`;
}

function renderMessage(m) {
  const el = document.createElement('article');
  el.className = `msg ${m.role}`;
  el.dataset.id = m.id;
  if (m.role === 'user') {
    el.innerHTML = `${attachmentsHtml(m.attachments)}${m.content ? '<div class="bubble"></div>' : ''}
      <div class="msg-actions">
        <button data-act="copy" title="Copiar">${icon.copy}</button>
        <button data-act="edit" title="Editar">${icon.edit}</button>
      </div>`;
    if (m.content) el.querySelector('.bubble').textContent = m.content;
  } else {
    el.innerHTML = `<div class="md"></div>
      <div class="msg-actions">
        <button data-act="copy" title="Copiar">${icon.copy}</button>
        <button data-act="speak" title="Ouvir resposta" hidden>${icon.speaker}</button>
        <button data-act="regenerate" title="Gerar de novo">${icon.retry}</button>
        <span class="msg-meta"></span>
      </div>`;
    el.querySelector('.md').innerHTML = renderMarkdown(m.content);
    el.querySelector('.msg-meta').textContent = m.model ? modelLabel(m.model) : '';
  }
  return el;
}

function renderThread() {
  requestAnimationFrame(() => document.querySelectorAll('[data-act="speak"]').forEach((b) => { b.hidden = !('speechSynthesis' in window); }));
  els.messages.replaceChildren(...state.messages.map(renderMessage));
  els.thread.classList.toggle('has-messages', state.messages.length > 0);
  updateRegenerateButtons();
}

// Só a última resposta pode ser gerada de novo (igual ao original).
function updateRegenerateButtons() {
  const all = els.messages.querySelectorAll('.msg.assistant');
  all.forEach((el, i) => { const b = el.querySelector('[data-act="regenerate"]'); if (b) b.hidden = i !== all.length - 1; });
}

function scrollToBottom(force = false) {
  const t = els.thread;
  if (force || t.scrollHeight - t.scrollTop - t.clientHeight < 160) t.scrollTop = t.scrollHeight;
}

// Executa o código de um bloco da resposta e mostra a saída logo abaixo dele.
async function runCodeBlock(btn) {
  const block = btn.closest('.code-block');
  const code = block.querySelector('pre code').innerText;
  let out = block.querySelector('.run-output');
  if (!out) { out = document.createElement('div'); out.className = 'run-output'; block.append(out); }
  out.innerHTML = '<span class="run-label">Saída</span><div class="loading-line"><div class="thinking"><i></i><i></i><i></i></div>Executando…</div>';
  btn.disabled = true;
  const r = await execute(btn.dataset.lang, { mode: 'run', code, fn: '__nenhuma__', tests: [] }, () => {
    out.querySelector('.loading-line').lastChild.textContent = 'Preparando o Python no navegador… (só demora na primeira vez)';
  });
  const lines = (r.logs || []).map((l) => escapeHtml(l));
  if (r.error) lines.push(`<span class="err">${escapeHtml(r.error)}</span>`);
  if (!lines.length) lines.push('<span class="ok">Rodou sem erros</span> (o código não imprimiu nada).');
  out.innerHTML = `<span class="run-label">Saída</span>${lines.join('\n')}`;
  btn.disabled = false;
}

els.messages.addEventListener('click', (e) => {
  const codeBtn = e.target.closest('.copy-code');
  if (codeBtn) return copyText(codeBtn.closest('.code-block').querySelector('code').innerText, codeBtn);
  const runBtn = e.target.closest('.run-code');
  if (runBtn) return runCodeBlock(runBtn);
  const traceBtn = e.target.closest('.trace-code');
  if (traceBtn) return openTrace(traceBtn.closest('.code-block').querySelector('pre code').innerText);
  const btn = e.target.closest('.msg-actions button');
  if (!btn) return;
  const el = btn.closest('.msg');
  const msg = state.messages.find((m) => m.id === el.dataset.id);
  if (!msg) return;
  if (btn.dataset.act === 'copy') copyText(msg.content, btn);
  if (btn.dataset.act === 'regenerate') send({ mode: 'regenerate', messageId: msg.id });
  if (btn.dataset.act === 'edit') startEdit(el, msg);
  if (btn.dataset.act === 'speak') speak(msg.content, btn);
});

function startEdit(el, msg) {
  if (state.streaming) return;
  const box = document.createElement('div');
  box.className = 'edit-box';
  box.innerHTML = `<textarea></textarea><div class="dialog-actions">
    <button class="btn ghost" data-act="cancel">Cancelar</button><button class="btn primary" data-act="save">Enviar</button></div>`;
  const ta = box.querySelector('textarea');
  ta.value = msg.content;
  el.replaceChildren(box);
  autoSize(ta);
  ta.focus();
  ta.addEventListener('input', () => autoSize(ta));
  box.addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (act === 'cancel') renderThread();
    if (act === 'save' && ta.value.trim()) send({ mode: 'edit', messageId: msg.id, content: ta.value, attachments: msg.attachments });
  });
}

// ---------- Envio com streaming ----------
async function send({ mode = 'new', messageId, content, attachments } = {}) {
  if (state.streaming) return;
  if (!state.convId) {
    const conv = await api('/api/conversations', { method: 'POST', body: JSON.stringify({ model: els.model.value }) });
    state.convId = conv.id;
    state.conv = conv;
    history.replaceState(null, '', `#/c/${conv.id}`);
  }

  if (mode === 'new' && content === undefined) {
    content = els.input.value;
    attachments = state.pending.filter((a) => !a.loading).map(({ kind, name, dataUrl, text }) => ({ kind, name, dataUrl, text }));
    if (!content.trim() && attachments.length === 0) return;
    els.input.value = '';
    state.pending = [];
    renderPending();
    autoSize(els.input);
  }

  // Remove do estado local o que o servidor também vai apagar.
  if (mode === 'regenerate' || mode === 'edit') {
    const idx = state.messages.findIndex((m) => m.id === messageId);
    if (idx !== -1) state.messages = state.messages.slice(0, idx);
    renderThread();
  }

  const payload = { mode, messageId, content, attachments, model: els.model.value, kind: mode === 'new' && state.imageMode ? 'image' : 'chat' };
  if (payload.kind === 'image') setImageMode(false);
  const controller = new AbortController();
  state.streaming = controller;
  setStreamingUi(true);

  // Bolha temporária enquanto a mensagem do usuário não volta do servidor.
  let tempUser = null;
  if (mode === 'new' || mode === 'edit') {
    tempUser = renderMessage({ id: 'temp', role: 'user', content, attachments });
    els.messages.append(tempUser);
    els.thread.classList.add('has-messages');
  }
  const answerEl = document.createElement('article');
  answerEl.className = 'msg assistant';
  answerEl.innerHTML = '<div class="md"><div class="thinking"><i></i><i></i><i></i></div></div>';
  els.messages.append(answerEl);
  scrollToBottom(true);

  const md = answerEl.querySelector('.md');
  let text = '';
  let skillChips = null; // selo "usando a skill X" acima da resposta
  let frame = 0;
  const paint = () => {
    frame = 0;
    md.innerHTML = renderMarkdown(text);
    md.lastElementChild?.classList.add('cursor');
    scrollToBottom();
  };

  try {
    const res = await fetch(`/api/conversations/${state.convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...BASE_HEADERS },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      let msg = `Erro ${res.status}`;
      try { msg = (await res.json()).error || msg; } catch { /* sem corpo */ }
      throw new Error(msg);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let sep;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (!raw.startsWith('data: ')) continue;
        const ev = JSON.parse(raw.slice(6));
        if (ev.type === 'user') {
          state.messages.push(ev.message);
          tempUser?.replaceWith(renderMessage(ev.message));
          tempUser = null;
        } else if (ev.type === 'skills') {
          skillChips = document.createElement('div');
          skillChips.className = 'skill-chips';
          skillChips.innerHTML = ev.skills.map((s) => `<span class="skill-chip"><b>${escapeHtml(s.simbolo)}</b>${escapeHtml(s.nome)}</span>`).join('');
          answerEl.prepend(skillChips);
        } else if (ev.type === 'status') {
          md.innerHTML = '<div class="status-line"><div class="thinking"><i></i><i></i><i></i></div><span></span></div>';
          md.querySelector('span').textContent = ev.text;
        } else if (ev.type === 'delta') {
          text += ev.text;
          if (!frame) frame = requestAnimationFrame(paint);
        } else if (ev.type === 'done') {
          cancelAnimationFrame(frame);
          state.messages.push(ev.message);
          const finalEl = renderMessage(ev.message);
          finalEl.querySelectorAll('[data-act="speak"]').forEach((b) => { b.hidden = !('speechSynthesis' in window); });
          if (ev.consumo) { // modelo que respondeu de verdade e tokens, como o provedor informou
            uso.ultima = ev.consumo;
            const meta = finalEl.querySelector('.msg-meta');
            const partes = [nomeModelo(ev.consumo.modelo), ev.consumo.tokens?.total != null ? `${numero(ev.consumo.tokens.total)} tokens` : '', ev.consumo.provedor === 'offline' ? 'modelo local, sem internet' : ''].filter(Boolean);
            // troca automática para o modelo local muda a qualidade: avisa em vez de trocar em silêncio
            if (ev.consumo.provedor === 'offline' && uso.dados?.modo === 'auto') toast('O FreeLLMAPI não respondeu: esta resposta veio do modelo local, que é mais simples.');
            if (meta && partes.length) { meta.textContent = `${meta.textContent} · ${partes.join(' · ')}`; meta.title = 'Modelo que respondeu e tokens usados, informados pelo provedor'; }
            atualizarUso();
          }
          if (skillChips) finalEl.prepend(skillChips);
          answerEl.replaceWith(finalEl);
          updateRegenerateButtons();
        } else if (ev.type === 'title') {
          els.title.textContent = ev.title;
          document.title = `${ev.title} · Gyde`;
          loadConversations();
        } else if (ev.type === 'error') {
          throw new Error(ev.error);
        }
      }
    }
  } catch (err) {
    cancelAnimationFrame(frame);
    if (err.name === 'AbortError') {
      // Parado pelo usuário: o servidor salva o que já chegou. Recarrega para ficar em sincronia.
      await openConversation(state.convId, { keepScroll: true });
    } else {
      showError(answerEl, err.message, payload);
    }
  } finally {
    state.streaming = null;
    setStreamingUi(false);
    loadConversations();
    els.input.focus();
  }
}

function showError(answerEl, message, payload) {
  answerEl.innerHTML = `<div class="msg-error"><span></span><button type="button">Tentar de novo</button></div>`;
  answerEl.querySelector('span').textContent = message;
  answerEl.querySelector('button').addEventListener('click', () => {
    answerEl.remove();
    // Se a pergunta já foi salva, pede só uma nova resposta; senão, reenvia tudo.
    if (state.messages.at(-1)?.role === 'user') send({ mode: 'retry' });
    else {
      document.querySelector('.msg.user[data-id="temp"]')?.remove();
      send(payload);
    }
  });
  scrollToBottom(true);
}

function setStreamingUi(on) {
  els.send.classList.toggle('streaming', on);
  els.send.setAttribute('aria-label', on ? 'Parar resposta' : 'Enviar');
  updateSendButton();
}

function updateSendButton() {
  els.send.disabled = !state.streaming && !els.input.value.trim() && !state.pending.some((a) => !a.loading);
}

// ---------- Anexos ----------
function renderPending() {
  els.attachments.innerHTML = '';
  state.pending.forEach((a, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (a.loading ? ' loading' : '');
    chip.innerHTML = `${a.kind === 'image' ? `<img src="${a.dataUrl}" alt="">` : `<span class="chip-icon">${icon.file}</span>`}
      <span><span class="chip-name"></span><span class="chip-sub"></span></span>
      <button type="button" class="chip-x" aria-label="Remover anexo">${icon.close}</button>`;
    chip.querySelector('.chip-name').textContent = a.name;
    chip.querySelector('.chip-sub').textContent = a.loading ? 'Lendo…' : a.kind === 'image' ? 'Imagem' : a.sub || 'Arquivo';
    chip.querySelector('.chip-x').addEventListener('click', () => { state.pending.splice(i, 1); renderPending(); });
    els.attachments.append(chip);
  });
  updateSendButton();
}

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error(`Não consegui abrir a imagem ${file.name}.`));
    img.src = URL.createObjectURL(file);
  });
}

// Projeto inteiro (pasta ou .zip) vira um anexo só, com a árvore e os arquivos de código.
async function addProject(label, build) {
  const item = { name: label, loading: true, kind: 'file' };
  state.pending.push(item);
  renderPending();
  try {
    Object.assign(item, await build(), { loading: false });
    if (!els.input.value.trim()) {
      els.input.value = '/revisar Revise este projeto: entenda a estrutura, aponte bugs e más práticas em ordem de importância e me diga o que melhorar primeiro.';
      autoSize(els.input);
    }
  } catch (err) {
    state.pending.splice(state.pending.indexOf(item), 1);
    toast(`Não consegui ler o projeto: ${err.message}`);
  }
  renderPending();
}

async function addFiles(files) {
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) { toast(`${file.name} passa de 25 MB`); continue; }
    if (/\.zip$/i.test(file.name)) { await addProject(file.name, () => projectFromZip(file)); continue; }
    const item = { name: file.name, loading: true, kind: file.type.startsWith('image/') ? 'image' : 'file' };
    state.pending.push(item);
    renderPending();
    try {
      if (item.kind === 'image') {
        item.dataUrl = await shrinkImage(file);
      } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const out = await api('/api/extract', { method: 'POST', body: file });
        if (!out.text) throw new Error(`O PDF ${file.name} não tem texto selecionável.`);
        item.text = out.text;
        item.sub = `PDF · ${out.pages} pág.`;
      } else {
        item.text = await file.text();
        item.sub = 'Texto';
      }
      item.loading = false;
    } catch (err) {
      state.pending.splice(state.pending.indexOf(item), 1);
      toast(err.message);
    }
    renderPending();
  }
}

// O clipe abre um menu: arquivos soltos, pasta de projeto ou projeto .zip.
els.attachBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  closeMenus();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.innerHTML = `
    <button data-pick="files">${icon.file}Arquivos, imagens ou PDF</button>
    <button data-pick="folder">${icon.folder}Pasta de projeto</button>
    <button data-pick="zip">${icon.zip}Projeto .zip</button>`;
  document.body.append(menu);
  const r = els.attachBtn.getBoundingClientRect();
  menu.style.left = `${r.left}px`;
  menu.style.top = `${r.top - menu.offsetHeight - 8}px`;
  menu.onclick = (ev) => {
    const pick = ev.target.closest('[data-pick]')?.dataset.pick;
    closeMenus();
    if (pick === 'files') els.fileInput.click();
    if (pick === 'folder') $('#folderInput').click();
    if (pick === 'zip') $('#zipInput').click();
  };
});
$('#folderInput').addEventListener('change', (e) => {
  const files = e.target.files;
  if (files.length) addProject(files[0].webkitRelativePath.split('/')[0], () => projectFromFolder(files));
  e.target.value = '';
});
$('#zipInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) addProject(file.name, () => projectFromZip(file));
  e.target.value = '';
});

// ---------- Menu de comandos "/" (skills instaladas) ----------
let slashIndex = 0;
let slashMenu = null;

function slashMatches() {
  const m = els.input.value.match(/^\/([\w-]*)$/);
  if (!m) return null;
  const q = m[1].toLowerCase();
  return state.skills.filter((s) => s.comando && (s.comando.slice(1).startsWith(q) || s.nome.toLowerCase().includes(q)));
}

function closeSlash() {
  slashMenu?.remove();
  slashMenu = null;
}

function renderSlash() {
  const list = slashMatches();
  if (!list) return closeSlash();
  if (!slashMenu) {
    slashMenu = document.createElement('div');
    slashMenu.className = 'slash-menu';
    slashMenu.setAttribute('role', 'listbox');
    els.composer.append(slashMenu);
  }
  slashIndex = Math.min(slashIndex, Math.max(0, list.length - 1));
  slashMenu.innerHTML = list.length
    ? '<div class="slash-title">Skills instaladas</div>' + list.map((s, i) => `<button type="button" role="option" class="slash-item${i === slashIndex ? ' active' : ''}" data-i="${i}">
        <span class="skill-symbol">${escapeHtml(s.simbolo)}</span><span class="slash-text"><b>${escapeHtml(s.nome)}</b><small>${escapeHtml(s.descricao)}</small></span><code>${escapeHtml(s.comando)}</code></button>`).join('')
    : `<div class="slash-empty">${state.skills.length ? 'Nenhuma skill com esse comando.' : 'Você ainda não instalou nenhuma skill.'} <a href="#/skills">Abrir Skills</a></div>`;
  slashMenu.querySelectorAll('.slash-item').forEach((b) => {
    b.onmousedown = (e) => { e.preventDefault(); chooseSlash(list[Number(b.dataset.i)]); };
  });
}

function chooseSlash(skill) {
  els.input.value = `${skill.comando} `;
  closeSlash();
  autoSize(els.input);
  updateSendButton();
  els.input.focus();
}

els.input.addEventListener('input', () => { slashIndex = 0; renderSlash(); });
els.input.addEventListener('blur', () => setTimeout(closeSlash, 120));
// Fase de captura: roda antes do Enter-para-enviar quando o menu está aberto.
els.input.addEventListener('keydown', (e) => {
  if (!slashMenu) return;
  const list = slashMatches() || [];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    slashIndex = (slashIndex + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % Math.max(1, list.length);
    renderSlash();
  } else if ((e.key === 'Enter' || e.key === 'Tab') && list.length) {
    e.preventDefault();
    e.stopImmediatePropagation();
    chooseSlash(list[slashIndex]);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeSlash();
  }
}, true);

// ---------- Modo imagem ----------
const imageBtn = document.getElementById('imageBtn');
const defaultPlaceholder = els.input.placeholder;
function setImageMode(on) {
  state.imageMode = on;
  imageBtn.setAttribute('aria-pressed', String(on));
  els.input.placeholder = on ? 'Descreva a imagem (ex.: um diagrama de um loop for em Python)' : defaultPlaceholder;
}
imageBtn.addEventListener('click', () => {
  if (!state.imagesEnabled) return toast('Imagens ainda não configuradas: rode o configurar-imagens.bat (pasta configurar do Gyde)');
  setImageMode(!state.imageMode);
  els.input.focus();
});
// Clique numa imagem gerada abre em tamanho real.
els.messages.addEventListener('click', (e) => {
  const img = e.target.closest('.md img');
  if (img) window.open(img.src, '_blank', 'noopener');
});
els.fileInput.addEventListener('change', () => { addFiles([...els.fileInput.files]); els.fileInput.value = ''; });
els.input.addEventListener('paste', (e) => {
  const files = [...e.clipboardData.files];
  if (files.length) { e.preventDefault(); addFiles(files); }
});
let dragDepth = 0;
document.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files')) { dragDepth++; els.composer.classList.add('dragging'); } });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; els.composer.classList.remove('dragging'); } });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  els.composer.classList.remove('dragging');
  if (e.dataTransfer?.files.length) addFiles([...e.dataTransfer.files]);
});

// ---------- Composer ----------
function autoSize(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
}
els.input.addEventListener('input', () => { autoSize(els.input); updateSendButton(); });
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!els.send.disabled && !state.streaming) send(); }
});
els.composer.addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.streaming) state.streaming.abort();
  else send();
});
document.getElementById('suggestions').addEventListener('click', (e) => {
  const p = e.target.closest('button')?.dataset.prompt;
  if (!p) return;
  els.input.value = p;
  autoSize(els.input);
  updateSendButton();
  els.input.focus();
});

els.model.addEventListener('change', async () => {
  try { localStorage.setItem('model', els.model.value); } catch { /* sem storage */ }
  if (state.convId) await api(`/api/conversations/${state.convId}`, { method: 'PATCH', body: JSON.stringify({ model: els.model.value }) }).catch(() => {});
});

function setModelOptions(selected) {
  if (/^bugo-/.test(selected || '')) selected = selected.replace(/^bugo-/, 'gyde-'); // nome antigo salvo no navegador
  const opt = (id, label, title = '') => `<option value="${escapeHtml(id)}" title="${escapeHtml(title)}">${escapeHtml(label)}</option>`;
  const all = [...state.brand, ...state.models];
  let html = `<optgroup label="Gyde">${state.brand.map((b) => opt(b.id, b.label, b.hint)).join('')}</optgroup>`;
  if (state.models.length) html += `<optgroup label="Melhores para programar">${state.models.map((m) => opt(m.id, m.label, m.hint)).join('')}</optgroup>`;
  // Conversas antigas podem usar um modelo que saiu da lista.
  if (selected && !all.some((m) => m.id === selected)) html += opt(selected, modelLabel(selected));
  els.model.innerHTML = html;
  els.model.value = selected || DEFAULT_MODEL;
  els.model.title = all.find((m) => m.id === els.model.value)?.hint || '';
}

// ---------- Navegação ----------
async function openConversation(id, { keepScroll = false } = {}) {
  try {
    const conv = await api(`/api/conversations/${id}`);
    state.convId = conv.id;
    state.conv = conv;
    state.messages = conv.messages;
    els.title.textContent = conv.title === 'Nova conversa' ? '' : conv.title;
    document.title = conv.title === 'Nova conversa' ? 'Gyde' : `${conv.title} · Gyde`;
    setModelOptions(conv.model);
    renderThread();
    if (!keepScroll) scrollToBottom(true);
  } catch {
    toast('Conversa não encontrada');
    location.hash = '#/';
  }
}

function newChat() {
  state.streaming?.abort();
  state.convId = null;
  state.conv = null;
  state.messages = [];
  els.title.textContent = '';
  document.title = 'Gyde';
  let saved = DEFAULT_MODEL;
  try {
    saved = (localStorage.getItem('model') || DEFAULT_MODEL).replace(/^bugo-/, 'gyde-');
    localStorage.setItem('model', saved);
  } catch { /* sem storage */ }
  setModelOptions(saved);
  renderThread();
  els.input.focus();
}

// Prática (trilhas de exercícios)
const practice = createPractice({
  root: document.getElementById('praticaView'),
  api,
  toast,
  renderMarkdown,
  onXp: (xp) => { document.getElementById('xpBadge').textContent = xp ? `${xp} XP` : ''; },
  getProfile: () => state.user?.profile,
});

// Skills (habilidades instaláveis)
const skillsPage = createSkillsPage({
  root: document.getElementById('skillsView'),
  api,
  toast,
  renderMarkdown,
  onChange: (list) => { state.skills = list; },
});

// Turmas (modo professor/aluno)
const agentePage = createAgentePage({ root: document.getElementById('agenteView'), api, toast, renderMarkdown });
const turmasPage = createTurmasPage({
  root: document.getElementById('turmasView'),
  api,
  toast,
  getTracks: async () => (await api('/api/pratica')).tracks,
});

async function route() {
  els.app.classList.remove('sidebar-open');
  const practiceMatch = location.hash.match(/^#\/pratica(?:\/([\w-]+))?(?:\/([\w-]+))?/);
  const skillsMatch = location.hash.match(/^#\/skills(?:\/([\w-]+))?/);
  const turmasMatch = location.hash.match(/^#\/turmas(?:\/([\w-]+))?/);
  const agenteMatch = location.hash.match(/^#\/agente(?:\/([\w-]+))?/);
  const section = practiceMatch ? 'pratica' : skillsMatch ? 'skills' : turmasMatch ? 'turmas' : agenteMatch ? 'agente' : 'chat';
  document.querySelector('.main').dataset.page = section;
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.nav === section));
  if (agenteMatch) {
    document.title = 'Forja · Gyde';
    await agentePage.show(agenteMatch[1]);
    return;
  }
  if (turmasMatch) {
    document.title = 'Turmas · Gyde';
    await turmasPage.show(turmasMatch[1]);
    return;
  }
  if (practiceMatch) {
    document.title = 'Prática · Gyde';
    await practice.show([practiceMatch[1], practiceMatch[2]].filter(Boolean));
    return;
  }
  if (skillsMatch) {
    document.title = 'Skills · Gyde';
    await skillsPage.show(skillsMatch[1]);
    return;
  }
  const m = location.hash.match(/^#\/c\/([\w-]+)/);
  if (m) {
    if (m[1] !== state.convId) await openConversation(m[1]);
  } else newChat();
  els.convList.querySelectorAll('.conv').forEach((r) => r.classList.toggle('active', r.dataset.id === state.convId));
}
window.addEventListener('hashchange', route);
els.newChat.addEventListener('click', () => { if (location.hash === '#/' || !location.hash) newChat(); else location.hash = '#/'; });
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); els.newChat.click(); }
  if (e.key === 'Escape') closeMenus();
});
document.addEventListener('click', (e) => { if (!e.target.closest('.menu, .conv-menu-btn')) closeMenus(); });
els.search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadConversations, 200); });
$('#openSidebar').addEventListener('click', () => els.app.classList.add('sidebar-open'));
$('#closeSidebar').addEventListener('click', () => els.app.classList.remove('sidebar-open'));
$('#scrim').addEventListener('click', () => els.app.classList.remove('sidebar-open'));

// ---------- Tema (fica no navegador: precisa valer antes do login, sem piscar) ----------
const temaSalvo = () => { try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; } };
function currentTheme() {
  return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function applyTheme() {
  const dark = currentTheme() === 'dark';
  $('#hljs-theme').href = `/vendor/hljs/styles/${dark ? 'github-dark' : 'github'}.min.css`;
  $('#themeLabel').textContent = dark ? 'Tema claro' : 'Tema escuro';
}
function definirTema(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try { if (t === 'auto') localStorage.removeItem('theme'); else localStorage.setItem('theme', t); } catch { /* sem storage */ }
  applyTheme();
}
$('#toggleTheme').addEventListener('click', () => definirTema(currentTheme() === 'dark' ? 'light' : 'dark'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------- Configurações ----------
// Cada controle salva na hora (não existe "Salvar" que dá para esquecer). Preferências da conta vão para o
// servidor; tema e vídeo de abertura são deste navegador.
const ABAS = ['geral', 'ia', 'uso', 'pratica', 'dados', 'extensoes'];
function mostrarAba(aba) {
  document.querySelectorAll('.config-abas [role="tab"]').forEach((b) => { const on = b.dataset.aba === aba; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  document.querySelectorAll('.config-painel').forEach((p) => { p.hidden = p.dataset.painel !== aba; });
  if (aba === 'uso' || aba === 'ia') { desenharUso(); atualizarUso(); }
  if (aba === 'pratica') desenharPraticaConfig();
}
async function abrirConfig(aba = 'geral') {
  let s = {};
  try { s = await api('/api/settings'); } catch (err) { toast(err.message); }
  els.settingsForm.about_user.value = s.about_user || '';
  els.settingsForm.response_style.value = s.response_style || '';
  $('#cfgTema').value = temaSalvo();
  $('#cfgInicio').value = s.pagina_inicial || 'chat';
  loadTokens();
  loadMemory();
  mostrarAba(aba);
  if (!els.settingsDialog.open) els.settingsDialog.showModal();
}
$('#openSettings').addEventListener('click', () => abrirConfig());
$('#usoChip').addEventListener('click', () => abrirConfig('uso'));
const abas = $('.config-abas');
abas.addEventListener('click', (e) => { const b = e.target.closest('[data-aba]'); if (b) mostrarAba(b.dataset.aba); });
abas.addEventListener('keydown', (e) => { // setas trocam de aba (padrão de abas acessíveis)
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  const atual = ABAS.indexOf(document.activeElement?.dataset.aba);
  const prox = ABAS[(atual + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : ABAS.length - 1)) % ABAS.length];
  mostrarAba(prox); abas.querySelector(`[data-aba="${prox}"]`).focus();
});
const salvarPreferencia = async (dados) => {
  try { await api('/api/settings', { method: 'PUT', body: JSON.stringify(dados) }); toast('Salvo'); } catch (err) { toast(err.message); }
};
for (const nome of ['about_user', 'response_style']) els.settingsForm[nome].addEventListener('change', (e) => salvarPreferencia({ [nome]: e.target.value }));
$('#cfgTema').addEventListener('change', (e) => definirTema(e.target.value));
$('#cfgInicio').addEventListener('change', (e) => salvarPreferencia({ pagina_inicial: e.target.value }));
$('#cfgRestaurar').addEventListener('click', async () => {
  if (!confirm('Voltar o tema, a página inicial e o modelo do chat ao padrão?')) return;
  definirTema('auto'); $('#cfgTema').value = 'auto';
  try { localStorage.removeItem('model'); } catch { /* sem storage */ }
  setModelOptions(DEFAULT_MODEL);
  $('#cfgInicio').value = 'chat';
  await salvarPreferencia({ pagina_inicial: 'chat' });
});
// apagar dados (sempre com confirmação)
const APAGAR = {
  conversas: { pergunta: 'Apagar TODAS as conversas do chat? Não dá para desfazer.', rota: '/api/conversations', depois: async (r) => { toast(`${r.apagadas} conversa(s) apagada(s)`); await loadConversations(); if (location.hash.startsWith('#/c/')) location.hash = '#/'; } },
  forja: { pergunta: 'Apagar todas as conversas da Forja? Os arquivos dos projetos não são tocados.', rota: '/api/codigo/sessoes', depois: (r) => toast(`${r.apagadas} conversa(s) da Forja apagada(s)`) },
  uso: { pergunta: 'Zerar o registro de uso desta conta?', rota: '/api/uso', depois: () => { toast('Registro de uso apagado'); atualizarUso(); } },
};
document.querySelectorAll('[data-apagar]').forEach((b) => b.addEventListener('click', async () => {
  const a = APAGAR[b.dataset.apagar];
  if (!confirm(a.pergunta)) return;
  try { await a.depois(await api(a.rota, { method: 'DELETE' })); } catch (err) { toast(err.message); }
}));

// Memória entre conversas
const MEM_SOURCE = { auto: 'aprendido', manual: 'você escreveu', pedido: 'você pediu' };
function renderMemory(m) {
  $('#memoryOn').checked = m.ativa;
  $('.memory-box').classList.toggle('off', !m.ativa);
  $('#memoryList').innerHTML = m.itens.length
    ? m.itens.map((it, i) => `<li style="animation-delay:${i * 30}ms"><span>${escapeHtml(it.text)}</span><small>${MEM_SOURCE[it.source] || ''}</small><button type="button" data-forget="${escapeHtml(it.id)}" aria-label="Esquecer">×</button></li>`).join('')
    : '<li class="empty"><span>Ainda não lembro de nada sobre você.</span></li>';
}
async function loadMemory() { try { renderMemory(await api('/api/memoria')); } catch { /* sem memória */ } }
$('#memoryOn').addEventListener('change', async (e) => renderMemory(await api('/api/memoria/config', { method: 'PUT', body: JSON.stringify({ ativa: e.target.checked }) })));
$('#memoryList').addEventListener('click', async (e) => {
  const id = e.target.dataset?.forget;
  if (id) renderMemory(await api(`/api/memoria/${id}`, { method: 'DELETE' }));
});
const addMemory = async () => {
  const input = $('#memoryInput');
  if (!input.value.trim()) return;
  try { renderMemory(await api('/api/memoria', { method: 'POST', body: JSON.stringify({ texto: input.value }) })); input.value = ''; } catch (err) { toast(err.message); }
};
$('#memoryAdd').addEventListener('click', addMemory);
$('#memoryInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMemory(); } });
$('#memoryClear').addEventListener('click', async () => {
  if (!confirm('Apagar tudo o que o Gyde lembra sobre você?')) return;
  renderMemory(await api('/api/memoria', { method: 'DELETE' }));
  toast('Memória apagada');
});

// Tokens das extensões (Chrome e VS Code)
function renderTokens(tokens) {
  const fmt = (t) => (t ? new Date(t).toLocaleDateString('pt-BR') : 'nunca');
  $('#tokenList').innerHTML = tokens.map((t) => `<li><span>${escapeHtml(t.name)} · criado em ${fmt(t.created_at)} · último uso: ${fmt(t.last_used)}</span>
    <button type="button" data-revoke="${escapeHtml(t.id)}">Revogar</button></li>`).join('');
}
async function loadTokens() {
  $('#tokenNew').hidden = true;
  try { renderTokens((await api('/api/tokens')).tokens); } catch { /* sem tokens */ }
}
$('#tokenCreate').addEventListener('click', async () => {
  try {
    const r = await api('/api/tokens', { method: 'POST', body: JSON.stringify({ name: 'Extensão do Gyde' }) });
    $('#tokenValue').textContent = r.token;
    $('#tokenNew').hidden = false;
    renderTokens(r.tokens);
  } catch (err) { toast(err.message); }
});
$('#tokenCopy').addEventListener('click', (e) => copyText($('#tokenValue').textContent, e.currentTarget));
$('#tokenList').addEventListener('click', async (e) => {
  const id = e.target.dataset?.revoke;
  if (!id || !confirm('Revogar este token? A extensão que usa ele vai parar de funcionar.')) return;
  renderTokens((await api(`/api/tokens/${id}`, { method: 'DELETE' })).tokens);
  toast('Token revogado');
});
els.settingsDialog.addEventListener('close', () => { $('#tokenNew').hidden = true; $('#tokenValue').textContent = ''; });

// Prática nas configurações: o que você declarou, o que o quiz mediu e o que os exercícios mostraram
async function desenharPraticaConfig() {
  const box = $('#cfgPratica');
  box.innerHTML = '<div class="skeleton" style="height:90px"></div>';
  let plano;
  try {
    plano = (await api('/api/pratica')).plano;
    if (!plano || typeof plano !== 'object' || !('observado' in plano)) throw new Error('O servidor do Gyde respondeu num formato diferente desta tela. Feche a janela do iniciar.bat e abra de novo para terminar a atualização.');
  } catch (err) {
    console.error('[Gyde] Configurações > Prática:', err);
    box.innerHTML = `<div class="config-erro" role="alert"><p>${escapeHtml(err instanceof TypeError ? 'Sem conexão com o servidor do Gyde.' : err.message)}</p><button type="button" class="btn small" id="cfgPraticaTentar">Tentar de novo</button></div>`;
    $('#cfgPraticaTentar').onclick = desenharPraticaConfig;
    return;
  }
  $('#redoQuiz').textContent = plano.temQuiz ? 'Refazer o questionário' : 'Fazer o questionário';
  const d = plano.declarado, m = plano.medido, o = plano.observado;
  const item = (rot, val) => `<div><dt>${rot}</dt><dd>${val}</dd></div>`;
  const resumoPlano = `<p class="config-nota"><b>Plano atual:</b> ${escapeHtml(plano.explicacao || '')} Tecnologias: ${escapeHtml((plano.tecnologias || []).join(', '))}; nível ${escapeHtml(plano.nivel || '')}.</p>`;
  box.innerHTML = resumoPlano + (plano.temQuiz ? `
    <h3 class="config-sub">O que você respondeu <small>em ${new Date(d.em).toLocaleDateString('pt-BR')}</small></h3>
    <dl class="config-dl">
      ${item('Experiência', escapeHtml(d.experiencia || 'não respondeu'))}
      ${item('Linguagens', escapeHtml(d.linguagens.join(', ') || 'nenhuma escolhida'))}
      ${item('Objetivo', escapeHtml(d.objetivo || 'não respondeu'))}
      ${item('Como aprende melhor', escapeHtml(d.estilo || 'não respondeu'))}
    </dl>
    <h3 class="config-sub">O que o mini desafio mediu</h3>
    <dl class="config-dl">
      ${item('Nível estimado', `${escapeHtml(m.nivel)} (${m.acertos} de ${m.total})`)}
      ${item('Para reforçar', escapeHtml(m.reforcar.join(', ') || 'nada: acertou tudo'))}
      ${m.anteriores.length ? item('Antes', m.anteriores.map((a) => `${escapeHtml(a.nivel)} (${a.acertos}/${a.total}) em ${new Date(a.em).toLocaleDateString('pt-BR')}`).join(' · ')) : ''}
    </dl>
    <h3 class="config-sub">O que os exercícios mostram</h3>
    <dl class="config-dl">
      ${item('Exercícios feitos', String(o.feitos))}
      ${item('Tentativas com erro', String(o.tentativasComErro))}
      ${item('Ainda travado em', o.travados.length ? `${o.travados.length} exercício(s)` : 'nenhum')}
    </dl>`
    : '<p class="config-nota">Você ainda não respondeu o questionário. Sem ele, a Prática começa pelo mais simples (lógica e Python). Leva uns 3 minutos e muda as recomendações e o jeito do Gyde explicar.</p>');
}
$('#redoQuiz').addEventListener('click', () => {
  els.settingsDialog.close('cancel');
  showQuiz({ user: state.user, onDone: () => boot() });
});
$('#cfgIrPratica').addEventListener('click', () => els.settingsDialog.close('cancel'));

// ---------- Conta ----------
function renderUser() {
  const u = state.user;
  $('#userAvatar').textContent = (u.name.trim()[0] || '?').toUpperCase();
  $('#userName').textContent = u.name;
  $('#userLevel').textContent = u.profile?.levelLabel ? `Nível: ${u.profile.levelLabel}` : u.email;
  const first = u.name.trim().split(/\s+/)[0];
  $('#greeting').innerHTML = `Bora <span class="accent">programar</span>, ${escapeHtml(first)}?`;
}
$('#logoutBtn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.hash = '#/';
  location.reload();
});

// ---------- Uso e limites ----------
// Separa: o uso do Gyde (registrado aqui, por pedido), a cota do provedor (o que ele informa), tokens e créditos.
// O que o provedor não informa aparece escrito assim, sem número inventado nem barra de progresso falsa.
const uso = { ultima: null, dados: null };
const nomeModelo = (id) => String(id || '').split('/').pop().replace(/:free$/, '');
const horaCurta = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const numero = (n) => (n == null ? 'não informado' : Number(n).toLocaleString('pt-BR'));
const NOME_PROVEDOR = { online: 'FreeLLMAPI', offline: 'Modelo local (Ollama)', nenhum: 'Sem provedor' };
const ORIGEM = { chat: 'Chat', forja: 'Forja', pratica: 'Dica da Prática', imagem: 'Imagem' };
const RESULTADO = { ok: 'concluído', erro: 'falhou', cancelado: 'cancelado', limite: 'limite atingido' };
async function atualizarUso() {
  try { uso.dados = await api('/api/uso'); } catch { uso.dados = null; }
  const d = uso.dados, chip = $('#usoChip');
  chip.dataset.estado = !d ? 'erro' : d.ativo;
  const lim = d?.limiteRoteador;
  $('#usoTexto').textContent = !d ? 'IA indisponível' : d.ativo === 'offline' ? `Offline · ${d.offline.modelo}` : lim ? `Online · ${lim.restante}/${lim.total} por min` : 'Online';
  if (els.settingsDialog.open) desenharUso();
}
function desenharUso() {
  const d = uso.dados, u = uso.ultima;
  const linha = (rot, val) => `<div><dt>${rot}</dt><dd>${val}</dd></div>`;
  const estado = $('#cfgIaEstado');
  if (!d) {
    $('#usoPainel').innerHTML = estado.innerHTML = '<p class="msg-error">Não consegui falar com o servidor do Gyde.</p>';
    return;
  }
  // ----- aba IA e modelos: conexão real e modo
  estado.innerHTML = `
    <div class="config-linha">
      <div><b>Modo da IA</b><small>Vale para o Gyde inteiro neste computador.</small></div>
      <select id="usoModo" aria-label="Modo da IA">
        <option value="auto"${d.modo === 'auto' ? ' selected' : ''}>Automático (online; local se cair)</option>
        <option value="online"${d.modo === 'online' ? ' selected' : ''}>Só online (FreeLLMAPI)</option>
        <option value="offline"${d.modo === 'offline' ? ' selected' : ''}${d.offline.disponivel ? '' : ' disabled'}>Só offline (${escapeHtml(d.offline.modelo)})${d.offline.disponivel ? '' : ' · indisponível'}</option>
      </select>
    </div>
    <dl class="config-dl">
      ${linha('Em uso agora', `<b>${NOME_PROVEDOR[d.ativo]}</b>`)}
      ${linha('FreeLLMAPI', d.online.disponivel ? '<span class="ok">conectado</span>' : '<span class="ruim">sem resposta ou sem chave</span>')}
      ${linha('Modelo local', d.offline.disponivel ? `<span class="ok">${escapeHtml(d.offline.modelo)} pronto</span>` : `<span class="ruim">indisponível</span>${d.offline.instalados.length ? ` (instalados: ${escapeHtml(d.offline.instalados.join(', '))})` : ' (Ollama fechado ou sem modelo)'}`)}
      ${linha('Última resposta', u ? `${escapeHtml(nomeModelo(u.modelo) || 'modelo não informado')} via ${NOME_PROVEDOR[u.provedor] || ''}` : 'nenhuma nesta sessão')}
    </dl>
    ${d.modo === 'auto' ? '<p class="config-nota">No automático, se o FreeLLMAPI parar de responder, o Gyde usa o modelo local e avisa na resposta. Ele é mais simples e mais lento, e nada sai do computador.</p>' : ''}`;
  $('#usoModo').onchange = async (e) => {
    try { await api('/api/uso/modo', { method: 'POST', body: JSON.stringify({ modo: e.target.value }) }); toast('Modo da IA alterado'); } catch (err) { toast(err.message); }
    atualizarUso();
  };

  // ----- aba Uso e limites
  const g = d.gyde || { hoje: {}, semana: {}, ultimos: [] };
  const blocoGyde = (periodo) => {
    const provs = Object.entries(periodo);
    if (!provs.length) return '<p class="config-nota">Nenhum pedido registrado.</p>';
    return provs.map(([prov, p]) => `<div class="uso-prov"><b>${NOME_PROVEDOR[prov] || escapeHtml(prov)}</b>
      <dl class="config-dl">
        ${linha('Pedidos', `${numero(p.pedidos)} <small>(${p.concluidos} concluídos${p.falhas ? `, ${p.falhas} com falha` : ''}${p.cancelados ? `, ${p.cancelados} cancelados` : ''}${p.limite ? `, ${p.limite} barrados por limite` : ''})</small>`)}
        ${linha('Chamadas ao provedor', `${numero(p.chamadas)}${p.chamadas > p.pedidos ? ` <small>(inclui ${p.chamadas - p.pedidos} trocas de modelo e rodadas da Forja)</small>` : ''}`)}
        ${linha('Tokens', p.tokensEntrada || p.tokensSaida ? `${numero(p.tokensEntrada)} de entrada · ${numero(p.tokensSaida)} de saída${p.semTokens ? ` <small>(${p.semTokens} pedido(s) sem tokens informados)</small>` : ''}` : 'não informados pelo provedor')}
      </dl></div>`).join('');
  };
  const lim = d.limiteRoteador;
  const pctLivre = lim && lim.total ? Math.round((lim.restante / lim.total) * 100) : null;
  const alerta = lim && lim.total && lim.restante / lim.total <= 0.1
    ? `<p class="uso-alerta" role="alert">Restam ${lim.restante} pedidos neste minuto no FreeLLMAPI.${lim.renovaEm ? ` Renova às ${horaCurta(lim.renovaEm)}.` : ''}${d.offline.disponivel ? ' Se acabar, dá para usar o modelo local (aba IA e modelos).' : ''}</p>` : '';
  const porChave = d.mes?.porChave || [];
  $('#usoPainel').innerHTML = `${alerta}
    <section class="uso-sec">
      <h3 class="config-sub">Uso do Gyde <small>registrado neste computador, por pedido seu</small></h3>
      <div class="uso-periodos"><div><h4>Hoje</h4>${blocoGyde(g.hoje)}</div><div><h4>Últimos 7 dias</h4>${blocoGyde(g.semana)}</div></div>
      ${g.internasHoje ? `<p class="config-nota">Além disso, ${g.internasHoje} chamada(s) internas hoje (títulos de conversas e memória).</p>` : ''}
    </section>
    <section class="uso-sec">
      <h3 class="config-sub">Cota do provedor <small>informada por ${d.ativo === 'offline' ? 'ninguém: roda no seu PC' : 'FreeLLMAPI'}</small></h3>
      ${d.ativo === 'offline' ? '<p class="config-nota">O modelo local não tem cota nem custo: o limite é a memória e a velocidade do seu computador.</p>' : `
      <dl class="config-dl">
        ${linha('Pedidos por minuto', lim ? `${numero(lim.restante)} de ${numero(lim.total)} livres${lim.renovaEm ? ` · renova às ${horaCurta(lim.renovaEm)}` : ''}<span class="uso-barra" role="img" aria-label="${pctLivre}% livres"><i style="width:${pctLivre}%"></i></span>` : 'aparece depois do primeiro pedido')}
        ${d.mes ? linha('No mês, na conta do FreeLLMAPI', `${numero(d.mes.pedidos)} pedidos · ${numero(d.mes.tokens)} tokens<small class="uso-sub">Conta tudo que usa a chave do FreeLLMAPI (não só o Gyde). Zera em ${new Date(d.mes.renovaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.</small>`) : ''}
        ${d.mes ? linha('Limite mensal', porChave.some((k) => k.limitePedidos || k.limiteTokens) ? porChave.filter((k) => k.limitePedidos || k.limiteTokens).map((k) => `${escapeHtml(k.provedor)}: ${k.limitePedidos ? `${numero(k.limitePedidos)} pedidos` : `${numero(k.limiteTokens)} tokens`}`).join(' · ') : 'Limite não informado (nenhum definido no FreeLLMAPI)') : ''}
        ${linha('Créditos e saldo', 'Saldo não disponibilizado pelo provedor. Os serviços grátis por trás do FreeLLMAPI têm cotas diárias próprias que ele não repassa.')}
      </dl>`}
    </section>
    <section class="uso-sec">
      <h3 class="config-sub">Planos do Gyde</h3>
      <p class="config-nota">O Gyde não tem planos, assinatura nem cobrança. Os limites acima são só do provedor de IA.</p>
    </section>
    ${g.ultimos.length ? `<section class="uso-sec"><h3 class="config-sub">Últimos pedidos</h3><ul class="uso-ultimos">${g.ultimos.map((r) => `<li class="r-${r.resultado}">
      <time>${new Date(r.inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
      <span>${ORIGEM[r.origem] || escapeHtml(r.origem)} · ${escapeHtml(nomeModelo(r.modelo) || NOME_PROVEDOR[r.provedor] || 'sem modelo')}</span>
      <span>${RESULTADO[r.resultado]}${r.tokens_entrada != null ? ` · ${numero(r.tokens_entrada + (r.tokens_saida || 0))} tokens` : ''}${r.chamadas > 1 ? ` · ${r.chamadas} chamadas` : ''}</span></li>`).join('')}</ul></section>` : ''}
    <details class="uso-glossario"><summary>O que significa cada coisa</summary>
      <p><b>Pedido:</b> uma mensagem sua no chat, uma tarefa da Forja ou uma dica da Prática. Conta uma vez só, mesmo que o Gyde tente outro modelo.</p>
      <p><b>Chamada:</b> cada vez que o Gyde fala com o provedor. Trocas de modelo e rodadas da Forja geram várias chamadas num pedido.</p>
      <p><b>Token:</b> pedaço de texto que o modelo lê (entrada) ou escreve (saída). Só aparece quando o provedor informa.</p>
      <p><b>Cota:</b> limite do serviço de IA (por minuto, por dia ou por mês). Quem define é o provedor, não o Gyde.</p>
      <p><b>Créditos:</b> saldo em dinheiro ou unidades. O FreeLLMAPI não tem nem informa saldo.</p>
    </details>`;
}

// ---------- Início ----------
async function checkStatus() {
  try {
    const s = await api('/api/status');
    state.imagesEnabled = s.imagesEnabled;
    atualizarUso();
    if (s.desatualizado) { // código novo no disco, servidor antigo na memória: telas e servidor não combinam
      els.banner.textContent = 'O Gyde foi atualizado, mas o servidor ainda está rodando a versão anterior. Feche a janela do iniciar.bat e abra de novo para terminar a atualização.';
      els.banner.hidden = false;
      return true;
    }
    if (s.keyConfigured && !s.routerOnline && s.iaAtiva === 'offline') {
      els.banner.textContent = 'Sem conexão com o FreeLLMAPI: usando o modelo local (offline). Ele é mais simples e mais lento.';
      els.banner.hidden = false;
      return true;
    }
    if (!s.keyConfigured) {
      els.banner.innerHTML = 'A chave do FreeLLMAPI ainda não foi configurada. Clique em <b>Copy Key</b> no ícone do FreeLLMAPI e rode <code>configurar-chave.bat</code> (pasta <b>configurar</b> do Gyde).';
    } else if (!s.routerOnline) {
      els.banner.textContent = 'O FreeLLMAPI não está respondendo. Abra o app FreeLLMAPI (ícone na bandeja) e recarregue a página.';
    } else {
      els.banner.hidden = true;
      return true;
    }
    els.banner.hidden = false;
  } catch {
    els.banner.textContent = 'Não consegui falar com o servidor do Gyde.';
    els.banner.hidden = false;
  }
  return false;
}

async function loadModels() {
  try {
    const { brand, models } = await api('/api/models');
    state.brand = brand;
    state.models = models;
  } catch { /* fica só com "auto" */ }
  setModelOptions(state.conv?.model || els.model.value || DEFAULT_MODEL);
}

// Fluxo de entrada: login -> quiz (só na primeira vez) -> app.
async function boot() {
  let me;
  try { me = await fetch('/api/auth/me').then((r) => r.json()); } catch {
    els.banner.textContent = 'Não consegui falar com o servidor do Gyde.';
    els.banner.hidden = false;
    return;
  }
  if (!me.user) return showAuth({ mode: me.mode, emailMode: me.emailMode, onLogin: () => boot() });
  if (!me.user.onboarded) return showQuiz({ user: me.user, onDone: () => boot() });
  hideGate();
  state.user = me.user;
  renderUser();
  const ok = await checkStatus();
  if (ok) await loadModels();
  await loadConversations().catch(() => {});
  if (!state.inicioAplicado) { // página inicial escolhida em Configurações (só ao entrar, sem atropelar um link)
    state.inicioAplicado = true;
    if (!location.hash || location.hash === '#/') {
      const pref = (await api('/api/settings').catch(() => ({}))).pagina_inicial;
      if (pref === 'pratica' || pref === 'agente') history.replaceState(null, '', `#/${pref}`);
    }
  }
  state.convId = undefined; // força o route a recarregar a conversa atual
  practice.refreshXp();
  skillsPage.refresh();
  await route();
}

// ---------- Vídeo de abertura ----------
// Aparece só na primeira vez que o Gyde é aberto neste navegador (fica marcado no localStorage, sem nada
// externo). Dá para rever em Configurações > Geral. Ela vem antes do login, então a marca é do navegador, não da conta.
// Se o navegador segurar o som automático, o vídeo toca sem som e o som liga no primeiro clique ou tecla.
// No fim, a logo do vídeo vira a logo de verdade e voa até o lugar dela, enquanto a tela real aparece
// por trás num círculo que se abre a partir da logo. preparar() monta a tela real alguns segundos antes.
const introInfo = fetch('/intro.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
function visivel(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight ? r : null;
}
const INTRO_VISTA = 'gyde-intro-vista';
const introJaVista = () => { try { return localStorage.getItem(INTRO_VISTA) === '1' || sessionStorage.getItem('gyde-intro-visto') === '1'; } catch { return false; } };
// marca logo que começa: atualizar no meio, pular ou falhar a reprodução não faz o vídeo voltar
const marcarIntroVista = () => { try { localStorage.setItem(INTRO_VISTA, '1'); } catch { /* sem storage: some ao fechar a aba */ } };
function playIntro({ preparar = () => {} } = {}) {
  marcarIntroVista();
  return new Promise((done) => {
    const box = $('#intro'), video = $('#introVideo'), hint = $('#introSom'), somBtn = $('#introSomBtn'), leg = $('#introLegenda');
    box.hidden = false; box.classList.remove('revelando'); box.style.removeProperty('--r');
    hint.hidden = true; leg.classList.remove('on');
    let finished = false, preparado = false, info = {};
    introInfo.then((i) => { info = i; });
    const prepara = () => { if (!preparado) { preparado = true; preparar(); } };
    const mostrarSom = () => { somBtn.setAttribute('aria-pressed', String(!video.muted)); somBtn.title = video.muted ? 'Ligar o som' : 'Desligar o som'; };
    const unmute = () => { if (!video.muted) return; video.muted = false; hint.hidden = true; mostrarSom(); };
    const onKey = (e) => { if (e.key === 'Escape') finish(false); else unmute(); };
    somBtn.onclick = (e) => { e.stopPropagation(); video.muted = !video.muted; hint.hidden = true; mostrarSom(); };
    const limpar = () => {
      box.hidden = true; box.classList.remove('revelando', 'closing'); box.style.removeProperty('--r');
      video.currentTime = 0; leg.classList.remove('on'); done();
    };
    const finish = (natural) => {
      if (finished) return;
      finished = true;
      document.removeEventListener('keydown', onKey);
      box.removeEventListener('pointerdown', unmute);
      video.pause(); leg.classList.remove('on'); hint.hidden = true;
      prepara();
      const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!natural || reduzir || !info.logo) { box.classList.add('closing'); setTimeout(limpar, 380); return; }
      // espera a tela real existir (o login ou o app) antes de revelar
      requestAnimationFrame(() => requestAnimationFrame(() => passagem()));
    };
    // onde a logo está no último quadro (object-fit: cover na tela larga, contain na tela alta)
    const rectDaLogo = () => {
      const caber = matchMedia('(max-aspect-ratio: 13/10)').matches;
      const esc = (caber ? Math.min : Math.max)(innerWidth / 1920, innerHeight / 1080), vw = 1920 * esc, vh = 1080 * esc;
      const ox = (innerWidth - vw) / 2, oy = (innerHeight - vh) / 2, lado = info.logo.lado * vh;
      return { x: ox + info.logo.x * vw - lado / 2, y: oy + info.logo.y * vh - lado / 2, lado };
    };
    const passagem = () => {
      const de = rectDaLogo();
      const alvoEl = [document.querySelector('#gate:not([hidden]) .gate-brand img'), $('.empty-logo'), $('.brand-mark')].find((el) => visivel(el));
      const logo = document.createElement('img');
      logo.src = '/logo.svg'; logo.alt = ''; logo.className = 'intro-logo';
      Object.assign(logo.style, { left: `${de.x}px`, top: `${de.y}px`, width: `${de.lado}px`, height: `${de.lado}px` });
      document.body.append(logo);
      box.style.setProperty('--mx', `${de.x + de.lado / 2}px`); box.style.setProperty('--my', `${de.y + de.lado / 2}px`);
      const fimR = Math.hypot(innerWidth, innerHeight);
      logo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' }).finished.then(() => {
        box.classList.add('revelando');
        box.animate([{ '--r': '0px' }, { '--r': `${fimR}px` }], { duration: 1100, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
        const alvo = visivel(alvoEl);
        if (alvoEl && alvo) {
          alvoEl.style.visibility = 'hidden';
          const k = alvo.width / de.lado, dx = alvo.left - de.x, dy = alvo.top - de.y;
          logo.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], { duration: 1050, delay: 120, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' })
            .finished.then(() => { alvoEl.style.visibility = ''; logo.remove(); limpar(); });
        } else {
          logo.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.85)' }], { duration: 700, delay: 300, easing: 'ease-out', fill: 'forwards' })
            .finished.then(() => { logo.remove(); limpar(); });
        }
      });
    };
    if (!video.getAttribute('src')) { video.src = video.dataset.src; video.preload = 'auto'; } // só baixa quando vai tocar
    video.currentTime = 0;
    video.muted = false;
    video.play().then(mostrarSom).catch(() => {
      video.muted = true;
      hint.hidden = false; mostrarSom();
      video.play().catch(() => finish(false)); // sem nem tocar mudo: segue para o login
    });
    // legendas por cima do vídeo (sempre visíveis, mesmo com o vídeo ampliado)
    video.ontimeupdate = () => {
      const c = (info.legendas || []).find((x) => video.currentTime >= x.ini && video.currentTime <= x.fim);
      if (c && leg.textContent !== c.texto) leg.textContent = c.texto;
      leg.classList.toggle('on', Boolean(c));
      if (video.duration && video.currentTime > video.duration - 3.5) prepara();
    };
    video.onended = () => finish(true);
    video.onerror = () => finish(false);
    box.addEventListener('pointerdown', unmute);
    document.addEventListener('keydown', onKey);
  });
}
$('#replayIntro').addEventListener('click', () => {
  els.settingsDialog.close('cancel');
  playIntro();
});

applyTheme();
(async () => {
  let seen = false, iniciou = false;
  const iniciar = () => { if (!iniciou) { iniciou = true; boot(); } };
  seen = introJaVista();
  if (!seen) await playIntro({ preparar: iniciar });
  iniciar();
})();

// ---------- Voz ----------
// Ler respostas em voz alta (voz do próprio Windows/navegador).
function textForSpeech(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' (tem um bloco de código aqui na tela) ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[#>|-]+\s*/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let speakingBtn = null;
function speak(markdown, btn) {
  const synth = window.speechSynthesis;
  const wasThis = speakingBtn === btn;
  synth.cancel();
  speakingBtn?.classList.remove('speaking');
  speakingBtn = null;
  if (wasThis) return; // segundo clique para de falar
  const u = new SpeechSynthesisUtterance(textForSpeech(markdown));
  u.lang = 'pt-BR';
  const voice = synth.getVoices().find((v) => v.lang === 'pt-BR' && /natural|online/i.test(v.name)) || synth.getVoices().find((v) => v.lang === 'pt-BR');
  if (voice) u.voice = voice;
  u.rate = 1.05;
  u.onend = u.onerror = () => { btn.classList.remove('speaking'); if (speakingBtn === btn) speakingBtn = null; };
  btn.classList.add('speaking');
  speakingBtn = btn;
  synth.speak(u);
}
if ('speechSynthesis' in window) speechSynthesis.getVoices(); // carrega a lista de vozes

// Ditado: fala vira texto. Dizer "enviar" no final manda a mensagem.
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const micBtn = document.getElementById('micBtn');
if (SpeechRec) {
  micBtn.hidden = false;
  let rec = null;
  let base = '';
  const SEND_WORDS = /\s*\b(enviar|envia|mandar|manda)[.!]?\s*$/i;
  const stop = () => { rec?.stop(); };
  micBtn.addEventListener('click', () => {
    if (rec) return stop();
    rec = new SpeechRec();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = true;
    base = els.input.value ? els.input.value.replace(/\s*$/, ' ') : '';
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      els.input.value = base + finalText + interim;
      autoSize(els.input);
      updateSendButton();
      if (SEND_WORDS.test(finalText)) {
        els.input.value = (base + finalText).replace(SEND_WORDS, '').trim();
        stop();
        if (els.input.value) send();
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') toast('Permita o uso do microfone para falar com o Gyde');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('O ditado parou: ' + e.error);
    };
    rec.onend = () => { rec = null; micBtn.classList.remove('listening'); micBtn.setAttribute('aria-label', 'Falar'); };
    rec.start();
    micBtn.classList.add('listening');
    micBtn.setAttribute('aria-label', 'Parar de ouvir');
  });
}

// PWA: abre como app (janela própria, ícone na área de trabalho) e mantém a casca offline.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
const installBtn = document.getElementById('installApp');
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  if (outcome === 'accepted') toast('Gyde instalado: procure o ícone no menu Iniciar');
  installPrompt = null;
  installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => { installBtn.hidden = true; });
