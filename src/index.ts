import { expect } from 'vitest';
import { toMatchVisualDiff, toMatchVisualDiffSequence } from './matcher.ts';
import type { VisualDiffOptions, VisualDiffSequenceTarget, VisualDiffTarget } from './types.ts';

expect.extend({ toMatchVisualDiff, toMatchVisualDiffSequence });

declare module 'vitest' {
  // Vitest declares this external interface with `T = any`; declaration
  // merging requires the exact same type parameter default.
  // biome-ignore lint/suspicious/noExplicitAny: required by Vitest's public type contract
  interface Matchers<T = any> {
    toMatchVisualDiff(baseline: VisualDiffTarget, options?: VisualDiffOptions): Promise<T>;
    toMatchVisualDiffSequence(
      baseline: VisualDiffSequenceTarget,
      options?: VisualDiffOptions,
    ): Promise<T>;
  }
}

export {
  type CaptureVisualDiffFramesOptions,
  captureVisualDiffFrames,
} from './capture-browser.ts';
export { cascade, sanityCheck } from './cascade.ts';
export { walkElement } from './extract-browser.ts';
export { diffReferenceGraph } from './idgraph.ts';
export { toMatchVisualDiff, toMatchVisualDiffSequence } from './matcher.ts';
export { diffSemantic } from './semantic.ts';
export {
  type CascadeSequenceOptions,
  type CascadeSequenceResult,
  cascadeSequence,
  type SequenceFrameResult,
} from './temporal.ts';
export type {
  CascadeOptions,
  PixelFrame,
  PixelOptions,
  RenderElement,
  RenderStruct,
  StyleOptions,
  VisualDiffOptions,
  VisualDiffSequenceTarget,
  VisualDiffTarget,
} from './types.ts';
