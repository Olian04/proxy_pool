import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    sequence: {
      concurrent: true,
    },
    testTimeout: parseInt(process.env.CI_TEST_TIMEOUT ?? '20000', 10),
  },
});