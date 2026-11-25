import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import vite from './vite.config.ts';

export default defineConfig((env) =>
  mergeConfig(vite(env), {
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.tsx'],
      setupFiles: ['src/test-setup.ts'],
    },
  }),
);
