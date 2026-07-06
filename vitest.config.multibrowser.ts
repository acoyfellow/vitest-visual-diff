// Multi-browser proof run: the same matcher against three real engines in
// one Vitest run (Playwright provider driving chromium, firefox, webkit).
// Run with: npx vitest run --config vitest.config.multibrowser.ts

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', 'experiments/**'],
    setupFiles: ['./src/index.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        { browser: 'chromium', viewport: { width: 640, height: 320 } },
        { browser: 'firefox', viewport: { width: 640, height: 320 } },
        { browser: 'webkit', viewport: { width: 640, height: 320 } },
      ],
    },
  },
});
