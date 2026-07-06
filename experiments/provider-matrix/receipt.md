# Provider matrix receipt

Date: 2026-07-06

## Hypothesis

The matcher uses Vitest's Locator/Element contract rather than a provider API,
so one test file should run unchanged through multiple browser engines and
provider implementations.

## Inputs

- Vitest 4.1.10
- `test/matcher.test.ts` plus the executable README tutorial in `test/tutorial.test.ts`
- Playwright provider: Chromium, Firefox, WebKit
- WebdriverIO provider: installed Chrome

## Results

| Command | Result |
|---|---|
| `bun run test` | 2 files, 12 tests passed |
| `bun run test:webdriverio` | 2 files, 12 tests passed |
| `bun run test:all-browsers` | 6 files, 36 tests passed |
| five consecutive strict-TypeScript semantic-cascade runs | all five runs completed with 36 tests passed |

The first three-engine run found a Firefox-only false failure: two identical
buttons mounted in adjacent normal-flow containers produced element screenshots
of 20×20 and 20×21 pixels even though both `getBoundingClientRect()` calls
reported 20×20. The mount containers were coupled through normal block flow.
Moving each mount to a fixed position removed the coupling. The strict
pixel-dimension check stayed unchanged; no tolerance was added to hide the
failure.

## Re-run

```sh
bun run test
bun run test:webdriverio
bun run test:all-browsers
```
