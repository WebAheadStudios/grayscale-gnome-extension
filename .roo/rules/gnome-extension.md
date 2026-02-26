# GNOME Shell Extension Development Rules

These rules apply to ALL modes when working in this repository.

---

## GObject Class Registration (CRITICAL)

Every class extending `GObject.Object` or any GObject-derived base **MUST** use
`GObject.registerClass()`. Using `static [GObject.signals]` alone does **NOT**
register the GType and causes a runtime crash:
`"Tried to construct an object without a GType"`.

**Correct pattern** (see `src/effectManager.ts`, `src/settingsController.ts`):

```typescript
export const MyClass = GObject.registerClass(
    {
        GTypeName: 'UniqueGTypeName',
        Signals: {
            'my-signal': { param_types: [GObject.TYPE_STRING] },
        },
    },
    class MyClass extends GObject.Object {
        // implementation
    }
);
```

**Wrong pattern** (crashes at runtime):

```typescript
// ❌ NEVER do this — does not register the GType
export class MyClass extends GObject.Object {
    static [GObject.signals] = { 'my-signal': {} };
}
```

---

## TypeScript Class Fields

`tsconfig.runtime.json` **MUST** keep `"useDefineForClassFields": false`.

Without this, TypeScript emits class field declarations **before** `_init()`
completes, breaking GObject construction. Never change this to `true`.

---

## GJS Import Syntax

Use **ONLY** these import forms at runtime:

```typescript
// GObject Introspection libraries
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Meta from 'gi://Meta';

// GNOME Shell internal modules
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Button } from 'resource:///org/gnome/shell/ui/panelMenu.js';
```

`@girs/*` packages (e.g. `@girs/gobject-2.0`) are **type-check only** — they
live in `tsconfig.json` paths but **never** appear in runtime source imports.

---

## disable() Cleanup Contract

`disable()` MUST be a complete teardown. Any resource not freed here causes
memory leaks or crashes on re-enable:

- Remove all Clutter effects (call `removeAllEffects()` or
  `actor.remove_effect(effect)`)
- Disconnect all signal connections (save IDs at connect time, call
  `object.disconnect(id)`)
- Cancel all GLib timers: `GLib.source_remove(sourceId)`
- Remove keyboard bindings: `Main.wm.removeKeybinding('schema-key-name')`
- Destroy all UI widgets (panel indicators, Quick Settings items, `.destroy()`)

---

## Wayland Development Workflow

GJS cannot unload ES modules once loaded. On Wayland,
`gnome-extensions disable && gnome-extensions enable` does **NOT** reload module
code — old code stays in memory.

The only reliable test cycle on Wayland:

```bash
# Terminal 1 — rebuild on each change
npm run build:dev

# Terminal 2 — fresh shell each time
npm run dev:nested   # alias for: dbus-run-session gnome-shell --nested --wayland
# After each build: close the nested window, run dev:nested again
```

---

## No Node.js APIs in GJS

GJS is the GNOME JavaScript runtime, not Node.js. These APIs crash at runtime:

| Prohibited                  | GJS Alternative                                     |
| --------------------------- | --------------------------------------------------- |
| `require()`                 | ESM `import` with `gi://` or `resource:///`         |
| `fs.readFile()`             | `Gio.File.new_for_path().load_contents(null, null)` |
| `path.join()`               | `GLib.build_filenamev([...])`                       |
| `process.env.FOO`           | `GLib.getenv('FOO')`                                |
| `setTimeout(fn, ms)`        | `GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, fn)`   |
| `setInterval(fn, ms)`       | `GLib.timeout_add` returning `GLib.SOURCE_CONTINUE` |
| `clearTimeout/Interval(id)` | `GLib.source_remove(id)` — call in `disable()`      |
| `Buffer`                    | `GLib.Bytes` / `Uint8Array`                         |
| `fetch()`                   | `Soup.Session`                                      |

---

## GObject Signal Parameter Types — TYPE_VARIANT vs TYPE_JSOBJECT

`GObject.TYPE_VARIANT` is exclusively for parameters that carry an actual
`GLib.Variant` object. Using it for plain JavaScript objects causes a runtime
type mismatch.

