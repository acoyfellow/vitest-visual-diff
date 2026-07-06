import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// The playground writes the visitor's test file to ./playground.test.ts
// before invoking `vitest run`, so this config only ever picks that one file
// up — no other files in the harness directory are treated as tests.
export default defineConfig({
  test: {
    include: ['playground.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium', viewport: { width: 640, height: 320 } }],
    },
  },
});
