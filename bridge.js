// Relay between the page (cas.js) and the background service worker.
window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.type !== 'cas_query') return;
  try {
    chrome.runtime.sendMessage({ type: 'cas_query', id: e.data.id, latex: e.data.latex }).catch(() => {});
  } catch (err) {
    // "Extension context invalidated" — happens on an old tab after the
    // extension is reloaded. Harmless; a page refresh reconnects.
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'cas_result_push') {
    window.postMessage({ type: 'cas_result', id: msg.id, result: msg.result }, '*');
  }
});
