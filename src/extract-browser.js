// In-browser render extraction — the Vitest Browser Mode counterpart to
// visual-diff's extract.js. Vitest Browser Mode runs the TEST FILE ITSELF
// inside the real browser, so this is direct DOM code (document, getComputedStyle),
// not a CDP Runtime.evaluate string. Same normalization contract as visual-diff:
// element multisets, per-element computed styles, `display:contents` flattening.

import { STYLE_PROPS } from './style.js';

const SEMANTIC_ATTRS = [
  'role', 'type', 'aria-checked', 'aria-hidden', 'data-state', 'data-checked',
  'data-unchecked', 'data-indeterminate', 'name', 'value', 'disabled',
  'aria-label', 'open', 'data-selected',
];
const INTERACTIVE = '[role="checkbox"],[role="switch"],[role="radio"],button,input,textarea,select,a[href]';

function roleOf(el) {
  const r = el.getAttribute && el.getAttribute('role');
  if (r) return r;
  const t = el.tagName.toLowerCase();
  if (t === 'input') {
    const ty = (el.getAttribute('type') || 'text').toLowerCase();
    return ty === 'checkbox' ? 'checkbox' : ty === 'radio' ? 'radio' : 'textbox';
  }
  const IMP = { button: 'button', a: 'link', label: '(label)', svg: '(graphic)', img: 'img', select: 'listbox', textarea: 'textbox' };
  return IMP[t] || null;
}

function attrsOf(el) {
  const o = {};
  for (const a of SEMANTIC_ATTRS) if (el.hasAttribute && el.hasAttribute(a)) o[a] = el.getAttribute(a);
  return o;
}

function isContents(el) {
  return getComputedStyle(el).display === 'contents';
}

function flatChildren(el) {
  const out = [];
  for (const c of Array.from(el.children)) {
    if (c.nodeType === 1 && isContents(c)) out.push(...flatChildren(c));
    else out.push(c);
  }
  return out;
}

function stylesOf(el) {
  const cs = getComputedStyle(el);
  const o = {};
  for (const p of STYLE_PROPS) o[p] = cs[p];
  return o;
}

/**
 * Walk a rendered subtree rooted at `rootEl` into the same normalized shape
 * visual-diff's extract.js produces: { tree, elements, elementCount,
 * tagHistogram, roles, hasSvg, control }.
 *
 * Unlike visual-diff (which mounts a fragment under a known #mount selector
 * and picks the first non-`display:contents` child as root), here the caller
 * already has a concrete element (from a Locator) — no mount/root-finding.
 *
 * @param {Element} rootEl
 * @returns {{tree, elements, elementCount, tagHistogram, roles, hasSvg, control}}
 */
export function walkElement(rootEl) {
  let root = rootEl;
  while (root && isContents(root)) {
    const fc = flatChildren(root);
    if (fc.length !== 1) break;
    root = fc[0];
  }
  if (!root) return { error: 'no-root' };

  const flatList = [];
  function tree(el, depth) {
    const kids = flatChildren(el).map((c) => tree(c, depth + 1));
    const node = { tag: el.tagName.toLowerCase(), role: roleOf(el), attrs: attrsOf(el), childCount: kids.length, children: kids };
    flatList.push({
      tag: node.tag,
      role: node.role,
      depth,
      className: (el.getAttribute && el.getAttribute('class')) || '',
      ariaHidden: el.getAttribute && el.getAttribute('aria-hidden') === 'true',
      styles: stylesOf(el),
      attrs: node.attrs,
    });
    return node;
  }
  const t = tree(root, 0);

  const tagHistogram = {};
  const roles = {};
  for (const e of flatList) {
    tagHistogram[e.tag] = (tagHistogram[e.tag] || 0) + 1;
    if (e.role) roles[e.role] = (roles[e.role] || 0) + 1;
  }

  let control = root.matches(INTERACTIVE) ? root : (root.querySelector(INTERACTIVE) || root);
  const controlDesc = [];
  (function cwalk(el) {
    for (const c of flatChildren(el)) {
      controlDesc.push(c);
      cwalk(c);
    }
  })(control);
  const controlTags = {};
  for (const el of controlDesc) {
    const tg = el.tagName.toLowerCase();
    controlTags[tg] = (controlTags[tg] || 0) + 1;
  }

  return {
    tree: t,
    elements: flatList,
    elementCount: flatList.length,
    tagHistogram,
    roles,
    hasSvg: !!root.querySelector('svg'),
    control: { tag: control.tagName.toLowerCase(), role: roleOf(control), descendantCount: controlDesc.length, tags: controlTags },
  };
}
