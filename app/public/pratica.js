// Área de Prática: trilhas, exercícios, editor com código colorido e correção automática no navegador.
import { TRACK_ICONS } from '/icones.js';
import hljs from '/vendor/hljs/es/highlight.min.js';
import { execute, confetti } from '/runner.js';
import { openTrace } from '/passo-a-passo.js';

const HEADERS = { 'Content-Type': 'application/json', 'x-gyde': '1' };
const LANG_LABEL = { python: 'Python', javascript: 'JavaScript' };
const FILE_EXT = { python: 'py', javascript: 'js' };

const icons = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 5v14l11-7z"/></svg>',
  test: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/></svg>',
  bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/></svg>',
  steps: '<svg viewBox="0 0 24 24"><path d="M4 6h10M4 12h6M4 18h10M17 9l3 3-3 3"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Mostra valores no jeito da linguagem (True/None em Python).
function show(v, lang) {
  if (v === '__undefined__') return 'undefined';
  const json = JSON.stringify(v);
  if (lang !== 'python' || json === undefined) return json ?? String(v);
  return json.replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None');
}

// ---------- Editor com destaque de sintaxe ----------
function createEditor(container, { code, lang, onChange }) {
  container.innerHTML = `<div class="editor">
    <div class="gutter" aria-hidden="true"></div>
    <div class="area"><pre aria-hidden="true"><code class="hljs"></code></pre>
      <textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Editor de código"></textarea></div>
  </div>`;
  const ta = container.querySelector('textarea');
  const out = container.querySelector('code');
  const gutter = container.querySelector('.gutter');
  const area = container.querySelector('.area');
  const indent = lang === 'python' ? '    ' : '  ';

  const paint = () => {
    const value = ta.value;
    out.innerHTML = hljs.highlight(value + (value.endsWith('\n') ? ' ' : ''), { language: lang, ignoreIllegals: true }).value;
    const lines = value.split('\n').length;
    gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    // A textarea cresce junto com o conteúdo; quem rola é o .editor.
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight, area.clientHeight)}px`;
    ta.style.width = 'auto';
    ta.style.width = `${Math.max(ta.scrollWidth, area.clientWidth)}px`;
  };
  ta.value = code;
  ta.addEventListener('input', () => { paint(); onChange?.(ta.value); });
  ta.addEventListener('keydown', (e) => {
    const { selectionStart: s, selectionEnd: end, value } = ta;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', s - 1) + 1;
        if (value.startsWith(indent, lineStart)) {
          ta.setRangeText('', lineStart, lineStart + indent.length, 'preserve');
        }
      } else {
        ta.setRangeText(indent, s, end, 'end');
      }
      ta.dispatchEvent(new Event('input'));
    } else if (e.key === 'Enter' && !e.ctrlKey) {
      // Mantém a indentação da linha anterior (e aumenta depois de ":" ou "{").
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const line = value.slice(lineStart, s);
      let lead = line.match(/^\s*/)[0];
      if (/[:{[(]\s*$/.test(line)) lead += indent;
      ta.setRangeText('\n' + lead, s, end, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  });
  requestAnimationFrame(paint);
  return {
    get value() { return ta.value; },
    set value(v) { ta.value = v; paint(); onChange?.(v); },
    focus() { ta.focus(); },
  };
}

// ---------- Telas ----------
export function createPractice({ root, api, toast, renderMarkdown, onXp, getProfile }) {
  let data = null;
  let drafts = {};

  async function load(force = false) {
    if (!data || force) {
      data = await api('/api/pratica');
      onXp(data.xp);
    }
    return data;
  }

  const trackDone = (t) => t.exercises.filter((e) => data.progress[e.id]?.done).length;

  function recommendedTrack() {
    const p = getProfile() || {};
    if (p.level === 'intermediate' || p.level === 'advanced') return 'logica';
    if ((p.languages || []).includes('JavaScript') && !(p.languages || []).includes('Python')) return 'js-zero';
    return 'python-basico';
  }

  // Acha um exercício e a trilha dele.
  function findEx(id) {
    for (const t of data.tracks) {
      const ex = t.exercises.find((e) => e.id === id);
      if (ex) return { t, ex };
    }
    return null;
  }
  const exLink = (id) => { const f = findEx(id); return f ? `#/pratica/${f.t.id}/${f.ex.id}` : '#/pratica'; };

  function trackCard(t, i, rec) {
    const done = trackDone(t);
    const pct = Math.round((done / t.exercises.length) * 100);
    return `<a class="track-card" href="#/pratica/${t.id}" style="--i:${i};--track:${t.color}">
      <div class="track-top"><span class="track-icon">${TRACK_ICONS[t.icon] || esc(t.icon)}</span><span class="lang-badge">${LANG_LABEL[t.lang]}</span></div>
      ${t.id === rec && done < t.exercises.length ? '<span class="recommended">Recomendada para você</span>' : ''}
      <h2>${esc(t.title)}</h2>
      <p>${esc(t.description)}</p>
      <div class="progress"><span data-w="${pct}"></span></div>
      <div class="track-meta"><span>${done}/${t.exercises.length} ${t.projeto ? 'etapas' : 'exercícios'}</span><span>${pct === 100 ? 'Concluído ✓' : done ? 'Continuar →' : 'Começar →'}</span></div>
    </a>`;
  }

  async function renderHome() {
    root.innerHTML = '<div class="skills-inner"><div class="skeleton" style="height:120px;margin-top:24px"></div><div class="skeleton" style="height:180px"></div></div>';
    await load(true);
    const totalEx = data.tracks.reduce((s, t) => s + t.exercises.length, 0);
    const doneEx = data.tracks.reduce((s, t) => s + trackDone(t), 0);
    const rec = recommendedTrack();
    const d = data.desafio;
    const daily = findEx(d.exerciseId);
    const dueReviews = data.revisoes.filter((r) => r.due && findEx(r.exerciseId));
    const nextReview = data.revisoes.filter((r) => !r.due).sort((a, b) => a.dueAt - b.dueAt)[0];
    const reforco = data.reforco.slice(0, 4).map(findEx).filter(Boolean);
    const seq = data.sequencia;
    const fmtDay = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

    root.innerHTML = `<div class="skills-inner">
      <header class="skills-hero">
        <div><h1>Prática</h1><p>Aprenda fazendo: escreva o código, rode os testes e ganhe XP. Travou? Peça uma dica ao Gyde — ele te guia sem entregar a resposta.</p></div>
        <div class="hero-stats">
          <div class="xp-card">${icons.star}<div><b>${data.xp} XP</b><small>${doneEx} de ${totalEx} feitos</small></div></div>
          <div class="streak-card${seq.praticouHoje ? ' on' : ''}" title="Dias seguidos praticando">${icons.bolt}<div><b>${seq.dias} ${seq.dias === 1 ? 'dia' : 'dias'}</b><small>${seq.praticouHoje ? 'sequência garantida hoje' : seq.dias ? 'pratique hoje para manter' : 'comece sua sequência'}</small></div></div>
        </div>
      </header>

      <div class="today-grid">
        ${daily ? `<a class="today-card daily${d.rewarded ? ' done' : ''}" href="${exLink(d.exerciseId)}" style="--track:${daily.t.color}">
          <span class="today-label">${icons.target}Desafio do dia</span>
          <b>${esc(daily.ex.title)}</b>
          <small>${esc(daily.t.title)} · ${LANG_LABEL[daily.t.lang]}</small>
          <span class="today-reward">${d.rewarded ? `${icons.check} Feito hoje` : `XP em dobro: +${daily.ex.xp * 2} XP`}</span>
        </a>` : ''}
        <div class="today-card review">
          <span class="today-label">${icons.reset}Revisão</span>
          ${dueReviews.length
            ? `<b>${dueReviews.length} para revisar hoje</b><div class="review-list">${dueReviews.slice(0, 4).map((r) => { const f = findEx(r.exerciseId); return `<a href="${exLink(r.exerciseId)}">${esc(f.ex.title)}<span>nível ${r.level + 1}/4</span></a>`; }).join('')}</div>`
            : `<b>Nada para revisar agora</b><small>${nextReview ? `Próxima revisão em ${fmtDay(nextReview.dueAt)}.` : 'Exercícios em que você errou antes de acertar voltam aqui depois de 1, 3, 7 e 21 dias.'}</small>`}
        </div>
      </div>

      ${reforco.length ? `<section class="reforco"><h2 class="section-title">Para reforçar <small>pelo seu quiz de nível</small></h2>
        <div class="chip-row">${reforco.map(({ t, ex }) => `<a class="chip-link" href="#/pratica/${t.id}/${ex.id}" style="--track:${t.color}"><span class="dot"></span>${esc(ex.title)}<small>${LANG_LABEL[t.lang]}</small></a>`).join('')}</div></section>` : ''}

      <h2 class="section-title">Trilhas</h2>
      <div class="track-grid">${data.tracks.filter((t) => !t.projeto).map((t, i) => trackCard(t, i, rec)).join('')}</div>

      <h2 class="section-title">Projetos guiados <small>construa algo de verdade, etapa por etapa</small></h2>
      <div class="track-grid">${data.tracks.filter((t) => t.projeto).map((t, i) => trackCard(t, i + 3, rec)).join('')}</div>

      <section class="ranking">
        <h2 class="section-title">Ranking da semana <small>XP dos últimos 7 dias</small></h2>
        <div class="ranking-card">
          <ol class="rank-list">${data.ranking.map((r, i) => `<li class="${r.voce ? 'me' : ''}" style="--i:${i}"><span class="pos">${i + 1}</span><span class="who">${esc(r.name)}${r.voce ? ' <small>(você)</small>' : ''}</span><span class="seq">${icons.bolt}${r.sequencia}</span><b>${r.xpSemana} XP</b></li>`).join('')}</ol>
          ${data.ranking.length === 1 ? '<p class="rank-empty">Adicione amigos para competir. Os dois precisam se adicionar — assim ninguém vê seu XP sem você querer.</p>' : ''}
          ${data.pedidos.length ? `<div class="friend-requests"><small>Querem ser seus amigos:</small>${data.pedidos.map((p) => `<button class="btn small" data-accept="${esc(p.email)}">${icons.plus}${esc(p.name)}</button>`).join('')}</div>` : ''}
          ${data.aguardando.length ? `<p class="rank-empty">Aguardando: ${data.aguardando.map((a) => esc(a.name)).join(', ')}</p>` : ''}
          <form class="friend-form"><input type="email" name="email" placeholder="E-mail de um amigo neste Gyde" required><button class="btn">Adicionar</button></form>
        </div>
      </section>
    </div>`;
    animateBars();

    const addFriend = async (email) => {
      try {
        data = { ...data, ...(await api('/api/amigos', { method: 'POST', headers: HEADERS, body: JSON.stringify({ email }) })) };
        toast('Pedido enviado. Vira amizade quando a outra pessoa te adicionar também.');
        renderHome();
      } catch (err) { toast(err.message); }
    };
    root.querySelector('.friend-form').onsubmit = (e) => { e.preventDefault(); addFriend(e.target.email.value.trim()); };
    root.querySelectorAll('[data-accept]').forEach((b) => { b.onclick = () => addFriend(b.dataset.accept); });
  }

  function animateBars() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.querySelectorAll('.progress span[data-w]').forEach((s) => { s.style.width = `${s.dataset.w}%`; });
    }));
  }

  async function renderTrack(trackId) {
    await load();
    const t = data.tracks.find((x) => x.id === trackId);
    if (!t) { location.hash = '#/pratica'; return; }
    const done = trackDone(t);
    root.innerHTML = `<div class="skills-inner" style="--track:${t.color}">
      <nav class="crumbs"><a href="#/pratica">Prática</a><span>›</span><span>${esc(t.title)}</span></nav>
      <header class="skills-hero"><div><h1>${esc(t.title)}</h1><p>${esc(t.description)}</p></div>
        <div style="min-width:220px"><div class="track-meta" style="margin-bottom:8px"><span>${done}/${t.exercises.length} feitos</span><span>${LANG_LABEL[t.lang]}</span></div><div class="progress"><span data-w="${Math.round((done / t.exercises.length) * 100)}"></span></div></div>
      </header>
      <div class="ex-list">
        ${t.exercises.map((ex, i) => {
          const isDone = data.progress[ex.id]?.done;
          return `<a class="ex-item${isDone ? ' done' : ''}" href="#/pratica/${t.id}/${ex.id}" style="--i:${i}">
            <span class="ex-num">${isDone ? icons.check : i + 1}</span>
            <span class="ex-title"><b>${esc(ex.title)}</b><small>${ex.tests.length} testes · função <code>${esc(ex.fn)}</code></small></span>
            <span class="xp-pill">+${ex.xp} XP</span>
          </a>`;
        }).join('')}
      </div></div>`;
    animateBars();
  }

  async function renderExercise(trackId, exId) {
    await load();
    const t = data.tracks.find((x) => x.id === trackId);
    const idx = t?.exercises.findIndex((e) => e.id === exId) ?? -1;
    if (!t || idx < 0) { location.hash = '#/pratica'; return; }
    const ex = t.exercises[idx];
    const next = t.exercises[idx + 1];
    const isDone = data.progress[ex.id]?.done;
    const isDaily = data.desafio.exerciseId === ex.id && !data.desafio.rewarded;
    const reviewDue = data.revisoes.find((r) => r.exerciseId === ex.id && r.due);
    // Revisão: começa do zero para praticar de verdade. Projeto: continua o código da etapa anterior.
    let code = drafts[ex.id] ?? (reviewDue ? null : data.progress[ex.id]?.code);
    if (!code && t.projeto && idx > 0) {
      const prev = t.exercises[idx - 1];
      const prevCode = drafts[prev.id] ?? data.progress[prev.id]?.code ?? '';
      code = prevCode ? `${prevCode.replace(/\s+$/, '')}\n${ex.starter}` : null;
    }
    const badges = [
      `<span class="xp-pill">+${ex.xp} XP${isDone && !reviewDue ? ' · feito ✓' : ''}</span>`,
      isDaily ? `<span class="badge daily">${icons.target}Desafio do dia · XP em dobro</span>` : '',
      reviewDue ? `<span class="badge review">${icons.reset}Revisão · nível ${reviewDue.level + 1}/4</span>` : '',
      t.projeto ? `<span class="badge">Etapa ${idx + 1} de ${t.exercises.length}</span>` : '',
    ].join('');

    root.innerHTML = `<div class="skills-inner" style="--track:${t.color}">
      <nav class="crumbs"><a href="#/pratica">Prática</a><span>›</span><a href="#/pratica/${t.id}">${esc(t.title)}</a><span>›</span><span>${idx + 1}. ${esc(ex.title)}</span></nav>
      <div class="ex-layout">
        <section class="ex-panel">
          <div class="badges">${badges}</div>
          ${reviewDue ? '<p class="gate-note">Revisão: escreva a solução de novo, sem olhar a antiga. É assim que o conteúdo fixa.</p>' : ''}
          <h1>${esc(ex.title)}</h1>
          <div class="md">${renderMarkdown(ex.statement)}</div>
          <div class="ex-tests"><h3>Testes</h3>${ex.tests.map((tc, i) => testRow(tc, i, null, t.lang, ex.fn)).join('')}</div>
          <div id="hintSlot"></div>
          <div id="successSlot"></div>
        </section>
        <section class="editor-card">
          <div class="editor-head"><span class="file">solucao.${FILE_EXT[t.lang]}</span><span class="spacer"></span>
            <button class="icon-btn" data-act="reset" title="Recomeçar do código inicial" aria-label="Recomeçar">${icons.reset}</button></div>
          <div id="editorSlot"></div>
          <div class="editor-actions">
            <button class="btn" data-act="run">${icons.play}Executar</button>
            <button class="btn primary" data-act="check">${icons.test}Verificar</button>
            <button class="btn ghost" data-act="hint">${icons.bulb}Dica do Gyde</button>
            ${t.lang === 'python' ? `<button class="btn ghost" data-act="trace">${icons.steps}Passo a passo</button>` : ''}
          </div>
          <div class="console" id="console" role="log"></div>
        </section>
      </div></div>`;

    const consoleEl = root.querySelector('#console');
    const editor = createEditor(root.querySelector('#editorSlot'), {
      code: code || ex.starter,
      lang: t.lang,
      onChange: (v) => { drafts[ex.id] = v; },
    });
    let lastResults = [];

    const setBusy = (on) => root.querySelectorAll('.editor-actions .btn').forEach((b) => { b.disabled = on; });
    const showLoading = () => {
      consoleEl.innerHTML = `<div class="loading-line"><div class="thinking"><i></i><i></i><i></i></div>Preparando o ${LANG_LABEL[t.lang]} no seu navegador… (só demora na primeira vez)</div>`;
    };
    const printLogs = (r) => {
      const parts = (r.logs || []).map((l) => esc(l));
      if (r.error) parts.push(`<span class="err">${esc(r.error)}</span>`);
      consoleEl.innerHTML = parts.join('\n');
    };

    root.querySelector('[data-act="reset"]').onclick = () => {
      if (!confirm('Voltar para o código inicial? O que você escreveu será perdido.')) return;
      editor.value = ex.starter;
    };

    root.querySelector('[data-act="run"]').onclick = async () => {
      setBusy(true);
      consoleEl.textContent = '';
      const r = await execute(t.lang, { mode: 'run', code: editor.value, fn: ex.fn, tests: [] }, showLoading);
      printLogs(r);
      if (r.ok && !r.logs?.length) consoleEl.innerHTML = '<span class="ok">Rodou sem erros.</span> Use print/console.log para ver valores, ou clique em Verificar.';
      setBusy(false);
    };

    root.querySelector('[data-act="check"]').onclick = async () => {
      setBusy(true);
      consoleEl.textContent = '';
      root.querySelector('#successSlot').innerHTML = '';
      // Limpa o resultado anterior para não confundir com o novo.
      root.querySelectorAll('.ex-tests .test-row').forEach((row) => { row.className = 'test-row'; row.querySelector('.test-icon').innerHTML = ''; });
      const r = await execute(t.lang, { mode: 'check', code: editor.value, fn: ex.fn, tests: ex.tests }, showLoading);
      printLogs(r);
      const testsEl = root.querySelector('.ex-tests');
      if (!r.ok || !r.results) {
        testsEl.querySelectorAll('.test-row').forEach((row) => { row.className = 'test-row fail'; });
        lastResults = ex.tests.map((tc) => ({ ...tc, pass: false, error: r.error }));
        setBusy(false);
        return;
      }
      lastResults = r.results;
      testsEl.innerHTML = '<h3>Testes</h3>' + r.results.map((res, i) => testRow(res, i, res, t.lang, ex.fn)).join('');
      const passed = r.results.every((x) => x.pass);
      const count = r.results.filter((x) => x.pass).length;
      if (!r.logs?.length) consoleEl.innerHTML = passed ? '<span class="ok">Todos os testes passaram!</span>' : `${count} de ${r.results.length} testes passaram.`;
      const result = await api('/api/pratica/progress', { method: 'POST', headers: HEADERS, body: JSON.stringify({ exerciseId: ex.id, code: editor.value, passed }) });
      data = { ...data, ...result };
      onXp(data.xp);
      if (passed) {
        const ganhos = result.ganhos || [];
        const total = ganhos.reduce((s, g) => s + g.xp, 0);
        const btn = root.querySelector('[data-act="check"]').getBoundingClientRect();
        confetti(btn.left + btn.width / 2, btn.top);
        root.querySelector('#successSlot').innerHTML = `<div class="success-banner">
          <div><b>Mandou bem! ${total ? `+${total} XP` : 'Exercício já concluído antes.'}</b>
            <small>${ganhos.length ? ganhos.map((g) => `${esc(g.motivo)}: +${g.xp}`).join(' · ') : `Todos os ${r.results.length} testes passaram.`}</small></div>
          ${next ? `<a class="btn primary" href="#/pratica/${t.id}/${next.id}">${t.projeto ? 'Próxima etapa' : 'Próximo'} ${icons.arrow}</a>` : `<a class="btn primary" href="#/pratica">${t.projeto ? 'Projeto concluído' : 'Trilha concluída'} ${icons.check}</a>`}
        </div>`;
      }
      setBusy(false);
    };

    // O exercício só define a função: chamamos com a entrada do 1º teste para ter o que acompanhar.
    root.querySelector('[data-act="trace"]')?.addEventListener('click', () => {
      const args = ex.tests[0].args.map((a) => show(a, 'python')).join(', ');
      openTrace(`${editor.value.replace(/\s+$/, '')}\n\n# chamada de exemplo (1º teste)\nprint(${ex.fn}(${args}))\n`);
    });

    root.querySelector('[data-act="hint"]').onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const slot = root.querySelector('#hintSlot');
      slot.innerHTML = `<div class="hint-box"><h3>${icons.bulb}Dica do Gyde</h3><div class="thinking"><i></i><i></i><i></i></div></div>`;
      try {
        const { hint } = await api('/api/pratica/hint', { method: 'POST', headers: HEADERS, body: JSON.stringify({ exerciseId: ex.id, code: editor.value, results: lastResults }) });
        slot.innerHTML = `<div class="hint-box"><h3>${icons.bulb}Dica do Gyde</h3><div class="md">${renderMarkdown(hint)}</div></div>`;
      } catch (err) {
        slot.innerHTML = '';
        toast(err.message);
      }
      btn.disabled = false;
    };

    editor.focus();
  }

  function testRow(tc, i, res, lang, fn) {
    const call = `${fn}(${tc.args.map((a) => show(a, lang)).join(', ')})`;
    const cls = res ? (res.pass ? ' pass' : ' fail') : '';
    const icon = res ? (res.pass ? icons.check : icons.x) : '';
    let detail = `esperado: <code>${esc(show(tc.expected, lang))}</code>`;
    if (res && !res.pass) detail += res.error ? ` · <span>${esc(res.error)}</span>` : ` · recebido: <code>${esc(show(res.got, lang))}</code>`;
    return `<div class="test-row${cls}" style="--i:${i}"><span class="test-icon">${icon}</span><span><code>${esc(call)}</code><span class="test-detail">${detail}</span></span></div>`;
  }

  return {
    async show(parts) {
      try {
        if (parts.length >= 2) await renderExercise(parts[0], parts[1]);
        else if (parts.length === 1) await renderTrack(parts[0]);
        else await renderHome();
        root.scrollTop = 0;
      } catch (err) {
        root.innerHTML = `<div class="skills-inner"><p class="msg-error">${esc(err.message)}</p></div>`;
      }
    },
    refreshXp: () => load(true).catch(() => {}),
  };
}
