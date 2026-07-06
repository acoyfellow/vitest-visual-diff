// The actual plugin surface: a Vitest custom matcher that composes the
// fail-closed cascade (structure AND style AND pixels [AND a11y, opt-in])
// over two live elements already resolved by Vitest Browser Mode — from
// ANY provider (local Playwright today; Cloudflare Browser Run once wired
// via @cloudflare/vitest-browser-run or similar, since this matcher never
// touches the provider/CDP layer itself, only what Vitest hands the test).
//
// Deliberately NOT reimplementing what Vitest's native `toMatchScreenshot`
// or `toMatchAriaSnapshot` already do well (reference-baseline pixel diff,
// accessible-name/state tree snapshots). This matcher's job is the gap
// neither covers: ONE verdict that requires structure, style, pixels
// (and optionally a11y) to ALL agree, comparing two LIVE elements directly
// (no stored baseline file needed) — e.g. two variants rendered in the same
// test, a component vs. its own design-reference iframe, or A/B DOM outputs.

import { cascade } from './cascade.js';
import { walkElement } from './extract-browser.js';
import { decodePngBase64 } from './decode-browser.js';

/**
 * Resolve a matcher argument (Locator | Element) to a concrete Element and,
 * when possible, a screenshot-capable object exposing `.screenshot()`.
 */
function resolve(target) {
  if (target && typeof target.element === 'function') {
    // Vitest Locator
    return { el: target.element(), shootable: target };
  }
  if (target instanceof Element) {
    return { el: target, shootable: null };
  }
  throw new TypeError('diffgate: expected a Vitest Locator or a DOM Element');
}

async function screenshotFrame(shootable, el) {
  if (!shootable) return null;
  // `save:false` always returns a raw base64 string (docs: "path is ignored
  // in that case") — do NOT also pass base64:true, that combination is for
  // the save-to-disk-and-also-return-base64 case, not this one.
  const base64 = await shootable.screenshot({ save: false });
  return decodePngBase64(base64);
}

function formatDefects(result) {
  const lines = [];
  if (!result.A.pass) {
    if (Object.keys(result.A.control.missingInCandidate).length) lines.push(`  structure: missing in control — ${JSON.stringify(result.A.control.missingInCandidate)}`);
    if (Object.keys(result.A.control.extraInCandidate).length) lines.push(`  structure: extra in control — ${JSON.stringify(result.A.control.extraInCandidate)}`);
    if (Object.keys(result.A.whole.missingInCandidate).length) lines.push(`  structure: missing overall — ${JSON.stringify(result.A.whole.missingInCandidate)}`);
    if (Object.keys(result.A.whole.extraInCandidate).length) lines.push(`  structure: extra overall — ${JSON.stringify(result.A.whole.extraInCandidate)}`);
  }
  if (!result.B.pass) {
    for (const d of result.B.deltas.slice(0, 8)) lines.push(`  style: ${d.tag}${d.role ? `[${d.role}]` : ''}.${d.prop} — expected "${d.baseline}" got "${d.candidate}"`);
    if (result.B.deltas.length > 8) lines.push(`  ...and ${result.B.deltas.length - 8} more style deltas`);
  }
  if (result.C && !result.C.pass) lines.push(`  pixels: ${result.C.pct}% of content bbox (${result.C.bbox}) differs${result.C.note ? ` — ${result.C.note}` : ''}`);
  if (result.D && !result.D.pass) {
    if (Object.keys(result.D.missing).length) lines.push(`  a11y: missing — ${JSON.stringify(result.D.missing)}`);
    if (Object.keys(result.D.extra).length) lines.push(`  a11y: extra — ${JSON.stringify(result.D.extra)}`);
  }
  return lines.join('\n');
}

/**
 * expect(candidateLocatorOrElement).toMatchVisualDiff(baselineLocatorOrElement, opts?)
 *
 * @param {{pixels?:boolean, a11y?:boolean, style?:Object, pixelOpts?:Object}} [opts]
 *   pixels defaults to true when both sides expose `.screenshot()` (i.e. are
 *   Locators); pass `{pixels:false}` to compare structure+style only (e.g.
 *   when one side is a bare Element with no screenshot capability).
 */
export async function toMatchVisualDiff(candidate, baseline, opts = {}) {
  const { isNot } = this;
  const c = resolve(candidate);
  const b = resolve(baseline);

  const candidateStruct = walkElement(c.el);
  const baselineStruct = walkElement(b.el);

  const wantPixels = opts.pixels !== false && !!(c.shootable && b.shootable);
  const [candidatePng, baselinePng] = wantPixels
    ? await Promise.all([screenshotFrame(c.shootable, c.el), screenshotFrame(b.shootable, b.el)])
    : [null, null];

  const result = cascade(baselineStruct, candidateStruct, {
    style: opts.style,
    pixels: opts.pixelOpts,
    a11y: !!opts.a11y,
    baselinePng,
    candidatePng,
  });

  return {
    pass: result.pass,
    actual: candidateStruct,
    expected: baselineStruct,
    message: () => {
      const verb = isNot ? 'not to' : 'to';
      if (result.pass) return `expected candidate ${verb} match visual-diff baseline (structure+style${wantPixels ? '+pixels' : ''}${opts.a11y ? '+a11y' : ''}), but it did`;
      const tierSummary = Object.entries(result.tiers).filter(([, v]) => v !== null).map(([k, v]) => `${k}=${v ? 'pass' : 'FAIL'}`).join(' ');
      return [
        `expected candidate ${verb} match visual-diff baseline (${tierSummary})`,
        formatDefects(result),
      ].filter(Boolean).join('\n');
    },
  };
}
