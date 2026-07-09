// Temporal visual diff: apply the existing fail-closed cascade to ordered
// render frames and retain the exact first divergent frame.

import { type CascadeResult, cascade } from './cascade.ts';
import type { CascadeOptions, PixelFrame, RenderStruct } from './types.ts';

export interface CascadeSequenceOptions
  extends Omit<CascadeOptions, 'baselinePng' | 'candidatePng'> {
  baselinePng?: readonly (PixelFrame | null)[];
  candidatePng?: readonly (PixelFrame | null)[];
}

export interface ComparedSequenceFrame {
  frame: number;
  pass: boolean;
  tiers: CascadeResult['tiers'];
  cascade: CascadeResult;
}

export interface MissingSequenceFrame {
  frame: number;
  pass: false;
  reason: 'frame-count-mismatch';
}

export type SequenceFrameResult = ComparedSequenceFrame | MissingSequenceFrame;

export interface CascadeSequenceResult {
  pass: boolean;
  firstDivergence: number;
  frames: SequenceFrameResult[];
}

export function cascadeSequence(
  baselineFrames: readonly RenderStruct[],
  candidateFrames: readonly RenderStruct[],
  options: CascadeSequenceOptions = {},
): CascadeSequenceResult {
  const frameCount = Math.max(baselineFrames.length, candidateFrames.length);
  const frames: SequenceFrameResult[] = [];
  let firstDivergence = -1;

  for (let frame = 0; frame < frameCount; frame++) {
    const baseline = baselineFrames[frame];
    const candidate = candidateFrames[frame];
    if (!baseline || !candidate) {
      frames.push({ frame, pass: false, reason: 'frame-count-mismatch' });
      if (firstDivergence < 0) firstDivergence = frame;
      continue;
    }

    const result = cascade(baseline, candidate, {
      style: options.style,
      pixels: options.pixels,
      a11y: options.a11y,
      baselinePng: options.baselinePng?.[frame] ?? null,
      candidatePng: options.candidatePng?.[frame] ?? null,
    });
    frames.push({ frame, pass: result.pass, tiers: result.tiers, cascade: result });
    if (!result.pass && firstDivergence < 0) firstDivergence = frame;
  }

  return { pass: firstDivergence < 0, firstDivergence, frames };
}
