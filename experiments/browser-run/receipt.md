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
