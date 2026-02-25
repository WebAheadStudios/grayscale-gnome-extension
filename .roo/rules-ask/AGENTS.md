# AGENTS.md (Ask Mode)

- When explaining settings behavior, call out that `grayscale-enabled` and
  `global-enabled` are distinct and intentionally used by different runtime
  paths.
- Reference schema keys in kebab-case when discussing real setting names; note
  that `src/types/settings.ts` camelCase interfaces are not a 1:1 schema map.
- Flag potential confusion in effect settings: signal keys are emitted as schema
  names, while some handlers compare camelCase names.
- For lifecycle/order questions, use `componentOrder`, `initOrder`, and
  `destroyOrder` in `src/extension.ts` as authoritative over narrative docs.
