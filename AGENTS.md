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

## Development Workflow

### Wayland nested shell pattern

GJS cannot unload ES modules once loaded. On Wayland, reloading an extension in
the same session does **not** pick up new module code. The only reliable way to
test updated code on Wayland is to start a fresh `gnome-shell` process:

```bash
# Terminal 1 – build whenever source changes
npm run build:dev       # or: npm run dev:rebuild (prints a reminder)

# Terminal 2 – one-time nested session
npm run dev:nested      # runs: dbus-run-session gnome-shell --nested --wayland
```

After each `build:dev`, close the nested shell window and run `dev:nested` again
to start a fresh process that loads the new modules.

Available dev scripts:

| Script                | What it does                                      |
| --------------------- | ------------------------------------------------- |
| `npm run dev:nested`  | Launches a nested Wayland GNOME Shell session     |
| `npm run dev:rebuild` | Builds dev bundle and prints a restart reminder   |
| `npm run dev:cycle`   | Alias for `build:dev` (use inside a CI-like loop) |
| `npm run dev:install` | Builds and installs via symlink (dev mode)        |

> **Reference:**
> https://gjs.guide/extensions/development/debugging.html#reloading-extensions

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

## GObject Class Registration

All GObject subclasses **MUST** use
`GObject.registerClass({GTypeName: '...', Signals: {...}}, class ... extends GObject.Object {...})`.
The `static [GObject.signals]` syntax does **NOT** register the GType and causes
a runtime crash: `"Tried to construct an object without a GType"`. All
GTypeNames in this project are prefixed with `Grayscale`.

### Complete list of classes that require registerClass (verified 2026-02)

**Main runtime path** (extension.ts → UIController chain):

- `src/settingsController.ts` → `GrayscaleSettingsController`
- `src/stateManager.ts` → `GrayscaleStateManager`
- `src/effectManager.ts` → `GrayscaleEffectManager`
- `src/monitorManager.ts` → `GrayscaleMonitorManager`
- `src/uiController.ts` → `GrayscaleUIController`
- `src/panelIndicator.ts` → `GrayscalePanelButton` (extends `Button`)
- `src/quickSettingsIntegration.ts` → `GrayscaleQuickToggle` (extends
  `QuickToggle`)
- `src/quickSettingsIntegration.ts` → `GrayscaleSystemIndicator` (extends
  `SystemIndicator`)

**Infrastructure** (used by EnhancedEffectManager):

- `src/infrastructure/BaseComponent.ts` → `GrayscaleBaseComponent`
- `src/infrastructure/SignalManager.ts` → `GrayscaleSignalManager`
- `src/infrastructure/ComponentRegistry.ts` → `GrayscaleComponentRegistry`
- `src/infrastructure/Logger.ts` → `GrayscaleLogger`
- `src/infrastructure/ErrorBoundary.ts` → `GrayscaleErrorBoundary`
- `src/infrastructure/ConfigCache.ts` → `GrayscaleConfigCache`
- `src/infrastructure/PerformanceMonitor.ts` → `GrayscalePerformanceMonitor`
- `src/infrastructure/EffectPool.ts` → `GrayscaleEffectPool`
- `src/enhanced/EnhancedEffectManager.ts` → `GrayscaleEnhancedEffectManager`

### Key rules

- Subclasses of GNOME Shell UI types (`QuickToggle`, `SystemIndicator`,
  `PanelMenu.Button`) **also** require `registerClass` — not just
  `GObject.Object` subclasses.
- When converting from the old pattern, move `static [GObject.signals]` into the
  `Signals:` object inside `registerClass`, then export a companion type alias:
    ```typescript
    export const Foo = GObject.registerClass({ GTypeName: 'GrayscaleFoo', Signals: {...} }, class Foo extends GObject.Object {...});
    // eslint-disable-next-line @typescript-eslint/no-redeclare
    export type Foo = InstanceType<typeof Foo>;  // preserves class-as-type semantics
    ```
- The only acceptable use of `static [GObject.signals]` is inside anonymous
  inline classes used as **Jest test mocks** (e.g.
  `src/tests/ArchitectureValidator.ts`), since Jest mocks don't run in GJS.

## TypeScript Runtime Configuration

`tsconfig.runtime.json` **MUST** set `"useDefineForClassFields": false`. This
prevents TypeScript from emitting class field initializers
(`Object.defineProperty(...)`) that execute before `_init()` completes, breaking
GObject construction. Never change this value to `true`.

## Import Syntax in GJS

Runtime code **MUST** use `gi://` and `resource:///` imports. Examples:

```typescript
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
```

`@girs/*` packages are for TypeScript type checking only. They must stay in
`tsconfig.json` path aliases and must **never** appear in runtime source
`import` statements.

## Wayland Nested Shell Pattern

