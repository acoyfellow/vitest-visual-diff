# diffgate

A Vitest custom matcher for Browser Mode: `toMatchVisualDiff`, a fail-closed
structure + style + pixel (+ opt-in a11y) cascade over two **live** elements —
not a stored reference screenshot.

```js
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import 'diffgate'; // registers toMatchVisualDiff on expect

test('the two variants render the same', async () => {
  const golden = page.getByTestId('checkbox-golden');
  const candidate = page.getByTestId('checkbox-candidate');
  await expect(candidate).toMatchVisualDiff(golden);
});
```

PASS requires **every** requested tier to agree:

- **A — structure**: element-tag multiset, in the interactive control subtree
  and the whole tree. Catches missing/extra elements (e.g. a checkbox
  rendered without its checkmark `<svg>`).
- **B — computed style**: significant box-model/color/border properties on
  LCS-aligned elements. Names *what* differs, not just *that* it does.
- **C — pixels**: `pixelmatch` over screenshots of both elements, reported as
  % of the non-white content bounding box. Runs automatically when both sides
  are Locators (screenshot-capable); pass `{ pixels: false }` to skip it.
- **D — a11y** (opt-in via `{ a11y: true }`): accessible role + aria/state
  signature. Catches a pixel-and-structure-identical pair where
  `aria-checked` silently flipped — invisible to A/B/C.

Any single failing tier fails the whole match. No tier is trusted alone.

## Why this exists next to Vitest's own `toMatchScreenshot` / `toMatchAriaSnapshot`

Vitest Browser Mode already ships two strong native matchers: `toMatchScreenshot`
(reference-baseline pixel diff with stable-screenshot detection) and
`toMatchAriaInlineSnapshot`/`toMatchAriaSnapshot` (accessibility-tree YAML
snapshots). Both are good and this package does not reimplement them.

Neither answers "are these two **live** elements the same right now" with one
verdict across structure, style, and pixels at once — `toMatchScreenshot`
needs a committed baseline file and only looks at pixels; the ARIA snapshot
matchers only look at the accessibility tree. `diffgate` fills the gap: a
single fail-closed comparison between two elements resolved in the same test
run (two variants, a component vs. a design-reference iframe, a migration's
before/after), covering the two tiers (structure multiset, computed style)
neither native matcher checks at all.

## Provider-agnostic by construction

`diffgate` never touches the browser provider. It consumes whatever
Locator/Element + `.screenshot()` Vitest Browser Mode hands the test — so it
works unchanged with the local Playwright provider (proven here) and with any
other CDP-based provider Vitest supports, including a remote one like
Cloudflare's Browser Run, once wired in as `browser.provider` in
`vitest.config.ts`. This repo's own test suite runs against the local
Playwright provider; nothing in `src/` assumes that specific provider.

## What's proven vs. what isn't (yet)

**Proven** (`test/matcher.test.js`, real Vitest Browser Mode, real headless
Chromium, 7/7 passing, run 5x back to back with 0 flake):

- positive control: an identical pair passes
- Tier A alone catches a missing-element structural regression
- Tier B alone catches a significant-style regression, and names the property
- Tier C alone catches a genuinely pixel-only regression (rendered text
  content differs; structure and every significant style prop are identical)
- Tier D, opt-in, catches an aria-state-only regression invisible to A/B/C
- works on bare `Element`s with no screenshot capability (`{ pixels: false }`
  path)
- bad input (non-Locator, non-Element) fails closed with a clear error

**Not yet proven**: behavior against a remote/CDP provider other than local
Playwright (no such provider was available to test against in this session);
multi-viewport or cross-browser (`firefox`/`webkit`) runs; performance at
scale (many `toMatchVisualDiff` calls in one suite).

## Install

```sh
npm install --save-dev diffgate vitest @vitest/browser @vitest/browser-playwright playwright
```

Register once, either globally via `test.setupFiles` in `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    setupFiles: ['diffgate'],
    browser: { enabled: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
  },
});
```

or per-file with `import 'diffgate';` at the top of a test.

## Options

```ts
toMatchVisualDiff(baseline: Locator | Element, opts?: {
  pixels?: boolean;   // default: true iff both sides are Locators
  a11y?: boolean;     // default: false — opt-in Tier D
  style?: object;     // forwarded style-diff tolerance/prop-subset options
  pixelOpts?: object; // forwarded pixel-diff threshold/flagPct options
})
```

## Provenance

The cascade (`src/cascade.js`, `src/structure.js`, `src/style.js`,
`src/pixels.js`, `src/a11y.js`) is ported, not reinvented, from
[`@acoyfellow/visual-diff`](https://github.com/acoyfellow/visual-diff) and its
sibling [`semantic-diff`](https://github.com/acoyfellow/semantic-diff) — those
two repos are left as-is; this package distills their proven fail-closed
cascade into a Vitest-native matcher. The one real port: extraction moved from
a CDP `Runtime.evaluate` string (visual-diff drives a raw pinned-Chromium
process over the DevTools protocol) to plain in-page DOM code
(`src/extract-browser.js`), because Vitest Browser Mode runs the test file
itself inside the browser — no CDP round-trip needed to walk the DOM.
