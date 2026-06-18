// Minimal sandbox echo — just confirms iframe postMessage works before loading Pyodide
parent.postMessage({ type: 'sandbox_ready' }, '*');

window.addEventListener('message', (e) => {
  if (e.data?.type !== 'cas_offscreen') return;
  parent.postMessage({
    type: 'sandbox_echo',
    id: e.data.id,
    tabId: e.data.tabId,
    latex: e.data.latex
  }, '*');
});
