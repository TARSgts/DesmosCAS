// Inject scripts via src — chrome-extension:// is whitelisted in Desmos's CSP
function inject(src) {
  const s = document.createElement('script');
  s.src = src;
  document.head.appendChild(s);
  return s;
}

inject(chrome.runtime.getURL('nerdamer.min.js'))
  .addEventListener('load', () => inject(chrome.runtime.getURL('cas.js')));
