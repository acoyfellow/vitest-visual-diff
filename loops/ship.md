# Ship loop

Follow `../../.context/TERRALOOP.md` from the workspace root.

## North star

A new, single-purpose Vitest Browser Mode matcher package that compares two live
elements through structure, computed style, pixels, and accessibility; the same
test suite runs through multiple browser engines and provider implementations.

## Collapsed hypothesis

The unknowns are coupled enough to test as one end-to-end experiment:

> A custom async Vitest matcher can resolve two live Locators, inspect their DOM
> and computed styles in-page, capture both elements through Vitest's provider
> abstraction, and return one fail-closed verdict without importing a provider.

## Stop gate

- strict TypeScript and Biome checks pass;
- the README tutorial is an executable browser test;
- positive and negative controls exist for each tier;
- the suite passes in Chromium, Firefox, and WebKit through Playwright;
- the same suite passes through WebdriverIO without source changes;
- a Browser Run claim appears only after a hosted run exits successfully;
- public-repository files and lockfile checks pass;
- README tutorial, how-to, reference, and explanation sections read cleanly in a browser;
- adversarial review has no must-fix findings.

Receipts live under `experiments/`.
