# Cloudflare Browser Run receipt

Date: 2026-07-06

## Hypothesis

The matcher can run unchanged through Brendan Irvine-Broque's Cloudflare Browser
Run provider because it consumes Vitest's Locator/Element surface rather than a
provider API.

## Inputs

- `irvinebroque/vitest-browser-run` at `d011a6f`
- `irvinebroque/vitest` branch `feat/playwright-cdp-options` at `936cdc6b2`
- `irvinebroque/workers-sdk` branch `vite-tunnel-programmatic-url` at `ccc45176b`
- local `vitest-visual-diff` linked into the provider example
- Wrangler OAuth token with Browser write permission, passed only through the
  process environment
- one hosted Chromium session, one Vitest worker

## Test

The Browser Run example imported `vitest-visual-diff` and ran:

1. a known-identical checkbox pair that must pass;
2. a checkbox missing its checkmark SVG that must be rejected by the matcher.

## Result

```text
Test Files  1 passed (1)
     Tests  2 passed (2)
  Duration  23.96s (import 786ms, tests 2.85s)
```

The first two credential attempts returned HTTP 401 before creating a browser:
a personal API token did not satisfy Browser Run authentication. The successful
run used `wrangler auth token --json` captured into a shell variable and unset
after the command. No credential was printed or written to a file.

A preceding run against the same final source acquired a hosted browser but the
Browser Mode WebSocket closed before either test executed (`tests 0ms`). A
bounded retry passed both tests. The failed transport attempt is retained here
because a hosted provider's connection stability is separate from matcher
correctness.

## Re-run shape

The provider currently depends on pending Vitest and Workers SDK branches. Follow
its README to build those sibling forks, then run the example test with
`CLOUDFLARE_API_TOKEN` set from an OAuth token that has Browser write permission.

## Running inside the provider's own proof suite, not just in isolation

The result above only proves the matcher works as a standalone test file. To
check whether it plays nicely with the provider's own test suite — not just
next to it — `vitest-visual-diff` was added as a real `devDependency` of
`examples/parallelism` (via a local `link:` reference) and its test file was
left in `test/browser/` alongside the provider's own 8 `parallel-slot-*` files,
3 `visual-*` snapshot tests, and `greeting` test — then the provider's actual
default command was run, unedited:

```sh
pnpm test:browser-run
```

This runs `vitest run --config vitest.browser-run.config.ts` with no file
filter, so it schedules all 13 files (12 the provider's own, 1 mine) under the
provider's real default pool (`maxWorkers=8`, one shared hosted Chromium
session, `sessionsPerBrowser` derived from that default).

Provider unit tests and typecheck, unmodified:

```text
pnpm test        -> Test Files 3 passed (3) / Tests 36 passed (36)
pnpm typecheck   -> passes for both packages
```

Four consecutive runs of `pnpm test:browser-run` at the provider's own default
concurrency:

| Run | Result |
|---|---|
| 1 | 2 files failed / 13, 6 tests failed / 20 — `parallel-slot-01/02/03` + all 3 `visual-*` + `vitest-visual-diff`'s file, all with `Browser connection was closed` / `Target page, context or browser has been closed` |
| 2 | 1 file failed / 13, 4 tests failed / 20 (observed live in the terminal; not captured to a log file) — same error class, spread across the provider's own files, not `vitest-visual-diff`-specific |
| 3 | 13/13 files, 20/20 tests passed |
| 4 | 13/13 files, 20/20 tests passed |

In every failing run, the failures land on the provider's own `parallel-slot-*`
and `visual-*` files as often as (or instead of) `vitest-visual-diff`'s file —
never on `vitest-visual-diff` exclusively. Isolating the provider's own 12
files alone (no `vitest-visual-diff` in the run at all) at the same default
concurrency also passed cleanly (18/18), and running all 13 files serialized to
a single hosted session (`VITEST_MAX_WORKERS=1
CLOUDFLARE_BROWSER_RUN_MAX_BROWSERS=1 CLOUDFLARE_BROWSER_RUN_SESSIONS_PER_BROWSER=1`)
passed all 13 files / 20 tests with no flake.

Conclusion: the intermittent failures are a capacity/pooling characteristic of
hosted Browser Run at this provider's own default full-suite concurrency —
the provider's README already documents a browser-creation rate limit and a
pooling model for exactly this reason. `vitest-visual-diff` does not cause the
flake, is not more exposed to it than the provider's own tests, and is fully
stable serialized. This is reported here rather than smoothed over, because
"it works in isolation" and "it survives the provider's real default load"
are different claims, and only the second one is what matters for shipping
this inside the provider's actual test suite.
