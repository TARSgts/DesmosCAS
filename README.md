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
- **Trig, log, and more**

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder
5. Navigate to [desmos.com/calculator](https://www.desmos.com/calculator)
6. Press **Alt+E** to toggle exact answers

## How it works

- A content script (`loader.js`) injects [Nerdamer](https://nerdamer.com/) (a JavaScript CAS library) and the main script into the Desmos page context
- The main script (`cas.js`) reads expressions from `window.Calc`, converts Desmos LaTeX to Nerdamer syntax, computes exact results, and swaps the displayed values in the DOM
- Desmos's Content Security Policy is respected by loading scripts via `chrome-extension://` URLs rather than inline

## Dependencies

- [Nerdamer](https://nerdamer.com/) v1.1.13 — bundled (`nerdamer.min.js`)