```typescript
// ✅ Correct — plain JS object payload:
Signals: {
    'settings-changed': {
        param_types: [GObject.TYPE_JSOBJECT],
    },
}

// ✅ Correct — real GLib.Variant payload:
Signals: {
    'variant-received': {
        param_types: [GObject.TYPE_VARIANT],
    },
}

// ❌ Wrong — TYPE_VARIANT used for a plain JS object:
Signals: {
    'settings-changed': {
        param_types: [GObject.TYPE_VARIANT], // crashes at emit() time
    },
}
```

Use `GObject.TYPE_JSOBJECT` whenever the signal payload is a plain JS object,
array, or any non-`GLib.Variant` reference type.

---

## Extension.getLogger() — GNOME 48+ Only

`Extension.getLogger()` was introduced in **GNOME Shell 48**. This project
targets **GNOME 45/46**, so this call crashes unconditionally:

```typescript
// ❌ Crashes on GNOME 45/46:
const log = this.getLogger(); // TypeError: this.getLogger is not a function
```

Use the infrastructure [`Logger`](src/infrastructure/Logger.ts) directly in
`src/extension.ts` instead (see `AGENTS.md` for the full pattern).

---

## Project UUID

This extension's UUID is `grayscale-toggle@webaheadstudios.com`. Do not use the
old UUID `grayscale-toggle@luiz.dev` anywhere.

---

## GSettings Schema Key Names

Schema keys are **kebab-case** and are the source of truth:
`animation-duration`, `performance-mode`, `show-quick-settings`,
`grayscale-enabled`, `global-enabled`.

TypeScript interfaces in `src/types/settings.ts` use camelCase internally. Do
NOT assume direct key-name compatibility between the two.

---

## Constructor Must NOT Create GObject Instances (review guideline R1)

The `constructor()` in an Extension class **MUST** only call `super(metadata)`
and initialize fields to `null` / safe defaults. Never instantiate GObject
subclasses (e.g. `Logger`, `SettingsController`), connect signals, or add GLib
sources in the constructor.

```typescript
// ✅ Correct — Logger (GObject) created in enable()
constructor(metadata: GrayscaleExtensionMetadata) {
    super(metadata);
    this._logger = null;
    this._log = { log: () => {}, warn: () => {}, error: () => {} };
    this._initialized = false;
}

// ❌ Wrong — Logger is a GObject subclass; constructing it here violates R1
constructor(metadata: GrayscaleExtensionMetadata) {
    super(metadata);
    this._logger = new Logger({ ... }); // crash risk during shell startup
}
```

---

## GLib Timer Cleanup — Store Every Source ID (review guideline R4)

Every `GLib.timeout_add()` call **MUST** store the returned source ID in a class
field. In `disable()`, call `GLib.source_remove(id)` before tearing down
components — even for one-shot timers that may not have fired yet.

```typescript
// ✅ Correct
this._autoEnableTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
    this._autoEnableTimerId = null;
    // … work …
    return GLib.SOURCE_REMOVE;
});

// In disable():
if (this._autoEnableTimerId) {
    GLib.source_remove(this._autoEnableTimerId);
    this._autoEnableTimerId = null;
}

// ❌ Wrong — timer fires after disable() and crashes the shell
GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => { ... return GLib.SOURCE_REMOVE; });
```

---

## No Excessive Logging (review guideline R9)

Extensions submitted to extensions.gnome.org **MUST NOT** print excessively to
the system journal. Gate all informational `console.log()` calls behind the
`debug-logging` GSettings key. Only genuine `console.error()` calls are
unconditional.

```typescript
private _debugLog(message: string): void {
    try {
        if (this._settings?.get_boolean('debug-logging')) {
            console.log(message);
        }
    } catch {
        /* ignore — settings not yet available */
    }
}
```

Replace every lifecycle/state `console.log(...)` with `this._debugLog(...)`.
Keep `console.error(...)` for genuine error paths only.

---

## Signal Connections in ALL Component Files (review guideline R3)

ALL signal connections in ALL component files must be tracked and disconnected
in `destroy()`. Untracked connections survive the disable cycle and cause memory
leaks or crashes on re-enable.

```typescript
// In class fields:
private _signalConnectionIds: { object: any; id: number }[] = [];

// When connecting:
const id = source.connect('signal-name', handler);
this._signalConnectionIds.push({ object: source, id });

// In destroy():
for (const { object, id } of this._signalConnectionIds) {
    try { object.disconnect(id); } catch { /* ignore */ }
}
this._signalConnectionIds = [];
```

This applies to settings `connect()`, stateManager `connect()`,
settingsController `connect()`, and any other GObject signal.
