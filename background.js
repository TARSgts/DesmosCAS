let pyodideReady = false;
const pending = new Map(); // reqId -> sendResponse
let reqCounter = 0;

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (contexts.length === 0) {
    pyodideReady = false;
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['WORKERS'],
      justification: 'Run SymPy CAS computations via Pyodide WebAssembly'
    });
  }
}

// Start loading immediately on install/startup
ensureOffscreen();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'cas_status') {
    if (msg.status === 'ready') pyodideReady = true;
    return;
  }

  if (msg.type === 'cas_query') {
    if (!pyodideReady) {
      sendResponse({ loading: true });
      return true;
    }
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
