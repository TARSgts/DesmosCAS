async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['WORKERS'],
      justification: 'Run SymPy CAS via Pyodide WebAssembly'
    });
  }
}

ensureOffscreen();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'cas_query') {
    const tabId = sender.tab?.id;
    if (!tabId) return;
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({
        type: 'cas_offscreen',
        id: msg.id,
        latex: msg.latex,
        tabId
      }).catch(() => {
        chrome.tabs.sendMessage(tabId, { type: 'cas_result_push', id: msg.id, result: null }).catch(() => {});
      });
    });
    // No return true — fire and forget, result pushed back via cas_offscreen_result
  }

  if (msg.type === 'cas_offscreen_result') {
    chrome.tabs.sendMessage(msg.tabId, {
      type: 'cas_result_push',
      id: msg.id,
      result: msg.result || null
    }).catch(() => {});
  }
});
