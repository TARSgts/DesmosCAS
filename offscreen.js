// Minimal echo — confirms offscreen <-> background messaging works
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'cas_offscreen') return;
  chrome.runtime.sendMessage({
    type: 'cas_offscreen_result',
    id: msg.id,
    tabId: msg.tabId,
    result: 'OFFSCREEN_ECHO:' + msg.latex.slice(0, 15)
  }).catch(() => {});
});
