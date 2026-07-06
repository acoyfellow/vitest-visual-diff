import type { Locator } from '@vitest/browser/context';

export type CountMap = Record<string, number>;
export type AttributeMap = Record<string, string>;
export type StyleMap = Record<string, string>;

export interface RenderElement {
  tag: string;
  role: string | null;
  depth: number;
  className: string;
  ariaHidden: boolean;
  styles: StyleMap;
  attrs: AttributeMap;
  id?: string;
  text?: string;
  implicitLabelText?: string;
  parentTag?: string;
}

export interface RenderTree {
  tag: string;
  role: string | null;
  attrs: AttributeMap;
  childCount: number;
  children: RenderTree[];
}

export interface ControlSummary {
  tag: string;
  role: string | null;
  descendantCount: number;
  tags: CountMap;
}

export interface RenderStruct {
  tree: RenderTree;
  elements: RenderElement[];
  elementCount: number;
  tagHistogram: CountMap;
  roles: CountMap;
  hasSvg: boolean;
  control: ControlSummary;
}

export interface PixelFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface StyleOptions {
  tol?: number;
  props?: ReadonlySet<string>;
}

export interface PixelOptions {
  threshold?: number;
  includeAA?: boolean;
  flagPct?: number;
  emitDiff?: boolean;
}

export interface VisualDiffOptions {
  pixels?: boolean;
  a11y?: boolean;
  style?: StyleOptions;
  pixelOpts?: PixelOptions;
}

export type VisualDiffTarget = Locator | Element;

export interface CascadeOptions {
  baselinePng?: PixelFrame | null;
  candidatePng?: PixelFrame | null;
  style?: StyleOptions;
  pixels?: PixelOptions;
  a11y?: boolean;
}
