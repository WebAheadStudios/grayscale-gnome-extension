import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
    // Base JavaScript configuration
    js.configs.recommended,

    // TypeScript configuration
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2023,
            sourceType: 'module',
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                // GJS/GNOME Shell globals
                global: 'readonly',
                globalThis: 'readonly',
                imports: 'readonly',
                pkg: 'readonly',
                log: 'readonly',
                logError: 'readonly',
                print: 'readonly',
                printerr: 'readonly',
                // Console is available in GJS applications
                console: 'readonly',
                // GNOME Shell specific
                main: 'readonly',
                Meta: 'readonly',
                Shell: 'readonly',
                St: 'readonly',
                Clutter: 'readonly',
                Gio: 'readonly',
                GLib: 'readonly',
                GObject: 'readonly',
                Gtk: 'readonly',
                // Extension globals
                ExtensionUtils: 'readonly',
                Extension: 'readonly',
                // Environment
                ARGV: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            // TypeScript specific rules
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-inferrable-types': 'error',

            // JavaScript/General rules
            'no-unused-vars': 'off', // Use TypeScript version instead
            'no-undef': 'off', // TypeScript handles this better
            'prefer-const': 'error',
            'no-var': 'error',
            'object-shorthand': 'error',
            'prefer-arrow-callback': 'error',
            'prefer-template': 'error',
            'template-curly-spacing': ['error', 'never'],
            'no-console': 'off', // Allow console in GNOME Shell extensions

            // GNOME Shell / GJS specific rules
            'no-global-assign': 'error',
            'no-implicit-globals': 'error',
            strict: ['error', 'global'],

            // Code quality rules
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            curly: ['error', 'all'],
            'brace-style': ['error', '1tbs', { allowSingleLine: true }],
            'comma-dangle': ['error', 'always-multiline'],
            'comma-spacing': ['error', { before: false, after: true }],
            'comma-style': ['error', 'last'],
            'computed-property-spacing': ['error', 'never'],
            'eol-last': ['error', 'always'],
            'func-call-spacing': ['error', 'never'],
            indent: [
                'error',
                4,
                {
                    SwitchCase: 1,
                    VariableDeclarator: 1,
                    outerIIFEBody: 1,
                    MemberExpression: 1,
                    FunctionDeclaration: { parameters: 1, body: 1 },
                    FunctionExpression: { parameters: 1, body: 1 },
                    CallExpression: { arguments: 1 },
                    ArrayExpression: 1,
                    ObjectExpression: 1,
                    ImportDeclaration: 1,
                    flatTernaryExpressions: false,
                    ignoreComments: false,
                },
            ],
            'key-spacing': ['error', { beforeColon: false, afterColon: true }],
            'keyword-spacing': ['error', { before: true, after: true }],
            'linebreak-style': ['error', 'unix'],
            'no-trailing-spaces': 'error',
            'no-whitespace-before-property': 'error',
            'object-curly-spacing': ['error', 'always'],
            'operator-linebreak': [
                'error',
                'after',
                { overrides: { '?': 'before', ':': 'before' } },
            ],
            'padded-blocks': ['error', 'never'],
            'quote-props': ['error', 'as-needed'],
            quotes: ['error', 'single', { avoidEscape: true }],
            semi: ['error', 'always'],
            'semi-spacing': ['error', { before: false, after: true }],
            'semi-style': ['error', 'last'],
            'space-before-blocks': ['error', 'always'],
            'space-before-function-paren': [
                'error',
                { anonymous: 'always', named: 'never', asyncArrow: 'always' },
            ],
            'space-in-parens': ['error', 'never'],
            'space-infix-ops': ['error', { int32Hint: false }],
            'space-unary-ops': ['error', { words: true, nonwords: false }],
            'spaced-comment': ['error', 'always', { exceptions: ['-', '+'] }],
            'switch-colon-spacing': ['error', { after: true, before: false }],
        },
    },

    // Configuration for specific file types
    {
        files: ['**/*.ts'],
        rules: {
            // Additional TypeScript specific rules for .ts files
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-non-null-assertion': 'warn',
        },
    },

    // Configuration for JavaScript files
    {
        files: ['**/*.js', '**/*.jsx'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                // GJS/GNOME Shell globals
                global: 'readonly',
                globalThis: 'readonly',
                imports: 'readonly',
                pkg: 'readonly',
                log: 'readonly',
                logError: 'readonly',
                print: 'readonly',
                printerr: 'readonly',
                // Console is available in GJS applications
                console: 'readonly',
                // GNOME Shell specific
                main: 'readonly',
                Meta: 'readonly',
                Shell: 'readonly',
                St: 'readonly',
                Clutter: 'readonly',
                Gio: 'readonly',
                GLib: 'readonly',
                GObject: 'readonly',
                Gtk: 'readonly',
                // Extension globals
                ExtensionUtils: 'readonly',
                Extension: 'readonly',
                // Environment
                ARGV: 'readonly',
                // Node.js globals (for scripts/ files)
                process: 'readonly',
            },
        },
        rules: {
            // JavaScript rules (no TypeScript rules)
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'prefer-const': 'warn',
            'no-var': 'warn',
            'no-console': 'off', // Allow console in GNOME Shell extensions
            'no-global-assign': 'error',
            eqeqeq: ['warn', 'always', { null: 'ignore' }],
            curly: ['warn', 'all'],
            'brace-style': ['warn', '1tbs', { allowSingleLine: true }],
            'comma-dangle': ['warn', 'always-multiline'],
            'comma-spacing': ['warn', { before: false, after: true }],
            'comma-style': ['warn', 'last'],
            'computed-property-spacing': ['warn', 'never'],
            'eol-last': ['warn', 'always'],
            'func-call-spacing': ['warn', 'never'],
            indent: ['warn', 4],
            'key-spacing': ['warn', { beforeColon: false, afterColon: true }],
            'keyword-spacing': ['warn', { before: true, after: true }],
            'linebreak-style': ['warn', 'unix'],
            'no-trailing-spaces': 'warn',
            'no-whitespace-before-property': 'warn',
            'object-curly-spacing': ['warn', 'always'],
            quotes: ['warn', 'single', { avoidEscape: true }],
            semi: ['warn', 'always'],
            'semi-spacing': ['warn', { before: false, after: true }],
            'space-before-blocks': ['warn', 'always'],
            'space-before-function-paren': [
                'warn',
                { anonymous: 'always', named: 'never', asyncArrow: 'always' },
            ],
            'space-in-parens': ['warn', 'never'],
            'space-infix-ops': ['warn', { int32Hint: false }],
            'space-unary-ops': ['warn', { words: true, nonwords: false }],
            'spaced-comment': ['warn', 'always', { exceptions: ['-', '+'] }],
            'switch-colon-spacing': ['warn', { after: true, before: false }],
        },
    },

    // Ignore patterns
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            '*.min.js',
            '**/*.d.ts',
            '.git/**',
            'schemas/gschemas.compiled',
        ],
    },
];
