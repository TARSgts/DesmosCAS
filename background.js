let reqCounter = 0;
const pending = new Map();

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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'cas_query') {
    const id = reqCounter++;
    pending.set(id, sendResponse);
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ type: 'cas_offscreen', id, latex: msg.latex })
        .catch(() => {
          const cb = pending.get(id);
          if (cb) { cb({ result: null }); pending.delete(id); }
        });
    });
    return true; // keep channel open for async sendResponse
  }

  if (msg.type === 'cas_offscreen_result') {
    const cb = pending.get(msg.id);
    if (cb) { cb({ result: msg.result || null }); pending.delete(msg.id); }
  }
});
