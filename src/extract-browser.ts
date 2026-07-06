// In-browser render extraction for Vitest Browser Mode.
//
// Tests already execute inside a real browser, so extraction uses direct DOM
// APIs rather than a CDP evaluation string. Elements with display:contents are
// flattened because they contribute no layout box.

import { STYLE_PROPS } from './style.ts';
import type {
  AttributeMap,
  CountMap,
  RenderElement,
  RenderStruct,
  RenderTree,
  StyleMap,
} from './types.ts';

const SEMANTIC_ATTRS = [
  'role',
  'type',
  'name',
  'value',
  'disabled',
  'open',
  'title',
  'for',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
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
  'data-state',
  'data-checked',
  'data-unchecked',
  'data-indeterminate',
  'data-selected',
] as const;

const INTERACTIVE =
  '[role="checkbox"],[role="switch"],[role="radio"],button,input,textarea,select,a[href]';

const IMPLICIT_ROLES: Readonly<Record<string, string>> = {
  button: 'button',
  a: 'link',
  label: '(label)',
  svg: '(graphic)',
  img: 'img',
  select: 'listbox',
  textarea: 'textbox',
};

function roleOf(element: Element): string | null {
  const explicit = element.getAttribute('role');
  if (explicit) return explicit;
  const tag = element.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (element.getAttribute('type') ?? 'text').toLowerCase();
    return type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : 'textbox';
  }
  return IMPLICIT_ROLES[tag] ?? null;
}

function attrsOf(element: Element): AttributeMap {
  const attrs: AttributeMap = {};
  for (const attribute of SEMANTIC_ATTRS) {
    if (element.hasAttribute(attribute)) attrs[attribute] = element.getAttribute(attribute) ?? '';
  }
  return attrs;
}

function isContents(element: Element): boolean {
  return getComputedStyle(element).display === 'contents';
}

function flatChildren(element: Element): Element[] {
  const children: Element[] = [];
  for (const child of Array.from(element.children)) {
    if (isContents(child)) children.push(...flatChildren(child));
    else children.push(child);
  }
  return children;
}

function stylesOf(element: Element): StyleMap {
  const computed = getComputedStyle(element) as unknown as Record<string, string>;
  const styles: StyleMap = {};
  for (const property of STYLE_PROPS) styles[property] = computed[property] ?? '';
  return styles;
}

export function walkElement(rootElement: Element): RenderStruct {
  let root = rootElement;
  while (isContents(root)) {
    const children = flatChildren(root);
    if (children.length !== 1) break;
    root = children[0];
  }

  const elements: RenderElement[] = [];
  function walk(
    element: Element,
    depth: number,
    parentTag?: string,
    inheritedLabel?: string,
  ): RenderTree {
    const tag = element.tagName.toLowerCase();
    const attrs = attrsOf(element);
    const text = element.textContent?.trim() || undefined;
    const renderElement: RenderElement = {
      tag,
      role: roleOf(element),
      depth,
      className: element.getAttribute('class') ?? '',
      ariaHidden: element.getAttribute('aria-hidden') === 'true',
      styles: stylesOf(element),
      attrs,
      ...(element.id ? { id: element.id } : {}),
      ...(text ? { text } : {}),
      ...(inheritedLabel ? { implicitLabelText: inheritedLabel } : {}),
      ...(parentTag ? { parentTag } : {}),
    };
    elements.push(renderElement);

    const labelForChildren = tag === 'label' ? text : inheritedLabel;
    const children = flatChildren(element).map((child) =>
      walk(child, depth + 1, tag, labelForChildren),
    );
    return {
      tag,
      role: renderElement.role,
      attrs,
      childCount: children.length,
      children,
    };
  }

  const tree = walk(root, 0);

  // Apply explicit <label for="..."> text to its target. Literal IDs stay local
  // to this render; the reference-graph tier compares edge shape across renders.
  const byId = new Map<string, RenderElement>();
  for (const element of elements) if (element.id) byId.set(element.id, element);
  for (const element of elements) {
    if (element.tag !== 'label' || !element.text) continue;
    const targetId = element.attrs.for;
    if (targetId) {
      const target = byId.get(targetId);
      if (target) target.implicitLabelText = element.text;
    }
  }

  const tagHistogram: CountMap = {};
  const roles: CountMap = {};
  for (const element of elements) {
    tagHistogram[element.tag] = (tagHistogram[element.tag] ?? 0) + 1;
    if (element.role) roles[element.role] = (roles[element.role] ?? 0) + 1;
  }

  const control = root.matches(INTERACTIVE) ? root : (root.querySelector(INTERACTIVE) ?? root);
  const descendants: Element[] = [];
  function collect(element: Element): void {
    for (const child of flatChildren(element)) {
      descendants.push(child);
      collect(child);
    }
  }
  collect(control);

  const controlTags: CountMap = {};
  for (const element of descendants) {
    const tag = element.tagName.toLowerCase();
    controlTags[tag] = (controlTags[tag] ?? 0) + 1;
  }

  return {
    tree,
    elements,
    elementCount: elements.length,
    tagHistogram,
    roles,
    hasSvg: root.querySelector('svg') !== null,
    control: {
      tag: control.tagName.toLowerCase(),
      role: roleOf(control),
      descendantCount: descendants.length,
      tags: controlTags,
    },
  };
}
