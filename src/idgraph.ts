// Tier R — id-reference graph shape.
//
// Literal IDs commonly differ across independent renders, so comparison uses
// stable tag/role occurrence signatures and checks whether the same relationship
// edges exist (label-for, labelledby, describedby, controls, owns).

import type { RenderElement } from './types.ts';

export const REFERENCE_ATTRS = [
  'for',
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
] as const;

interface Edge {
  from: string;
  attr: string;
  to: string;
}

interface ReferenceGraph {
  edges: Edge[];
  unresolved: Array<{ from: string; attr: string; ref: string }>;
}

export interface ReferenceResult {
  pass: boolean;
  missingEdges: string[];
  extraEdges: string[];
  unresolvedInBaseline: number;
  unresolvedInCandidate: number;
}

function signatures(elements: RenderElement[]): {
  values: string[];
  idToSignature: Map<string, string>;
} {
  const counts = new Map<string, number>();
  const values: string[] = [];
  const idToSignature = new Map<string, string>();
  for (const element of elements) {
    const base = `${element.tag}|${element.role ?? ''}`;
    const index = counts.get(base) ?? 0;
    counts.set(base, index + 1);
    const signature = `${base}#${index}`;
    values.push(signature);
    if (element.id) idToSignature.set(element.id, signature);
  }
  return { values, idToSignature };
}

function buildGraph(elements: RenderElement[]): ReferenceGraph {
  const { values, idToSignature } = signatures(elements);
  const edges: Edge[] = [];
  const unresolved: ReferenceGraph['unresolved'] = [];

  elements.forEach((element, index) => {
    const from = values[index];
    for (const attribute of REFERENCE_ATTRS) {
      const raw = element.attrs[attribute];
      if (!raw) continue;
      for (const ref of raw.trim().split(/\s+/).filter(Boolean)) {
        const target = idToSignature.get(ref);
        if (target) edges.push({ from, attr: attribute, to: target });
        else unresolved.push({ from, attr: attribute, ref });
      }
    }
  });
  return { edges, unresolved };
}

function edgeKey(edge: Edge): string {
  return `${edge.from}--${edge.attr}-->${edge.to}`;
}

export function diffReferenceGraph(
  baseline: RenderElement[],
  candidate: RenderElement[],
): ReferenceResult {
  const baselineGraph = buildGraph(baseline);
  const candidateGraph = buildGraph(candidate);
  const baselineEdges = new Set(baselineGraph.edges.map(edgeKey));
  const candidateEdges = new Set(candidateGraph.edges.map(edgeKey));
  const missingEdges = [...baselineEdges].filter((edge) => !candidateEdges.has(edge));
  const extraEdges = [...candidateEdges].filter((edge) => !baselineEdges.has(edge));
  return {
    pass: missingEdges.length === 0 && extraEdges.length === 0,
    missingEdges,
    extraEdges,
    unresolvedInBaseline: baselineGraph.unresolved.length,
    unresolvedInCandidate: candidateGraph.unresolved.length,
  };
}
