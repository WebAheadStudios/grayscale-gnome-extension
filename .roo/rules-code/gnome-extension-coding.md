# GNOME Shell Extension Coding Rules

Rules specific to Code mode for this repository.

---

## GObject.registerClass() — Always Required

Every GObject subclass **must** use `GObject.registerClass()` with a unique
`GTypeName`. Never use `static [GObject.signals]` — it does not register the
GType and causes a crash: `"Tried to construct an object without a GType"`.

```typescript
// ✅ Correct — GType is registered, signals work
export const MyComponent = GObject.registerClass(
    {
        GTypeName: 'GrayscaleMyComponent', // prefix all GTypeNames with "Grayscale"
        Signals: {
            'state-changed': {
                param_types: [GObject.TYPE_BOOLEAN],
            },
        },
    },
    class MyComponent extends GObject.Object {
        _init() {
            super._init();
        }
    }
);

// ❌ Wrong — GType not registered
export class MyComponent extends GObject.Object {
    static [GObject.signals] = { 'state-changed': {} };
}
```

**GTypeName uniqueness**: all GTypeNames in this project are prefixed with
`Grayscale` (e.g. `GrayscaleEffectManager`, `GrayscaleStateManager`).

---

## Panel Indicator Pattern

Add panel indicators via `Main.panel.addToStatusArea()`, never via direct box
insertion.

```typescript
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Button } from 'resource:///org/gnome/shell/ui/panelMenu.js';

const indicator = new Button(0.0, 'Grayscale Toggle');
Main.panel.addToStatusArea('grayscale-indicator', indicator);

// Cleanup in disable():
indicator.destroy();
```

---

## Keyboard Shortcut Pattern

Schema key type must be `as` (array of strings). Key name in `addKeybinding()`
must match the schema exactly (kebab-case).

```typescript
// In GSettings schema XML:
// <key name="toggle-keybinding" type="as">

// Add binding (in enable()):
Main.wm.addKeybinding(
    'toggle-keybinding', // must match schema key name exactly
    this._settings,
    Meta.KeyBindingFlags.NONE,
    Shell.ActionMode.NORMAL,
    () => this._onToggle()
);

// Remove binding (in disable()):
Main.wm.removeKeybinding('toggle-keybinding');
```

---

## Clutter Effect Pattern

Apply effects to actors, not to the whole stage unless global mode is required.
Save the effect reference for removal in `disable()`.

```typescript
import Clutter from 'gi://Clutter';

// Apply:
const effect = new Clutter.DesaturateEffect({ factor: 1.0 });
actor.add_effect_with_name('grayscale', effect);

// Remove in disable():
actor.remove_effect_by_name('grayscale');
// or: actor.remove_all_effects();
```

---

## GLib Timer Pattern

Always save the source ID and remove it in `disable()`. Timers that fire after
`disable()` will crash the shell.

```typescript
import GLib from 'gi://GLib';

// Add timer:
this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
    this._doWork();
    return GLib.SOURCE_CONTINUE; // or GLib.SOURCE_REMOVE to fire once
});

// Remove in disable():
if (this._timerId) {
    GLib.source_remove(this._timerId);
    this._timerId = 0;
}
```

---

## Signal Connection Pattern

Save all signal IDs at connect time. Disconnect them all in `disable()`. Use the
`SignalManager` infrastructure class (`src/infrastructure/SignalManager.ts`) for
automatic tracking.

```typescript
// Manual pattern:
this._signalIds = [];
this._signalIds.push(obj.connect('signal-name', this._onSignal.bind(this)));

// Cleanup:
this._signalIds.forEach(id => obj.disconnect(id));
this._signalIds = [];

// Preferred: use SignalManager from src/infrastructure/
import { SignalManager } from './infrastructure/index.js';
```

---

## connectObject() / disconnectObject() — Preferred Signal Pattern (GNOME 45+)

GNOME Shell 45+ provides lifecycle-tracked signal connections. Prefer this
pattern for GObject-derived classes in Shell context (NOT in prefs):

```typescript
// Connect multiple signals tracked to this object:
sourceObject.connectObject(
    'signal-one',
    this._onSignalOne.bind(this),
    'signal-two',
    this._onSignalTwo.bind(this),
    this // tracking object — auto-disconnected when this is destroyed
);

// Disconnect all signals tracked to this:
sourceObject.disconnectObject(this);
```

This is preferred over manual `SignalManager` arrays for GObject-derived classes
in Shell context. **Not available in prefs context.**

---

## GSettings Access

