let pyodide = null;
let ready = false;
const queue = [];

async function init() {
  try {
    pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
    await pyodide.loadPackage(['sympy']);
    pyodide.runPython(`
from sympy import *
from sympy.parsing.latex import parse_latex

def cas_compute(latex_str):
    try:
        expr = parse_latex(latex_str)
        # Treat lone 'e' symbol as Euler's number
        e_sym = Symbol('e')
        if e_sym in expr.free_symbols:
            expr = expr.subs(e_sym, E)
        # Evaluate integrals, derivatives, etc.
        result = expr.doit()
        result = simplify(result)
        s = str(result)
        s = s.replace('**', '^')
        # Reject if still unevaluated or obviously decimal
        if 'Integral(' in s or 'Derivative(' in s:
            return None
        return s
    except Exception as ex:
        return None
`);
    ready = true;
    chrome.runtime.sendMessage({ type: 'cas_status', status: 'ready' });
    // Drain any queued requests
    for (const msg of queue) processMsg(msg);
    queue.length = 0;
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'cas_status', status: 'error', error: String(e) });
  }
}

function processMsg({ id, latex }) {
  try {
    const result = pyodide.globals.get('cas_compute')(latex);
    chrome.runtime.sendMessage({ type: 'cas_offscreen_result', id, result: result || null });
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'cas_offscreen_result', id, result: null });
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'cas_offscreen') return;
  if (!ready) { queue.push(msg); return; }
  processMsg(msg);
});

init();
