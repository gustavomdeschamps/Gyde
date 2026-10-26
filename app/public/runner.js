// Execução isolada de código (Python via Pyodide e JavaScript) em Web Workers, mais o confete das comemorações.
// Usado pelo chat (botão Executar e Passo a passo) e pela Prática.

const RUN_TIMEOUT_MS = 6000;
export const RUNNABLE = { python: 'python', py: 'python', javascript: 'javascript', js: 'javascript' };

const workers = {};
function getWorker(lang) {
  if (!workers[lang]) {
    const w = new Worker(`/runners/${lang === 'python' ? 'py' : 'js'}-worker.js`);
    workers[lang] = { w, ready: lang !== 'python' ? Promise.resolve() : new Promise((res) => {
      const onReady = (e) => { if (e.data?.type === 'ready') { w.removeEventListener('message', onReady); res(); } };
      w.addEventListener('message', onReady);
    }) };
  }
  return workers[lang];
}

// payload: { mode: 'run' | 'check' | 'trace', code, fn?, tests? }
export async function execute(lang, payload, onLoading) {
  const entry = getWorker(lang);
  let loaded = false;
  setTimeout(() => { if (!loaded) onLoading?.(); }, 150);
  await entry.ready;
  loaded = true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      entry.w.terminate();
      delete workers[lang]; // o próximo uso cria um worker novo
      resolve({ ok: false, timeout: true, error: `Tempo esgotado (${RUN_TIMEOUT_MS / 1000}s). O código pode estar num laço infinito — confira a condição de parada.`, logs: [] });
    }, RUN_TIMEOUT_MS);
    const onMsg = (e) => {
      if (e.data?.type === 'ready') return;
      clearTimeout(timer);
      entry.w.removeEventListener('message', onMsg);
      resolve(e.data);
    };
    entry.w.addEventListener('message', onMsg);
    entry.w.postMessage(payload);
  });
}

export function confetti(x = innerWidth / 2, y = innerHeight / 3) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#2f6bff', '#7aa2ff', '#22c55e', '#f59e0b', '#ec4899', '#a78bfa'];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('span');
    p.className = 'confetti';
    const angle = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 190;
    p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist + 140}px;--rot:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 80}ms`;
    document.body.append(p);
    setTimeout(() => p.remove(), 1300);
  }
}
