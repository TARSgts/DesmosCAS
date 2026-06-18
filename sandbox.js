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
    parent.postMessage({ type: 'sandbox_ready' }, '*');
  } catch (e) {
    parent.postMessage({ type: 'sandbox_error', error: String(e) }, '*');
    return;
  }

  window.addEventListener('message', (e) => {
    if (e.data?.type !== 'cas_offscreen') return;
    const { id, latex } = e.data;
    try {
      const result = pyodide.globals.get('cas_compute')(latex);
      parent.postMessage({ type: 'cas_offscreen_result', id, result: result || null }, '*');
    } catch (err) {
      parent.postMessage({ type: 'cas_offscreen_result', id, result: null }, '*');
    }
  });
}

init();
