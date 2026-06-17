(() => {
  if (typeof nerdamer === 'undefined') return;

  let exactMode = false;
  const hidden = new Map(); // exprId -> wrapped-value element

  function toNerd(s) {
    s = s.trim();
    s = s.replace(
      /\\int_(\{[^}]*\}|\\[a-zA-Z]+|[^\\^{])\^(\{[^}]*\}|\\[a-zA-Z]+|[^\\{])([\s\S]*?)(?:\\[,!;\: ]\s*)?d([a-zA-Z])\b/g,
      (_, lo, hi, body, v) => {
        const l = lo.startsWith('{') ? lo.slice(1,-1).trim() : lo.trim();
        const h = hi.startsWith('{') ? hi.slice(1,-1).trim() : hi.trim();
        // Empty bounds = indefinite integral
        if (!l && !h) return `integrate(${toNerd(body.trim())},${v})`;
        const numBound = b => toNerd(b).replace(/\bpi\b/g, '3.14159265358979');
        return `defint(${toNerd(body.trim())},${numBound(l)},${numBound(h)},${v})`;
      });
    s = s.replace(/\\int([\s\S]*?)(?:\\[,!;\: ]\s*)?d([a-zA-Z])\b/g,
      (_, b, v) => `integrate(${toNerd(b.trim())},${v})`);
    s = s.replace(/\\frac\{d\}\{d([a-zA-Z])\}\s*([\s\S]+)/g,
      (_, v, body) => `diff(${toNerd(body.trim())},${v})`);
    s = s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g,
      (_, n, d) => `(${toNerd(n)})/(${toNerd(d)})`);
    s = s.replace(/\\sqrt\{([^}]*)\}/g, (_, x) => `sqrt(${toNerd(x)})`);
    s = s.replace(/\\sqrt\s*(\w)/g, (_, x) => `sqrt(${x})`);
    // Handle \trig^{n}(x) → trig(x)^n before stripping backslashes
    s = s.replace(/\\(sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan|sinh|cosh|tanh)\^\{([^}]*)\}/g,
      (_, fn, exp) => `${fn}_POW_${exp}_`);
    s = s.replace(/\\(sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan|sinh|cosh|tanh)/g, '$1');
    s = s.replace(/([a-z]+)_POW_([^_]+)_\s*\(([^)]*)\)/g, '$1($3)^($2)');
    // Handle \sin^{3}x (no parens around arg — single char or word)
    s = s.replace(/([a-z]+)_POW_([^_]+)_([a-zA-Z])/g, '$1($3)^($2)');
    s = s.replace(/\\ln/g, 'log'); s = s.replace(/\\pi/g, 'pi');
    s = s.replace(/\\left\s*[\(\[]/g, '('); s = s.replace(/\\right\s*[\)\]]/g, ')');
    s = s.replace(/\\cdot|\\times/g, '*'); s = s.replace(/\\[,!;\: ]/g, '');
    s = s.replace(/\^\{([^}]*)\}/g, (_, x) => `^(${toNerd(x)})`);
    s = s.replace(/\{([^}]*)\}/g, (_, x) => `(${toNerd(x)})`);
    const fns = 'sqrt|defint|integrate|diff|sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan|log|abs|pi';
    s = s.replace(new RegExp(`([a-zA-Z0-9)])\\s*(${fns})\\b`, 'g'), '$1*$2');
    s = s.replace(/(\d)\s*([a-zA-Z(])/g, '$1*$2');
    s = s.replace(/\)\s*\(/g, ')*('); s = s.replace(/\)\s*([a-zA-Z])/g, ')*$1');
    s = s.replace(/\\+/g, ''); // strip any remaining stray backslashes
    return s.trim();
  }

  function getCasResult(latex) {
    try {
      const expr = toNerd(latex);
      let out;
      const intMatch = expr.match(/^integrate\((.+),([a-zA-Z])\)$/);
      if (intMatch) { try { out = nerdamer.integrate(intMatch[1], intMatch[2]).toString(); } catch {} }
      if (!out) out = nerdamer(expr).toString();
      if (out.includes('^(-1)') || /[+\-].*[+\-]/.test(out)) {
        try { const f = nerdamer('factor(' + expr + ')').toString(); if (f !== out && !f.includes('^(-1)')) out = f; } catch {}
      }
      if (out.includes('^(-1)')) {
        try { out = nerdamer('simplify(' + expr + ')').toString(); } catch {}
      }
      // Simplify known atan values (atan(1)=pi/4, etc.)
      out = out.replace(/\batan\(1\)/g, 'pi/4')
               .replace(/\batan\(sqrt\(3\)\)/g, 'pi/3')
               .replace(/\batan\(1\/sqrt\(3\)\)/g, 'pi/6');
      const bad = /^-?\d+\.\d+([eE][+-]?\d+)?$/.test(out) || out.includes('?') || out === expr;
      return bad ? null : out;
    } catch { return null; }
  }

  function enterExactMode() {
    const exprs = window.Calc?.getState()?.expressions?.list || [];
    const exprMap = {};
    exprs.forEach(e => { if (e.id) exprMap[e.id] = e; });

    document.querySelectorAll('.dcg-expressionitem.dcg-mathitem').forEach(item => {
      const exprId = item.getAttribute('expr-id');
      if (!exprId) return;

      const expr = exprMap[exprId];
      if (!expr?.latex) return;

      const result = getCasResult(expr.latex);
      if (!result) return;

      const wrappedVal = item.querySelector('.dcg-evaluation-view__wrapped-value');
      const evalNum = item.querySelector('.dcg-evaluation-number');

      if (wrappedVal && evalNum) {
        // Expression has a Desmos numeric result — replace it
        wrappedVal.style.visibility = 'hidden';
        wrappedVal.style.position = 'absolute';
        hidden.set(exprId, wrappedVal);
        const span = document.createElement('span');
        span.className = 'cas-exact-value';
        span.textContent = result;
        wrappedVal.parentNode.insertBefore(span, wrappedVal);
      } else {
        // Symbolic expression with no Desmos value box — append result row
        const row = document.createElement('div');
        row.className = 'cas-exact-value cas-symbolic-row';
        row.innerHTML = '<span class="cas-sym-eq">=</span><span class="cas-sym-val" title="' + result + '">' + result + '</span>';
        const container = item.querySelector('.dcg-fade-container');
        if (container) container.appendChild(row);
      }
    });
    exactMode = true;
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
      if (exactMode) exitExactMode();
      else enterExactMode();
    }
  });
})();
