# AGENTS.md (Code Mode)

- Keep schema keys in kebab-case when reading/writing runtime settings (for
  example `animation-duration`, `performance-mode`, `show-quick-settings`).
- Do not collapse `grayscale-enabled` and `global-enabled`; both are required
  and consumed on different paths.
- Treat `src/types/settings.ts` camelCase interfaces as internal typing only,
  not direct schema key names.
- When wiring setting-change handlers, align key comparisons with emitted key
  format to avoid camelCase/kebab-case drift (notably effect-setting handlers).
- For lifecycle-dependent changes, follow the runtime arrays in
  `src/extension.ts` (`componentOrder`, `initOrder`, `destroyOrder`) as source
  of truth.
