import { defineGlobalSetup } from 'vitest/node';

export default defineGlobalSetup({
  setup() {
    console.log('[Global Setup] Setting up test environment...');
    // vitest v4 provides these globals automatically when using the setup file
    // No need to manually import describe, it, etc.
  },
  teardown() {
    console.log('[Global Setup] Teardown complete');
  },
});