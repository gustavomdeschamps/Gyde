// Telas de entrada do Gyde: login, cadastro, confirmação de e-mail, troca de senha e quiz.
import hljs from '@highlightjs/cdn-assets/es/highlight.min.js';
import { confetti } from './runner.js';

const HEADERS = { 'Content-Type': 'application/json', 'x-gyde': '1' };

async function post(path, body) {
  const res = await fetch(path, { method: 'POST', headers: HEADERS, body: JSON.stringify(body || {}) });
  let json = {};
  try { json = await res.json(); } catch { /* sem corpo */ }
  return { ok: res.ok, status: res.status, json };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// direction: 'next' | 'back' | undefined — controla a animação de entrada do cartão.
function shell(inner, direction) {
  const root = document.getElementById('gate');
  root.hidden = false;
  root.innerHTML = `<div class="gate-card${direction ? ` step-${direction}` : ''}">
    <div class="gate-brand"><img src="/logo.svg" alt="" width="40" height="40"><span>Gyde</span></div>
    ${inner}
  </div>`;
  return root;
}

function busy(form, on) {
  form.querySelectorAll('button, input').forEach((el) => { el.disabled = on; });
}

function showError(form, msg) {
  const el = form.querySelector('.gate-error');
  el.textContent = msg || '';
  el.hidden = !msg;
  if (msg) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; } // repete o "tremido"
}

