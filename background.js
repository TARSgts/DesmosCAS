// DIAGNOSTIC: echo service — confirms bridge pipeline works end-to-end
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'cas_query') {
    const tabId = sender.tab?.id;
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, {
      type: 'cas_result_push',
      id: msg.id,
      result: 'ECHO:' + msg.latex.slice(0, 20)
    }).catch(() => {});
  }
});
