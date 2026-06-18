// Test if sandbox iframe postMessage works
let sandboxReady = false;
const queue = [];

window.addEventListener('message', (e) => {
  if (e.data?.type === 'sandbox_ready') {
    sandboxReady = true;
  } else if (e.data?.type === 'sandbox_echo') {
    // Forward sandbox echo back to background as result
    chrome.runtime.sendMessage({
      type: 'cas_offscreen_result',
      id: e.data.id,
      tabId: e.data.tabId,
      result: 'SANDBOX_ECHO:' + e.data.latex.slice(0, 15)
    }).catch(() => {});
  } else if (e.data?.type === 'sandbox_error') {
    chrome.runtime.sendMessage({
      type: 'cas_offscreen_result',
      id: e.data.id,
      tabId: e.data.tabId,
      result: 'SANDBOX_ERROR:' + e.data.error
    }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'cas_offscreen') return;
  if (!sandboxReady) { queue.push(msg); return; }
  document.getElementById('sb').contentWindow.postMessage(msg, '*');
});

// Drain queue once sandbox ready (poll)
setInterval(() => {
  if (sandboxReady && queue.length) {
    const sb = document.getElementById('sb');
    queue.forEach(m => sb.contentWindow.postMessage(m, '*'));
    queue.length = 0;
  }
}, 500);
