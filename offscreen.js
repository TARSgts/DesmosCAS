const queue = [];
let ready = false;
let _compute;
let _status = 'starting';

function report(stage, extra) {
  _status = stage + (extra ? ':' + extra : '');
  chrome.runtime.sendMessage({ type: 'cas_status', status: _status }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'cas_status_query') { sendResponse({ status: _status }); return; }
  if (msg.type !== 'cas_offscreen') return;
  if (!ready) { queue.push(msg); return; }
  compute(msg);
});

function compute(msg) {
  const { id, tabId, latex } = msg;
  try {
    const result = _compute(latex);
    chrome.runtime.sendMessage({ type: 'cas_offscreen_result', id, tabId, result: result || null }).catch(() => {});
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'cas_offscreen_result', id, tabId, result: null }).catch(() => {});
  }
}

async function init() {
  try {
    report('checking_globals', 'loadPyodide=' + typeof loadPyodide + ',createModule=' + typeof _createPyodideModule);
    report('loading_pyodide');
    const pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
    report('pyodide_loaded');
    await pyodide.loadPackage(['sympy']);
    report('sympy_loaded');
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
    report('ready');
    for (const msg of queue) compute(msg);
    queue.length = 0;
  } catch (e) {
    report('ERROR', (e && e.message ? e.message : String(e)).slice(0, 200));
    ready = true;
    _compute = () => null;
    for (const msg of queue) compute(msg);
    queue.length = 0;
  }
}

init();
