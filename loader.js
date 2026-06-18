// Inject KaTeX (for rendering answers as real math) + cas.js into the page
// context. chrome-extension:// URLs are allowed by Desmos's CSP.

// KaTeX stylesheet — @font-face URLs inside resolve relative to this file, so
// the bundled fonts/ dir is fetched from the extension automatically.
const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = chrome.runtime.getURL('katex.min.css');
document.head.appendChild(css);

function injectScript(file) {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL(file);
  document.head.appendChild(s);
  return s;
}

// Load KaTeX first, then cas.js (cas.js also guards on typeof katex anyway).
injectScript('katex.min.js');
injectScript('cas.js');
