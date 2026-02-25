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
