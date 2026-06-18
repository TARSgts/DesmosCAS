# Desmos CAS

A Chrome extension that adds exact symbolic answers to [Desmos Graphing Calculator](https://www.desmos.com/calculator).

## What it does

Press **Alt+E** while on Desmos to toggle exact answers. The decimal approximations shown next to each expression are replaced with their exact symbolic forms — fractions, radicals, and symbolic constants. Press **Alt+E** again to restore the decimals.

### Examples

| Desmos shows | With Desmos CAS |
|---|---|
| `0.333...` | `1/3` |
| `506.664...` | `51π√10` |
| `0.707...` | `5√2` |
| `2` | `2` ✓ |

## Supported operations

- **Definite integrals** — `∫₀^π sin(x) dx` → `2`
- **Indefinite integrals** — `∫ x² dx` → `(1/3)x³`
- **Derivatives** — `d/dx x³` → `3x²`
- **Simplification** — `(x²-1)/(x-1)` → `x+1`
- **Factoring** — `x³-3x²+3x-1` → `(x-1)³`
- **Radicals** — `√50` → `5√2`
- **Series & products** — `∑ 1/n²` → `π²/6`, `∑_{k=1}^n k` → `n(n+1)/2`
- **Trig, log, and more**

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder
5. Navigate to [desmos.com/calculator](https://www.desmos.com/calculator)
6. Press **Alt+E** to toggle exact answers

## How it works

- A content script (`loader.js`) injects the page script (`cas.js`) into the Desmos page context, where it can read `window.Calc`
- `cas.js` reads each expression's LaTeX and sends it, via `bridge.js`, to the extension's background service worker
- The background worker forwards requests to an **offscreen document** (`offscreen.html` / `offscreen.js`) that runs [Pyodide](https://pyodide.org/) — Python compiled to WebAssembly — with [SymPy](https://www.sympy.org/) loaded
- SymPy's `parse_latex` reads the Desmos LaTeX directly, evaluates it symbolically, and the exact result is pushed back to the page and injected into the DOM
- Pyodide + SymPy (and the `antlr4-python3-runtime` needed by `parse_latex`) are fetched once from the jsDelivr CDN and cached by the browser

## Dependencies

- [Pyodide](https://pyodide.org/) v0.26.2 — `pyodide.js` + `pyodide.asm.js` bundled; WASM and packages fetched from CDN on first run
- [SymPy](https://www.sympy.org/) — loaded as a Pyodide package
- `antlr4-python3-runtime` — installed via micropip for `parse_latex`
