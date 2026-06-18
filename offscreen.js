const queue = [];
let ready = false;
let _compute;

function store(s) {
  // Report via runtime message (background persists it) — avoids depending on
  // chrome.storage being available in the offscreen context
  try { chrome.runtime.sendMessage({ type: 'cas_status', status: s }).catch(() => {}); } catch (e) {}
}

// Capture any top-level error from the pyodide scripts loaded after this one
window.addEventListener('error', (e) => {
  store('SCRIPT_ERROR:' + (e.message || '').slice(0, 180) + ' @ ' + (e.filename || '').split('/').pop());
});

// Confirm offscreen.js executed
store('offscreen_js_loaded');

function compute(msg) {
  const { id, tabId, latex } = msg;
  try {
    const result = _compute(latex);
    chrome.runtime.sendMessage({ type: 'cas_offscreen_result', id, tabId, result: result || null }).catch(() => {});
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'cas_offscreen_result', id, tabId, result: null }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'cas_offscreen') return;
  if (!ready) { queue.push(msg); return; }
  compute(msg);
});

// Defer init until ALL scripts (pyodide.js, pyodide.asm.js) have loaded
window.addEventListener('load', () => {
  store('window_loaded:loadPyodide=' + typeof loadPyodide + ',createModule=' + typeof _createPyodideModule);
  init();
});

async function init() {
  try {
    if (typeof loadPyodide !== 'function') { store('ERROR:loadPyodide_undefined'); return; }
    store('loading_pyodide');
    const pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
    store('pyodide_loaded');
    await pyodide.loadPackage(['sympy']);
    store('sympy_loaded');
    pyodide.runPython(`
from sympy import *
from sympy.parsing.latex import parse_latex
import re as _re

def cas_compute(latex_str):
    try:
        expr = parse_latex(latex_str)
        e_sym = Symbol('e')
        if e_sym in expr.free_symbols:
            expr = expr.subs(e_sym, E)
        result = expr.doit()
        result = simplify(result)
        s = str(result)
        s = s.replace('**', '^')
        if 'Integral(' in s or 'Derivative(' in s:
            return None
        if _re.match(r'^-?[0-9]+\.[0-9]+$', s):
            return None
        return s
    except Exception:
        return None
`);
    _compute = (latex) => pyodide.globals.get('cas_compute')(latex);
    ready = true;
    store('READY');
    for (const m of queue) compute(m);
    queue.length = 0;
  } catch (e) {
    store('INIT_ERROR:' + (e && e.message ? e.message : String(e)).slice(0, 180));
    ready = true;
    _compute = () => null;
    for (const m of queue) compute(m);
    queue.length = 0;
  }
}
