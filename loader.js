// Inject cas.js into page context via src (chrome-extension:// is allowed by Desmos CSP)
const s = document.createElement('script');
s.src = chrome.runtime.getURL('cas.js');
document.head.appendChild(s);
