import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            '.vercel/**',
            'backend/**',
            'public/**',
        ],
    },

    // Browser source
    {
        ...js.configs.recommended,
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: { ...globals.browser },
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': [
                'warn',
                { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' },
            ],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            eqeqeq: ['warn', 'smart'],
            'prefer-const': 'warn',
            'no-var': 'error',

            // Pre-existing violations in code this task must not touch. Kept
            // visible as warnings so the lint baseline is honest and CI is
            // green; raise to `error` once the owning task has landed.
            //   no-case-declarations  -> src/main.js, cleared by T4.2
            //   no-prototype-builtins -> src/utils/bioUtils.js:68
            //   no-useless-escape     -> src/utils/bioUtils.js:283
            'no-case-declarations': 'warn',
            'no-prototype-builtins': 'warn',
            'no-useless-escape': 'warn',
        },
    },

    // src/utils and src/core are the pure layers: no DOM, no HTML.
    // See AGENTS.md — "the one rule that matters most". Kept at `warn` because
    // `bioUtils.downloadFile` is a pre-existing violation; it should move to a
    // browser-side module, after which this can be raised to `error`.
    {
        files: ['src/utils/**/*.js', 'src/core/**/*.js'],
        rules: {
            'no-restricted-globals': [
                'warn',
                { name: 'document', message: 'src/utils and src/core must not touch the DOM.' },
                { name: 'alert', message: 'src/utils and src/core must not touch the DOM.' },
                { name: 'localStorage', message: 'src/utils and src/core must not touch the DOM.' },
            ],
        },
    },

    // src/core is new code, so the rule is an error there from day one.
    {
        files: ['src/core/**/*.js'],
        rules: {
            'no-restricted-globals': [
                'error',
                { name: 'document', message: 'src/core must not touch the DOM.' },
                { name: 'window', message: 'src/core must not touch the DOM.' },
                { name: 'alert', message: 'src/core must not touch the DOM.' },
            ],
        },
    },

    // Tests and Node-side config files
    {
        ...js.configs.recommended,
        files: ['**/*.test.js', '*.config.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: { ...globals.node },
        },
    },
];