GJS cannot unload ES modules. On Wayland, `gnome-extensions disable && enable`
does **NOT** pick up new module code — old code stays in memory. Test code
changes with `npm run dev:nested` (alias for
`dbus-run-session gnome-shell --nested --wayland`). Run `npm run build:dev`
first, then restart the nested shell. See the Development Workflow section for
the full two-terminal cycle.

## disable() Cleanup Contract

`disable()` MUST be a clean teardown: remove all Clutter effects
(`actor.remove_effect(effect)` or `removeAllEffects()`), disconnect all signals
(save IDs at connect time, call `object.disconnect(id)`), destroy all UI widgets
(`.destroy()`), cancel all GLib timers (`GLib.source_remove(id)`), and remove
all keyboard shortcuts (`Main.wm.removeKeybinding('key-name')`). Any resource
not freed here causes memory leaks or crashes on re-enable.

## Animation Durations — adjustAnimationTime() is Required

Every animation duration passed to `ease_property()` or similar Clutter
animation calls **MUST** be wrapped with `adjustAnimationTime()`:

```typescript
import { adjustAnimationTime } from 'resource:///org/gnome/shell/misc/animationUtils.js';
duration: adjustAnimationTime(300); // respects Reduce Motion / Slow Down
```

This ensures the extension honours the user's accessibility settings. When
animations are globally disabled, `adjustAnimationTime()` returns `0` making
transitions instant. Hardcoded durations that bypass this break accessibility.

## connectObject() / disconnectObject() — Preferred Pattern (GNOME 45+)

In Shell context (NOT prefs), `connectObject()` / `disconnectObject()` is the
preferred way to manage GObject signal connections in GNOME 45+:

```typescript
// Connect multiple signals, auto-disconnected when `this` is destroyed:
source.connectObject(
    'signal-a',
    this._onA.bind(this),
    'signal-b',
    this._onB.bind(this),
    this
);
source.disconnectObject(this);
```

**Not available in `src/prefs.ts`** — that file runs in a separate LibAdwaita
process where Shell globals are absent.

## src/prefs.ts — Shell-Only Globals Are Forbidden

`src/prefs.ts` runs in a **separate LibAdwaita process**, completely outside
GNOME Shell. The following APIs **must NOT** appear in `src/prefs.ts`:

- `global` (Shell.Global singleton)
- `Main.*` (Shell UI)
- `connectObject()` / `disconnectObject()`
- `actor.ease()`
- `Math.clamp()` / `String.format()`
- Any import from `resource:///org/gnome/shell/ui/...`

Safe prefs imports: `gi://` libraries (`Adw`, `Gtk`, `Gio`, `GLib`) and
`resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js`.

## override Keyword — Enforced by noImplicitOverride

`tsconfig.json` sets `"noImplicitOverride": true`. Any method overriding a
base-class method requires the `override` keyword or TypeScript will error.
Known locations in this codebase (verified 2026-02):

- `src/extension.ts` → `override enable()`, `override disable()`
- `src/prefs.ts` → `override fillPreferencesWindow()`
- `src/panelIndicator.ts` → `override destroy()`
- `src/quickSettingsIntegration.ts` → `override get label()`,
  `override get iconName()`, `override destroy()` (×2)
- `src/infrastructure/SignalManager.ts` → `override disconnect()`

## Logging in extension.ts — Use Infrastructure Logger, NOT getLogger()

`Extension.getLogger()` was introduced in **GNOME Shell 48**. This extension
targets GNOME 45/46, so that API does **NOT** exist at runtime and calling it
unconditionally will crash the extension on load with:
`TypeError: this.getLogger is not a function`

**Correct pattern** — use `src/infrastructure/Logger.ts` directly:

```typescript
import { Logger, LogCategory, LogLevel } from './infrastructure/Logger.js';

// In class fields:
private _logger: InstanceType<typeof Logger> | null = null;
private _log!: ExtensionLogger;   // ExtensionLogger = { log, warn, error }

// In constructor (after super()):
this._logger = new Logger({ level: LogLevel.Info, enableConsole: true });
const _componentLog = this._logger.createComponentLogger(
    metadata.uuid ?? 'grayscale-toggle@webaheadstudios.com',
    LogCategory.System
);
this._log = {
    log: (msg: string) => _componentLog.info(msg),
    warn: (msg: string) => _componentLog.warn(msg),
    error: (msg: string) => _componentLog.error(msg),
};

// In disable() — flush & destroy the logger last:
this._logger?.destroy();
this._logger = null;
```

Console output format:
`[timestamp] [LEVEL] [grayscale-toggle@webaheadstudios.com] message`

Only use this pattern in `src/extension.ts`; component files use their own
`ComponentLogger` obtained from the same `Logger` instance via their base class.
