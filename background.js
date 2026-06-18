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

// On install/reload, replace any stale offscreen document with a fresh one.
chrome.runtime.onInstalled.addListener(async () => {
  try { await chrome.offscreen.closeDocument(); } catch (e) {}
  ensureOffscreen();
});

// Warm the engine on browser startup so the first query isn't a cold start.
chrome.runtime.onStartup.addListener(() => { ensureOffscreen(); });

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'cas_query') {
    const tabId = sender.tab?.id;
    if (!tabId) return;
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ type: 'cas_offscreen', id: msg.id, latex: msg.latex, tabId }).catch(() => {});
    });
  } else if (msg.type === 'cas_offscreen_result') {
    chrome.tabs.sendMessage(msg.tabId, { type: 'cas_result_push', id: msg.id, result: msg.result || null }).catch(() => {});
  }
});
