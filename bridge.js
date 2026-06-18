// Relay messages between page context (cas.js) and background service worker
window.addEventListener('message', async (e) => {
  if (e.source !== window || e.data?.type !== 'cas_query') return;
  const { id, latex } = e.data;
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'cas_query', id, latex });
    window.postMessage({ type: 'cas_result', id, result: resp?.result || null, loading: resp?.loading || false }, '*');
  } catch (err) {
    window.postMessage({ type: 'cas_result', id, result: null }, '*');
  }
});
