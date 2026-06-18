(() => {
  let exactMode = false;
  const hidden = new Map(); // exprId -> wrapped-value element

  function queryCAS(latex) {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ result: null });
      }, 60000);
      function handler(e) {
        if (e.source !== window || e.data?.type !== 'cas_result' || e.data.id !== id) return;
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        resolve(e.data);
      }
      window.addEventListener('message', handler);
      window.postMessage({ type: 'cas_query', id, latex }, '*');
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

  function fillPlaceholder(placeholder, result) {
    placeholder.classList.remove('cas-loading');
    if (placeholder.classList.contains('cas-symbolic-row')) {
      const val = placeholder.querySelector('.cas-sym-val');
      val.textContent = result;
      val.title = result;
    } else {
      placeholder.textContent = result;
    }
  }

  async function enterExactMode() {
    const exprs = window.Calc?.getState()?.expressions?.list || [];
    const exprMap = {};
    exprs.forEach(e => { if (e.id) exprMap[e.id] = e; });

    const items = [...document.querySelectorAll('.dcg-expressionitem.dcg-mathitem')];

    await Promise.all(items.map(async (item) => {
      if (item.querySelector('.cas-exact-value')) return; // already injected
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

      const { result, loading } = await queryCAS(expr.latex);

      if (!exactMode) {
        placeholder.remove();
        if (!isSymbolic && hidden.has(exprId)) {
          const wv = hidden.get(exprId);
          wv.style.visibility = '';
          wv.style.position = '';
          hidden.delete(exprId);
        }
        return;
      }

      if (!result || loading) {
        placeholder.remove();
        if (!isSymbolic && hidden.has(exprId)) {
          const wv = hidden.get(exprId);
          wv.style.visibility = '';
          wv.style.position = '';
          hidden.delete(exprId);
        }
        return;
      }

      fillPlaceholder(placeholder, result);
    }));
  }

  function exitExactMode() {
    document.querySelectorAll('.cas-exact-value').forEach(el => el.remove());
    hidden.forEach(el => { el.style.visibility = ''; el.style.position = ''; });
    hidden.clear();
    exactMode = false;
  }

  document.addEventListener('keydown', e => {
    if (e.altKey && e.key === 'e') {
      e.preventDefault();
      if (exactMode) { exitExactMode(); }
      else { exactMode = true; enterExactMode(); }
    }
  });
})();
