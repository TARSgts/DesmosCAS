// Fire-and-forget: send query to background (no await — result is pushed back)
window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.type !== 'cas_query') return;
  chrome.runtime.sendMessage({ type: 'cas_query', id: e.data.id, latex: e.data.latex }).catch(() => {});
});

// Background pushes result here when ready
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'cas_result_push') {
    window.postMessage({ type: 'cas_result', id: msg.id, result: msg.result }, '*');
  }
});
