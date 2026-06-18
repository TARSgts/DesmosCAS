const queue = [];
let ready = false;
let _compute;

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
    const pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
    await pyodide.loadPackage(['sympy', 'micropip']);
    // parse_latex needs antlr4-python3-runtime (not bundled) — install from PyPI
    const micropip = pyodide.pyimport('micropip');
    try { await micropip.install('antlr4-python3-runtime==4.11'); } catch (e) {}
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
        # If a Piecewise slipped through, take its principal (first) branch.
        if isinstance(raw, Piecewise) and len(raw.args):
            raw = raw.args[0].expr
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
  } catch (e) {
    _compute = () => null; // Pyodide failed to load — fail gracefully (queries get null)
  }
  ready = true;
  for (const m of queue) compute(m);
  queue.length = 0;
}
