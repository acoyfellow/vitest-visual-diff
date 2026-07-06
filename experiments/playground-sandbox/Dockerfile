FROM docker.io/cloudflare/sandbox:0.12.1

# Documents the ports this application uses (standard Docker convention)
EXPOSE 8080

# Preinstall the playground's Vitest Browser Mode harness once at build time
# (Playwright + Chromium + vitest-visual-diff), so a per-request run only
# writes one file and execs `vitest run` against dependencies that are
# already on disk. No network fetch, no npm install, at request time.
WORKDIR /opt/harness
COPY harness/package.json ./package.json
COPY harness/vitest.config.ts ./vitest.config.ts
COPY harness/vitest-visual-diff-0.0.1.tgz ./vitest-visual-diff-0.0.1.tgz

# Local-dev-only: this machine's network runs through Cloudflare WARP, which
# terminates TLS with its own root CA. Trust it during the build so npm/curl
# inside the container can fetch Chromium; this line and the .pem it copies
# are a workaround for THIS laptop's network, not something a real deploy
# (built on Cloudflare's own infra via `wrangler deploy`) needs or ships.
COPY harness/warp-root-ca.pem /usr/local/share/ca-certificates/warp-root-ca.crt
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/warp-root-ca.crt
RUN update-ca-certificates \
  && npm install --no-audit --no-fund \
  && npx --yes playwright install --with-deps chromium
