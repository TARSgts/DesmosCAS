// Debug version — posts status messages to window for diagnosis
window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.type !== 'cas_query') return;
  const { id, latex } = e.data;
  window.postMessage({ type: 'cas_debug', stage: 'bridge_received', id }, '*');
  chrome.runtime.sendMessage({ type: 'cas_query', id, latex })
    .then(() => window.postMessage({ type: 'cas_debug', stage: 'bg_ack', id }, '*'))
    .catch(err => window.postMessage({ type: 'cas_debug', stage: 'bg_error', id, err: err?.message }, '*'));
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'cas_result_push') {
    window.postMessage({ type: 'cas_result', id: msg.id, result: msg.result }, '*');
  }
});
