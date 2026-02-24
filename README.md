# Grayscale GNOME Extension

A GNOME Shell extension that toggles grayscale display across all monitors for improved focus and reduced dopamine stimulation.

## Overview

This extension provides a simple way to toggle grayscale mode system-wide, helping users maintain focus by reducing visual distractions and dopamine triggers from colorful interfaces. The extension integrates seamlessly with the GNOME Shell environment and provides convenient access through the system panel.

## Features

- **System-wide grayscale toggle**: Apply grayscale filter to all connected monitors
- **Quick access**: Toggle through GNOME Shell panel integration
- **Multi-monitor support**: Works across all displays simultaneously
- **Focus enhancement**: Reduces visual distractions for improved productivity
- **Minimal performance impact**: Efficient implementation using native GNOME APIs

## System Requirements

- **GNOME Shell**: Version 46.0 or later
- **Session Type**: Wayland (recommended) or X11
- **Architecture**: x86_64
- **Operating System**: Ubuntu 24.04 LTS or compatible Linux distribution

## Installation

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd grayscale-gnome-extension

# Install to user extensions directory
cp -r src/* ~/.local/share/gnome-shell/extensions/grayscale-extension@<your-domain>

# Enable the extension
gnome-extensions enable grayscale-extension@<your-domain>

# Restart GNOME Shell (for X11 sessions)
# Alt+F2, type 'r', press Enter
```

### From Extensions Website

This extension will be available on the GNOME Extensions website once development is complete.

## Project Structure

```
grayscale-gnome-extension/
├── src/                    # Extension source code
│   ├── extension.js        # Main extension logic
│   ├── metadata.json       # Extension metadata
│   └── prefs.js           # Preferences window
├── schemas/               # GSettings schemas
│   └── org.gnome.shell.extensions.grayscale.gschema.xml
├── po/                    # Translation files
│   ├── POTFILES.in
│   └── LINGUAS
├── docs/                  # Documentation
│   └── system-environment-assessment.md
└── README.md
```

## Development

### Prerequisites

The development environment has been assessed and confirmed compatible:

- **GNOME Shell**: 46.0 ✅
- **GJS Runtime**: 1.80.2 ✅  
- **Development Tools**: Complete toolchain available ✅
- **GObject Introspection**: Full library access ✅

See [`docs/system-environment-assessment.md`](docs/system-environment-assessment.md) for detailed environment analysis.

### Building

```bash
# Compile GSettings schema (if modified)
glib-compile-schemas schemas/

# Package the extension
make dist
```

### Testing

```bash
# Enable debug logging
gnome-extensions enable grayscale-extension@<your-domain> --verbose

# Check logs
journalctl -f -o cat /usr/bin/gnome-shell
```

## Configuration

The extension can be configured through GNOME Extensions preferences:

- **Toggle shortcut**: Customize keyboard shortcut
- **Animation duration**: Configure transition effects
- **Auto-enable**: Start with grayscale enabled

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Commit using conventional commits: `git commit -m "feat: add new feature"`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- GNOME Shell development team for the excellent extension APIs
- Community contributors and testers
- Inspired by the need for distraction-free computing environments

## Support

- **Issues**: Report bugs and feature requests through GitHub Issues
- **Documentation**: See the `docs/` directory for technical details
- **Community**: Join the discussion in project discussions

---

**Note**: This extension is currently in development. Features and APIs may change before the stable release.