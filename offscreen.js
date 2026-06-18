const queue = [];
let ready = false;

// Queue messages that arrive before Pyodide finishes loading
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'cas_offscreen') return;
  if (!ready) { queue.push(msg); return; }
  compute(msg);
});

let _compute;

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
    const pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
    await pyodide.loadPackage(['sympy']);
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
    // Drain queue
    for (const msg of queue) compute(msg);
    queue.length = 0;
  } catch (e) {
    // Pyodide failed — drain queue with null results
    ready = true;
    _compute = () => null;
    for (const msg of queue) compute(msg);
    queue.length = 0;
  }
}

init();
