# Playground backend: Cloudflare Browser Run (isolated proof)

Question this answers: can a hosted playground use Brendan Irvine-Broque's
`vitest-browser-run` provider as the execution backend for arbitrary
visitor-supplied `vitest-visual-diff` test files — tested as its own
standalone project, not embedded in his `examples/parallelism` app, so the
result is about the provider itself, not about his example scaffolding.

## The architectural fact this backend runs into

Browser Run does **not** run the whole Vitest process remotely, unlike the
Sandbox backend in `../playground-sandbox`. Reading
`packages/browser-run-provider/src/browser-run.ts` directly: Browser Run only
replaces the **browser**. Vitest's own Node orchestrator — the process that
decides pass/fail — still runs locally (or on whatever server hosts it) and
exposes itself over a public tunnel; the hosted Chromium session connects
*back* into that tunnel over CDP to load `__vitest_test__` pages. Concretely,
`resolveBrowserRunRunnerUrl()` throws outright if no public tunnel origin is
configured — there is no way to point Browser Run at a bare CDP endpoint
without also running a reachable Vitest dev server somewhere.

That means a Browser-Run-backed playground still needs a real compute
backend to run Vitest itself (a Worker with `@cloudflare/vite-plugin`'s
tunnel, or the same kind of container `playground-sandbox` uses) — Browser
Run only replaces *where the Chromium session runs*, not *where Vitest
runs*. This is a materially different backend shape than Sandbox, where one
container does both.

## What this is

A from-scratch project, outside his repo, with:

- Its own minimal Worker (`src/worker.ts`) — just enough for the Cloudflare
  Vite plugin's tunnel to attach to, per the provider's own requirement.
- `vite.config.ts` / `vitest.browser-run.config.ts` wiring `browserRunCdp()`
  from `@cloudflare/vitest-browser-run-provider` exactly as his example does.
- The real published `vitest-visual-diff` tarball as a dependency (`npm
  pack`'d from this repo, not a stub).
- `playground.test.ts` — the one file a real Worker would write per visitor
  request; nothing else in this project is a test file.
- Depends on Brendan's two pending forks (`vitest` branch
  `feat/playwright-cdp-options`, `workers-sdk` branch
  `vite-tunnel-programmatic-url`) via local `link:` — same forks used for the
  earlier CI-integration proof, built once and reused here.

## Result

Ran `vitest run --config vitest.browser-run.config.ts` against a real hosted
Browser Run Chromium session (Wrangler OAuth token, Browser write scope):

```text
Test Files  1 passed (1)
     Tests  2 passed (2)
  Duration  30.72s
```

Then swapped in a deliberately-failing test and confirmed the real diagnostic
surfaces correctly over the hosted connection, not just a bare pass/fail —
after two bounded retries past known Browser Run transport flakes (below):

```text
✕ this should fail on purpose
  structure: missing overall — svg/path in the checkmark subtree
Test Files  1 failed (1)
     Tests  1 failed (1)
```

## Transport flakes hit and retried, not hidden

Getting the failing-test run to actually execute took two retries past two
different transport-layer errors, both already known from the earlier
CI-suite proof (`../browser-run/receipt.md`) rather than new to this harness:

1. `[vitest] Browser connection was closed while running tests` / `[birpc]
   rpc is closed` — the same hosted-session-drop class already observed and
   attributed to Browser Run's own launch/pooling behavior, not this
   package or this harness.
2. `net::ERR_CONNECTION_RESET` navigating to a fresh
   `*.trycloudflare.com` quick-tunnel URL — consistent with the hosted
   browser reaching the tunnel before Cloudflare's edge had fully
   propagated the brand-new random-hostname quick tunnel Vite spins up per
   run.

Both are pre-existing Browser Run/tunnel characteristics, not `vitest-visual-diff`
defects — the matcher itself has never produced a wrong verdict in any of
these runs, only the hosted browser session or the ephemeral quick tunnel has
occasionally failed to connect before the test could start.

## Reproduce

```sh
# Sibling forks (built once, shared with the earlier CI-suite proof):
git clone https://github.com/irvinebroque/vitest.git /tmp/vitest
(cd /tmp/vitest && git switch feat/playwright-cdp-options && pnpm install && pnpm build)
git clone --branch vite-tunnel-programmatic-url --single-branch \
  https://github.com/irvinebroque/workers-sdk.git /tmp/workers-sdk-vite-tunnel-programmatic-url
(cd /tmp/workers-sdk-vite-tunnel-programmatic-url && pnpm install --frozen-lockfile && pnpm --filter @cloudflare/vite-plugin... build)
git clone https://github.com/irvinebroque/vitest-browser-run.git /tmp/vitest-browser-run

cd experiments/playground-browser-run/harness
(cd ../../.. && npm pack --pack-destination /tmp)   # vitest-visual-diff-0.0.1.tgz
pnpm install
pnpm approve-builds --all   # esbuild, sharp, workerd postinstall scripts

TOK=$(wrangler auth token --json | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0)).token)')
CLOUDFLARE_API_TOKEN="$TOK" node_modules/.bin/vitest run --config vitest.browser-run.config.ts
```

## What this experiment does NOT prove yet

- A real per-visitor Worker request path (accept pasted code over `fetch`,
  write `playground.test.ts`, spin the tunnel+Vitest process, stream the
  result back) was not built — only the "one project, one real invocation
  of the whole browser-run-backed vitest run" shape was proven, per the
  request to test each backend in isolation.
- Where the Vitest/tunnel process itself would actually run for a hosted
  playground (this ran on a laptop) — Browser Run only solves the browser
  half; the Vitest-process half still needs a real compute answer (e.g. the
  Sandbox container from `../playground-sandbox`, run alongside Browser Run
  rather than instead of it).
- Concurrency: many simultaneous playground visitors each needing their own
  tunnel + hosted browser session was not tested, and the earlier CI-suite
  proof already found Browser Run's default pooled concurrency to be
  intermittently flaky under load (`../browser-run/receipt.md`).
