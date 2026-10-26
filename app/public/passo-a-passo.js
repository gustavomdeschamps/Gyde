// Passo a passo visual (estilo Python Tutor): mostra a linha que vai rodar, as variáveis, a pilha e a saída.
import hljs from '/vendor/hljs/es/highlight.min.js';
import { execute } from '/runner.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = {
  first: '<svg viewBox="0 0 24 24"><path d="M6 5v14M18 6l-8 6 8 6z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  last: '<svg viewBox="0 0 24 24"><path d="M18 5v14M6 6l8 6-8 6z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

export async function openTrace(code) {
  const dlg = document.createElement('dialog');
  dlg.className = 'dialog trace-dialog';
  dlg.innerHTML = `<div class="trace-head"><h2>Passo a passo</h2><span class="trace-sub">Python</span>
    <button class="icon-btn" data-act="close" aria-label="Fechar">${ic.close}</button></div>
    <div class="trace-body"><div class="loading-line"><div class="thinking"><i></i><i></i><i></i></div>Executando e gravando cada passo…</div></div>`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.querySelector('[data-act="close"]').onclick = () => dlg.close();
  dlg.showModal();

  const r = await execute('python', { mode: 'trace', code }, () => {
    dlg.querySelector('.loading-line').lastChild.textContent = 'Preparando o Python no navegador… (só demora na primeira vez)';
  });
  if (!dlg.isConnected) return;
  if (!r.ok && !r.steps?.length) {
    dlg.querySelector('.trace-body').innerHTML = `<p class="msg-error">${esc(r.error || 'Não consegui executar.')}</p>`;
    return;
  }

  // Passo final sintético: estado depois da última linha.
  const steps = [...r.steps];
  const last = steps.at(-1);
  steps.push({ line: null, event: 'end', vars: last?.vars || {}, globals: null, stack: [], out: r.out, error: r.error });
  const lines = code.replace(/\n$/, '').split('\n');
  const highlighted = lines.map((l) => hljs.highlight(l || ' ', { language: 'python', ignoreIllegals: true }).value);

  dlg.querySelector('.trace-body').innerHTML = `
    <div class="trace-grid">
      <div class="trace-code" aria-label="Código"></div>
      <div class="trace-side">
        <section><h3>Variáveis</h3><div class="trace-vars"></div></section>
        <section><h3>Pilha de chamadas</h3><div class="trace-stack"></div></section>
        <section><h3>Saída</h3><pre class="trace-out"></pre></section>
      </div>
    </div>
    <div class="trace-explain" role="status"></div>
    <div class="trace-controls">
      <button class="icon-btn" data-go="first" title="Início">${ic.first}</button>
      <button class="icon-btn" data-go="prev" title="Passo anterior (seta para a esquerda)">${ic.prev}</button>
      <button class="btn primary small" data-go="play">${ic.play}<span>Reproduzir</span></button>
      <button class="icon-btn" data-go="next" title="Próximo passo (seta para a direita)">${ic.next}</button>
      <button class="icon-btn" data-go="last" title="Fim">${ic.last}</button>
      <input type="range" min="0" max="${steps.length - 1}" value="0" aria-label="Passo">
      <span class="trace-count"></span>
    </div>`;

  const codeEl = dlg.querySelector('.trace-code');
  codeEl.innerHTML = highlighted.map((h, i) => `<div class="tl" data-line="${i + 1}"><span class="ln">${i + 1}</span><code class="hljs">${h}</code></div>`).join('');
  const slider = dlg.querySelector('input[type="range"]');
  let i = 0;
  let timer = null;

  function varsTable(cur, prev) {
    const keys = Object.keys(cur);
    if (!keys.length) return '<p class="trace-empty">Nenhuma variável ainda.</p>';
    return `<table>${keys.map((k) => {
      const changed = prev && prev[k] !== cur[k];
      return `<tr class="${changed ? 'changed' : ''}"><th>${esc(k)}</th><td><code>${esc(cur[k])}</code></td></tr>`;
    }).join('')}</table>`;
  }

  function render() {
    const s = steps[i];
    const prev = steps[i - 1];
    codeEl.querySelectorAll('.tl').forEach((el) => {
      const n = Number(el.dataset.line);
      el.classList.toggle('current', n === s.line);
      el.classList.toggle('was', prev && n === prev.line && n !== s.line);
    });
    codeEl.querySelector('.tl.current')?.scrollIntoView({ block: 'nearest' });
    let vars = varsTable(s.vars, prev && prev.stack.at(-1) === s.stack.at(-1) ? prev.vars : null);
    if (s.globals && Object.keys(s.globals).length) vars += `<h4>Do programa principal</h4>${varsTable(s.globals, null)}`;
    dlg.querySelector('.trace-vars').innerHTML = vars;
    dlg.querySelector('.trace-stack').innerHTML = s.stack.length
      ? s.stack.map((f, k) => `<div class="frame${k === s.stack.length - 1 ? ' top' : ''}">${esc(f)}</div>`).join('')
      : '<p class="trace-empty">Programa terminou.</p>';
    dlg.querySelector('.trace-out').textContent = s.out || '';
    let msg;
    if (s.event === 'end') msg = s.error ? `<b>Erro:</b> ${esc(s.error)}` : '<b>Fim.</b> O programa terminou sem erros.';
    else if (s.event === 'return') msg = `A função <code>${esc(s.stack.at(-1))}</code> termina e devolve <code>${esc(s.ret)}</code>.`;
    else msg = `A linha <b>${s.line}</b> é a próxima a rodar${s.stack.length > 1 ? `, dentro de <code>${esc(s.stack.at(-1))}</code>` : ''}.`;
    const explain = dlg.querySelector('.trace-explain');
    explain.innerHTML = msg;
    explain.classList.toggle('error', Boolean(s.event === 'end' && s.error));
    slider.value = i;
    dlg.querySelector('.trace-count').textContent = `${i + 1} de ${steps.length}`;
  }

  const go = (n) => { i = Math.max(0, Math.min(steps.length - 1, n)); render(); };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    const b = dlg.querySelector('[data-go="play"]');
    b.innerHTML = `${ic.play}<span>Reproduzir</span>`;
  };
  dlg.querySelector('.trace-controls').onclick = (e) => {
    const act = e.target.closest('[data-go]')?.dataset.go;
    if (!act) return;
    if (act === 'play') {
      if (timer) return stop();
      if (i >= steps.length - 1) go(0);
      e.target.closest('button').innerHTML = `${ic.pause}<span>Pausar</span>`;
      timer = setInterval(() => { if (i >= steps.length - 1) stop(); else go(i + 1); }, 700);
      return;
    }
    stop();
    go({ first: 0, prev: i - 1, next: i + 1, last: steps.length - 1 }[act]);
  };
  slider.oninput = () => { stop(); go(Number(slider.value)); };
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); stop(); go(i + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); go(i - 1); }
  });
  dlg.addEventListener('close', stop);
  render();
}
