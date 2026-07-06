import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

import { cloudflare } from '@cloudflare/vite-plugin';
import { browserRunCdp } from '@cloudflare/vitest-browser-run-provider';
import { defineConfig } from 'vitest/config';

for (const envPath of ['.env']) {
  if (existsSync(envPath)) loadEnvFile(envPath);
}

const browserApiHost = process.env.VITEST_BROWSER_API_HOST ?? '0.0.0.0';
const browserApiPort = Number(process.env.VITEST_BROWSER_API_PORT ?? '63316');

export default defineConfig({
  plugins: [cloudflare({ tunnel: { autoStart: true } })],
  server: {
    host: browserApiHost,
    port: browserApiPort,
    strictPort: true,
    allowedHosts: true,
  },
  test: {
    // Isolated per-request shape: only the visitor's freshly-written file.
    include: ['playground.test.ts'],
    browser: {
      enabled: true,
      connectTimeout: 180000,
      headless: true,
      provider: browserRunCdp(),
      api: {
        host: browserApiHost,
        port: browserApiPort,
        allowExec: true,
        allowWrite: true,
      },
      instances: [{ browser: 'chromium', viewport: { width: 640, height: 320 } }],
    },
  },
});
