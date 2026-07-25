import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// `obsidian` ships types only (no runtime) -- see src/test-obsidian.ts for
// why this alias exists and why it is test-only.
export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL('./src/test-obsidian.ts', import.meta.url)),
    },
  },
});
