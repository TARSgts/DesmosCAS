(() => {
  let exactMode = false;
  const hidden = new Map(); // exprId -> wrapped-value element
  let observer = null;
  let sweepTimer = null;

  // Query the CAS, resending periodically until an answer arrives. The MV3
  // service worker / offscreen document can be asleep (and may need to reload
  // Pyodide), so a single fire-and-forget message can be dropped or arrive very
  // late. Resending tolerates that. shouldContinue() lets us abort if the user
  // toggles exact mode off mid-flight.
  function queryCAS(latex, shouldContinue) {
    return new Promise((resolve) => {
      const sent = new Set();
      let attempts = 0, settled = false, timer = null;
      function cleanup() { window.removeEventListener('message', handler); clearTimeout(timer); }
      function handler(e) {
        if (e.source !== window || e.data?.type !== 'cas_result' || !sent.has(e.data.id)) return;
        if (settled) return;
        settled = true; cleanup(); resolve(e.data);
      }
      window.addEventListener('message', handler);
      function send() {
        if (settled) return;
        if (shouldContinue && !shouldContinue()) { settled = true; cleanup(); resolve({ result: null }); return; }
        attempts++;
        const id = 'q' + Math.random().toString(36).slice(2);
        sent.add(id);
        window.postMessage({ type: 'cas_query', id, latex }, '*');
        if (attempts < 6) {
          timer = setTimeout(send, 9000); // ~54s of retries (covers a Pyodide reload)
        } else {
          timer = setTimeout(() => { if (!settled) { settled = true; cleanup(); resolve({ result: null }); } }, 12000);
        }
      }
      send();
    });
  }

  function makePlaceholder(isSymbolic) {
    if (isSymbolic) {
      const row = document.createElement('div');
      row.className = 'cas-exact-value cas-symbolic-row cas-loading';
      row.innerHTML = '<span class="cas-sym-eq">=</span><span class="cas-sym-val">…</span>';
      return row;
    }
    const span = document.createElement('span');
    span.className = 'cas-exact-value cas-loading';
    span.textContent = '…';
    return span;
  }

  // result is a LaTeX string from SymPy. Render with KaTeX; fall back to raw text.
  function renderInto(el, tex) {
    el.title = tex;
    if (typeof katex !== 'undefined') {
      try {
        katex.render(tex, el, { throwOnError: false, displayMode: false });
        return;
      } catch (e) { /* fall through to text */ }
    }
    el.textContent = tex;
  }

  function fillPlaceholder(placeholder, result) {
    placeholder.classList.remove('cas-loading');
    if (placeholder.classList.contains('cas-symbolic-row')) {
      renderInto(placeholder.querySelector('.cas-sym-val'), result);
    } else {
      renderInto(placeholder, result);
    }
  }

  function restore(exprId) {
    if (hidden.has(exprId)) {
      const wv = hidden.get(exprId);
      wv.style.visibility = '';
      wv.style.position = '';
      hidden.delete(exprId);
    }
  }

  async function injectItem(item, exprMap) {
    if (item.querySelector('.cas-exact-value')) return; // already injected or in-flight
    const exprId = item.getAttribute('expr-id');
    if (!exprId) return;
    const expr = exprMap[exprId];
    if (!expr?.latex) return;

    const wrappedVal = item.querySelector('.dcg-evaluation-view__wrapped-value');
    const evalNum = item.querySelector('.dcg-evaluation-number');
    const isSymbolic = !(wrappedVal && evalNum);

    const placeholder = makePlaceholder(isSymbolic);

    if (!isSymbolic) {
      wrappedVal.style.visibility = 'hidden';
      wrappedVal.style.position = 'absolute';
      hidden.set(exprId, wrappedVal);
      wrappedVal.parentNode.insertBefore(placeholder, wrappedVal);
    } else {
      const container = item.querySelector('.dcg-fade-container');
      if (!container) return;
      container.appendChild(placeholder);
    }

    const { result } = await queryCAS(expr.latex, () => exactMode);

    // Bail if mode was toggled off, no exact form was found, or the placeholder
    // got detached (Desmos recycled the row mid-query — a re-sweep will redo it).
    if (!exactMode || !result || !placeholder.isConnected) {
      placeholder.remove();
      if (!isSymbolic) restore(exprId);
      return;
    }
    fillPlaceholder(placeholder, result);
  }

  function currentExprMap() {
    const exprs = window.Calc?.getState()?.expressions?.list || [];
    const map = {};
    exprs.forEach(e => { if (e.id) map[e.id] = e; });
    return map;
  }

  function injectAllVisible() {
    const exprMap = currentExprMap();
    document.querySelectorAll('.dcg-expressionitem.dcg-mathitem').forEach(item => injectItem(item, exprMap));
  }

  function enterExactMode() {
    exactMode = true;
    injectAllVisible();
    // Desmos virtual-scrolls: rows are added/removed from the DOM as they enter
    // the viewport. Watch for newly-rendered rows and inject into them too.
    const panel = document.querySelector('.dcg-expressionlist') || document.body;
    observer = new MutationObserver(() => { if (exactMode) injectAllVisible(); });
    observer.observe(panel, { childList: true, subtree: true });
    // Safety net: periodically re-scan so any row that failed to load (dropped
    // message, recycled node) gets another shot.
    sweepTimer = setInterval(() => { if (exactMode) injectAllVisible(); }, 5000);
  }

  function exitExactMode() {
    exactMode = false;
    if (observer) { observer.disconnect(); observer = null; }
    if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
    document.querySelectorAll('.cas-exact-value').forEach(el => el.remove());
    hidden.forEach(el => { el.style.visibility = ''; el.style.position = ''; });
    hidden.clear();
  }

  document.addEventListener('keydown', e => {
    if (e.altKey && e.key === 'e') {
      e.preventDefault();
      if (exactMode) exitExactMode();
      else enterExactMode();
    }
  });
})();
