/**
 * Root Vitest Configuration
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // vitest v4 requires explicit imports - we'll handle this in the setup file
    setupFiles: ['engine/vitest/globalSetup.ts'],
  },
});