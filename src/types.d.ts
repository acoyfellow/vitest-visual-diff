import 'vitest';

interface DiffgateOptions {
  /** default: true when both sides can screenshot (Locators) */
  pixels?: boolean;
  /** opt-in Tier D: accessible-name/role/state signature must also match */
  a11y?: boolean;
  /** forwarded to visual-diff's style-tier diff (tolerance, prop subset) */
  style?: Record<string, unknown>;
  /** forwarded to the pixel tier (threshold, includeAA, flagPct) */
  pixelOpts?: Record<string, unknown>;
}

declare module 'vitest' {
  interface Matchers<R = unknown> {
    /**
     * Fail-closed structure+style+pixel(+a11y) cascade against a baseline
     * Locator or Element. PASS only if every requested tier agrees.
     */
    toMatchVisualDiff: (baseline: unknown, opts?: DiffgateOptions) => Promise<R>;
  }
}
