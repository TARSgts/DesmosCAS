async function init() {
  let pyodide;
  try {
    pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/' });
    parent.postMessage({ type: 'sandbox_ready' }, '*');
  } catch (e) {
    parent.postMessage({ type: 'sandbox_error', error: 'pyodide_load:' + String(e) }, '*');
    return;
  }

  window.addEventListener('message', (e) => {
    if (e.data?.type !== 'cas_offscreen') return;
    const { id, tabId, latex } = e.data;
    try {
      // Simple eval test — no sympy yet
      const result = pyodide.runPython(`str(1 + 1)`);
      parent.postMessage({ type: 'sandbox_echo', id, tabId, latex: 'pyodide_ok:' + result }, '*');
    } catch (err) {
      parent.postMessage({ type: 'sandbox_error', id, tabId, error: String(err) }, '*');
    }
  });
}

init();
