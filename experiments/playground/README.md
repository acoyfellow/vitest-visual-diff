# Playground: which backend actually runs a visitor's test

Both real backends were built and run in isolation — not compared on paper —
against the same two files: a passing pair and a deliberately-failing pair.
Full receipts: [`../playground-sandbox`](../playground-sandbox) and
[`../playground-browser-run`](../playground-browser-run).

## Both backends work

| | Sandbox | Browser Run |
|---|---|---|
| Real pass (2/2) | ✅ | ✅ |
| Real fail with correct diagnostic | ✅ | ✅ |
| What actually runs where | Whole Vitest process + Chromium, both inside one container | Only Chromium is hosted; Vitest's own process still needs a server (a tunnel-exposed Worker + local dev process in this proof) |
| Extra infra required | None beyond the container image | A public tunnel per run, plus Brendan's two pending Vitest/Workers SDK forks |
| Flakiness observed | None across all runs | Two different transport-layer flakes (hosted browser session drop; fresh quick-tunnel connection reset) before a clean run — same class already logged in `../browser-run/receipt.md` |
| Stability of the dependency itself | `@cloudflare/sandbox` is GA, already running in production for `my-ax` | Pending forks of Vitest and Workers SDK, not yet merged upstream |

## The one fact that should decide this

Sandbox gives you one execution unit that does everything: write a file,
run `vitest run`, get JSON back. Browser Run only replaces the browser —
something still has to run the actual Vitest process and expose a tunnel to
it, which in practice means **you'd run Sandbox (or an equivalent container)
anyway, and optionally point its Vitest process at Browser Run instead of a
local Chromium install.** Browser Run is not an alternative to a compute
backend for this use case; it is an optional upgrade to the browser inside
whichever compute backend you pick.

## Recommendation

Build the playground on the Sandbox backend now — it is GA, it is the same
primitive `my-ax` already runs in production, and it proved fully stable
across every run in this proof with zero flakes. Do not block the playground
on Browser Run's pending forks landing upstream. If/when Vitest's
`playwright-cdp-options` branch and the tunnel-plugin change ship, swapping
the Sandbox container's local Playwright/Chromium install for a
`browserRunCdp()` provider is a small, optional, later upgrade — not a
prerequisite.

## Local dev note (not a deploy concern)

Both proofs were run on Apple Silicon under Docker Desktop/Colima. Two
Apple-Silicon-only, non-product issues were found and fixed along the way,
documented in `../playground-sandbox/README.md`:

- This machine's WARP-intercepted network needed its root CA trusted inside
  the build for Chromium's downloader — irrelevant on a real
  `wrangler deploy` build.
- QEMU's default `linux/amd64` emulation crashed Chromium on launch;
  switching Colima to Rosetta (`colima start --vm-type=vz --vz-rosetta`)
  fixed it. Real Cloudflare Containers run on native x86_64 hardware and
  never hit this.

Neither issue is specific to `vitest-visual-diff`, the Sandbox SDK, or
Browser Run — both are pure artifacts of developing against amd64-only
container images on an arm64 laptop.
