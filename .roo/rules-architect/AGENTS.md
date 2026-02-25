# AGENTS.md (Architect Mode)

- Preserve the intentional dual-key model in designs: `grayscale-enabled`
  (runtime enable path) and `global-enabled` (persistence/session restore path)
  are not interchangeable.
- Define settings contracts using schema kebab-case keys; treat camelCase types
  in `src/types/settings.ts` as internal typing, not canonical key names.
- In architecture proposals involving settings propagation, explicitly guard
  against camelCase/kebab-case key drift in effect-setting handlers.
- Use `componentOrder`, `initOrder`, and `destroyOrder` in `src/extension.ts` as
  the authoritative lifecycle model.
