# GNOME Shell Extension Debugging Rules

Rules specific to Debug mode for this repository.

---

## Primary Log Command

```bash
# Live stream GNOME Shell logs, filtered for this extension
journalctl --user -f | grep -E "(GrayscaleToggle|JS ERROR|EXTENSION)"

# Broader filter including all extension errors
journalctl --user -f | grep -E "(grayscale|JS ERROR|JS WARNING)"

# Show logs since last boot
journalctl --user -b | grep -i grayscale

# Show logs from the last 5 minutes
journalctl --user --since="5 minutes ago" | grep -i grayscale
```

---

## When Errors Appear

- **Load errors** appear when running `gnome-extensions enable <uuid>`, not at
  install time. If `enable` silently succeeds but the extension is not active,
  check `gnome-extensions show <uuid>` for state.
- **Runtime errors** (e.g. signal crashes) appear in the journal at the moment
  the failure occurs, not at startup.

---

## Check Extension State

```bash
# Shows STATE (ACTIVE / ERROR / INITIALIZED / DISABLED) and error message
gnome-extensions show grayscale-toggle@webaheadstudios.com
```

States to look for:

- `ACTIVE` — running correctly
- `ERROR` — failed to load; check journal for the JS error
- `INITIALIZED` — loaded but not yet enabled

---

## Common Error Messages and Root Causes

| Error message                                         | Root cause                                                       | Fix                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Tried to construct an object without a GType`        | Class extends `GObject.Object` without `GObject.registerClass()` | Wrap class in `GObject.registerClass({ GTypeName: '...', ... }, class ...)` |
| `No signal '...' in the … class hierarchy`            | Signal not declared in `GObject.registerClass({Signals: ...})`   | Add signal to the `Signals` dict inside `registerClass`                     |
| `GObject subclass '...' uses ES6 class fields`        | `"useDefineForClassFields": true` in `tsconfig.runtime.json`     | Set back to `false` in `tsconfig.runtime.json`                              |
| `Cannot read properties of null`                      | Component accessed before initialization completes               | Check component order in `src/extension.ts` `componentOrder` array          |
| `disconnect() signal handler id ... is not connected` | Signal disconnected twice or ID not saved                        | Track IDs with `SignalManager`; guard with `if (this._id)`                  |
| `TypeError: ... is not a function`                    | Wrong import path or using Node.js API                           | Use `gi://` or `resource:///` imports; no `require()`                       |

---

## Wayland Reload Procedure

GJS **cannot unload** ES modules once imported. On Wayland,
`gnome-extensions disable && enable` does NOT pick up new module code.

**Correct procedure to test code changes on Wayland:**

```bash
# Terminal 1: rebuild on each change
npm run build:dev

# Terminal 2: start a fresh nested shell per test cycle
npm run dev:nested
# Runs: dbus-run-session gnome-shell --nested --wayland

# After each build: close the nested shell window, then run dev:nested again
```

On X11 only, the quick reload (`Alt+F2 → r`) works to reload extensions.

---

## Looking Glass (X11 Only)

```
Alt+F2 → type: lg → Enter
```

Tabs in Looking Glass:

- **Extensions**: Lists all loaded extensions with their current state
- **Evaluator**: Run arbitrary GJS code live (useful for inspecting state)
- **Errors**: Shows recent JS errors from extensions

Example evaluator snippet:

```javascript
// Inspect extension state from Looking Glass Evaluator
const ext = imports.ui.main.extensionManager.lookup(
    'grayscale-toggle@webaheadstudios.com'
);
ext.stateObj.dumpDebugInfo();
```

---

## State Key Debugging

This extension has two boolean state keys that serve different purposes:

| Key                 | Read by                          | Purpose                          |
| ------------------- | -------------------------------- | -------------------------------- |
| `grayscale-enabled` | `SettingsController.isEnabled()` | Current active toggle state      |
| `global-enabled`    | Session restore path + UI sync   | Previous session grayscale state |

```bash
# Check both keys directly
gsettings get org.gnome.shell.extensions.grayscale-toggle grayscale-enabled
gsettings get org.gnome.shell.extensions.grayscale-toggle global-enabled
```

If the UI shows one state but effects show another, the two keys may be out of
sync. Reset with:

```bash
gsettings reset-recursively org.gnome.shell.extensions.grayscale-toggle
```
