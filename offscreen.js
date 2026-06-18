// pyodide.js + pyodide.asm.js are pre-loaded by offscreen.html
// loadPyodide skips the dynamic CDN import since _createPyodideModule is already defined
// WASM binary + packages are still fetched from CDN via fetch() — no CSP issue

async function init() {
  let pyodide;
  try {
    pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
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
  } catch (e) {
    return; // silently fail — queries will get null results
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== 'cas_offscreen') return;
    const { id, tabId, latex } = msg;
    try {
      const result = pyodide.globals.get('cas_compute')(latex);
      chrome.runtime.sendMessage({
        type: 'cas_offscreen_result',
        id, tabId, result: result || null
      }).catch(() => {});
    } catch (e) {
      chrome.runtime.sendMessage({
        type: 'cas_offscreen_result',
        id, tabId, result: null
      }).catch(() => {});
    }
  });
}

init();
