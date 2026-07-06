// diffgate — a Vitest custom matcher for Browser Mode: fail-closed
// structure + style + pixel (+ opt-in a11y) cascade over two live elements.
//
// Import this file's side effect once (e.g. from a Vitest `setupFiles` entry,
// or directly at the top of a test file) to register `toMatchVisualDiff` on
// `expect`. It works with ANY Vitest Browser Mode provider — local Playwright
// today, or a remote CDP provider like Cloudflare's Browser Run — because it
// only consumes the Locator/Element + screenshot surface Vitest itself
// exposes; it never touches the provider layer.

import { expect } from 'vitest';
import { toMatchVisualDiff } from './matcher.js';

expect.extend({ toMatchVisualDiff });

export { toMatchVisualDiff };
export { cascade, sanityCheck } from './cascade.js';
export { walkElement } from './extract-browser.js';
