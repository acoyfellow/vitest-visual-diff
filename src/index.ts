import { expect } from 'vitest';
import { toMatchVisualDiff } from './matcher.ts';
import type { VisualDiffOptions, VisualDiffTarget } from './types.ts';

expect.extend({ toMatchVisualDiff });

declare module 'vitest' {
  // Vitest declares this external interface with `T = any`; declaration
  // merging requires the exact same type parameter default.
  // biome-ignore lint/suspicious/noExplicitAny: required by Vitest's public type contract
  interface Matchers<T = any> {
    toMatchVisualDiff(baseline: VisualDiffTarget, options?: VisualDiffOptions): Promise<T>;
  }
}

export { cascade, sanityCheck } from './cascade.ts';
export { walkElement } from './extract-browser.ts';
export { diffReferenceGraph } from './idgraph.ts';
export { toMatchVisualDiff } from './matcher.ts';
export { diffSemantic } from './semantic.ts';
export type {
  CascadeOptions,
  PixelFrame,
  PixelOptions,
  RenderElement,
  RenderStruct,
  StyleOptions,
  VisualDiffOptions,
  VisualDiffTarget,
} from './types.ts';
