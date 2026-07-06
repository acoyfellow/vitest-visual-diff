# Playground backend: Cloudflare Sandbox (isolated proof)

Question this answers: can a hosted playground actually execute a visitor's
`vitest-visual-diff` test file for real — real Chromium, real computed styles,
real pixels — using Cloudflare's `@cloudflare/sandbox` container SDK as the
execution backend? Tested standalone, without the Worker HTTP layer, so the
result is about the execution backend itself, not about routing.

## What this is

- `Dockerfile` extends `docker.io/cloudflare/sandbox:0.12.1` (the same base
  image `my-ax` already runs in production) and preinstalls, at build time:
  Node's `vitest`, `@vitest/browser`, `@vitest/browser-playwright`,
  Playwright's Chromium + OS deps, and the real published
  `vitest-visual-diff` package (installed from a local `npm pack` tarball, not
  a mocked stub).
- `harness/vitest.config.ts` only ever picks up one file,
  `playground.test.ts` — the file a real Worker would write per-request
  from a visitor's pasted code.
- No Worker was needed to prove this half of the question, so this
  experiment execs directly into the running container.

## Result

Built the image, started the container, wrote a real test file in (via
`docker cp`), and ran `vitest run` inside it:

```text
✓ |chromium| playground.test.ts (2 tests) 488ms
  ✓ identical checkboxes pass  337ms
  ✓ missing checkmark fails    154ms  (asserts `.not.toMatchVisualDiff`)

Test Files  1 passed (1)
     Tests  2 passed (2)
```

Then wrote a deliberately-failing file (identical to the checkmark test but
asserting the match should hold) and confirmed the real diagnostic surfaces
correctly, not just a bare pass/fail:

```text
✕ this should fail on purpose
  structure: missing overall — svg/path in the checkmark subtree
Test Files  1 failed (1)
     Tests  1 failed (1)
```

Both the pass and the fail path work: the matcher runs unmodified inside a
real Sandbox container and produces its real, specific failure message.

## A real problem found and fixed, not glossed over

The first build/run attempts failed for two unrelated reasons, both fixed and
recorded here rather than hidden:

1. **Docker image builds failed downloading Chromium**
   (`self-signed certificate in certificate chain`). This machine's outbound
   network runs through Cloudflare WARP, which terminates TLS with its own
   root CA. The `Dockerfile` copies that CA into the image and sets
   `NODE_EXTRA_CA_CERTS` so `npm`/Playwright's downloader trust it during the
   build. **This step is a workaround for this laptop's network, not
   something a real `wrangler deploy` build (which runs on Cloudflare's own
   infrastructure) needs.** Anyone building this image on a normal network
   can delete the `COPY harness/warp-root-ca.pem ...` and
   `ENV NODE_EXTRA_CA_CERTS=...` lines.

2. **Chromium crashed on launch** with a QEMU internal assertion
   (`Assertion failed: p_rcu_reader->depth != 0`), not a browser or sandbox
   error. Isolated the cause by reproducing the identical crash on a plain
   `node:22-bookworm` image with no Sandbox SDK involved at all — proving it
   was this Mac's Docker Desktop/Colima `qemu` emulator failing to run
   `linux/amd64` Chromium under binary translation, unrelated to
   `vitest-visual-diff`, the Sandbox SDK, or Playwright. Fixed locally by
   switching Colima to Apple's Rosetta emulator
   (`colima start --vm-type=vz --vz-rosetta`) instead of QEMU. Real Cloudflare
   Containers run on native x86_64 hardware and would never hit this at all —
   it is exclusively a local Apple Silicon dev-loop issue.

## Reproduce

```sh
colima start --vm-type=vz --vz-rosetta   # only needed on Apple Silicon dev machines
cd experiments/playground-sandbox
(cd ../.. && npm pack --pack-destination experiments/playground-sandbox/harness)

# Only if your network intercepts TLS (e.g. Cloudflare WARP) and the Docker
# build fails downloading Chromium with SELF_SIGNED_CERT_IN_CHAIN. On a plain
# network, skip this and delete the two Dockerfile lines that reference it.
cp "$SSL_CERT_FILE" harness/warp-root-ca.pem

docker build --platform linux/amd64 -t vvd-playground-sandbox:test .
docker run -d --name vvd-sb-test --platform linux/amd64 -p 3999:3000 vvd-playground-sandbox:test
docker cp your-test-file.ts vvd-sb-test:/opt/harness/playground.test.ts
docker exec vvd-sb-test bash -lc "cd /opt/harness && node_modules/.bin/vitest run --no-color"
```

## What this experiment does NOT prove yet

- The Worker HTTP layer (`src/index.ts` in this template) that would
  accept a visitor's pasted code over `fetch`, write it into the running
  Sandbox instance via `sandbox.writeFile`/`sandbox.exec`, and stream the
  result back was not built or tested here — this experiment isolates only
  the execution backend, per the request to test each piece "in isolation."
- Real cost/latency of spinning up or reusing a Sandbox instance per
  playground visitor on Cloudflare's actual infrastructure (not local
  Docker) was not measured.
- Concurrent/multi-visitor isolation (one Sandbox DO instance per session vs.
  a shared pool) was not designed or tested.
