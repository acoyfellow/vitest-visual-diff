// Tier A — STRUCTURE (fail-closed element-multiset diff).
//
// Compares the multiset of element tags in the interactive control subtree and
// across the whole rendered tree. Missing and extra elements fail the tier.

import type { CountMap, RenderStruct } from './types.ts';

export interface MultisetDelta {
  missing: CountMap;
  extra: CountMap;
}

export interface StructureResult {
  pass: boolean;
  controlEqual: boolean;
  wholeEqual: boolean;
  missingSvg: boolean;
  control: {
    baseline: CountMap;
    candidate: CountMap;
    missingInCandidate: CountMap;
    extraInCandidate: CountMap;
  };
  whole: {
    missingInCandidate: CountMap;
    extraInCandidate: CountMap;
  };
}

export function multisetDiff(a: CountMap = {}, b: CountMap = {}): MultisetDelta {
  const missing: CountMap = {};
  const extra: CountMap = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const delta = (a[key] ?? 0) - (b[key] ?? 0);
    if (delta > 0) missing[key] = delta;
    else if (delta < 0) extra[key] = -delta;
  }
  return { missing, extra };
}

function isEmpty(value: CountMap): boolean {
  return Object.keys(value).length === 0;
}

export function diffStructure(baseline: RenderStruct, candidate: RenderStruct): StructureResult {
  const control = multisetDiff(baseline.control.tags, candidate.control.tags);
  const whole = multisetDiff(baseline.tagHistogram, candidate.tagHistogram);
  const controlEqual = isEmpty(control.missing) && isEmpty(control.extra);
  const wholeEqual = isEmpty(whole.missing) && isEmpty(whole.extra);

  return {
    pass: controlEqual && wholeEqual,
    controlEqual,
    wholeEqual,
    missingSvg: baseline.hasSvg && !candidate.hasSvg,
    control: {
      baseline: baseline.control.tags,
      candidate: candidate.control.tags,
      missingInCandidate: control.missing,
      extraInCandidate: control.extra,
    },
    whole: {
      missingInCandidate: whole.missing,
      extraInCandidate: whole.extra,
    },
  };
}
