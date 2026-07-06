# vitest-visual-diff

[Docs](https://vitest-visual-diff.coey.dev) · [source](https://github.com/acoyfellow/vitest-visual-diff)

A Vitest matcher for Browser Mode that answers one question: **are these two
elements, rendered live in a real browser, actually the same?**

```js
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import 'vitest-visual-diff';

test('the new checkbox renders the same as the old one', async () => {
  await expect(page.getByTestId('checkbox-new')).toMatchVisualDiff(
    page.getByTestId('checkbox-old'),
  );
});
```

If the answer is no, the failure tells you *why* — a missing element, a
wrong color, a shifted pixel, or a broken screen-reader state — instead of
just "these don't match."

---

## Tutorial: your first comparison

This walks through comparing two elements in a real test, from an empty
project to a passing (and then a deliberately failing) assertion.

**1. Install it.**

```sh
bun add -d github:acoyfellow/vitest-visual-diff vitest @vitest/browser @vitest/browser-playwright playwright
bunx playwright install chromium
```

**2. Point Vitest at a real browser.** Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    setupFiles: ['vitest-visual-diff'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
```

`setupFiles: ['vitest-visual-diff']` registers `toMatchVisualDiff` on `expect` once,
for every test file.

**3. Write a test that mounts two elements and compares them.**

```ts
// checkbox.test.ts
import { test, expect } from 'vitest';
import { page } from 'vitest/browser';

test('two identically-styled checkboxes match', async () => {
  const checkbox = (testId: string) => `
    <button data-testid="${testId}" role="checkbox" aria-checked="true"
      style="width:20px; height:20px; background:#2563eb; border-radius:4px;">
      <svg width="12" height="12"><path d="M2 6l3 3 5-7" stroke="white" stroke-width="2" fill="none"/></svg>
    </button>`;

  document.body.innerHTML = `
    <div style="position:fixed; top:0; left:0;">${checkbox('checkbox-old')}</div>
    <div style="position:fixed; top:100px; left:0;">${checkbox('checkbox-new')}</div>
  `;

  const oldCheckbox = page.getByTestId('checkbox-old');
  const newCheckbox = page.getByTestId('checkbox-new');

  await expect(newCheckbox).toMatchVisualDiff(oldCheckbox);
});
```

Run it: `bun run test`. It passes — same markup, same styles, same pixels.

**4. Break something on purpose and watch the failure explain itself.**

Remove the new checkbox's `<svg>` checkmark before the assertion (a real
regression class: "the checkbox looks right until you check it, and then
nothing appears"):

```ts
newCheckbox.element().querySelector('svg')?.remove();
```

Run it again. It fails, and the message says exactly what's wrong:

```
expected candidate to match visual-diff baseline (A=FAIL B=pass C=pass)
  structure: missing overall — {"svg":1,"path":1}
```

That's the shape of the whole library: every failure names the tier that
caught it and the concrete thing that differed.

> **Why `position:fixed` on the two containers?** Two elements sitting next
> to each other in normal page flow can round their own box height by a
> fraction of a pixel differently across browser engines (confirmed on
> Firefox specifically — see [Why two fixed-positioned containers](#why-two-fixed-positioned-containers)).
> Giving each container its own fixed position removes that coupling. If
> you're comparing two elements that are already isolated in their own
> containers (an iframe, a separate test render), you don't need this.

---

## How-to guides

### Compare two elements that don't have a stored baseline file

Use `toMatchVisualDiff` directly with two live elements — no reference image
to commit, no `--update` workflow. This is the case for A/B component
variants, a migration's before/after, or a design-reference iframe next to
the real render.

```js
await expect(candidate).toMatchVisualDiff(reference);
```

### Skip the pixel check

Pass `{ pixels: false }` when one side is a bare DOM `Element` (no
screenshot capability) or when you only care about structure and style:

```js
await expect(candidateElement).toMatchVisualDiff(referenceElement, { pixels: false });
```

`pixels` defaults to `true` automatically when both sides are Locators
(screenshot-capable) and `false` when either side is a plain `Element`.

### Catch an accessibility-only regression

Pass `a11y: true` to add two checks: Tier S compares accessible names,
descriptions, and state; Tier R compares relationships such as `label[for]`,
`aria-labelledby`, and `aria-describedby`. This catches a checkbox whose
`aria-checked` silently flipped and a label that no longer points to its
control:

```js
await expect(candidate).toMatchVisualDiff(reference, { a11y: true });
```

### Tune the style comparison tolerance

```js
await expect(candidate).toMatchVisualDiff(reference, {
  style: { tol: 1.5 }, // px tolerance for numeric style values
});
```

### Tune the pixel-diff threshold

```js
await expect(candidate).toMatchVisualDiff(reference, {
  pixelOpts: { threshold: 0.2, flagPct: 2.0 },
});
```

### Run against a different browser engine

Nothing in `vitest-visual-diff` is Chromium-specific. Add more instances to
`vitest.config.ts`:

```ts
browser: {
  enabled: true,
  provider: playwright(),
  instances: [
    { browser: 'chromium' },
    { browser: 'firefox' },
    { browser: 'webkit' },
  ],
}
```

### Run against a different Vitest Browser Mode provider entirely

`vitest-visual-diff` never imports a provider package — it only uses the
Locator/Element and `.screenshot()` surface Vitest itself hands the test.
Swap `@vitest/browser-playwright` for `@vitest/browser-webdriverio` and
nothing in `src/` needs to change:

```ts
import { webdriverio } from '@vitest/browser-webdriverio';
// ...
browser: { enabled: true, provider: webdriverio(), instances: [{ browser: 'chrome' }] }
```

---

## Reference

### `toMatchVisualDiff(baseline, opts?)`

```ts
expect(candidate: Locator | Element).toMatchVisualDiff(
  baseline: Locator | Element,
  opts?: {
    pixels?: boolean;    // default: true iff both sides are Locators
    a11y?: boolean;      // default: false; adds semantic + reference tiers
    style?: { tol?: number; props?: Set<string> };
    pixelOpts?: { threshold?: number; includeAA?: boolean; flagPct?: number };
  }
): Promise<void>
```

Passes only if every requested tier agrees. `.not.toMatchVisualDiff(...)`
works as the negation, same as any Vitest matcher.

| Tier | Checks | Runs when | Catches |
|---|---|---|---|
| A — structure | element-tag counts, whole tree and the interactive control subtree | always | missing/extra elements (a checkbox with no checkmark) |
| B — style | box model, color, border, background on matched elements | always | a right-shaped, wrong-styled element, and names the property |
| C — pixels | `pixelmatch` over both elements' screenshots, scored against the shared content area | both sides are Locators and `pixels` is not `false` | anything A/B can't see in the actual rendered output (text content, gradients, sub-pixel rendering) |
| S — semantics | accessible name, description, and ARIA state | `opts.a11y === true` | a visually-identical control with the wrong name or state |
| R — references | shape of `for` and `aria-*` ID-reference edges, ignoring generated ID strings | `opts.a11y === true` | a label or description that no longer points to its control |

### Exports

```js
import {
  toMatchVisualDiff,
  cascade,
  sanityCheck,
  walkElement,
  diffSemantic,
  diffReferenceGraph,
} from 'vitest-visual-diff';
```

- `toMatchVisualDiff` — the matcher function itself (already registered on
  `expect` as a side effect of importing `vitest-visual-diff`; import this only if you
  want to call it directly, e.g. from your own wrapper matcher).
- `cascade(baselineRender, candidateRender, opts)` — the underlying pure
  tier-composition function, for callers who already have two normalized
  renders and want the raw `{pass, A, B, C, S, R, tiers}` result.
- `sanityCheck(anchors, opts)` — run the cascade over a labelled set of
  known-good/known-broken pairs and report which ones the cascade got wrong.
  Useful in the library's own tests; most consumers won't need it directly.
- `walkElement(element)` — the in-page DOM walk that produces a normalized
  render from a live `Element`.
- `diffSemantic(baselineRender, candidateRender)` — Tier S in isolation.
- `diffReferenceGraph(baselineElements, candidateElements)` — Tier R in
  isolation, given the `elements` array from two normalized renders.

---

## Explanation

### Why this exists next to Vitest's own visual and accessibility matchers

Vitest Browser Mode already ships two strong native matchers:
`toMatchScreenshot` (compares against a stored reference image, with
stable-screenshot detection and a documented CI baseline-update workflow) and
`toMatchAriaSnapshot`/`toMatchAriaInlineSnapshot` (snapshots the
accessibility tree as YAML). Both are good, and `vitest-visual-diff` doesn't reimplement
either one.

What's missing between them: a single verdict that requires structure, style,
and pixels to all agree at once, between two elements resolved in the same
test run — no reference file to commit or update. `toMatchScreenshot` only
looks at pixels and needs a baseline on disk. The ARIA snapshot matchers only
look at the accessibility tree. Neither checks the element-tag structure or
the computed style directly. `vitest-visual-diff` covers that middle ground and can sit
next to the native matchers rather than instead of them — a test can use
`toMatchScreenshot` for "does this look right against last week's baseline"
and `toMatchVisualDiff` for "do these two elements, right now, actually
agree."

### Why it works with any Browser Mode provider

`src/` never imports a browser-provider package. The matcher only calls
methods Vitest's own `Locator`/`Element` objects expose —
`.element()`, `.screenshot()` — the same surface both tested providers
implement underneath Vitest's abstraction. The full test suite passes
unmodified against the Playwright provider (Chromium, Firefox, and WebKit —
three different rendering engines), the WebdriverIO provider (driving a locally
installed Chrome over WebDriver), and Brendan Irvine-Broque's Browser Run
provider (driving hosted Chromium on Cloudflare). Receipts for each provider
run, including the exact commands and pinned commits, are in
[`experiments/`](./experiments).

### Why the cascade is ported, not reinvented

The comparison logic — structure multiset diff, LCS-aligned style diff,
`pixelmatch`-based pixel diff, accessible semantics, ID-reference graph, and
the fail-closed AND across all of them — comes from
[`@acoyfellow/visual-diff`](https://github.com/acoyfellow/visual-diff) and
its sibling [`semantic-diff`](https://github.com/acoyfellow/semantic-diff).
Those two repos are untouched by this project; `vitest-visual-diff` distills their
comparison logic into a Vitest-native matcher. The one real rewrite is
how a render gets extracted: visual-diff drives a separate, pinned Chromium
process over the DevTools protocol and evaluates a DOM-walking string inside
it, because it runs *outside* any test framework. Vitest Browser Mode runs
the test file itself inside the real browser, so `vitest-visual-diff`'s extraction
(`src/extract-browser.ts`) is plain, direct DOM code — no remote-evaluation
string needed.

### Why two fixed-positioned containers

While testing this library against three browser engines side by side, two
identical elements mounted as adjacent siblings in normal page flow
occasionally reported different pixel dimensions on Firefox specifically — a
20×20px button in the first container measured 20×20px, and the same markup
in the second, block-stacked container measured 20×21px. `getBoundingClientRect()`
agreed the box was 20×20px on every engine; the difference only showed up in
the captured screenshot. The cause is how each engine accumulates the
fractional inline-level "strut" height around a button in normal block flow
— a coupling between the two mount points, not a rendering defect in either
one. Giving each mount container `position:fixed` removes it from normal
flow entirely, so its geometry no longer depends on what else is on the
page. This is why the tutorial's example mounts both elements as
fixed-positioned siblings, and why the library's own test suite does the
same.