// ---------- Login / cadastro ----------
export function showAuth({ mode, emailMode, onLogin }) {
  const personal = mode === 'pessoal';
  const localHint = emailMode === 'console'
    ? '<p class="gate-note">Modo de teste: o código aparece no terminal do servidor.</p>'
    : '';
  const offWarning = personal
    ? '<p class="gate-note">Modo pessoal: sua conta e suas conversas ficam só neste computador. O e-mail serve apenas para entrar — pode ser qualquer um, e nada é enviado.</p>'
    : emailMode === 'off'
    ? '<p class="gate-note">⚠︎ O envio de e-mail ainda não foi configurado neste computador. Rode o <b>configurar-email.bat</b> (pasta <b>configurar</b> do Gyde) antes de criar contas.</p>'
    : '';

  function login(prefillEmail = '') {
    const root = shell(`
      <h1>Entrar</h1>
      <p class="gate-sub">Bem-vindo de volta! Bora programar?</p>
      <form class="gate-form" novalidate>
        <label>E-mail<input name="email" type="email" autocomplete="email" required value="${esc(prefillEmail)}"></label>
        <label>Senha<input name="password" type="password" autocomplete="current-password" required></label>
        <p class="gate-error" role="alert" hidden></p>
        <button class="btn primary wide">Entrar</button>
      </form>
      <div class="gate-links">
        <button type="button" class="link" data-go="forgot">Esqueci minha senha</button>
        <span>Não tem conta? <button type="button" class="link" data-go="register">Criar conta</button></span>
      </div>`);
    const form = root.querySelector('form');
    form.email.focus();
    root.querySelector('[data-go="register"]').onclick = () => register();
    root.querySelector('[data-go="forgot"]').onclick = () => (personal ? localReset(form.email.value) : forgot(form.email.value));
    form.onsubmit = async (e) => {
      e.preventDefault();
      busy(form, true);
      const r = await post('/api/auth/login', { email: form.email.value, password: form.password.value });
      busy(form, false);
      if (r.ok) return onLogin(r.json.user);
      if (r.json.needsVerification) return verify(r.json.email);
      showError(form, r.json.error || 'Não deu para entrar agora.');
    };
  }

  function register() {
    const root = shell(`
      <h1>Criar conta</h1>
      <p class="gate-sub">Seu guia na programação, em português.</p>
      ${offWarning}
      <form class="gate-form" novalidate>
        <label>Como quer ser chamado?<input name="name" autocomplete="given-name" maxlength="60" required></label>
        <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
        <label>Senha<input name="password" type="password" autocomplete="new-password" minlength="8" required>
          <small>Mínimo de 8 caracteres, com letras e números.</small></label>
        <p class="gate-error" role="alert" hidden></p>
        <button class="btn primary wide">Criar conta</button>
      </form>
      <div class="gate-links"><span>Já tem conta? <button type="button" class="link" data-go="login">Entrar</button></span></div>`);
    const form = root.querySelector('form');
    form.name.focus();
    root.querySelector('[data-go="login"]').onclick = () => login(form.email.value);
    form.onsubmit = async (e) => {
      e.preventDefault();
      busy(form, true);
      const r = await post('/api/auth/register', { name: form.name.value, email: form.email.value, password: form.password.value });
      busy(form, false);
      if (r.ok && r.json.user) return onLogin(r.json.user); // modo pessoal: já entra
      if (r.ok) return verify(r.json.email);
      showError(form, r.json.error || 'Não deu para criar a conta agora.');
    };
  }

  function verify(email) {
    const root = shell(`
      <h1>Confirme seu e-mail</h1>
      <p class="gate-sub">Mandamos um código de 6 dígitos para <b>${esc(email)}</b>.</p>
      ${localHint}
      <form class="gate-form" novalidate>
        <label>Código<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" class="code-input" required></label>
        <p class="gate-error" role="alert" hidden></p>
        <button class="btn primary wide">Confirmar</button>
      </form>
      <div class="gate-links">
        <button type="button" class="link" data-go="resend">Reenviar código</button>
        <button type="button" class="link" data-go="login">Voltar</button>
      </div>`);
    const form = root.querySelector('form');
    form.code.focus();
    form.code.oninput = () => { form.code.value = form.code.value.replace(/\D/g, '').slice(0, 6); };
    root.querySelector('[data-go="login"]').onclick = () => login(email);
    root.querySelector('[data-go="resend"]').onclick = async (e) => {
      const r = await post('/api/auth/resend', { email });
      showError(form, r.ok ? '' : r.json.error);
      if (r.ok) { e.target.textContent = 'Código reenviado'; e.target.disabled = true; }
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      busy(form, true);
      const r = await post('/api/auth/verify', { email, code: form.code.value });
      busy(form, false);
      if (r.ok) return onLogin(r.json.user);
      showError(form, r.json.error || 'Código inválido.');
    };
  }

  // Modo pessoal: não há e-mail para mandar código; a senha é trocada por um script local.
  function localReset(email) {
    const root = shell(`
      <h1>Esqueceu a senha?</h1>
      <p class="gate-sub">No modo pessoal a conta fica só neste computador, então a troca é feita aqui mesmo:</p>
      <ol class="gate-steps">
        <li>Abra a pasta do Gyde (onde fica o <b>iniciar.bat</b>).</li>
        <li>Na pasta <b>configurar</b> do Gyde, dê dois cliques em <b>redefinir-senha.bat</b>.</li>
        <li>Escolha a sua conta e digite a senha nova.</li>
      </ol>
      <button type="button" class="btn primary wide" data-go="login">Voltar para entrar</button>`, 'next');
    root.querySelector('[data-go="login"]').onclick = () => login(email);
  }

  function forgot(prefillEmail = '') {
    const root = shell(`
      <h1>Trocar senha</h1>
      <p class="gate-sub">Vamos mandar um código para o seu e-mail.</p>
      <form class="gate-form" novalidate>
        <label>E-mail<input name="email" type="email" autocomplete="email" required value="${esc(prefillEmail)}"></label>
        <p class="gate-error" role="alert" hidden></p>
        <button class="btn primary wide">Enviar código</button>
      </form>
      <div class="gate-links"><button type="button" class="link" data-go="login">Voltar</button></div>`);
    const form = root.querySelector('form');
    form.email.focus();
    root.querySelector('[data-go="login"]').onclick = () => login(form.email.value);
    form.onsubmit = async (e) => {
      e.preventDefault();
      busy(form, true);
      const r = await post('/api/auth/forgot', { email: form.email.value });
      busy(form, false);
      if (r.ok) return reset(form.email.value);
      showError(form, r.json.error);
    };
  }

  function reset(email) {
    const root = shell(`
      <h1>Nova senha</h1>
      <p class="gate-sub">Se existir uma conta com <b>${esc(email)}</b>, o código chegou lá.</p>
      ${localHint}
      <form class="gate-form" novalidate>
        <label>Código<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="code-input" required></label>
        <label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="8" required>
          <small>Mínimo de 8 caracteres, com letras e números.</small></label>
        <p class="gate-error" role="alert" hidden></p>
        <button class="btn primary wide">Trocar senha</button>
      </form>
      <div class="gate-links"><button type="button" class="link" data-go="login">Voltar</button></div>`);
    const form = root.querySelector('form');
    form.code.focus();
    root.querySelector('[data-go="login"]').onclick = () => login(email);
    form.onsubmit = async (e) => {
      e.preventDefault();
      busy(form, true);
      const r = await post('/api/auth/reset', { email, code: form.code.value, password: form.password.value });
      busy(form, false);
      if (r.ok) return onLogin(r.json.user);
      showError(form, r.json.error);
    };
  }

  login();
}

