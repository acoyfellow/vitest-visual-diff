// The e2e smoke test IS the proof for this plugin: real Vitest Browser Mode,
// real Playwright-driven Chromium, real DOM elements, running the real
// `toMatchVisualDiff` matcher end to end. No mocks, no separate self-proof
// script — per instruction, this suite is the single-engine check.
//
// Sanity-anchor pattern (ported from visual-diff/semantic-diff discipline):
// the gate isn't trusted until it (a) PASSES a pair we know is identical and
// (b) FLAGS a pair we know is broken, on each defect class the cascade claims
// to catch (structure, style, pixels, a11y).

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import '../src/index.ts';

// `position:fixed` on each mount container fully decouples the two mounts'
// box geometry from normal document flow. Without it, two adjacent sibling
// containers stack in normal flow, and the SAME markup mounted twice can
// round its bounding box to a DIFFERENT pixel height depending on which
// engine's block-layout accumulates fractional inline-baseline strut height
// (observed on Firefox specifically: a 20.0px button in the first container
// measured 20px, the identical button in the second, block-stacked
// container measured 21px — not a rendering difference, a test-harness
// coupling artifact). Confirmed fixed across chromium/firefox/webkit via
// `vitest.config.multibrowser.ts` before landing this.
function requiredElement(selector: string): Element {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`test setup: missing ${selector}`);
  return element;
}

function mount([a, b]: [string, string]) {
  document.body.innerHTML = `<div id="a" style="position:fixed; top:0; left:0;"></div><div id="b" style="position:fixed; top:200px; left:0;"></div>`;
  requiredElement('#a').innerHTML = a;
  requiredElement('#b').innerHTML = b;
  return {
    a: page.elementLocator(requiredElement('#a > *')),
    b: page.elementLocator(requiredElement('#b > *')),
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('toMatchVisualDiff — sanity anchors', () => {
  test('PASSES a known-identical pair (positive control)', async () => {
    const CHECKBOX = `<button role="checkbox" aria-checked="true" style="width:20px;height:20px;background:#2563eb;border-radius:4px;"><svg width="12" height="12"><path d="M2 6l3 3 5-7" stroke="white" stroke-width="2" fill="none"/></svg></button>`;
    const { a, b } = mount([CHECKBOX, CHECKBOX]);
    await expect(b).toMatchVisualDiff(a);
  });

  test('FLAGS a structurally-broken pair — missing checkmark svg (Tier A)', async () => {
    const GOOD = `<button role="checkbox" aria-checked="true" style="width:20px;height:20px;background:#2563eb;border-radius:4px;"><svg width="12" height="12"><path d="M2 6l3 3 5-7" stroke="white" stroke-width="2" fill="none"/></svg></button>`;
    const BROKEN = `<button role="checkbox" aria-checked="true" style="width:20px;height:20px;background:#2563eb;border-radius:4px;"></button>`;
    const { a, b } = mount([GOOD, BROKEN]);
    await expect(b).not.toMatchVisualDiff(a);
  });

  test('FLAGS a style-only regression — right structure, wrong color (Tier B)', async () => {
    const GOOD = `<div role="button" style="width:40px;height:40px;background-color:rgb(37, 99, 235);"></div>`;
    const WRONG_COLOR = `<div role="button" style="width:40px;height:40px;background-color:rgb(255, 0, 0);"></div>`;
    const { a, b } = mount([GOOD, WRONG_COLOR]);
    let failure = '';
    try {
      await expect(b).toMatchVisualDiff(a);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      failure = error.message;
    }
    expect(failure).toMatch(/style:/);
  });

  test('FLAGS a genuinely pixel-only regression — same structure, same significant styles, different rendered TEXT content (Tier C)', async () => {
    // `color`/`background*`/box-model props are all SIGNIFICANT to Tier B, so a
    // color swap would be (correctly) caught by B too, which would not prove C
    // adds anything. Text content is not a style/structure property the walker
    // records at all — the only tier that can see this difference is pixels.
    const A = `<div style="width:80px;height:24px;font-size:14px;">AAAA</div>`;
    const B = `<div style="width:80px;height:24px;font-size:14px;">ZZZZ</div>`;
    const { a, b } = mount([A, B]);
    await expect(b).not.toMatchVisualDiff(a);
  });

  test('opt-in semantics (Tier S) catches an aria-only regression invisible to A/B/C', async () => {
    const CHECKED = `<button role="checkbox" aria-checked="true" style="width:20px;height:20px;"></button>`;
    const UNCHECKED_ARIA = `<button role="checkbox" aria-checked="false" style="width:20px;height:20px;"></button>`;
    const { a, b } = mount([CHECKED, UNCHECKED_ARIA]);

    await expect(b).toMatchVisualDiff(a, { pixels: false });
    await expect(b).not.toMatchVisualDiff(a, { pixels: false, a11y: true });
  });

  test('Tier S includes aria-disabled state', async () => {
    const ENABLED = `<button aria-disabled="false" style="width:20px;height:20px;"></button>`;
    const DISABLED = `<button aria-disabled="true" style="width:20px;height:20px;"></button>`;
    const { a, b } = mount([ENABLED, DISABLED]);
    await expect(b).not.toMatchVisualDiff(a, { pixels: false, a11y: true });
  });

  test('Tier R compares label relationships by shape, not literal generated IDs', async () => {
    const BASELINE = `<div><label for="base-email">Email</label><input id="base-email" aria-label="Email" /></div>`;
    const CANDIDATE = `<div><label for="generated-42">Email</label><input id="generated-42" aria-label="Email" /></div>`;
    const { a, b } = mount([BASELINE, CANDIDATE]);
    await expect(b).toMatchVisualDiff(a, { pixels: false, a11y: true });
  });

  test('Tier R catches a broken label-to-control reference invisible to A/B/C', async () => {
    const BASELINE = `<div><label for="base-email">Email</label><input id="base-email" aria-label="Email" /></div>`;
    const BROKEN = `<div><label for="missing-control">Email</label><input id="candidate-email" aria-label="Email" /></div>`;
    const { a, b } = mount([BASELINE, BROKEN]);
    let failure = '';
    try {
      await expect(b).toMatchVisualDiff(a, { pixels: false, a11y: true });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      failure = error.message;
    }
    expect(failure).toMatch(/references: missing/);
  });

  test('works on bare Elements too (no screenshot capability required)', async () => {
    document.body.innerHTML = `<div id="x"><span role="button">Hi</span></div><div id="y"><span role="button">Hi</span></div>`;
    const x = requiredElement('#x > *');
    const y = requiredElement('#y > *');
    await expect(y).toMatchVisualDiff(x);
  });

  test('pixels:true fails closed when bare Elements cannot provide screenshots', async () => {
    document.body.innerHTML = `<div id="x"><span>Hi</span></div><div id="y"><span>Hi</span></div>`;
    const x = requiredElement('#x > *');
    const y = requiredElement('#y > *');
    await expect(expect(y).toMatchVisualDiff(x, { pixels: true })).rejects.toThrow(
      /pixels:true requires both values to be Vitest Locators/,
    );
  });

  test('non-Locator, non-Element input is rejected clearly (fail-closed on bad input)', async () => {
    document.body.innerHTML = `<div id="z"><span>hi</span></div>`;
    const z = requiredElement('#z > *');
    const invalid = 'not-an-element' as unknown as Element;
    await expect(expect(z).toMatchVisualDiff(invalid)).rejects.toThrow(/Locator or a DOM Element/);
  });
});
