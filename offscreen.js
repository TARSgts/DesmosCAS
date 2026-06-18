// Relay between background (chrome.runtime) and sandbox iframe (postMessage)
let sandboxReady = false;
const queue = [];

window.addEventListener('message', (e) => {
  if (e.data?.type === 'sandbox_ready') {
    sandboxReady = true;
    chrome.runtime.sendMessage({ type: 'cas_status', status: 'ready' });
    for (const msg of queue) forwardToSandbox(msg);
    queue.length = 0;
  } else if (e.data?.type === 'cas_offscreen_result') {
    chrome.runtime.sendMessage({
      type: 'cas_offscreen_result',
      id: e.data.id,
      result: e.data.result || null
    });
  }
});

function forwardToSandbox(msg) {
  document.getElementById('sb').contentWindow.postMessage(msg, '*');
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'cas_offscreen') return;
  if (!sandboxReady) { queue.push(msg); return; }
  forwardToSandbox(msg);
});
