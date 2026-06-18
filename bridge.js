// Debug version — posts status messages to window for diagnosis
window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (e.data?.type === 'cas_query') {
    const { id, latex } = e.data;
    chrome.runtime.sendMessage({ type: 'cas_query', id, latex }).catch(() => {});
  } else if (e.data?.type === 'cas_status_query') {
    chrome.runtime.sendMessage({ type: 'cas_status_relay' }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'cas_result_push') {
    window.postMessage({ type: 'cas_result', id: msg.id, result: msg.result }, '*');
  } else if (msg.type === 'cas_status_push') {
    window.postMessage({ type: 'cas_status_result', status: msg.status }, '*');
  }
});
