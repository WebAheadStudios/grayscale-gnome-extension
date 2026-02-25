# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## High-signal project specifics

- Dual state keys are intentional: `grayscale-enabled` and `global-enabled` are
  both used, but by different paths. `SettingsController.isEnabled()` reads
  `grayscale-enabled`, while startup/session restore and some UI sync use
  `global-enabled`.
- Treat GSettings schema keys as kebab-case source of truth (for example,
  `animation-duration`, `performance-mode`, `show-quick-settings`).
- Type interfaces in TypeScript use camelCase names that do not map 1:1 to
  schema keys (`src/types/settings.ts`). Avoid assuming direct key-name
  compatibility.
- Watch for key-name drift in effect setting handling: parts of effect logic
  check camelCase keys (for example `animationDuration`, `performanceMode`)
  while runtime setting signals carry schema key names.
- Component lifecycle order is defined in code, not docs: `componentOrder`,
  `initOrder`, and `destroyOrder` in `src/extension.ts`. If behavior and docs
  diverge, trust those arrays.

## Commands used in this repo

- Build/dev package flow: `npm run build`, `npm run build:dev`,
  `npm run build:prod`
- Type check: `npm run compile` (runs `tsc --noEmit`)
- Lint: `npm run lint`, strict lint: `npm run lint:strict`
- Tests: `npm run test`, CI tests: `npm run test:ci`, coverage:
  `npm run test:coverage`
- Full validation gate: `npm run validate`

Single-test invocations:

- By file/path: `npm run test -- src/tests/infrastructure.test.ts`
- By name filter: `npm run test -- -t "monitor state"`
- Combine path + name:
  `npm run test -- src/tests/infrastructure.test.ts -t "monitor state"`

## Pre-commit behavior that is easy to miss

- Pre-commit always runs `lint-staged` and `npm run compile`.
- Tests run only if staged files include `*.test.ts` or `*.spec.ts`.
- Staging `package.json` triggers `npm audit --audit-level=moderate` via
  lint-staged.
- Staging `schemas/*.gschema.xml` triggers `xmllint --noout` via lint-staged.
- Staging `src/metadata.json` triggers metadata validation script.

## Type checking scope caveat

- `tsc --noEmit` (via `npm run compile`) excludes `**/*.test.ts` and
  `**/*.spec.ts` in `tsconfig.json`.
- Test compile/runtime coverage is handled by Jest + ts-jest (`jest.config.js`).
