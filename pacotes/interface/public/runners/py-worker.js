// Executa o código Python do aluno no navegador com Pyodide, isolado num Web Worker.
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.28.3/full/';
importScripts(PYODIDE_URL + 'pyodide.js');

const ready = loadPyodide({ indexURL: PYODIDE_URL }).then((py) => {
  self.postMessage({ type: 'ready' });
  return py;
});

function deepEqual(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

// Mostra só a parte útil do traceback (o código do aluno aparece como "<exec>").
function cleanError(message) {
  const lines = String(message).trim().split('\n');
  const start = lines.findIndex((l) => l.includes('File "<exec>"'));
  const useful = start >= 0 ? lines.slice(start) : lines.slice(-3);
  return useful.join('\n').replace(/File "<exec>", /g, '').trim();
}

const HARNESS = `
import json as __json
def __gyde_run(__fn, __cases):
    __out = []
    for __args in __json.loads(__cases):
        try:
            __r = __fn(*__args)
            __out.append({"ok": True, "got": __r, "type": type(__r).__name__})
        except Exception as __e:
            __out.append({"ok": False, "error": type(__e).__name__ + ": " + str(__e)})
    return __json.dumps(__out, default=lambda o: list(o) if isinstance(o, (set, tuple)) else repr(o))
`;

// Passo a passo: grava cada linha executada com as variáveis daquele momento (limite de passos).
const TRACER = `
import sys as __sys, io as __io, json as __json, types as __types
def __gyde_trace(__src, __limit=500):
    out = __io.StringIO()
    steps = []
    class _Limite(Exception): pass
    def fmt(v):
        r = repr(v)
        return r if len(r) <= 90 else r[:87] + '...'
    def snap(d):
        res = {}
        for k, v in d.items():
            if k.startswith('__') or isinstance(v, (__types.ModuleType, __types.FunctionType, type)) or k == 'print':
                continue
            res[k] = fmt(v)
        return res
    def tracer(frame, event, arg):
        if frame.f_code.co_filename != '<gyde>':
            return None
        if event in ('line', 'return'):
            if len(steps) >= __limit:
                raise _Limite()
            stack, f = [], frame
            while f is not None and f.f_code.co_filename == '<gyde>':
                stack.append('programa principal' if f.f_code.co_name == '<module>' else f.f_code.co_name + '()')
                f = f.f_back
            is_fn = frame.f_code.co_name != '<module>'
            steps.append({
                'line': frame.f_lineno, 'event': event,
                'vars': snap(frame.f_locals), 'globals': snap(frame.f_globals) if is_fn else None,
                'stack': stack[::-1], 'out': out.getvalue(),
                'ret': fmt(arg) if event == 'return' and is_fn else None,
            })
        return tracer
    old = __sys.stdout
    __sys.stdout = out
    err = None
    try:
        __sys.settrace(tracer)
        exec(compile(__src, '<gyde>', 'exec'), {'__name__': '__main__'})
    except _Limite:
        err = 'Parei depois de ' + str(__limit) + ' passos (laço muito longo ou infinito).'
    except Exception as e:
        tb = e.__traceback__
        line = None
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == '<gyde>':
                line = tb.tb_lineno
            tb = tb.tb_next
        err = type(e).__name__ + ': ' + str(e) + (' (linha ' + str(line) + ')' if line else '')
    finally:
        __sys.settrace(None)
        __sys.stdout = old
    return __json.dumps({'steps': steps, 'error': err, 'out': out.getvalue()})
`;

self.onmessage = async (e) => {
  const { code, fn, tests, mode } = e.data;
  const py = await ready;
  if (mode === 'trace') {
    const ns = py.globals.get('dict')();
    try {
      py.runPython(TRACER, { globals: ns });
      const result = JSON.parse(ns.get('__gyde_trace')(code));
      self.postMessage({ ok: true, ...result });
    } catch (err) {
      self.postMessage({ ok: false, error: cleanError(err.message), steps: [] });
    } finally {
      ns.destroy();
    }
    return;
  }
  const logs = [];
  py.setStdout({ batched: (s) => logs.push(s) });
  py.setStderr({ batched: (s) => logs.push(s) });
  const ns = py.globals.get('dict')();
  try {
    try {
      py.runPython(code, { globals: ns });
    } catch (err) {
      self.postMessage({ ok: false, error: cleanError(err.message), logs });
      return;
    }
    if (mode === 'run') { self.postMessage({ ok: true, logs }); return; }
    const fnRef = ns.get(fn);
    if (!fnRef || typeof fnRef !== 'function') {
      self.postMessage({ ok: false, error: `Não encontrei a função "${fn}". Confira se o nome está igual ao do enunciado.`, logs });
      return;
    }
    py.runPython(HARNESS, { globals: ns });
    const out = JSON.parse(ns.get('__gyde_run')(fnRef, JSON.stringify(tests.map((t) => t.args))));
    const results = tests.map((t, i) => {
      const r = out[i];
      if (!r.ok) return { args: t.args, expected: t.expected, pass: false, error: r.error };
      // Em Python, True == 1; aqui exigimos o tipo certo (bool para bool).
      const typeOk = typeof t.expected !== 'boolean' || r.type === 'bool';
      return { args: t.args, expected: t.expected, got: r.got, pass: typeOk && deepEqual(r.got, t.expected) };
    });
    self.postMessage({ ok: true, logs, results });
  } catch (err) {
    self.postMessage({ ok: false, error: cleanError(err.message), logs });
  } finally {
    ns.destroy();
  }
};
