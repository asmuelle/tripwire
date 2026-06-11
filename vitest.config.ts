import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          root: './packages/core',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'pipeline',
          root: './packages/pipeline',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'db',
          root: './packages/db',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**', 'packages/pipeline/src/**'],
      reporter: ['text-summary', 'text'],
    },
  },
});
