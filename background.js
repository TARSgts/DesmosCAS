async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existing.length === 0) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['WORKERS'],
      justification: 'Run SymPy CAS via Pyodide'
    });
  }
}

// On install/reload: tear down any stale offscreen and start fresh
chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.storage.local.set({ onInstalled: details.reason + '@' + Date.now() });
  try { await chrome.offscreen.closeDocument(); } catch (e) {}
  await chrome.storage.local.remove(['casStatus', 'casStatusTime']);
  ensureOffscreen();
});

// On service-worker startup, make sure an offscreen exists
ensureOffscreen();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'cas_status') {
    chrome.storage.local.set({ casStatus: msg.status, casStatusTime: Date.now() });
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
    Promise.all([
      chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }),
      chrome.storage.local.get(['casStatus', 'casStatusTime', 'onInstalled'])
    ]).then(([ctx, store]) => {
      const age = store.casStatusTime ? Math.round((Date.now() - store.casStatusTime) / 1000) + 's ago' : 'never';
      if (tabId) chrome.tabs.sendMessage(tabId, {
        type: 'cas_status_push',
        status: 'docs=' + ctx.length + ' | onInstalled=' + (store.onInstalled || 'NO') + ' | offscreen=' + (store.casStatus || 'none') + ' (' + age + ')'
      }).catch(() => {});
    });
    return true;
  }

  if (msg.type === 'cas_offscreen_result') {
    chrome.tabs.sendMessage(msg.tabId, { type: 'cas_result_push', id: msg.id, result: msg.result || null }).catch(() => {});
  }
});
