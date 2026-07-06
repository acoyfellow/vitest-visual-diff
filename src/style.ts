// Tier B — COMPUTED STYLE (cause-locator).
//
// Aligns present elements by longest common subsequence over tag/role, then
// names significant box-model, color, background, and border differences.

import type { RenderElement, RenderStruct, StyleOptions } from './types.ts';

export const STYLE_PROPS = [
  'display',
  'width',
  'height',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'backgroundColor',
  'backgroundImage',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'borderTopColor',
  'borderRadius',
  'boxShadow',
  'color',
  'alignItems',
  'justifyContent',
  'fontSize',
  'fontWeight',
] as const;

export const SIGNIFICANT: ReadonlySet<string> = new Set([
  'display',
  'width',
  'height',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'backgroundColor',
  'backgroundImage',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'borderTopColor',
  'borderRadius',
  'boxShadow',
  'color',
]);

export interface StyleDelta {
  tag: string;
  role: string | null;
  prop: string;
  baseline: string | undefined;
  candidate: string | undefined;
}

export interface StyleResult {
  pass: boolean;
  deltas: StyleDelta[];
}

function signature(element: RenderElement): string {
  return `${element.tag}|${element.role ?? ''}`;
}

export function alignLCS(
  baseline: RenderElement[],
  candidate: RenderElement[],
): Array<[RenderElement, RenderElement]> {
  const n = baseline.length;
  const m = candidate.length;
  const matrix = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      matrix[i][j] =
        signature(baseline[i]) === signature(candidate[j])
          ? matrix[i + 1][j + 1] + 1
          : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }

  const pairs: Array<[RenderElement, RenderElement]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (signature(baseline[i]) === signature(candidate[j])) {
      pairs.push([baseline[i], candidate[j]]);
      i++;
      j++;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

export function numClose(x: string | undefined, y: string | undefined, tolerance = 0.6): boolean {
  if (x === undefined || y === undefined) return false;
  const parsedX = Number.parseFloat(x);
  const parsedY = Number.parseFloat(y);
  if (!Number.isNaN(parsedX) && !Number.isNaN(parsedY) && /px|^\d/.test(x) && /px|^\d/.test(y)) {
    return Math.abs(parsedX - parsedY) <= tolerance;
  }
  return false;
}

export function diffStyle(
  baseline: RenderStruct,
  candidate: RenderStruct,
  options: StyleOptions = {},
): StyleResult {
  const tolerance = options.tol ?? 0.6;
  const props = options.props ?? SIGNIFICANT;
  const pairs = alignLCS(baseline.elements, candidate.elements);
  const deltas: StyleDelta[] = [];

  for (const [baselineElement, candidateElement] of pairs) {
    for (const property of STYLE_PROPS) {
      if (!props.has(property)) continue;
      const baselineValue = baselineElement.styles[property];
      const candidateValue = candidateElement.styles[property];
      if (baselineValue !== candidateValue && !numClose(baselineValue, candidateValue, tolerance)) {
        deltas.push({
          tag: baselineElement.tag,
          role: baselineElement.role,
          prop: property,
          baseline: baselineValue,
          candidate: candidateValue,
        });
      }
    }
  }
  return { pass: deltas.length === 0, deltas };
}
