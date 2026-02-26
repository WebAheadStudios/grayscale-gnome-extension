# Contributing to Grayscale Toggle

> **Welcome contributors!** We appreciate your interest in improving the GNOME
> Shell Grayscale Toggle Extension. This guide will help you contribute
> effectively to the project.

## 📋 Table of Contents

1. [Getting Started](#-getting-started)
2. [Development Setup](#-development-setup)
3. [Contribution Types](#-contribution-types)
4. [Development Workflow](#-development-workflow)
5. [Code Standards](#-code-standards)
6. [Testing Requirements](#-testing-requirements)
7. [Documentation Guidelines](#-documentation-guidelines)
8. [Community Guidelines](#-community-guidelines)

---

## 🚀 Getting Started

### Before You Start

1. **Read the Documentation**: Familiarize yourself with the project by reading:
    - [README.md](README.md) - Project overview and features
    - [docs/user-guide.md](docs/user-guide.md) - User experience and
      functionality
    - [docs/developer-guide.md](docs/developer-guide.md) - Technical
      architecture

2. **Check Existing Issues**: Browse
   [GitHub Issues](https://github.com/webaheadstudios/grayscale-gnome-extension/issues)
   to see:
    - Current bug reports and feature requests
    - Issues labeled `good-first-issue` for newcomers
    - Issues labeled `help-wanted` for community contributions

3. **Join the Discussion**: Engage with the community:
    - Comment on existing issues you're interested in
    - Ask questions in
      [GitHub Discussions](https://github.com/webaheadstudios/grayscale-gnome-extension/discussions)
    - Join `#gnome-extensions` on
      [irc.gnome.org](https://wiki.gnome.org/Community/GettingInTouch/IRC)

### Prerequisites

**Required Knowledge:**

- **TypeScript**: Modern TypeScript features and patterns
- **GNOME Shell Extensions**: Understanding of GJS and extension architecture
- **Git**: Version control and collaborative development workflows
- **Linux Desktop**: Experience with GNOME Shell and desktop environments

**Helpful Background:**

- **GObject**: GNOME's object-oriented framework
- **GTK4**: Modern GNOME user interface development
- **Multi-monitor setups**: Experience with complex display configurations
- **Digital wellness**: Understanding of distraction-free computing

---

## 🛠 Development Setup

### Environment Setup

1. **Install Prerequisites**:

    ```bash
    # Ubuntu/Debian
    sudo apt install gnome-shell-extensions gjs libglib2.0-dev nodejs npm git

    # Fedora
    sudo dnf install gnome-shell gjs glib2-devel nodejs npm git

    # Arch Linux
    sudo pacman -S gnome-shell gjs glib2 nodejs npm git
    ```

2. **Fork and Clone**:

    ```bash
    # Fork the repository on GitHub
    # Then clone your fork
    git clone https://github.com/YOUR_USERNAME/grayscale-gnome-extension.git
    cd grayscale-gnome-extension
    ```

3. **Development Installation**:

    ```bash
    # Create symlink for development
    mkdir -p ~/.local/share/gnome-shell/extensions
    ln -sf "$(pwd)/src" ~/.local/share/gnome-shell/extensions/grayscale-toggle@webaheadstudios.com

    # Install schema
    sudo cp schemas/org.gnome.shell.extensions.grayscale-toggle.gschema.xml \
        /usr/share/glib-2.0/schemas/
    sudo glib-compile-schemas /usr/share/glib-2.0/schemas/

    # Enable extension
    gnome-extensions enable grayscale-toggle@webaheadstudios.com
    ```

4. **Development Tools**:

    ```bash
    # Install development dependencies
    npm install -g typescript eslint

    # Set up environment variables
    export GNOME_SHELL_DEVELOPMENT=true
    export G_MESSAGES_DEBUG=all
    ```

### Development Environment

#### Live Development Workflow

```bash
# Monitor extension logs
journalctl -f -o cat /usr/bin/gnome-shell | grep -i grayscale &

# Make changes to source files...

# Quick extension restart (preserves state)
gnome-extensions disable grayscale-toggle@webaheadstudios.com && \
gnome-extensions enable grayscale-toggle@webaheadstudios.com

# Full shell restart (X11 only - Alt+F2, type 'r', Enter)
```

#### Code Quality Tools

```bash
# Type checking (before commits)
npx tsc --noEmit

# Linting
eslint src/**/*.js

# Schema validation
glib-compile-schemas --strict schemas/

# Extension validation
gnome-extensions info grayscale-toggle@webaheadstudios.com
```

---

## 🤝 Contribution Types

### Code Contributions

#### Bug Fixes

- **Critical Bugs**: Extension crashes, data loss, security issues
- **Compatibility Issues**: GNOME Shell version compatibility
- **Performance Problems**: Memory leaks, slow animations
- **Multi-Monitor Issues**: Display detection, hotplug handling

#### Feature Development

- **Core Features**: Effect improvements, new visual modes
- **User Interface**: Preferences enhancements, new UI components
- **Multi-Monitor**: Advanced display management features
- **Performance**: Optimization and efficiency improvements

#### Refactoring and Maintenance

- **Code Quality**: Architecture improvements, cleanup
- **Documentation**: Code comments, API documentation
- **Testing**: Unit tests, integration tests
- **Localization**: Translation support and management

### Non-Code Contributions

#### Documentation

- **User Documentation**: Usage guides, troubleshooting
- **Developer Documentation**: API docs, architecture guides
- **Installation Guides**: Platform-specific instructions
- **Examples**: Sample configurations, use cases

#### Testing and Quality Assurance

- **Bug Reports**: Detailed issue descriptions with reproduction steps
- **Feature Testing**: Validation of new functionality
- **Platform Testing**: Different Linux distributions and hardware
- **Performance Testing**: Benchmarking and optimization validation

#### Community Support

- **Issue Triage**: Helping organize and prioritize bug reports
- **User Support**: Answering questions in discussions and issues
- **Documentation Review**: Proofreading and improving guides
- **Translation**: Internationalization support

---

## 🔄 Development Workflow

### Issue-Based Development

1. **Create or Claim an Issue**:
    - For bugs: Use the bug report template
    - For features: Use the feature request template
    - For discussions: Use GitHub Discussions
    - Comment on existing issues to indicate interest

2. **Planning Phase**:
    - Discuss approach in issue comments
    - Get maintainer approval for significant changes
    - Break down complex features into smaller tasks
    - Consider impact on existing functionality

### Git Workflow

#### Branch Strategy

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/description-of-change

# Work on your changes...

# Keep feature branch updated
git checkout main
git pull origin main
git checkout feature/description-of-change
git rebase main  # or merge, depending on preference
```

#### Branch Naming Convention

- **Features**: `feature/quick-settings-improvements`
- **Bug fixes**: `fix/panel-indicator-positioning`
- **Documentation**: `docs/update-installation-guide`
- **Refactoring**: `refactor/state-manager-simplification`
- **Performance**: `perf/optimize-effect-application`

### Commit Message Format

We follow [Conventional Commits](https://conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types

- **feat**: New feature for users
- **fix**: Bug fix for users
- **docs**: Documentation changes
- **style**: Code formatting (no logic changes)
- **refactor**: Code restructuring (no behavior changes)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Build system or dependency changes
- **ci**: CI/CD pipeline changes
- **chore**: Maintenance tasks

#### Examples

```bash
# Feature additions
git commit -m "feat(ui): add Quick Settings integration for GNOME 46"
git commit -m "feat(monitor): implement hotplug detection system"

# Bug fixes
git commit -m "fix(animation): resolve timing issues on NVIDIA drivers"
git commit -m "fix(memory): prevent leak during rapid toggling"

# Documentation
git commit -m "docs(guide): add troubleshooting section for multi-monitor"

# Performance
git commit -m "perf(effects): optimize batch application for multiple monitors"
```

### Pull Request Process

#### Before Submitting

```bash
# Ensure code quality
npx tsc --noEmit          # Type check
eslint src/**/*.js        # Lint check
npm test                  # Run tests (if available)

# Test functionality
gnome-extensions disable grayscale-toggle@webaheadstudios.com
gnome-extensions enable grayscale-toggle@webaheadstudios.com
# Verify your changes work as expected
```

#### Pull Request Template

```markdown
## Summary

Brief description of changes and motivation.

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (change that causes existing functionality to break)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring/code quality improvement

## Changes Made

- Specific change 1
- Specific change 2
- etc.

## Testing Performed

- [ ] Manual testing completed
- [ ] Extension enables/disables cleanly
- [ ] All features work as expected
- [ ] No errors in console logs
- [ ] Tested on [specify GNOME Shell version]

## Documentation Updated

- [ ] Code comments added/updated
- [ ] User documentation updated (if needed)
- [ ] API documentation updated (if needed)

## Screenshots (if applicable)

[Include relevant screenshots for UI changes]

## Additional Notes

Any additional information about the changes.
```

---

## 📏 Code Standards

### TypeScript Style Guidelines

#### General Formatting

```javascript
// Use 2 spaces for indentation (never tabs)
// Follow existing code style in the project

class ExampleComponent extends GObject.Object {
    constructor(extension) {
        super();
        this._extension = extension;
        this._initialized = false;
    }

    async initialize() {
        if (this._initialized) return;

        try {
            await this._performSetup();
            this._initialized = true;
        } catch (error) {
            console.error('Initialization failed:', error);
            throw error;
        }
    }
}
```

#### Naming Conventions

- **Classes**: PascalCase (`StateManager`, `EffectManager`)
- **Methods**: camelCase (`getMonitorState`, `applyEffect`)
- **Properties**: camelCase with underscore prefix for private (`_settings`,
  `_monitors`)
- **Constants**: SCREAMING_SNAKE_CASE (`DEFAULT_ANIMATION_DURATION`)
- **Signals**: kebab-case (`'state-changed'`, `'monitor-added'`)
- **Files**: camelCase (`stateManager.js`, `effectManager.js`)

#### Code Organization

```javascript
// File structure order:
// 1. Imports
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// 2. Constants
const DEFAULT_TIMEOUT = 300;

// 3. Private functions (if any)
function _helperFunction() {
    // Implementation
}

// 4. Main class
export class ComponentName extends GObject.Object {
    // Class implementation
}
```

### Documentation Standards

#### JSDoc Comments

```javascript
/**
 * Apply grayscale effect to specific monitor
 *
 * @param {number} monitorIndex - Zero-based monitor index
 * @param {Object} options - Effect options
 * @param {number} options.intensity - Grayscale intensity (0.0-1.0)
 * @param {number} options.duration - Animation duration in ms
 * @param {boolean} options.animated - Whether to animate transition
 * @returns {Promise<boolean>} Promise resolving to success state
 * @throws {Error} If monitor index is invalid or effect fails
 *
 * @example
 * // Apply full grayscale to primary monitor
 * await effectManager.applyMonitorEffect(0, {
 *     intensity: 1.0,
 *     duration: 300,
 *     animated: true
 * });
 */
async applyMonitorEffect(monitorIndex, options = {}) {
    // Implementation...
}
```

#### Code Comments

```javascript
// Good: Explain why, not what
// Use per-monitor state to handle complex display configurations
this._monitorStates = new Map();

// Good: Explain complex logic
// Batch monitor operations to prevent race conditions during hotplug
await this._queue.process(operations);

// Bad: Obvious comments
// Set variable to true
this._enabled = true;
```

### Error Handling Standards

#### Comprehensive Error Handling

```javascript
async performOperation() {
    try {
        await this._riskyOperation();
    } catch (error) {
        // Log error with context
        console.error(`[${this.constructor.name}] Operation failed:`, error);

        // Clean up if needed
        this._cleanup();

        // Re-throw or handle gracefully
        throw new Error(`Operation failed: ${error.message}`);
    }
}
```

#### Graceful Degradation

```javascript
// Attempt advanced feature, fall back to basic functionality
try {
    await this._useAdvancedAPI();
} catch (error) {
    console.warn('Advanced API unavailable, using fallback');
    await this._useBasicAPI();
}
```

---

## 🧪 Testing Requirements

### Manual Testing Checklist

#### Basic Functionality

```markdown
- [ ] Extension enables without errors
- [ ] Extension disables cleanly
- [ ] Global grayscale toggle works
- [ ] Keyboard shortcuts function
- [ ] Settings persist across sessions
```

#### Multi-Monitor Testing

```markdown
- [ ] All monitors detected correctly
- [ ] Per-monitor mode works independently
- [ ] Hotplug events handled properly
- [ ] Display configuration changes handled
- [ ] Effects apply to correct monitors
```

#### Performance Testing

```markdown
- [ ] No significant CPU usage increase
- [ ] Animations are smooth (>30fps)
- [ ] Memory usage remains stable
- [ ] No memory leaks after extended use
```

### Automated Testing (Future)

#### Unit Tests

```javascript
// Example test structure (when test framework is added)
describe('StateManager', () => {
    test('should initialize with correct defaults', () => {
        const stateManager = new StateManager(mockExtension);
        expect(stateManager.getGlobalState()).toBe(false);
    });
});
```

#### Integration Tests

- Extension lifecycle testing
- Multi-monitor scenario testing
- Settings persistence validation
- Performance benchmarking

---

## 📖 Documentation Guidelines

### Documentation Types

#### Code Documentation

- **JSDoc**: All public APIs must have complete JSDoc comments
- **Inline Comments**: Explain complex logic and design decisions
- **Architecture Notes**: Document component interactions and patterns

#### User Documentation

- **Clear Instructions**: Step-by-step procedures with expected outcomes
- **Screenshots**: Visual aids for UI explanations (text descriptions)
- **Troubleshooting**: Common issues and solutions
- **Examples**: Real-world usage scenarios

#### Developer Documentation

- **Setup Guides**: Complete development environment instructions
- **Architecture Overviews**: Component relationships and data flow
- **API References**: Complete interface documentation
- **Contribution Guides**: How to participate in development

### Documentation Standards

#### Writing Style

- **Clear and Concise**: Use simple, direct language
- **Active Voice**: Prefer active voice over passive
- **Consistent Terminology**: Use the same terms throughout documentation
- **Inclusive Language**: Welcome all community members

#### Structure

```markdown
# Document Title

> Brief description of the document's purpose

## Table of Contents

[Clear navigation for longer documents]

## Main Sections

[Logical organization of content]

### Subsections

[Detailed information with examples]

---

## Related Resources

[Links to related documentation]
```

---

## 🌟 Community Guidelines

### Code of Conduct

We follow the
[GNOME Code of Conduct](https://wiki.gnome.org/Foundation/CodeOfConduct):

#### Core Principles

- **Be Respectful**: Treat all community members with dignity and respect
- **Be Collaborative**: Work together constructively and help others
- **Be Considerate**: Think about how your actions affect others
- **Be Patient**: Remember that everyone is learning and contributing
  voluntarily

#### Unacceptable Behavior

- Harassment, discrimination, or personal attacks
- Trolling, insulting comments, or intentional disruption
- Publishing private information without consent
- Any conduct that creates an unwelcoming environment

### Communication Guidelines

#### Issue Discussions

- **Be Specific**: Provide detailed information and reproduction steps
- **Be Constructive**: Focus on solutions and improvements
- **Be Patient**: Allow time for responses and testing
- **Stay On Topic**: Keep discussions relevant to the specific issue

#### Pull Request Reviews

- **Be Thorough**: Review both functionality and code quality
- **Be Educational**: Explain suggestions and share knowledge
- **Be Respectful**: Provide constructive feedback
- **Be Timely**: Respond to reviews within reasonable timeframes

### Recognition and Attribution

#### Contributors

- All contributors are acknowledged in release notes
- Significant contributors may be invited to become maintainers
- Community contributions are highlighted in project documentation

#### Credit Guidelines

- Original authors are credited for their work
- Derived work acknowledges sources appropriately
- Community feedback and suggestions are recognized

---

## 🎯 Getting Help

### Resources

#### Documentation

- [User Guide](docs/user-guide.md) - Complete usage instructions
- [Developer Guide](docs/developer-guide.md) - Technical architecture
- [Installation Guide](docs/installation-guide.md) - Setup procedures

#### Community Support

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community support
- **IRC**: `#gnome-extensions` on irc.gnome.org
- **GNOME Discourse**: General GNOME development discussions

### Mentorship

#### New Contributors

- Look for issues labeled `good-first-issue`
- Ask questions in issue comments or discussions
- Request guidance on implementation approaches
- Pair with experienced contributors when possible

#### Experienced Developers

- Consider mentoring newcomers
- Share knowledge through documentation
- Help with code reviews and architectural decisions
- Contribute to project planning and roadmap development

---

## 📝 Issue Templates

### Bug Report Template

````markdown
**Describe the bug** A clear and concise description of what the bug is.

**To Reproduce** Steps to reproduce the behavior:

1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected behavior** A clear and concise description of what you expected to
happen.

**Environment:**

- OS and version: [e.g. Ubuntu 24.04]
- GNOME Shell version: [e.g. 46.0]
- Extension version: [e.g. 1.0.0]
- Graphics hardware: [e.g. NVIDIA GTX 1060]
- Number of monitors: [e.g. 2]

**Console Output**

```bash
# Include relevant logs from:
journalctl -f -o cat /usr/bin/gnome-shell | grep -i grayscale
```
````

**Additional context** Add any other context about the problem here.

````

### Feature Request Template

```markdown
**Feature Description**
A clear and concise description of the feature you'd like to see.

**Use Case**
Describe the problem this feature would solve or the workflow it would enable.

**Proposed Solution**
Describe how you envision this feature working.

**Alternatives Considered**
Describe any alternative solutions or features you've considered.

**Implementation Ideas**
If you have technical ideas about implementation, share them here.

**Additional context**
Add any other context, mockups, or examples about the feature request.
````

---

## 🎉 Thank You

Thank you for your interest in contributing to the Grayscale Toggle extension!
Every contribution, whether it's code, documentation, testing, or community
support, helps make this project better for everyone.

### Recognition

Your contributions will be:

- Acknowledged in release notes and change logs
- Credited in the project's contributor list
- Appreciated by the entire community of users

### Questions?

If you have any questions about contributing, don't hesitate to:

- Open a discussion on GitHub
- Comment on relevant issues
- Join the IRC channel for real-time discussion

**Project Repository**:
https://github.com/webaheadstudios/grayscale-gnome-extension **License**:
GPL-2.0-or-later (see [LICENSE](LICENSE))

---

_Happy coding, and thank you for helping create a more focused, distraction-free
computing experience!_
