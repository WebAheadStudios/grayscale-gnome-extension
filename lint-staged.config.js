export default {
    '*.{ts,js}': ['eslint --fix', 'prettier --write'],
    '*.{json,md}': ['prettier --write'],
    // Use a function so lint-staged does NOT append staged filenames.
    // Passing filenames to tsc causes single-file mode (ignores tsconfig.json
    // and gi:// path aliases), producing false-positive errors.
    'src/**/*.ts': () => 'npm run compile',
    'src/metadata.json': ['node scripts/validate-metadata.js'],
    'schemas/*.gschema.xml': ['xmllint --noout'],
};
