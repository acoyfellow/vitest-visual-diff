// The fail-closed cascade. Ported verbatim (same tier order, same AND
// semantics, same sanity-anchor pattern) from @acoyfellow/visual-diff's
// src/cascade.js — this is the proven core, not a rewrite.
//
// PASS = A (structure) AND B (style) AND C (pixels, when PNGs supplied)
//        AND D (a11y, opt-in via opts.a11y).

import { diffStructure } from './structure.js';
import { diffStyle } from './style.js';
import { diffPixels } from './pixels.js';
import { diffA11y } from './a11y.js';

/**
 * @param {Object} baseline   normalized render (from extract-browser.js)
 * @param {Object} candidate  normalized render
 * @param {{baselinePng?, candidatePng?, style?, pixels?, a11y?:boolean}} [opts]
 * @returns {{pass:boolean, A, B, C:(Object|null), D:(Object|null), tiers:Object}}
 */
export function cascade(baseline, candidate, opts = {}) {
  const A = diffStructure(baseline, candidate);
  const B = diffStyle(baseline, candidate, opts.style);
  const C = (opts.baselinePng && opts.candidatePng) ? diffPixels(opts.baselinePng, opts.candidatePng, opts.pixels) : null;
  const D = opts.a11y ? diffA11y(baseline, candidate) : null;

  const cPass = C == null ? true : C.pass;
  const dPass = D == null ? true : D.pass;
  const pass = A.pass && B.pass && cPass && dPass;

  const tiers = { A: A.pass, B: B.pass, C: C == null ? null : C.pass };
  if (opts.a11y) tiers.D = D.pass;

  return { pass, A, B, C, D, tiers };
}

/**
 * The sanity-anchor pattern, ported unmodified: a gate you can't trust unless
 * it PASSES a known-identical pair and FLAGS a known-broken pair.
 * @param {Array<{name:string, expect:('pass'|'broken'), baseline, candidate, baselinePng?, candidatePng?}>} anchors
 */
export function sanityCheck(anchors, opts = {}) {
  const results = [];
  const violations = [];
  for (const a of anchors) {
    const r = cascade(a.baseline, a.candidate, { ...opts, baselinePng: a.baselinePng, candidatePng: a.candidatePng });
    const verdict = r.pass ? 'pass' : 'broken';
    const held = verdict === a.expect;
    if (!held) violations.push(`anchor "${a.name}" expected ${a.expect} but cascade said ${verdict}`);
    results.push({ name: a.name, expect: a.expect, verdict, held, cascade: r });
  }
  return { ok: violations.length === 0, results, violations };
}
