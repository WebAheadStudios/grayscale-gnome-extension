# AGENTS.md (Debug Mode)

- Validate which state key is being read before diagnosing toggle/state bugs:
  `grayscale-enabled` (runtime enabled check) vs `global-enabled`
  (startup/session persistence paths).
- For setting-change issues, inspect emitted key format first: runtime signals
  from settings are schema keys (kebab-case), while some handlers compare
  camelCase names.
- If startup/teardown behavior looks wrong, verify runtime order in
  `src/extension.ts` arrays (`componentOrder`, `initOrder`, `destroyOrder`)
  before trusting docs.
- Pre-commit can mask/skip checks depending on staged files: tests run only when
  staged files include `*.test.ts`/`*.spec.ts`; `package.json` staging adds
  `npm audit`; schema XML staging adds `xmllint`.
