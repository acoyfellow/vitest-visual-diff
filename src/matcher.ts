// Vitest matcher surface: one fail-closed verdict across structure, computed
// style, pixels, and opt-in accessibility for two live Browser Mode elements.

import type { Locator } from '@vitest/browser/context';
import type { MatcherState } from 'vitest';
import { type CascadeResult, cascade } from './cascade.ts';
import { decodePngBase64 } from './decode-browser.ts';
import { walkElement } from './extract-browser.ts';
import type { PixelFrame, VisualDiffOptions, VisualDiffTarget } from './types.ts';

interface MatcherResult {
  pass: boolean;
  message: () => string;
  actual?: unknown;
  expected?: unknown;
}

interface ResolvedTarget {
  element: Element;
  locator: Locator | null;
}

function isLocator(target: unknown): target is Locator {
  if (typeof target !== 'object' || target === null || !('element' in target)) return false;
  return typeof target.element === 'function';
}

function resolve(target: unknown): ResolvedTarget {
  if (isLocator(target)) return { element: target.element(), locator: target };
  if (target instanceof Element) return { element: target, locator: null };
  throw new TypeError('vitest-visual-diff: expected a Vitest Locator or a DOM Element');
}

async function screenshotFrame(locator: Locator): Promise<PixelFrame> {
  // Vitest returns the raw base64 string when save:false. Passing base64:true
  // here would request the save-to-disk result shape instead.
  const base64 = await locator.screenshot({ save: false });
  return decodePngBase64(base64);
}

function formatDefects(result: CascadeResult): string {
  const lines: string[] = [];
  if (!result.A.pass) {
    if (Object.keys(result.A.control.missingInCandidate).length) {
      lines.push(
        `  structure: missing in control — ${JSON.stringify(result.A.control.missingInCandidate)}`,
      );
    }
    if (Object.keys(result.A.control.extraInCandidate).length) {
      lines.push(
        `  structure: extra in control — ${JSON.stringify(result.A.control.extraInCandidate)}`,
      );
    }
    if (Object.keys(result.A.whole.missingInCandidate).length) {
      lines.push(
        `  structure: missing overall — ${JSON.stringify(result.A.whole.missingInCandidate)}`,
      );
    }
    if (Object.keys(result.A.whole.extraInCandidate).length) {
      lines.push(`  structure: extra overall — ${JSON.stringify(result.A.whole.extraInCandidate)}`);
    }
  }
  if (!result.B.pass) {
    for (const delta of result.B.deltas.slice(0, 8)) {
      lines.push(
        `  style: ${delta.tag}${delta.role ? `[${delta.role}]` : ''}.${delta.prop} — expected "${delta.baseline}" got "${delta.candidate}"`,
      );
    }
    if (result.B.deltas.length > 8) {
      lines.push(`  ...and ${result.B.deltas.length - 8} more style deltas`);
    }
  }
  if (result.C && !result.C.pass) {
    lines.push(
      `  pixels: ${result.C.pct}% of content bbox (${result.C.bbox}) differs${result.C.note ? ` — ${result.C.note}` : ''}`,
    );
  }
  if (result.S && !result.S.pass) {
    for (const delta of result.S.deltas.slice(0, 8)) {
      const attribute = delta.attr ? `.${delta.attr}` : '';
      lines.push(
        `  semantics: ${delta.tag}${delta.role ? `[${delta.role}]` : ''}.${delta.kind}${attribute} — expected "${delta.baseline}" got "${delta.candidate}"`,
      );
    }
  }
  if (result.R && !result.R.pass) {
    if (result.R.missingEdges.length) {
      lines.push(`  references: missing — ${JSON.stringify(result.R.missingEdges)}`);
    }
    if (result.R.extraEdges.length) {
      lines.push(`  references: extra — ${JSON.stringify(result.R.extraEdges)}`);
    }
  }
  return lines.join('\n');
}

export async function toMatchVisualDiff(
  this: MatcherState,
  candidate: VisualDiffTarget,
  baseline: VisualDiffTarget,
  options: VisualDiffOptions = {},
): Promise<MatcherResult> {
  const candidateTarget = resolve(candidate);
  const baselineTarget = resolve(baseline);
  const bothLocators = candidateTarget.locator !== null && baselineTarget.locator !== null;
  if (options.pixels === true && !bothLocators) {
    throw new TypeError(
      'vitest-visual-diff: pixels:true requires both values to be Vitest Locators',
    );
  }
  const comparePixels = options.pixels !== false && bothLocators;
  const candidateStruct = walkElement(candidateTarget.element);
  const baselineStruct = walkElement(baselineTarget.element);

  const [candidatePng, baselinePng] = comparePixels
    ? await Promise.all([
        screenshotFrame(candidateTarget.locator as Locator),
        screenshotFrame(baselineTarget.locator as Locator),
      ])
    : [null, null];

  const result = cascade(baselineStruct, candidateStruct, {
    style: options.style,
    pixels: options.pixelOpts,
    a11y: options.a11y ?? false,
    baselinePng,
    candidatePng,
  });

  return {
    pass: result.pass,
    actual: candidateStruct,
    expected: baselineStruct,
    message: () => {
      const verb = this.isNot ? 'not to' : 'to';
      if (result.pass) {
        return `expected candidate ${verb} match visual-diff baseline (structure+style${comparePixels ? '+pixels' : ''}${options.a11y ? '+a11y' : ''}), but it did`;
      }
      const tierSummary = Object.entries(result.tiers)
        .filter(([, value]) => value !== null)
        .map(([tier, value]) => `${tier}=${value ? 'pass' : 'FAIL'}`)
        .join(' ');
      return [
        `expected candidate ${verb} match visual-diff baseline (${tierSummary})`,
        formatDefects(result),
      ]
        .filter(Boolean)
        .join('\n');
    },
  };
}
