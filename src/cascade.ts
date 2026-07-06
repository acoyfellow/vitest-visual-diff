// The fail-closed cascade.
//
// Default PASS = A (structure) AND B (style) AND C (pixels, when available).
// With a11y enabled, semantic output S and reference graph R join the same AND.

import { diffReferenceGraph, type ReferenceResult } from './idgraph.ts';
import { diffPixels, type PixelResult } from './pixels.ts';
import { diffSemantic, type SemanticResult } from './semantic.ts';
import { diffStructure, type StructureResult } from './structure.ts';
import { diffStyle, type StyleResult } from './style.ts';
import type { CascadeOptions, PixelFrame, RenderStruct } from './types.ts';

export interface TierSummary {
  A: boolean;
  B: boolean;
  C: boolean | null;
  S?: boolean;
  R?: boolean;
}

export interface CascadeResult {
  pass: boolean;
  A: StructureResult;
  B: StyleResult;
  C: PixelResult | null;
  S: SemanticResult | null;
  R: ReferenceResult | null;
  tiers: TierSummary;
}

export function cascade(
  baseline: RenderStruct,
  candidate: RenderStruct,
  options: CascadeOptions = {},
): CascadeResult {
  const A = diffStructure(baseline, candidate);
  const B = diffStyle(baseline, candidate, options.style);
  const C =
    options.baselinePng && options.candidatePng
      ? diffPixels(options.baselinePng, options.candidatePng, options.pixels)
      : null;
  const S = options.a11y ? diffSemantic(baseline, candidate) : null;
  const R = options.a11y ? diffReferenceGraph(baseline.elements, candidate.elements) : null;
  const pass = A.pass && B.pass && (C?.pass ?? true) && (S?.pass ?? true) && (R?.pass ?? true);
  const tiers: TierSummary = { A: A.pass, B: B.pass, C: C?.pass ?? null };
  if (S && R) {
    tiers.S = S.pass;
    tiers.R = R.pass;
  }
  return { pass, A, B, C, S, R, tiers };
}

export interface SanityAnchor {
  name: string;
  expect: 'pass' | 'broken';
  baseline: RenderStruct;
  candidate: RenderStruct;
  baselinePng?: PixelFrame;
  candidatePng?: PixelFrame;
}

export interface SanityResult {
  ok: boolean;
  results: Array<{
    name: string;
    expect: 'pass' | 'broken';
    verdict: 'pass' | 'broken';
    held: boolean;
    cascade: CascadeResult;
  }>;
  violations: string[];
}

export function sanityCheck(anchors: SanityAnchor[], options: CascadeOptions = {}): SanityResult {
  const results: SanityResult['results'] = [];
  const violations: string[] = [];
  for (const anchor of anchors) {
    const result = cascade(anchor.baseline, anchor.candidate, {
      ...options,
      baselinePng: anchor.baselinePng,
      candidatePng: anchor.candidatePng,
    });
    const verdict = result.pass ? 'pass' : 'broken';
    const held = verdict === anchor.expect;
    if (!held) {
      violations.push(
        `anchor "${anchor.name}" expected ${anchor.expect} but cascade said ${verdict}`,
      );
    }
    results.push({
      name: anchor.name,
      expect: anchor.expect,
      verdict,
      held,
      cascade: result,
    });
  }
  return { ok: violations.length === 0, results, violations };
}
