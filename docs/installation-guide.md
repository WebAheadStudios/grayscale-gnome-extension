# Grayscale Toggle - Installation Guide

> **Comprehensive installation instructions** for all supported platforms,
> installation methods, and troubleshooting procedures.

## 📋 Table of Contents

1. [System Requirements](#-system-requirements)
2. [Installation Methods](#-installation-methods)
3. [Platform-Specific Instructions](#️-platform-specific-instructions)
4. [Manual Installation](#-manual-installation)
5. [Development Installation](#-development-installation)
6. [Configuration and Setup](#-configuration-and-setup)
7. [Troubleshooting](#-troubleshooting)
8. [Uninstallation](#️-uninstallation)

---

## 📋 System Requirements

### Minimum Requirements

**Operating System Support:**

- Ubuntu 24.04 LTS or later
- Fedora 40 or later
- openSUSE Leap 15.5 or Tumbleweed
- Arch Linux (current)
- Debian 12 (Bookworm) or later
- Pop!\_OS 24.04 or later

**GNOME Shell Version:**

- **Required**: GNOME Shell 46.0 or later
- **Recommended**: GNOME Shell 47.0+ for optimal Quick Settings integration
- **Support**: Only the latest stable GNOME Shell version receives full support

**Hardware Requirements:**

- **RAM**: 512MB available memory (minimal overhead)
- **Graphics**: Any GPU with OpenGL support (Intel, AMD, NVIDIA)
- **Display**: Single or multi-monitor configurations supported
- **Architecture**: x86_64, aarch64 (ARM64)

**Session Requirements:**

- **Wayland**: Fully supported (recommended)
- **X11**: Supported with some limitations
- **User session**: Standard GNOME session (not supported in GNOME Classic mode)

### Recommended Specifications

**For Optimal Performance:**

- **GNOME Shell**: 47.0 or later
- **Graphics**: Dedicated GPU for smooth animations
- **RAM**: 1GB+ available for complex multi-monitor setups
- **Display**: 60Hz+ refresh rate for smooth animations

**For Advanced Features:**

- **Quick Settings Integration**: GNOME Shell 46.0+ required
- **Multi-Monitor Support**: Any number of displays supported
- **Hardware Acceleration**: Modern GPU drivers recommended

---

## 🚀 Installation Methods

### Method 1: GNOME Extensions Website (Recommended)

**Easiest installation method for most users**

1. **Visit the Extensions Website:**

    ```bash
    # Open in your browser
    https://extensions.gnome.org/
    # Search for "Grayscale Toggle"
    ```

2. **Install Browser Integration:**

    ```bash
    # For Firefox (recommended)
    sudo apt install gnome-browser-connector    # Ubuntu/Debian
    sudo dnf install gnome-browser-connector    # Fedora
    sudo pacman -S gnome-browser-connector      # Arch Linux

    # Install browser extension from:
    # https://addons.mozilla.org/en-US/firefox/addon/gnome-shell-integration/
    ```

3. **Install the Extension:**
    - Click the "Install" toggle on the extension page
    - Confirm installation when prompted
    - The extension will be automatically enabled

4. **Verify Installation:**

    ```bash
    # Check if extension is installed and enabled
    gnome-extensions list --enabled | grep grayscale-toggle

    # Should output: grayscale-toggle@webaheadstudios.com
    ```

### Method 2: Using GNOME Extensions App

**For users who prefer a GUI approach**

1. **Install GNOME Extensions App:**

    ```bash
    # Ubuntu/Debian
    sudo apt install gnome-shell-extension-manager

    # Fedora
    sudo dnf install gnome-shell-extension-manager

    # Arch Linux
    sudo pacman -S extension-manager

    # Flatpak (any distribution)
    flatpak install flathub com.mattjakeman.ExtensionManager
    ```

2. **Browse and Install:**
    - Open "Extensions" app from Activities
    - Click "Browse" tab
    - Search for "Grayscale Toggle"
    - Click "Install" button
    - Enable the extension

3. **Configure Settings:**
    - Click the gear icon next to the extension
    - Adjust preferences as needed

### Method 3: Modern Development Installation (Material Shell Inspired)

**One-command installation with convenient npm scripts - ideal for developers
and power users**

#### Quick Start (Recommended for Developers)

```bash
# Clone and set up in one go
git clone https://github.com/webaheadstudios/grayscale-gnome-extension.git
cd grayscale-gnome-extension
npm install
npm run dev:install
```

**What this does:**

- Builds the extension automatically
- Creates development symlink for easy testing
- Compiles GSettings schemas
- Installs and attempts to enable the extension

#### Available Commands

```bash
# Main installation commands
npm run dev:install          # Development installation (symlinked)
npm run install:extension    # Production installation (copied files)
npm run install:prod         # Build production package + install

# Management commands
npm run extension:status     # Check installation status
npm run enable:extension     # Enable the extension
npm run disable:extension    # Disable the extension
npm run uninstall:extension  # Complete removal

# Developer workflow
npm run dev:uninstall       # Quick uninstall for testing
npm run build:dev           # Build for development
npm run build:prod          # Build for production
```

#### Advantages of this Method

✅ **One-Command Setup**: `npm run dev:install` does everything ✅ **Material
Shell Parity**: Same convenience as popular extensions ✅ **Development Focus**:
Easy symlink setup for developers ✅ **Cross-Platform**: Works on all Linux
distributions with GNOME ✅ **Status Management**: Easy checking with
`npm run extension:status` ✅ **Error Handling**: Clear error messages and
recovery instructions

#### Session Type Support

**Wayland (Recommended):**

```bash
npm run dev:install
# Extension installed - log out/in to activate
```

**X11:**

```bash
npm run dev:install
# GNOME Shell restarts automatically
```

### Method 4: Package Manager Installation

**For distributions that package the extension**

#### Ubuntu/Debian (Future Package)

```bash
# Once packaged (not yet available)
sudo apt update
sudo apt install gnome-shell-extension-grayscale-toggle
gnome-extensions enable grayscale-toggle@webaheadstudios.com
```

#### Fedora (Future Package)

```bash
# Once packaged (not yet available)
sudo dnf install gnome-shell-extension-grayscale-toggle
gnome-extensions enable grayscale-toggle@webaheadstudios.com
```

#### Arch Linux (AUR Package)

```bash
# Using yay (AUR helper)
yay -S gnome-shell-extension-grayscale-toggle

# Using makepkg (manual AUR installation)
git clone https://aur.archlinux.org/gnome-shell-extension-grayscale-toggle.git
cd gnome-shell-extension-grayscale-toggle
makepkg -si
```

---

## 🖥️ Platform-Specific Instructions

### Ubuntu 24.04 LTS

#### Standard Installation

```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Install required dependencies
sudo apt install gnome-shell-extensions gnome-browser-connector

# Install via browser or manual method (see below)
```

#### Ubuntu-Specific Considerations

- **Snap GNOME Shell**: Not supported, use apt version
- **Wayland**: Default and recommended
- **Multiple desktop environments**: May cause conflicts, test carefully

### Fedora (40+)

#### Standard Installation

```bash
# Update system
sudo dnf update

# Install dependencies
sudo dnf install gnome-shell-extensions gnome-browser-connector

# Enable user extensions (if not already enabled)
gsettings set org.gnome.shell disable-user-extensions false
```

#### Fedora-Specific Notes

- **Silverblue**: Use `rpm-ostree install gnome-shell-extensions`
- **SELinux**: May require policy adjustments for development
- **Wayland**: Default and fully supported

### Arch Linux

#### Standard Installation

```bash
# Update system
sudo pacman -Syu

# Install dependencies
sudo pacman -S gnome-shell gnome-browser-connector

# Install from AUR (when available) or manual method
```

#### Arch-Specific Considerations

- **Wayland**: Default in GNOME
- **Rolling release**: Latest GNOME Shell versions supported
- **Development packages**: Available for advanced users

### openSUSE

#### openSUSE Leap

```bash
# Update system
sudo zypper update

# Install dependencies
sudo zypper install gnome-shell gnome-browser-connector

# Manual installation recommended (package not available yet)
```

#### openSUSE Tumbleweed

```bash
# Update to latest packages
sudo zypper dup

# Dependencies usually pre-installed
# Manual installation or browser method recommended
```

### Pop!\_OS

#### Standard Installation

```bash
# Pop!_OS uses Ubuntu base, follow Ubuntu instructions
sudo apt update && sudo apt upgrade
sudo apt install gnome-shell-extensions gnome-browser-connector

# Pop!_OS includes GNOME Extensions app by default
# Use Extensions app or browser method
```

---

## 🔧 Manual Installation

### Prerequisites Check

Before manual installation, verify your system:

```bash
# Check GNOME Shell version
gnome-shell --version
# Required: 46.0 or later

# Check if user extensions are enabled
gsettings get org.gnome.shell disable-user-extensions
# Should be 'false'

# Check available disk space
df -h ~/.local/share/gnome-shell/extensions
# Need ~500KB for extension files
```

### Step-by-Step Manual Installation

#### 1. Download Extension Source

**Option A: Release Archive (Recommended)**

```bash
# Create download directory
mkdir -p ~/Downloads/grayscale-extension
cd ~/Downloads/grayscale-extension

# Download latest release
curl -L -o grayscale-toggle.zip \
    https://github.com/webaheadstudios/grayscale-gnome-extension/archive/main.zip

# Extract archive
unzip grayscale-toggle.zip
```

**Option B: Git Clone (For Development)**

```bash
# Clone the repository
git clone https://github.com/webaheadstudios/grayscale-gnome-extension.git
cd grayscale-gnome-extension
```

#### 2. Install Extension Files

```bash
# Create extension directory
mkdir -p ~/.local/share/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com

# Copy source files
cp -r src/* ~/.local/share/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com/

# Verify files copied correctly
ls -la ~/.local/share/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com/
# Should show: extension.js, metadata.json, prefs.js, and other source files
```

#### 3. Install GSettings Schema

```bash
# Copy schema file
sudo cp schemas/org.gnome.shell.extensions.grayscale-toggle.gschema.xml \
    /usr/share/glib-2.0/schemas/

# Compile schemas
sudo glib-compile-schemas /usr/share/glib-2.0/schemas/

# Verify schema installation
gsettings list-schemas | grep grayscale-toggle
# Should output: org.gnome.shell.extensions.grayscale-toggle
```

#### 4. Enable Extension

```bash
# Enable the extension
gnome-extensions enable grayscale-toggle@webaheadstudios.com

# Verify it's enabled
gnome-extensions list --enabled | grep grayscale-toggle
```

#### 5. Restart GNOME Shell (X11 Only)

```bash
# Check session type
echo $XDG_SESSION_TYPE

# If X11, restart GNOME Shell
if [ "$XDG_SESSION_TYPE" = "x11" ]; then
    # Alt+F2, type 'r', press Enter
    # Or logout/login
    echo "Restart GNOME Shell with Alt+F2 -> 'r'"
else
    echo "Wayland detected - extension should work immediately"
fi
```

---

## 🛠 Development Installation

### Modern Development Installation (Recommended)

**Quick one-command setup inspired by Material Shell's convenience**

#### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/webaheadstudios/grayscale-gnome-extension.git
cd grayscale-gnome-extension

# Install dependencies
npm install
```

#### 2. One-Command Development Setup

```bash
# Build and install extension in development mode
npm run dev:install
```

This command automatically:

- Builds the extension for development
- Creates a symlink for easy development
- Compiles GSettings schemas
- Installs the extension
- Attempts to enable it

#### 3. Development Commands Reference

```bash
# Extension management
npm run extension:status      # Check extension status
npm run disable:extension     # Disable the extension
npm run enable:extension      # Enable the extension
npm run uninstall:extension   # Uninstall completely

# Development workflow
npm run dev:install          # Build + install + enable (dev mode)
npm run dev:uninstall        # Quick uninstall for testing

# Production installation
npm run install:extension    # Install from built package
npm run install:prod         # Build production + install
```

#### 4. Development Workflow

```bash
# Make your changes to source files...

# Quick reinstall during development
npm run dev:install

# Or step by step:
npm run build:dev           # Rebuild
npm run disable:extension   # Disable
npm run enable:extension    # Re-enable

# Check status anytime
npm run extension:status
```

#### 5. Monitor Extension Activity

```bash
# Watch GNOME Shell logs
journalctl -f -o cat /usr/bin/gnome-shell | grep -i grayscale

# Check extension errors
gnome-extensions show grayscale-toggle@webaheadstudios.com
```

### Manual Development Setup (Advanced)

**For developers who prefer manual control**

#### 1. Clone and Setup Repository

```bash
# Clone with development branches
git clone --recursive https://github.com/webaheadstudios/grayscale-gnome-extension.git
cd grayscale-gnome-extension

# Set up development environment
export GNOME_SHELL_DEVELOPMENT=true
export G_MESSAGES_DEBUG=all

# Install development dependencies
npm install
```

#### 2. Development Installation

```bash
# Build and install extension in development mode
# (creates symlink, compiles schemas, enables extension automatically)
npm run dev:install
```

**Testing code changes on Wayland** — GJS cannot unload ES modules, so
`gnome-extensions disable && enable` does not reload new code. Use a nested
shell:

```bash
# Terminal 1: rebuild on each change
npm run build:dev

# Terminal 2: fresh nested shell per test cycle
npm run dev:nested
# After each build: close the nested shell window, run dev:nested again
```

#### 3. Development Tools Setup

```bash
# Install development tools
npm install -g typescript eslint

# Set up pre-commit hooks (if using git hooks)
chmod +x .git/hooks/pre-commit

# Enable extension manually
gnome-extensions enable grayscale-toggle@webaheadstudios.com
```

#### 4. Manual Development Workflow

```bash
# Monitor extension logs
journalctl --user -f | grep -E "(GrayscaleToggle|JS ERROR|EXTENSION)" &

# Make changes to source files, then rebuild
npm run build:dev

# Wayland: start fresh nested shell (required to pick up new module code)
npm run dev:nested

# X11 only: quick disable/enable (does NOT reload new modules on Wayland)
gnome-extensions disable grayscale-toggle@webaheadstudios.com
gnome-extensions enable grayscale-toggle@webaheadstudios.com
```

---

## ⚙️ Configuration and Setup

### Initial Configuration

#### 1. Verify Installation

```bash
# Check extension status
gnome-extensions list --enabled

# Test basic functionality
gsettings get org.gnome.shell.extensions.grayscale-toggle grayscale-enabled
# Should return: false (initial state)
```

#### 2. Access Preferences

**Method A: Extensions App**

- Open "Extensions" from Activities
- Find "Grayscale Toggle"
- Click settings gear icon

**Method B: Command Line**

```bash
# Open preferences dialog
gnome-extensions prefs grayscale-toggle@webaheadstudios.com
```

**Method C: Panel Menu**

- Right-click the panel indicator
- Select "Preferences"

#### 3. Configure Basic Settings

**Keyboard Shortcut:**

```bash
# Set custom keybinding (example: Ctrl+Alt+G)
gsettings set org.gnome.shell.extensions.grayscale-toggle toggle-keybinding \
    "['<Primary><Alt>g']"
```

**Panel Integration:**

```bash
# Show/hide panel indicator
gsettings set org.gnome.shell.extensions.grayscale-toggle show-panel-indicator true

# Panel position (left, center, right)
gsettings set org.gnome.shell.extensions.grayscale-toggle panel-position 'right'
```

**Animation Settings:**

```bash
# Set animation duration (0-2000ms)
gsettings set org.gnome.shell.extensions.grayscale-toggle animation-duration 300

# Set effect intensity (0.0-1.0)
gsettings set org.gnome.shell.extensions.grayscale-toggle grayscale-intensity 1.0
```

### Advanced Configuration

#### Multi-Monitor Setup

```bash
# Enable per-monitor mode
gsettings set org.gnome.shell.extensions.grayscale-toggle per-monitor-mode true

# Check monitor detection
# Open preferences and verify all monitors are listed
gnome-extensions prefs grayscale-toggle@webaheadstudios.com
```

#### Performance Tuning

```bash
# Enable performance mode (for older hardware)
gsettings set org.gnome.shell.extensions.grayscale-toggle performance-mode true

# Set effect quality (low, medium, high)
gsettings set org.gnome.shell.extensions.grayscale-toggle effect-quality 'medium'

# Disable animations for maximum performance
gsettings set org.gnome.shell.extensions.grayscale-toggle animation-duration 0
```

---

## 🐛 Troubleshooting

### Common Installation Issues

#### Extension Not Appearing

**Issue**: Extension installed but not visible in GNOME Extensions

```bash
# Check if extension directory exists
ls -la ~/.local/share/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com/

# Verify metadata.json is valid
cat ~/.local/share/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com/metadata.json

# Check GNOME Shell compatibility
gnome-shell --version
# Compare with metadata.json shell-version requirement
```

**Solution**:

```bash
# Reinstall with correct permissions
chmod -R 755 ~/.local/share/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com/

# Restart GNOME Shell (X11) or logout/login (Wayland)
```

#### Schema Installation Failures

**Issue**: Settings schema not found

```bash
# Error message: "Schema 'org.gnome.shell.extensions.grayscale-toggle' is not installed"
```

**Solution**:

```bash
# Reinstall schema with correct permissions
sudo cp schemas/org.gnome.shell.extensions.grayscale-toggle.gschema.xml \
    /usr/share/glib-2.0/schemas/

# Fix permissions
sudo chmod 644 /usr/share/glib-2.0/schemas/org.gnome.shell.extensions.grayscale-toggle.gschema.xml

# Compile schemas
sudo glib-compile-schemas /usr/share/glib-2.0/schemas/

# Verify installation
gsettings list-schemas | grep grayscale-toggle
```

#### Permission Issues

**Issue**: Permission denied errors during installation

```bash
# Common error: Permission denied when copying to system directories
```

**Solution**:

```bash
# Use proper sudo permissions for system files
sudo cp schemas/*.gschema.xml /usr/share/glib-2.0/schemas/
sudo glib-compile-schemas /usr/share/glib-2.0/schemas/

# User directory should not require sudo
mkdir -p ~/.local/share/gnome-shell/extensions/
cp -r src/* ~/.local/share/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com/
```

### Runtime Issues

#### Extension Fails to Enable

**Check Extension Logs:**

```bash
# Monitor GNOME Shell logs for errors
journalctl -f -o cat /usr/bin/gnome-shell | grep -E "(grayscale|ERROR|JS ERROR)"

# Check for specific error patterns
journalctl --since="5 minutes ago" -u gnome-shell@$(whoami).service | grep -i error
```

**Common Fixes:**

```bash
# Reset extension settings
gsettings reset-recursively org.gnome.shell.extensions.grayscale-toggle

# Clear extension cache
rm -rf ~/.cache/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com/

# Restart GNOME Shell completely
sudo systemctl restart gdm  # Will logout all users!
```

#### Keyboard Shortcut Not Working

**Check for Conflicts:**

```bash
# List all keyboard shortcuts
gsettings list-keys org.gnome.shell.keybindings
gsettings list-keys org.gnome.desktop.wm.keybindings
gsettings list-keys org.gnome.settings-daemon.plugins.media-keys

# Check for conflicting Super+G binding
gsettings get org.gnome.shell.extensions.grayscale-toggle toggle-keybinding
```

**Solutions:**

```bash
# Set alternative keybinding
gsettings set org.gnome.shell.extensions.grayscale-toggle toggle-keybinding \
    "['<Super><Shift>g']"

# Or use different key combination
gsettings set org.gnome.shell.extensions.grayscale-toggle toggle-keybinding \
    "['<Primary><Alt>g']"
```

#### Multi-Monitor Detection Issues

**Check Monitor Setup:**

```bash
# List detected monitors
xrandr --listmonitors
# Or for Wayland:
gnome-monitor-config list

# Check GNOME Shell monitor info
busctl --user call org.gnome.Mutter.DisplayConfig \
    /org/gnome/Mutter/DisplayConfig \
    org.gnome.Mutter.DisplayConfig GetCurrentState
```

**Solutions:**

```bash
# Reset monitor detection
gsettings reset org.gnome.shell.extensions.grayscale-toggle per-monitor-mode
gsettings set org.gnome.shell.extensions.grayscale-toggle per-monitor-mode true

# Disable and re-enable extension
gnome-extensions disable grayscale-toggle@webaheadstudios.com
gnome-extensions enable grayscale-toggle@webaheadstudios.com
```

### Graphics and Performance Issues

#### Slow Animations or System Lag

**Check Graphics Drivers:**

```bash
# Check current graphics driver
lspci | grep VGA
glxinfo | grep "OpenGL vendor"

# For NVIDIA users
nvidia-smi  # Check NVIDIA driver status

# For AMD users
lspci | grep VGA | grep AMD
```

**Performance Solutions:**

```bash
# Enable performance mode
gsettings set org.gnome.shell.extensions.grayscale-toggle performance-mode true

# Reduce animation duration
gsettings set org.gnome.shell.extensions.grayscale-toggle animation-duration 150

# Lower effect quality
gsettings set org.gnome.shell.extensions.grayscale-toggle effect-quality 'low'
```

#### Extension Crashes GNOME Shell

**Emergency Recovery:**

```bash
# Disable extension from terminal
gnome-extensions disable grayscale-toggle@webaheadstudios.com

# If shell is unresponsive, use TTY
# Press Ctrl+Alt+F2, login, then:
DISPLAY=:0 gnome-extensions disable grayscale-toggle@webaheadstudios.com

# Return to graphical session: Ctrl+Alt+F1 or F7
```

**Debug Crash:**

```bash
# Check crash logs
journalctl --since="10 minutes ago" -u gnome-shell@$(whoami).service

# Enable debug logging
G_DEBUG=fatal-criticals journalctl -f -u gnome-shell@$(whoami).service
```

---

## 🗑️ Uninstallation

### Complete Removal

#### 1. Disable Extension

```bash
# Disable the extension first
gnome-extensions disable grayscale-toggle@webaheadstudios.com

# Verify it's disabled
gnome-extensions list --disabled | grep grayscale-toggle
```

#### 2. Remove Extension Files

```bash
# Remove extension directory
rm -rf ~/.local/share/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com

# Verify removal
ls ~/.local/share/gnome-shell/extensions/ | grep grayscale
# Should return no results
```

#### 3. Remove Settings Schema

```bash
# Remove schema file
sudo rm /usr/share/glib-2.0/schemas/org.gnome.shell.extensions.grayscale-toggle.gschema.xml

# Recompile schemas
sudo glib-compile-schemas /usr/share/glib-2.0/schemas/

# Verify schema removal
gsettings list-schemas | grep grayscale-toggle
# Should return no results
```

#### 4. Clear User Settings

```bash
# Reset all extension settings (optional)
# Note: This will only work if schema is still installed
gsettings reset-recursively org.gnome.shell.extensions.grayscale-toggle

# Or manually remove from dconf (if schema already removed)
dconf reset -f /org/gnome/shell/extensions/grayscale-toggle/
```

#### 5. Clean Cache and Temporary Files

```bash
# Remove cache files
rm -rf ~/.cache/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com/

# Clear any temporary files
rm -f /tmp/*grayscale*
```

### Partial Removal (Keep Settings)

If you want to remove the extension but keep your settings:

```bash
# Disable extension
gnome-extensions disable grayscale-toggle@webaheadstudios.com

# Remove extension files only
rm -rf ~/.local/share/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com

# Keep schema and settings for future reinstallation
# (Don't remove schema file or reset settings)
```

### Verification of Complete Removal

```bash
# Check extension is gone
gnome-extensions list | grep grayscale-toggle
# Should return no results

# Check files are removed
find ~/.local/share/gnome-shell/extensions/ -name "*grayscale*"
# Should return no results

# Check schema is removed
gsettings list-schemas | grep grayscale-toggle
# Should return no results

# Check no remaining processes
ps aux | grep grayscale
# Should return only the grep command itself
```

---

## 📞 Getting Help

### Documentation Resources

- **[User Guide](user-guide.md)**: Complete usage instructions
- **[Developer Guide](developer-guide.md)**: Technical documentation
- **[Main README](../README.md)**: Project overview
- **GitHub Issues**:
  https://github.com/webaheadstudios/grayscale-gnome-extension/issues

### Community Support

- **GNOME Extensions IRC**: `#gnome-extensions` on irc.gnome.org
- **GitHub Discussions**: Community Q&A and feature requests
- **Extension Website**: User reviews and basic troubleshooting

### Before Seeking Help

Please provide the following information when reporting installation issues:

```bash
# System information
echo "OS: $(lsb_release -d | cut -f2)"
echo "GNOME Shell: $(gnome-shell --version)"
echo "Session: $XDG_SESSION_TYPE"
echo "Graphics: $(lspci | grep VGA)"

# Extension status
echo "Extension installed: $(test -d ~/.local/share/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com && echo 'Yes' || echo 'No')"
echo "Extension enabled: $(gnome-extensions list --enabled | grep -q grayscale-toggle && echo 'Yes' || echo 'No')"
echo "Schema installed: $(gsettings list-schemas | grep -q grayscale-toggle && echo 'Yes' || echo 'No')"

# Recent logs
echo "Recent errors:"
journalctl --since="30 minutes ago" -u gnome-shell@$(whoami).service | grep -i error | tail -5
```

---

**Installation complete!** Check out the [User Guide](user-guide.md) for
detailed usage instructions and the [Developer Guide](developer-guide.md) if
you're interested in contributing to the project.
