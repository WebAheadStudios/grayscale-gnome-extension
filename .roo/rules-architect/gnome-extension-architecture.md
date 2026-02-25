# GNOME Shell Extension Architecture Rules

Rules specific to Architect mode for this repository.

---

## Extension Base Class

All GNOME Shell extensions (GNOME 45+) must use the `Extension` class pattern:

```typescript
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class GrayscaleExtension extends Extension {
    enable(): void {
        /* initialize everything */
    }
    disable(): void {
        /* teardown everything — must be complete */
    }
}
```

The `enable()` / `disable()` contract is part of the GNOME Shell API. The
extension **must** be fully stateless when `disable()` returns.

---

## Authoritative Component Initialization Order

The component order is defined in code, not in docs. When behavior and
documentation diverge, trust `src/extension.ts` `componentOrder` array as source
of truth.

**Current order** (`src/extension.ts:144`):

```
enable():
  SettingsController  ← must be first; others depend on settings access
  MonitorManager      ← depends on: nothing
  StateManager        ← depends on: SettingsController
  EffectManager       ← depends on: StateManager, MonitorManager
  UIController        ← depends on: all of the above

disable() — reverse order:
  UIController        ← destroy panel button and Quick Settings first
  EffectManager       ← remove all Clutter effects
  StateManager        ← persist final state
  MonitorManager      ← clean up monitor listeners
  SettingsController  ← disconnect settings signals last
```

When adding a new component, place it in the order that satisfies its
dependencies. Never reorder existing components without auditing all consumers.

---

## Stateful Components Must Be GObject Subclasses

Any component that emits signals or reacts to signals **must** be wrapped in
`GObject.registerClass()`. Direct JavaScript classes cannot participate in the
GObject signal system.

```typescript
// ✅ Correct — can connect/emit signals
export const MyManager = GObject.registerClass(
  { GTypeName: 'GrayscaleMyManager', Signals: { 'my-event': {} } },
  class MyManager extends GObject.Object { ... }
);

// ❌ Wrong — cannot emit signals, cannot be used with GObject.connect()
export class MyManager { ... }
```

---

## Inter-Component Communication via GObject Signals

Components communicate through GObject signals, not direct method calls or
shared mutable state. This keeps components loosely coupled and testable.

```
SettingsController  →  'setting-changed'  →  EffectManager / UIController
StateManager        →  'state-changed'    →  EffectManager / UIController
MonitorManager      →  'monitor-added'    →  StateManager / EffectManager
UIController        →  'toggle-requested' →  StateManager
EffectManager       →  'effect-applied'   →  UIController (for feedback)
```

The signal subscriptions are wired in `GrayscaleExtension._connectSignals()`.

---

## Clutter Actor Hierarchy for Effect Placement

Effects target the highest-level actor that covers the desired display area:

```
global.stage                       ← entire display (all monitors)
  └─ Main.layoutManager.uiGroup   ← primary UI group
       └─ monitor-specific actors ← per-monitor effects go here
```

For **global mode**: apply `Clutter.DesaturateEffect` to `global.stage` or to
each monitor actor obtained via `Main.layoutManager.monitors`.

For **per-monitor mode**: apply the effect to the individual monitor actor at
`Main.layoutManager.monitors[index]`.

---

## Extension Must Be Stateless at disable()

All runtime state lives in GSettings or is re-derived from GSettings on
`enable()`. When `disable()` returns:

- No Clutter effects remain attached to any actor
- No signal handlers are connected on any GObject
- No GLib timer sources are alive
- No panel UI widgets remain in the shell
- No keyboard shortcuts are registered

State the user cares about (toggle on/off, per-monitor settings) is persisted to
GSettings **before** teardown so it can be restored on next `enable()`.

---

## Quick Settings Integration Pattern

Quick Settings toggles extend `SystemIndicator` and are registered via
`QuickSettingsMenu._addItems()`. They must be destroyed in `disable()`.

```typescript
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

// Create and register:
const toggle = new GrayscaleQuickToggle();
Main.panel.statusArea.quickSettings._addItems([toggle]);

// Destroy in disable():
toggle.destroy();
```

---

## Design Constraints to Maintain

1. **SettingsController is the single GSettings access point** — other
   components obtain settings through `extension.getSettings()` or through the
   `SettingsController` component. Do not instantiate a second `Gio.Settings`
   object in a component.

2. **Dual state keys are intentional** — `grayscale-enabled` (current active
   state, read by `SettingsController.isEnabled()`) and `global-enabled`
   (session restore path) serve different roles. Do not merge them.

3. **MonitorManager owns display topology** — other components ask
   `MonitorManager` for monitor indices and geometry. Do not directly access
   `Main.layoutManager.monitors` from EffectManager or UIController.
