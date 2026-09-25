import { defineConfig } from 'vitest/config';

export default defineConfig({
    envDir: 'config/env',
    test: {
        environment: 'node',
        include: ['src/**/*.test.js', 'tools/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/utils/**/*.js', 'src/core/**/*.js', 'tools/**/*.js'],
            exclude: [
                // storage.js needs IndexedDB (browser only) — see AGENT_TASKS.md T1.1.
                'src/utils/storage.js',
                // Type-only modules: JSDoc typedefs with no runtime code.
                'src/core/types.js',
                'src/**/*.test.js',
            ],
            thresholds: {
                lines: 80,
                functions: 80,
            },
        },
    },
});
