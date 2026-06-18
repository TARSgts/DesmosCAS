let sandboxReady = false;
const queue = [];

function forwardToSandbox(msg) {
  document.getElementById('sb').contentWindow.postMessage(msg, '*');
}

window.addEventListener('message', (e) => {
  if (e.data?.type === 'sandbox_ready') {
    sandboxReady = true;
    for (const msg of queue) forwardToSandbox(msg);
    queue.length = 0;
  } else if (e.data?.type === 'cas_offscreen_result') {
    // Forward result back to background (includes tabId for routing)
    chrome.runtime.sendMessage({
      type: 'cas_offscreen_result',
      id: e.data.id,
      tabId: e.data.tabId,
      result: e.data.result || null
    }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'cas_offscreen') return;
  if (!sandboxReady) { queue.push(msg); return; }
  forwardToSandbox(msg);
});
