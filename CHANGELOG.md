## <small>1.0.2 (2026-02-27)</small>

- style(scripts): apply prettier formatting
  ([cf40c56](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/cf40c56))
- style(src): apply prettier formatting
  ([a9facf1](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/a9facf1))
- fix(lint): extend lint coverage to scripts/ and root config files
  ([fcc2b61](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/fcc2b61))
- fix(lint): resolve all ESLint errors for professional code quality
  ([9e5ac80](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/9e5ac80))
- chore(test): remove Jest test infrastructure
  ([e0c3728](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/e0c3728))
- ci: use same lint rules as development (not strict)
  ([10d0dba](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/10d0dba))
- build(deps): bump tar and semantic-release (#1)
  ([95ef809](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/95ef809)),
  closes
  [#1](https://github.com/webaheadstudios/grayscale-gnome-extension/issues/1)

## [1.0.1](https://github.com/webaheadstudios/grayscale-gnome-extension/compare/v1.0.0...v1.0.1) (2026-02-27)

### Bug Fixes

- **panel:** open preferences from panel menu
  ([027a955](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/027a9552429d62414836c884b12cfa084880c870))
- **panel:** refresh status after reset all
  ([98ca482](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/98ca4825ed763e53ebc3ee67c743bb1eb96b5c63))
- **state:** apply persisted grayscale on startup
  ([a2f8ef3](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/a2f8ef334fadd7790dabb421f352d6764df4b965))
- **state:** keep grayscale-enabled and global-enabled in sync
  ([0bc8e8f](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/0bc8e8f054ec1d170a426923655d9d8840988fb1))

## 1.0.0 (2026-02-26)

### Features

- add comprehensive CI/CD pipeline and automation
  ([5e76dfc](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/5e76dfc1e8d440902ff7ec164e6faae221df3287))
- add comprehensive multi-monitor support and hotplug handling
  ([5093cc8](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/5093cc8909dd1e6a77c143c2c17c103d24e8fb57))
- add comprehensive VSCode workspace configuration
  ([11d004f](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/11d004fc9949efd7417e8d8ef48a45df2d646083))
- add modern TypeScript development foundation
  ([e761096](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/e761096172ce9dc79f109e740b70129f620b66b3))
- complete Phase 2 TypeScript Migration - ALL 9 FILES CONVERTED!
  ([df751e7](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/df751e7e3c990b007877544347d8e7d16b310549))
- convert effectManager.js to TypeScript
  ([be06a8a](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/be06a8a5f41ed4b237d6cf017d44e786f721e737))
- convert extension.js to TypeScript - PHASE 2 MIGRATION COMPLETE!
  ([44cad9b](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/44cad9b5f15a5d6268f9cc894e48efe039f0e02a))
- convert monitorManager.js to TypeScript
  ([0a2f725](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/0a2f725888762bd524fed044f451d435fa148d9d))
- convert panelIndicator.js to TypeScript
  ([a3998e5](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/a3998e5e234dac7592b1bd3da193488ec4098196))
- convert prefs.js to TypeScript
  ([761db33](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/761db331cebaa87f2bfeb905f6fcd1c3e9eaea6d))
- convert quickSettingsIntegration.js to TypeScript
  ([74f260c](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/74f260c61522a5fe0c36f0b665d0b23b027b0642))
- convert settingsController.js to TypeScript
  ([201610a](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/201610a86b11e5e2b431cfbb2ab0dae76ddbc3b9))
- convert stateManager.js to TypeScript
  ([7e953c7](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/7e953c7746c9fb5be01cce9205f4459c45f05fcc))
- convert uiController.js to TypeScript
  ([7fb62b2](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/7fb62b22fc513d5a5414bcb1a3f3d776cfc77f43))
- **dev:** add nested shell workflow for Wayland extension development
  ([2e819f0](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/2e819f04a95a03b445fa6a4ac8cabd0d253e82f4))
- **extension:** add adjustAnimationTime, override keyword, getLogger
  ([c2a38fa](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/c2a38fae525adcf1309984dc3e9e6132873ac8ad)),
  closes
  [#2](https://github.com/webaheadstudios/grayscale-gnome-extension/issues/2)
  [#2](https://github.com/webaheadstudios/grayscale-gnome-extension/issues/2)
  [#2](https://github.com/webaheadstudios/grayscale-gnome-extension/issues/2)
- **icon:** add extension icon SVG and verify inclusion in build
  ([b786fa3](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/b786fa3e4e8d70a56c80becbdb6f7cbbd2858620))
- implement enterprise-grade component architecture
  ([0160d04](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/0160d042f636778f876b5dc979dc87c7f90273ed))
- implement Phase 1 core functionality with keyboard toggle
  ([783d7c1](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/783d7c14da677ef50f257af17c2eb67be8c46b2e))
- initial commit before TypeScript migration
  ([7d82078](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/7d820781d6fc4910e86eb9791cfa49e08c6b7657))
- initialize project structure with documentation
  ([1ac14ec](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/1ac14ec8553e98ca0d9438b9bcb56654cc2b1765))
- **install:** add Material Shell-inspired installation system
  ([e3e448a](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/e3e448a06b55eba83beb51508a5cb283d6ad58fd))
- migrate JavaScript codebase to TypeScript
  ([92a0b46](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/92a0b46704f088624e52788be1a8751d182a2161))
- **panel:** add disable extension item to panel indicator menu
  ([79e97a7](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/79e97a7dc006964530265a86598133878f44824b))
- **roo:** add comprehensive agent behavior and tool usage rules
  ([9269a94](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/9269a9486f98abe63a4f1b457fcaac05e3a5e3fd))

### Bug Fixes

- **attribution:** fix author field and license identifier in package.json
  ([0dfb5d9](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/0dfb5d93672130ff5631cb255a1379b18ee266a9))
- **build:** isolate test typings from production compile
  ([1a31991](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/1a3199168c71e62245620fe23b21348ec5d86ffc))
- **copyright:** add SPDX copyright headers to key runtime source files
  ([56d587c](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/56d587c94553eb83351d2cd0d961ae1d9f4a5bc9))
- **docs:** fix old repository URLs from luiz/ to webaheadstudios/
  ([cb4d744](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/cb4d7442e90655687df58519ff01c6cc20b6df35))
- **effect:** fix per-monitor grayscale toggle in panel menu
  ([9a5c896](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/9a5c896df77b4e2f5f941975bed191896c83bb61))
- **effect:** replace ease_property with direct factor assignment on
  DesaturateEffect
  ([2cd0764](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/2cd0764cc0433f51cf7656b61268c53a933f577a))
- **extension:** complete GObject.registerClass audit and fix all remaining
  subclasses
  ([6cd2201](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/6cd22012945840c254a196db25ce1283bd803797))
- **extension:** fix 6 runtime errors blocking grayscale toggle functionality
  ([e3bc425](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/e3bc425a00dac1a797e88d16f1910564cd6a2a86))
- **extension:** move Logger GObject construction from constructor to enable
  ([e7d43e3](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/e7d43e300988c0b7bbe95524e6e58297dd1ce97f))
- **extension:** register GObject classes correctly and fix GNOME Shell API
  calls
  ([a0100fe](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/a0100fe63dff8ee79721ae554d355602fbedab47))
- **extension:** replace all Node.js timers with GLib equivalents
  ([99919b4](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/99919b472cb499d84d0f3a5094a9f7b4509bbaae))
- **extension:** replace getLogger() with GrayscaleLogger for GNOME 46 compat
  ([54e2d08](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/54e2d08375a4dbbd0950cd50992edc1fb9419c8b))
- **husky:** update pre-commit and commit-msg hook format
  ([b9d77e6](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/b9d77e61d897c6dc90cb275dd407425ea58ebac7))
- **install:** use zip archive and handle Wayland enable gracefully
  ([c8b8e10](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/c8b8e10f60bdfee93868e93439a0faafb48fb5a2))
- **license:** update license references from GPL-3 to GPL-2.0-or-later
  ([884ad1a](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/884ad1adac4b4aa63fc9842022c57d6bb1903c51))
- **logging:** gate informational console.log behind debug-logging setting
  ([d729306](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/d729306b87a016aa6385ac35f48848717eea91c4))
- **meta:** add GNOME 45 to shell-version and remove duplicate schema keys
  ([fcfd8ac](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/fcfd8ac2544de8784303efb6b2eb975054a05196))
- **metadata:** improve EGO description and expand shell-version to 45-48
  ([98309bd](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/98309bd80f0f4cc75d2eb25a8b179cf5224661c2))
- **monitorManager:** wrap MonitorManager in GObject.registerClass()
  ([47c1fcc](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/47c1fcc0042ddd97a0994e378c25ff1be38c3840))
- **prefs:** audit and clean up shell-only globals in prefs context
  ([54cb7d8](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/54cb7d80125d206f5c3fe804a52169cf2661c2a1))
- **prefs:** complete preferences UI - replace placeholders with working
  controls
  ([58274f9](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/58274f9c8ed963f0e5948af889758c4bf4e2a91a))
- **prefs:** fix preferences window - remove async wrapper and register GTK
  subclasses
  ([4b7b863](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/4b7b863348d0bb786b487374b710a89c1d43dc90))
- **release:** reset metadata version to 0 as pre-release baseline and fix
  prepareCmd order
  ([ff2dd3e](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/ff2dd3e65b3f440dd21745c59a83253a73b2ca2f))
- resolve critical UUID and URL inconsistencies for release readiness
  ([5ee3ed7](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/5ee3ed750932c2d96093095129f6a683c2e9de73))
- **types:** align gir typings and local interfaces
  ([af66338](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/af663380eb6c8bf168fd2a1566a274e6b6cccf22))
- **ui:** disconnect UIController signal connections in destroy
  ([583bc71](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/583bc71a5d352903c987e7c232a0fd81ff59629f))
- **ui:** ensure panel indicator appears on extension activation
  ([2185e87](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/2185e8765b09e18b420682b61d658865887e4973))

### Documentation

- add AI agent guidance files for project and Roo modes
  ([f8fdd7e](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/f8fdd7e89dd63e2a412f2e682e775b01e89d0cbf))
- add comprehensive project documentation and complete Phase 3 UI
  ([eaa838f](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/eaa838f1a5430c0e2bdd7d6e69abe69b1c76aaee))
- **agents:** update AGENTS.md with GNOME-specific development rules
  ([10bb052](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/10bb0529cbefd2a00338adb5e9a531f94ecf061e))
- consolidate and standardize documentation for public release
  ([f11a25f](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/f11a25f89b9755ca8d6eee19f8e8d588d1bfacdb))
- **guides:** correct documentation gaps and add accurate patterns
  ([49735bc](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/49735bc743624183daaa58d10dec805c216c45e7))
- remove development-only files inappropriate for public repo
  ([1149de8](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/1149de8160ddb2c7ab63a5e4787b2abe811feca9))
- **roo:** create gnome-extension rules for all ai modes
  ([1cbe1e8](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/1cbe1e81d91f840236a698bd85fbb8842fb5f3b5))
- **rules:** update .roo/rules and AGENTS.md with gjsify guide patterns
  ([2da0452](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/2da045232ae17bae40c8edc6c34bb0301086e76c)),
  closes
  [#3](https://github.com/webaheadstudios/grayscale-gnome-extension/issues/3)
  [#3](https://github.com/webaheadstudios/grayscale-gnome-extension/issues/3)
  [#3](https://github.com/webaheadstudios/grayscale-gnome-extension/issues/3)
- **rules:** update AGENTS.md and gnome-extension.md with review compliance
  rules
  ([c92c7ba](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/c92c7ba5b5dfe060f67a709f15ea13ba62a9bcc4))
- update README with comprehensive modernization achievements
  ([ba00823](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/ba008239f1618e04c7ed05ef63c930c0ae674942))

### Code Refactoring

- **cleanup:** remove unused code and simplify AI patterns for EGO submission
  ([e5b4a87](https://github.com/webaheadstudios/grayscale-gnome-extension/commit/e5b4a87d4928c834ac28f261b86cfa7ed2536959))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).
