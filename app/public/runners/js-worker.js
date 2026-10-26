// Executa o código JavaScript do aluno isolado num Web Worker (sem acesso à página).
function fmt(v) {
  if (typeof v === 'string') return v;
  if (v === undefined) return 'undefined';
  try { return JSON.stringify(v); } catch { return String(v); }
}

function deepEqual(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9 || (Number.isNaN(a) && Number.isNaN(b));
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

self.onmessage = (e) => {
  const { code, fn, tests, mode } = e.data;
  const logs = [];
  const fakeConsole = {
    log: (...a) => logs.push(a.map(fmt).join(' ')),
    info: (...a) => logs.push(a.map(fmt).join(' ')),
    warn: (...a) => logs.push('⚠︎ ' + a.map(fmt).join(' ')),
    error: (...a) => logs.push('✖ ' + a.map(fmt).join(' ')),
  };
  let fnRef;
  try {
    // O nome da função vem dos dados do exercício (identificador simples), não do aluno.
    fnRef = new Function('console', `"use strict";\n${code}\n;return (typeof ${fn} === "function") ? ${fn} : undefined;`)(fakeConsole);
  } catch (err) {
    self.postMessage({ ok: false, error: `${err.name}: ${err.message}`, logs });
    return;
  }
  if (mode === 'run') { self.postMessage({ ok: true, logs }); return; }
  if (!fnRef) { self.postMessage({ ok: false, error: `Não encontrei a função "${fn}". Confira se o nome está igual ao do enunciado.`, logs }); return; }

  const results = tests.map((t) => {
    try {
      const got = fnRef(...structuredClone(t.args));
      return { args: t.args, expected: t.expected, got: got === undefined ? '__undefined__' : got, pass: deepEqual(got, t.expected) };
    } catch (err) {
      return { args: t.args, expected: t.expected, pass: false, error: `${err.name}: ${err.message}` };
    }
  });
  self.postMessage({ ok: true, logs, results });
};