Access settings via `this.getSettings()` from the `Extension` class, not from
`ExtensionUtils` (deprecated in GNOME 46+).

```typescript
// In the Extension class:
const settings = this.getSettings();

// In components, receive via constructor injection:
class MyComponent {
    constructor(extension: GrayscaleExtension) {
        this._settings = extension.getSettings();
    }
}
```

---

## Schema Key Naming

GSettings schema keys are kebab-case. Always match them exactly in code.

```typescript
// ✅ Correct:
settings.get_boolean('grayscale-enabled');
settings.get_uint('animation-duration');
settings.get_boolean('performance-mode');

// ❌ Wrong (camelCase → key not found):
settings.get_boolean('grayscaleEnabled');
```

The TypeScript interfaces in `src/types/settings.ts` use camelCase for internal
typing only. They do not map directly to schema key names.

---

## Animation Duration — Always Use adjustAnimationTime()

Wrap ALL animation durations with `adjustAnimationTime()` so they respect the
user's "Reduce Motion" and "Slow Down" accessibility settings. When animations
are disabled the function returns `0`, making transitions instant.

```typescript
import { adjustAnimationTime } from 'resource:///org/gnome/shell/misc/animationUtils.js';

// ✅ Correct:
(effect as any).ease_property('factor', 1.0, {
    duration: adjustAnimationTime(duration),
    mode: Clutter.AnimationMode.EASE_IN_OUT,
});

// ❌ Wrong — ignores accessibility settings:
(effect as any).ease_property('factor', 1.0, {
    duration: duration,
});
```

Add the module declaration to `src/ambient.d.ts` if TypeScript cannot resolve
the import:

```typescript
declare module 'resource:///org/gnome/shell/misc/animationUtils.js' {
    export function adjustAnimationTime(msecs: number): number;
}
```

---

## Prefs Context vs Extension Context

`src/prefs.ts` runs in a **separate LibAdwaita process**, not inside GNOME
Shell. These APIs are **NOT available** in prefs:

| Forbidden in prefs                     | Reason                                 |
| -------------------------------------- | -------------------------------------- |
| `global`                               | Shell.Global singleton — Shell only    |
| `Main.*`                               | Shell UI modules — Shell only          |
| `connectObject()`                      | Shell GNOME 45+ extension — Shell only |
| `actor.ease()`                         | Clutter animation — Shell only         |
| `Math.clamp()`                         | GJS Shell global — Shell only          |
| `String.format()`                      | GJS Shell global — Shell only          |
| Any `resource:///org/gnome/shell/ui/*` | Shell UI modules                       |

Safe prefs imports:

```typescript
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
```

---

## Logging — Use Extension.getLogger()

In `Extension` class methods, use the built-in logger instead of manual
`console.log` prefixing. `getLogger()` auto-prefixes all output with the
extension UUID.

```typescript
// ✅ Correct — auto-prefixed with UUID
interface ExtensionLogger {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
}
private _log: ExtensionLogger = (this as any).getLogger();

this._log.log('Extension enabled');
// outputs: [grayscale-toggle@webaheadstudios.com] Extension enabled

// ❌ Wrong — manual prefixing, verbose
console.log(`[${this.metadata.name}] Extension enabled`);
```

---

## override Keyword — Required with noImplicitOverride

`tsconfig.json` enables `"noImplicitOverride": true`. Any method that overrides
a base-class method **must** include the `override` keyword. TypeScript will
produce a compile error if it is omitted.

```typescript
// ✅ Correct:
export default class GrayscaleExtension extends Extension {
    override enable(): void { ... }
    override disable(): void { ... }
}

// ❌ Wrong — compile error with noImplicitOverride: true:
export default class GrayscaleExtension extends Extension {
    enable(): void { ... }
    disable(): void { ... }
}
```

Common places that need `override` in this codebase:

- `extension.ts`: `enable()`, `disable()`
- `prefs.ts`: `fillPreferencesWindow()`
- `panelIndicator.ts`: `destroy()`
- `quickSettingsIntegration.ts`: `get label()`, `get iconName()`, `destroy()` ×2
- `infrastructure/SignalManager.ts`: `disconnect()`

---

## Translations

For i18n support, use the Extension base class methods:

- `this.initTranslations(domain?)` — Initialize gettext
- `this.gettext(str)` — Translate a string (alias: `_()`)
- `this.ngettext(str, plural, n)` — Plural forms

Currently, a placeholder `const _ = (str: string) => str` is used in
`src/prefs.ts` for development. Replace with the base class helper when
translation support is added.
