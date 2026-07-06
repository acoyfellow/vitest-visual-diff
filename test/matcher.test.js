// The e2e smoke test IS the proof for this plugin: real Vitest Browser Mode,
// real Playwright-driven Chromium, real DOM elements, running the real
// `toMatchVisualDiff` matcher end to end. No mocks, no separate self-proof
// script — per instruction, this suite is the single-engine check.
//
// Sanity-anchor pattern (ported from visual-diff/semantic-diff discipline):
// the gate isn't trusted until it (a) PASSES a pair we know is identical and
// (b) FLAGS a pair we know is broken, on each defect class the cascade claims
// to catch (structure, style, pixels, a11y).

import { describe, test, expect, beforeEach } from 'vitest';
import { page } from 'vitest/browser';
import '../src/index.js';

function mount(html) {
  document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
  const [a, b] = html;
  document.getElementById('a').innerHTML = a;
  document.getElementById('b').innerHTML = b;
  return {
    a: page.elementLocator(document.getElementById('a').firstElementChild),
    b: page.elementLocator(document.getElementById('b').firstElementChild),
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
    const result = await expect(b).toMatchVisualDiff(a).then(
      () => ({ pass: true }),
      (e) => ({ pass: false, message: e.message }),
    );
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/style:/);
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

  test('opt-in a11y (Tier D) catches an aria-only regression invisible to A/B/C', async () => {
    const CHECKED = `<button role="checkbox" aria-checked="true" style="width:20px;height:20px;"></button>`;
    const UNCHECKED_ARIA = `<button role="checkbox" aria-checked="false" style="width:20px;height:20px;"></button>`;
    const { a, b } = mount([CHECKED, UNCHECKED_ARIA]);

    // Structure+style alone do NOT see this (same tag, same box styles) —
    // proves D is adding real signal, not just re-deriving A/B.
    await expect(b).toMatchVisualDiff(a, { pixels: false });
    // With a11y requested, the same pair must now be flagged.
    await expect(b).not.toMatchVisualDiff(a, { pixels: false, a11y: true });
  });

  test('works on bare Elements too (no screenshot capability required)', async () => {
    document.body.innerHTML = `<div id="x"><span role="button">Hi</span></div><div id="y"><span role="button">Hi</span></div>`;
    const x = document.getElementById('x').firstElementChild;
    const y = document.getElementById('y').firstElementChild;
    await expect(y).toMatchVisualDiff(x);
  });

  test('non-Locator, non-Element input is rejected clearly (fail-closed on bad input)', async () => {
    document.body.innerHTML = `<div id="z"><span>hi</span></div>`;
    const z = document.getElementById('z').firstElementChild;
    await expect(expect(z).toMatchVisualDiff('not-an-element')).rejects.toThrow(/Locator or a DOM Element/);
  });
});
