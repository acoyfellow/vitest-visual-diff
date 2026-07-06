import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // experiments/ hosts standalone sub-projects (own package.json, own
    // Vitest install) for the playground backend proofs — exclude their test
    // files from this repo's own suite, or a shared browser port collides.
    exclude: ['**/node_modules/**', 'experiments/**'],
    setupFiles: ['./src/index.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium', viewport: { width: 640, height: 320 } }],
    },
  },
});
