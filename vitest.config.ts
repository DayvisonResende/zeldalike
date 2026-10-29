import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['packages/*/test/**/*.test.ts'], setupFiles: ['packages/shared/test/setup.ts'] } });