// ---------- Quiz de boas-vindas ----------
const QUIZ_LANGS = { Python: 'python', JavaScript: 'javascript', Java: 'java' };
const LANG_NAME = { python: 'Python', javascript: 'JavaScript', java: 'Java' };

export async function showQuiz({ user, onDone, allowSkip = true }) {
  const { questions } = await fetch('/api/quiz').then((r) => r.json());
  const answers = {};
  let i = 0;

  // As perguntas de código aparecem na primeira linguagem escolhida que o quiz cobre (senão, Python).
  const codeLang = () => {
    const chosen = (answers.languages || []).map((l) => QUIZ_LANGS[l]).filter(Boolean);
    return chosen[0] || 'python';
  };

  function render(direction) {
    const q = questions[i];
    const isKnowledge = q.kind === 'knowledge';
    const firstKnowledge = questions.findIndex((x) => x.kind === 'knowledge');
    const lang = codeLang();
    const code = isKnowledge ? q.code[lang] : '';
    const root = shell(`
      <div class="quiz-progress" aria-hidden="true"><span style="width:${Math.round((i / questions.length) * 100)}%"></span></div>
      <p class="quiz-step">${isKnowledge ? 'Mini desafio' : 'Sobre você'} · ${i + 1} de ${questions.length}</p>
      ${i === 0 ? `<p class="gate-sub">Oi, ${esc(user.name)}! Responda rapidinho para o Gyde explicar do seu jeito.</p>` : ''}
      ${i === firstKnowledge ? `<p class="gate-note">Agora umas perguntas de código em <b>${LANG_NAME[lang]}</b>. Sem pressão: "Não sei ainda" também é resposta — isso ajuda o Gyde a saber por onde começar.</p>` : ''}
      <h1 class="quiz-title">${esc(q.title)}</h1>
      ${code ? `<div class="quiz-code"><span class="code-lang">${LANG_NAME[lang]}</span><pre><code class="hljs">${hljs.highlight(code, { language: lang }).value}</code></pre></div>` : ''}
      ${q.multi ? '<p class="gate-note">Pode marcar mais de uma.</p>' : ''}
      <div class="quiz-options" role="${q.multi ? 'group' : 'radiogroup'}">
        ${q.options.map((o, k) => {
          const selected = q.multi ? (answers[q.id] || []).includes(o) : answers[q.id] === o;
          const label = isKnowledge && o !== 'Não sei ainda' && /^[\d\s]+$/.test(o) ? `<code>${esc(o)}</code>` : esc(o);
          return `<button type="button" class="quiz-option${selected ? ' selected' : ''}" style="--i:${k}" role="${q.multi ? 'checkbox' : 'radio'}" aria-checked="${selected}" data-v="${esc(o)}">${label}</button>`;
        }).join('')}
      </div>
      <div class="quiz-nav">
        ${i > 0 ? '<button type="button" class="btn ghost" data-go="back">Voltar</button>' : allowSkip ? '<button type="button" class="btn ghost" data-go="skip">Pular por agora</button>' : '<span></span>'}
        ${q.multi ? `<button type="button" class="btn primary" data-go="next">${i === questions.length - 1 ? 'Concluir' : 'Continuar'}</button>` : ''}
      </div>`, direction);

    // A barra de progresso anima até a posição nova.
    const bar = root.querySelector('.quiz-progress span');
    requestAnimationFrame(() => { bar.style.width = `${Math.round(((i + 1) / questions.length) * 100)}%`; });

    root.querySelectorAll('.quiz-option').forEach((btn) => {
      btn.onclick = () => {
        const v = btn.dataset.v;
        if (q.multi) {
          const set = new Set(answers[q.id] || []);
          set.has(v) ? set.delete(v) : set.add(v);
          answers[q.id] = [...set];
          btn.classList.toggle('selected');
          btn.setAttribute('aria-checked', String(set.has(v)));
        } else {
          answers[q.id] = v;
          root.querySelectorAll('.quiz-option').forEach((b) => { b.classList.toggle('selected', b === btn); b.disabled = true; });
          setTimeout(next, 260); // deixa ver a seleção antes de trocar
        }
      };
    });
    root.querySelector('[data-go="next"]')?.addEventListener('click', next);
    root.querySelector('[data-go="back"]')?.addEventListener('click', () => { i--; render('back'); });
    root.querySelector('[data-go="skip"]')?.addEventListener('click', async () => {
      await post('/api/profile/skip');
      onDone(null);
    });
    root.querySelector('.quiz-option')?.focus({ preventScroll: true });
  }

  function next() {
    if (i < questions.length - 1) { i++; render('next'); return; }
    finish();
  }

  async function finish() {
    const r = await post('/api/profile', { answers });
    const { profile, results } = r.json;
    const wrong = results.filter((x) => !x.correct);
    const root = shell(`
      <p class="quiz-step">Resultado</p>
      <h1>Prontinho, ${esc(user.name.split(' ')[0])}!</h1>
      <p class="quiz-score"><span data-count="${profile.score}">0</span><small>de ${profile.total} no mini desafio</small></p>
      <p class="gate-sub">O Gyde vai te tratar como <b>${esc(profile.levelLabel)}</b>${profile.languages.length ? ` e usar exemplos em <b>${esc(profile.languages.slice(0, 3).join(', '))}</b>` : ''}.</p>
      ${wrong.length ? `<div class="quiz-review"><p>Vale reforçar:</p><ul>${wrong.map((w) => `<li><b>${esc(w.topic)}</b> — a resposta era <code>${esc(w.answer)}</code></li>`).join('')}</ul>
        <p class="gate-note">Pergunte ao Gyde sobre qualquer um desses, ou pratique na área Prática. Dá para refazer o questionário em Configurações > Prática.</p></div>` : '<p class="gate-sub">Acertou tudo! Vamos para desafios mais difíceis.</p>'}
      <button type="button" class="btn primary wide" data-go="start">Começar a usar o Gyde</button>`, 'next');

    // Contagem animada da nota + confete se foi bem.
    const el = root.querySelector('[data-count]');
    const target = Number(el.dataset.count);
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 700);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    if (target >= Math.ceil(profile.total / 2)) {
      const box = root.querySelector('.quiz-score').getBoundingClientRect();
      setTimeout(() => confetti(box.left + 30, box.top + 10), 500);
    }
    root.querySelector('[data-go="start"]').onclick = () => onDone(profile);
    root.querySelector('[data-go="start"]').focus({ preventScroll: true });
  }

  render();
}


export function hideGate() {
  const root = document.getElementById('gate');
  root.hidden = true;
  root.innerHTML = '';
}
