# Grayscale Toggle - User Guide

> **Complete user manual** for the GNOME Shell Grayscale Toggle Extension - from basic usage to advanced multi-monitor configurations.

## 📋 Table of Contents

1. [Getting Started](#-getting-started)
2. [Basic Usage](#-basic-usage)
3. [Multi-Monitor Configuration](#️-multi-monitor-configuration)
4. [User Interface Guide](#-user-interface-guide)
5. [Customization Options](#-customization-options)
6. [Advanced Features](#-advanced-features)
7. [Troubleshooting](#-troubleshooting)
8. [Tips and Best Practices](#-tips-and-best-practices)

---

## 🚀 Getting Started

### What is Grayscale Toggle?

Grayscale Toggle is a sophisticated GNOME Shell extension that allows you to instantly remove color from your displays. This helps reduce visual distractions and dopamine triggers, leading to improved focus and productivity - especially valuable for:

- **Focused work sessions**: Eliminate colorful distractions during deep work
- **Reading and writing**: Reduce eye strain and improve text concentration
- **Digital wellness**: Manage screen time and reduce compulsive device usage
- **Professional workflows**: Maintain consistent visual environment across monitors

### First-Time Setup

After [installation](../README.md#-quick-installation), you'll see:

1. **Panel Indicator**: A new icon in your top panel (usually on the right side)
2. **Quick Settings Toggle**: A "Grayscale" toggle in your Quick Settings panel
3. **Keyboard Shortcut**: [`Super+G`] is ready to use immediately

**Initial Test:**

- Press [`Super+G`] or click the panel indicator
- Your screen should smoothly transition to grayscale
- Press again to return to color

---

## 🎮 Basic Usage

### Toggle Methods

#### Method 1: Keyboard Shortcut (Fastest)

```
Super + G
```

- **Super** = Windows key on most keyboards
- **Instant toggle**: No mouse interaction needed
- **Works globally**: Even when other applications have focus

#### Method 2: Panel Indicator

1. Look for the grayscale icon in your top panel
2. **Single click**: Toggle grayscale on/off
3. **Right-click**: Access advanced options menu

#### Method 3: Quick Settings (GNOME 46+)

1. Click the system menu (top-right corner)
2. Find "Grayscale" toggle in the Quick Settings panel
3. Click to toggle on/off

### Visual Feedback

**When Grayscale is Active:**

- Panel indicator changes to show active state
- Quick Settings toggle appears enabled
- Optional notification appears (if enabled in settings)
- Smooth transition animation (300ms by default)

**When Grayscale is Inactive:**

- Panel indicator shows normal state
- All displays return to full color
- Smooth transition back to color

---

## 🖥️ Multi-Monitor Configuration

### Understanding Multi-Monitor Modes

#### Global Mode (Default)

- **Behavior**: All monitors toggle together
- **Use case**: Synchronized workspace where all displays should match
- **Control**: Single toggle affects all connected displays

#### Per-Monitor Mode (Advanced)

- **Behavior**: Each monitor can be controlled independently
- **Use case**: Mixed workflows (e.g., grayscale document editing + color reference)
- **Control**: Individual toggles for each display

### Enabling Per-Monitor Control

1. **Open Preferences**:
   - Right-click the panel indicator → "Preferences"
   - Or: Extensions app → Grayscale Toggle → Settings

2. **Enable Per-Monitor Mode**:
   - Find "Multi-Monitor Settings" section
   - Toggle **"Per-monitor mode"** to ON

3. **Access Individual Controls**:
   - Right-click panel indicator → "Monitor Controls"
   - Each connected display will have its own toggle

### Monitor Detection and Naming

The extension automatically detects and names your monitors:

**Primary Monitor**: Usually labeled "Primary" or "Monitor 1"
**Secondary Monitors**: Labeled by position (e.g., "Monitor 2 - Left")

**Monitor Information Displayed:**

- Resolution (e.g., "1920×1080")
- Position ("Primary", "Left", "Right", "Above")
- Connection status ("Connected", "Disconnected")

### Hotplug Support (Dynamic Display Changes)

The extension handles display changes in real-time:

**When connecting a new monitor:**

- Automatic detection within 2-3 seconds
- New monitor adopts current global state
- Panel menu updates to show new option

**When disconnecting a monitor:**

- Settings for that monitor are preserved
- Graceful cleanup of effects
- Automatic reconnection when display returns

**Resolution or arrangement changes:**

- Extension adapts automatically
- Effects remain applied correctly
- No user intervention required

---

## 🎨 User Interface Guide

### Panel Indicator

#### Icon States

- **Inactive** (Color mode): Standard monitor icon
- **Active** (Grayscale mode): Icon with grayscale indicator
- **Per-monitor mixed**: Icon shows mixed state indicator

#### Panel Menu (Right-click)

```
Grayscale Toggle
├── 🔄 Toggle Grayscale (Global)
├── ⚙️ Preferences
├── 📊 Monitor Controls (if per-monitor enabled)
│   ├── Primary Monitor (1920×1080) ☐
│   ├── Monitor 2 - Left (1680×1050) ☐
│   └── Monitor 3 - Right (1920×1080) ☑
└── ℹ️ About
```

### Quick Settings Integration

Modern GNOME 46+ Quick Settings integration provides:

- **Native toggle appearance**: Matches system toggles
- **Status indication**: Clear on/off state
- **Accessibility**: Screen reader compatible
- **Gesture support**: Touch-friendly for tablets

### Preferences Dialog

Located at: **Extensions** → **Grayscale Toggle** → **Settings**

#### Settings Categories:

**General Settings:**

- Enable/disable extension features
- Configure keyboard shortcuts
- Set panel indicator preferences

**Multi-Monitor Options:**

- Per-monitor mode toggle
- Hotplug event handling
- Monitor-specific preferences

**Animation & Effects:**

- Transition duration (0-2000ms)
- Effect quality (Low, Medium, High)
- Performance optimization mode

**Notifications & Feedback:**

- Toggle state notifications
- Notification timeout
- Visual feedback options

---

## ⚙️ Customization Options

### Keyboard Shortcuts

#### Changing the Default Shortcut

1. Open Extensions → Grayscale Toggle → Preferences
2. Find "Keyboard Shortcuts" section
3. Click the current shortcut ([`Super+G`])
4. Press your desired key combination
5. Click "Set" to confirm

#### Recommended Shortcuts:

- [`Super+G`]: Default, easy to remember (G for Grayscale)
- [`Super+Shift+G`]: Alternative if Super+G conflicts
- [`Alt+Shift+G`]: Good for users who avoid Super key
- [`F12`]: Function key option for quick access

### Effect Customization

#### Grayscale Intensity

Control how strong the effect appears:

- **1.0**: Complete grayscale (default)
- **0.7-0.9**: Subtle color reduction
- **0.5**: Half-strength effect
- **0.1-0.3**: Very subtle desaturation

**Use Cases:**

- **Full grayscale (1.0)**: Maximum focus benefit
- **Partial grayscale (0.5-0.8)**: Reduce distractions while keeping some color information
- **Minimal (0.1-0.3)**: Slight reduction in colorfulness

#### Animation Settings

**Duration Options:**

- **0ms**: Instant toggle (no animation)
- **150ms**: Very fast transition
- **300ms**: Default, smooth transition
- **500ms**: Slower, more noticeable transition
- **1000ms**: Very slow, dramatic effect

**Quality Settings:**

- **High**: Best visual quality, more GPU usage
- **Medium**: Balanced quality and performance
- **Low**: Fastest performance, basic quality

### Panel Integration

#### Panel Position

Choose where the indicator appears:

- **Right**: Default position (recommended)
- **Center**: Between time and volume controls
- **Left**: Near activities button

#### Indicator Visibility

- **Show panel indicator**: Enable/disable top panel icon
- **Show Quick Settings**: Enable/disable Quick Settings integration
- **Auto-hide when disabled**: Hide indicator when extension is off

### Notification Settings

#### Notification Options

- **Enable notifications**: Show status change notifications
- **Timeout**: How long notifications stay visible (1-10 seconds)
- **Sound feedback**: Optional audio cues for state changes

---

## 🔥 Advanced Features

### Performance Optimization

#### Performance Mode

Enable for lower-end hardware or laptops:

- Reduces animation complexity
- Optimizes memory usage
- Extends battery life on portable devices

#### Quality vs Performance Balance

```
High Quality    →    Maximum Performance
- GPU intensive       - CPU optimized
- Smooth gradients    - Simplified effects
- Best visual result  - Faster execution
- Higher power usage  - Battery friendly
```

### Session Integration

#### Startup Behavior

Configure what happens when you log in:

- **Remember last state**: Restore previous grayscale setting
- **Always start with color**: Reset to color mode each session
- **Auto-enable grayscale**: Start each session in grayscale mode

#### State Persistence

The extension automatically saves:

- Global grayscale state
- Per-monitor configurations
- User preferences and settings
- Keyboard shortcut customizations

### Advanced Multi-Monitor Features

#### Monitor Profiles

For complex setups with frequently changing configurations:

- Settings are saved per monitor by hardware ID
- Configurations persist when monitors are reconnected
- Support for rotating monitor setups

#### Hotplug Event Customization

Control how the extension responds to display changes:

- **Immediate activation**: New monitors adopt current state
- **Manual activation**: New monitors start in color mode
- **Profile-based**: Use saved settings for recognized displays

---

## 🐛 Troubleshooting

### Common Issues

#### Extension Not Working

**Problem**: Grayscale toggle has no effect
**Solutions**:

1. Check GNOME Shell version compatibility (46.0+ required)
2. Verify extension is enabled: `gnome-extensions list | grep grayscale-toggle`
3. Restart GNOME Shell: [`Alt+F2`] → type `r` → [`Enter`]

**Problem**: Keyboard shortcut not responding
**Solutions**:

1. Check for conflicting shortcuts in Settings → Keyboard → Shortcuts
2. Try alternative shortcut combinations
3. Verify extension has proper permissions

#### Performance Issues

**Problem**: Slow animations or system lag
**Solutions**:

1. Enable "Performance mode" in preferences
2. Reduce animation duration to 150ms or less
3. Set effect quality to "Medium" or "Low"
4. Check system resources: `htop` or System Monitor

**Problem**: High CPU usage
**Solutions**:

1. Disable unnecessary visual effects
2. Enable performance optimizations
3. Update graphics drivers
4. Consider hardware limitations

#### Multi-Monitor Problems

**Problem**: Not all monitors detected
**Solutions**:

1. Check physical connections and power
2. Verify displays in System Settings → Displays
3. Use `xrandr --listmonitors` to check detection
4. Reconnect problematic displays

**Problem**: Hotplug not working
**Solutions**:

1. Check hotplug event handling in preferences
2. Restart extension: disable → enable
3. Test with `xrandr` commands
4. Check system logs: `journalctl -f`

#### Visual Glitches

**Problem**: Effect appears on wrong monitor
**Solutions**:

1. Disable and re-enable per-monitor mode
2. Check monitor identification in panel menu
3. Reset extension settings to defaults
4. Restart GNOME Shell session

**Problem**: Effect persists after disabling
**Solutions**:

1. Toggle grayscale off before disabling extension
2. Restart GNOME Shell if needed
3. Check for other color-affecting extensions
4. Reset graphics driver settings if necessary

### Debug Information

#### Collecting Debug Data

```bash
# Check extension status
gnome-extensions list --enabled | grep grayscale

# View extension logs
journalctl -f -o cat /usr/bin/gnome-shell | grep -i grayscale

# Check graphics information
glxinfo | grep "OpenGL"
```

#### Reset to Defaults

```bash
# Reset all extension settings
gsettings reset-recursively org.gnome.shell.extensions.grayscale-toggle

# Or reset specific settings
gsettings reset org.gnome.shell.extensions.grayscale-toggle grayscale-enabled
```

---

## 💡 Tips and Best Practices

### Productivity Workflows

#### Focus Session Setup

1. Enable grayscale before starting focused work
2. Set notification timeout to 1-2 seconds (less distraction)
3. Use per-monitor mode to keep reference materials in color
4. Consider setting "Auto-enable on startup" for morning focus sessions

#### Reading and Writing

1. Use partial grayscale (0.7-0.8 intensity) for long reading sessions
2. Enable instant toggle (0ms animation) for quick switching
3. Keep Quick Settings toggle visible for easy access
4. Consider a longer animation (500ms) for smooth transitions during breaks

### Multi-Monitor Optimization

#### Professional Workflows

- **Main workspace**: Grayscale for focus
- **Reference monitor**: Color for design/photo work
- **Communication display**: Grayscale to reduce notification distractions

#### Gaming and Entertainment

- **Gaming monitor**: Keep in color for optimal experience
- **Productivity displays**: Use grayscale during work hours
- **Use hotkey for quick switching between modes**

### Battery and Performance

#### Laptop Users

- Enable performance mode for better battery life
- Reduce animation duration to save GPU cycles
- Use "Low" quality setting on battery power
- Consider auto-disabling during gaming/video work

#### Desktop Users

- Use "High" quality for best visual experience
- Longer animation durations for smoother transitions
- Enable all notification features
- Utilize full multi-monitor capabilities

### Digital Wellness Integration

#### Habit Formation

- Start with short grayscale sessions (15-30 minutes)
- Gradually increase duration as you adapt
- Use grayscale during specific activities (writing, reading, coding)
- Pair with other focus techniques (Pomodoro, time blocking)

#### Work-Life Balance

- Enable grayscale during work hours
- Keep color for recreational computing
- Use startup settings to enforce work mode boundaries
- Consider scheduled automation (using external scripts)

---

## 📖 Additional Resources

### Related Documentation

- [Installation Guide](installation-guide.md) - Detailed setup procedures
- [Developer Guide](developer-guide.md) - Technical architecture and development
- [Main README](../README.md) - Project overview and quick start

### External Resources

- [GNOME Shell Extensions Documentation](https://gjs.guide/extensions/)
- [Digital Wellness Research](https://www.ncbi.nlm.nih.gov/pmc/) - Scientific background
- [GNOME Human Interface Guidelines](https://developer.gnome.org/hig/) - UI design principles

### Community Support

- **GitHub Issues**: Bug reports and feature requests
- **GNOME Extensions**: Community discussions
- **IRC**: `#gnome-extensions` on irc.gnome.org

---

**Need more help?** Check the [troubleshooting section](#-troubleshooting) or visit our [GitHub Issues](https://github.com/webaheadstudios/grayscale-gnome-extension/issues) for community support.
