// Tier S — accessible name, description, and state.
//
// This is a focused subset of the W3C accessible-name precedence needed for
// regression comparison. It compares perceived output; a source change that
// preserves the same name is reported as a warning rather than a failure.

import { alignLCS } from './style.ts';
import type { AttributeMap, RenderElement, RenderStruct } from './types.ts';

const STATE_ATTRS = [
  'aria-checked',
  'aria-expanded',
  'aria-selected',
  'aria-pressed',
  'aria-current',
  'aria-disabled',
  'aria-hidden',
  'aria-invalid',
  'aria-required',
  'aria-readonly',
  'aria-busy',
] as const;

interface AccessibleValue {
  value: string | null;
  source: string | null;
}

export interface SemanticDelta {
  kind: 'accessible-name' | 'accessible-description' | 'accessible-state';
  tag: string;
  role: string | null;
  attr?: string;
  baseline: string;
  candidate: string;
}

export interface SemanticWarning {
  kind: 'accessible-name-source';
  tag: string;
  role: string | null;
  name: string;
  baselineSource: string | null;
  candidateSource: string | null;
}

export interface SemanticResult {
  pass: boolean;
  deltas: SemanticDelta[];
  warnings: SemanticWarning[];
}

function resolveIdRefs(
  value: string | undefined,
  byId: ReadonlyMap<string, RenderElement>,
): string | null {
  if (!value) return null;
  const texts = value
    .trim()
    .split(/\s+/)
    .map((id) => byId.get(id)?.text?.trim())
    .filter((text): text is string => Boolean(text));
  return texts.length ? texts.join(' ') : null;
}

function accessibleName(
  element: RenderElement,
  byId: ReadonlyMap<string, RenderElement>,
): AccessibleValue {
  const labelledBy = resolveIdRefs(element.attrs['aria-labelledby'], byId);
  if (labelledBy) return { value: labelledBy, source: 'aria-labelledby' };
  const ariaLabel = element.attrs['aria-label'];
  if (ariaLabel) return { value: ariaLabel, source: 'aria-label' };
  if (element.implicitLabelText) {
    return { value: element.implicitLabelText, source: 'native-label' };
  }
  if (['button', 'a'].includes(element.tag) && element.text) {
    return { value: element.text.trim(), source: 'text-content' };
  }
  const title = element.attrs.title;
  if (title) return { value: title, source: 'title-attribute' };
  return { value: null, source: null };
}

function accessibleDescription(
  element: RenderElement,
  byId: ReadonlyMap<string, RenderElement>,
): AccessibleValue {
  const describedBy = resolveIdRefs(element.attrs['aria-describedby'], byId);
  return describedBy
    ? { value: describedBy, source: 'aria-describedby' }
    : { value: null, source: null };
}

function accessibleState(element: RenderElement): AttributeMap {
  const state: AttributeMap = {};
  for (const attribute of STATE_ATTRS) {
    const value = element.attrs[attribute];
    if (value !== undefined) state[attribute] = value;
  }
  return state;
}

function byId(elements: RenderElement[]): Map<string, RenderElement> {
  const map = new Map<string, RenderElement>();
  for (const element of elements) if (element.id) map.set(element.id, element);
  return map;
}

export function diffSemantic(baseline: RenderStruct, candidate: RenderStruct): SemanticResult {
  const baselineById = byId(baseline.elements);
  const candidateById = byId(candidate.elements);
  const pairs = alignLCS(baseline.elements, candidate.elements);
  const deltas: SemanticDelta[] = [];
  const warnings: SemanticWarning[] = [];

  for (const [baselineElement, candidateElement] of pairs) {
    const baselineName = accessibleName(baselineElement, baselineById);
    const candidateName = accessibleName(candidateElement, candidateById);
    if (baselineName.value !== candidateName.value) {
      deltas.push({
        kind: 'accessible-name',
        tag: baselineElement.tag,
        role: baselineElement.role,
        baseline: baselineName.value ?? '(absent)',
        candidate: candidateName.value ?? '(absent)',
      });
    } else if (baselineName.value !== null && baselineName.source !== candidateName.source) {
      warnings.push({
        kind: 'accessible-name-source',
        tag: baselineElement.tag,
        role: baselineElement.role,
        name: baselineName.value,
        baselineSource: baselineName.source,
        candidateSource: candidateName.source,
      });
    }

    const baselineDescription = accessibleDescription(baselineElement, baselineById);
    const candidateDescription = accessibleDescription(candidateElement, candidateById);
    if (baselineDescription.value !== candidateDescription.value) {
      deltas.push({
        kind: 'accessible-description',
        tag: baselineElement.tag,
        role: baselineElement.role,
        baseline: baselineDescription.value ?? '(absent)',
        candidate: candidateDescription.value ?? '(absent)',
      });
    }

    const baselineState = accessibleState(baselineElement);
    const candidateState = accessibleState(candidateElement);
    for (const attribute of new Set([
      ...Object.keys(baselineState),
      ...Object.keys(candidateState),
    ])) {
      if (baselineState[attribute] !== candidateState[attribute]) {
        deltas.push({
          kind: 'accessible-state',
          tag: baselineElement.tag,
          role: baselineElement.role,
          attr: attribute,
          baseline: baselineState[attribute] ?? '(absent)',
          candidate: candidateState[attribute] ?? '(absent)',
        });
      }
    }
  }

  return { pass: deltas.length === 0, deltas, warnings };
}
