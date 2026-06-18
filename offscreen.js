const queue = [];
let ready = false;
let _compute;

function store(s) {
  try { chrome.runtime.sendMessage({ type: 'cas_status', status: s }).catch(() => {}); } catch (e) {}
}
window.addEventListener('error', (e) => store('JSERR:' + (e.message || '').slice(0, 150)));
store('offscreen_loaded');

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

// Defer init until ALL scripts (pyodide.js, pyodide.asm.js) have loaded.
window.addEventListener('load', init);

async function init() {
  try {
    if (typeof loadPyodide !== 'function') { store('NO_loadPyodide'); return; }
    store('loading_pyodide');
    const pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
    store('pyodide_ok');
    await pyodide.loadPackage(['sympy', 'micropip']);
    store('sympy_ok');
    // parse_latex needs antlr4-python3-runtime (not bundled) — install from PyPI
    const micropip = pyodide.pyimport('micropip');
    try { await micropip.install('antlr4-python3-runtime==4.11'); store('antlr_ok'); } catch (e) { store('antlr_fail:' + String(e).slice(0,80)); }
    pyodide.runPython(`
import warnings
warnings.filterwarnings('ignore')  # silence the antlr ErrorListener notice
from sympy import *
from sympy.parsing.latex import parse_latex

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

        # For integrals, prefer SymPy's "manual" technique: it gives clean,
        # textbook-style antiderivatives instead of Piecewise/complex blowups.
        raw = None
        if expr.has(Integral):
            try:
                m = expr.doit(manual=True)
                if not m.has(Integral, Piecewise, I):
                    raw = m
            except Exception:
                pass
        if raw is None:
            raw = expr.doit()
        # If a Piecewise slipped through, take the real-valued branch (SymPy
        # often puts a complex branch first and the clean real form in 'otherwise').
        if isinstance(raw, Piecewise) and len(raw.args):
            real_branches = [b.expr for b in raw.args if not b.expr.has(I)]
            raw = real_branches[-1] if real_branches else raw.args[0].expr
        # simplify() can mangle results (e.g. combine logs into ln of a giant
        # integer). Keep the evaluated form unless simplify is genuinely shorter.
        try:
            simp = simplify(raw)
            result = simp if len(str(simp)) <= len(str(raw)) else raw
        except Exception:
            result = raw
        # Prefer a factored form for polynomials, e.g. (x-1)^3, (x-2)(x-3)
        try:
            if result.free_symbols and result.is_polynomial():
                fac = factor(result)
                if fac != result:  # factoring found a real factorization
                    result = fac
        except Exception:
            pass
        # Keep Desmos's own display for bare floats and undefined (0/0 -> nan)
        if getattr(result, 'is_Float', False) or result is S.NaN:
            return None
        # Hide unevaluated integrals/derivatives -- let Desmos show its own value
        if result.has(Integral) or result.has(Derivative):
            return None
        return latex(result)  # rendered as real math by KaTeX in the page
    except Exception:
        return None
`);
    _compute = (latex) => pyodide.globals.get('cas_compute')(latex);
    store('READY');
  } catch (e) {
    store('INIT_FAIL:' + (e && e.message ? e.message : String(e)).slice(0, 150));
    _compute = () => null; // Pyodide failed to load — fail gracefully (queries get null)
  }
  ready = true;
  for (const m of queue) compute(m);
  queue.length = 0;
}
