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

| Prohibited           | GJS Alternative                                     |
| -------------------- | --------------------------------------------------- |
| `require()`          | ESM `import` with `gi://` or `resource:///`         |
| `fs.readFile()`      | `Gio.File.new_for_path().load_contents(null, null)` |
| `path.join()`        | `GLib.build_filenamev([...])`                       |
| `process.env.FOO`    | `GLib.getenv('FOO')`                                |
| `setTimeout(fn, ms)` | `GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, fn)`   |
| `Buffer`             | `GLib.Bytes` / `Uint8Array`                         |
| `fetch()`            | `Soup.Session`                                      |

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
