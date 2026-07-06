// A SECOND, genuinely different Vitest Browser Mode provider config —
// webdriverio instead of Playwright — used only to prove diffgate's matcher
// makes no Playwright-specific assumption (`src/` never imports 'playwright').
// Run with: npx vitest run --config vitest.config.webdriverio.ts

import { webdriverio } from '@vitest/browser-webdriverio';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/index.ts'],
    browser: {
      enabled: true,
      provider: webdriverio(),
      headless: true,
      instances: [{ browser: 'chrome', viewport: { width: 640, height: 320 } }],
    },
  },
});
