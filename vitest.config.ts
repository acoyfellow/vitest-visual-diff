import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    setupFiles: ['./src/index.js'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        { browser: 'chromium', viewport: { width: 640, height: 320 } },
      ],
    },
  },
});
