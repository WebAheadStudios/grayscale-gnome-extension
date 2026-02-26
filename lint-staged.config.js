export default {
    '*.{ts,js}': ['eslint --fix', 'prettier --write'],
    '*.{json,md}': ['prettier --write'],
    // Use a function so lint-staged does NOT append staged filenames.
    // Passing filenames to tsc causes single-file mode (ignores tsconfig.json
    // and gi:// path aliases), producing false-positive errors.
    'src/**/*.ts': () => 'npm run compile',
    'src/metadata.json': ['node scripts/validate-metadata.js'],
    // Use a Node.js wrapper so the xmllint check gracefully skips when
    // xmllint is not installed (lint-staged uses execa, not a shell, so
    // shell builtins like `command -v` cannot be used directly).
    'schemas/*.gschema.xml': ['node scripts/validate-schema.js'],
};
