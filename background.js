let lastStatus = 'no_offscreen';

async function ensureOffscreen() {
  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['WORKERS'],
      justification: 'Run SymPy CAS via Pyodide'
    });
  } catch (e) {
    // Already exists — ignore
  }
}

ensureOffscreen();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'cas_status') {
    lastStatus = msg.status;
    return;
  }

  if (msg.type === 'cas_query') {
    const tabId = sender.tab?.id;
    if (!tabId) return;
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ type: 'cas_offscreen', id: msg.id, latex: msg.latex, tabId }).catch(() => {
        chrome.tabs.sendMessage(tabId, { type: 'cas_result_push', id: msg.id, result: null }).catch(() => {});
      });
    });
  }

  if (msg.type === 'cas_status_relay') {
    const tabId = sender.tab?.id;
    if (tabId) chrome.tabs.sendMessage(tabId, { type: 'cas_status_push', status: lastStatus }).catch(() => {});
  }

  if (msg.type === 'cas_offscreen_result') {
    chrome.tabs.sendMessage(msg.tabId, { type: 'cas_result_push', id: msg.id, result: msg.result || null }).catch(() => {});
  }
});
