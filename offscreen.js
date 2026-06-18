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

// parse_latex (antlr) can't parse |...| bars, so rewrite them as sqrt((...)^2)
function preprocess(latex) {
  let s = latex, prev;
  do { prev = s; s = s.replace(/\\left\|([^|]*?)\\right\|/g, '\\sqrt{($1)^{2}}'); }
  while (s !== prev); // repeat for nested bars
  return s;
}

// SymPy outputs inverse trig as \operatorname{asin}; rewrite to friendlier arc-forms.
function polishTex(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/\\operatorname\{asin\}/g, '\\arcsin')
    .replace(/\\operatorname\{acos\}/g, '\\arccos')
    .replace(/\\operatorname\{atan\}/g, '\\arctan')
    .replace(/\\operatorname\{acot\}/g, '\\operatorname{arccot}')
    .replace(/\\operatorname\{asec\}/g, '\\operatorname{arcsec}')
    .replace(/\\operatorname\{acsc\}/g, '\\operatorname{arccsc}')
    .replace(/\\log\{/g, '\\ln{'); // SymPy 'log' is natural log -> display as ln
}

function compute(msg) {
  const { id, tabId, latex } = msg;
  try {
    const result = polishTex(_compute(preprocess(latex)));
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
    await pyodide.loadPackage(['sympy', 'micropip']);
    store('sympy_loaded');
    // parse_latex needs antlr4-python3-runtime (not bundled) — install from PyPI
    const micropip = pyodide.pyimport('micropip');
    try {
      await micropip.install('antlr4-python3-runtime==4.11');
      store('antlr_installed');
    } catch (e) {
      store('antlr_install_failed:' + String(e).slice(0, 120));
    }
    pyodide.runPython(`
from sympy import *
from sympy.parsing.latex import parse_latex
import re as _re

def cas_compute(latex_str):
    try:
        expr = parse_latex(latex_str)
        # parse_latex yields plain symbols for e and pi — map to the constants
        expr = expr.subs(Symbol('e'), E).subs(Symbol('pi'), pi)

        # Equation solving: a single-variable equation -> solve it.
        # Multi-variable equations (y = 2x+1) are graphs; leave them to Desmos.
        if isinstance(expr, Eq):
            syms = sorted(expr.free_symbols, key=lambda s: s.name)
            if len(syms) != 1:
                return None
            try:
                sols = solve(expr, syms[0])
            except Exception:
                return None
            if not sols or len(sols) > 8:
                return None
            body = ',\\\\ '.join(latex(s) for s in sols)
            return latex(syms[0]) + ' = ' + body

        result = simplify(expr.doit())
        # Prefer a factored form for polynomials, e.g. (x-1)^3, (x-2)(x-3)
        try:
            if result.free_symbols and result.is_polynomial():
                fac = factor(result)
                if fac != result:  # factoring found a real factorization
                    result = fac
        except Exception:
            pass
        # Keep Desmos's own display for bare floats and undefined (0/0 → nan)
        if getattr(result, 'is_Float', False) or result is S.NaN:
            return None
        # Hide unevaluated integrals/derivatives — let Desmos show its own value
        if result.has(Integral) or result.has(Derivative):
            return None
        return latex(result)  # rendered as real math by KaTeX in the page
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
