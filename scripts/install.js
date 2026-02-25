#!/usr/bin/env node

import chalk from 'chalk';
import { execSync } from 'child_process';
import {
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    realpathSync,
    rmSync,
    symlinkSync,
} from 'fs';
import { homedir, tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PROJECT_ROOT = join(__dirname, '..');
const DIST_DIR = join(PROJECT_ROOT, 'dist');
const EXTENSION_UUID = 'grayscale-toggle@webaheadstudios.com';
const EXTENSIONS_DIR = join(homedir(), '.local/share/gnome-shell/extensions');
const INSTALL_PATH = join(EXTENSIONS_DIR, EXTENSION_UUID);

// Parse command line arguments
const isUninstall = process.argv.includes('--uninstall');
const isEnable = process.argv.includes('--enable');
const isDisable = process.argv.includes('--disable');
const isStatus = process.argv.includes('--status');
const isDev = process.argv.includes('--dev');
const isSymlink = process.argv.includes('--symlink') || isDev;

// Utilities
function log(message, ...args) {
    console.log(chalk.blue('🔧'), chalk.cyan(message), ...args);
}

function error(message, ...args) {
    console.error(chalk.red('❌'), chalk.red.bold(message), ...args);
    process.exit(1);
}

function success(message, ...args) {
    console.log(chalk.green('✅'), chalk.green.bold(message), ...args);
}

function warn(message, ...args) {
    console.log(chalk.yellow('⚠️'), chalk.yellow(message), ...args);
}

function info(message, ...args) {
    console.log(chalk.blue('ℹ️'), chalk.blue(message), ...args);
}

function exec(command, options = {}) {
    try {
        return execSync(command, {
            stdio: 'inherit',
            encoding: 'utf8',
            cwd: PROJECT_ROOT,
            ...options,
        });
    } catch (err) {
        throw new Error(`Command failed: ${command}\n${err.message}`);
    }
}

function execSilent(command, options = {}) {
    try {
        return execSync(command, {
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: PROJECT_ROOT,
            ...options,
        });
    } catch (_err) {
        return null;
    }
}

// Environment validation
function checkDependencies() {
    log('Checking system dependencies...');

    // Check for gnome-extensions tool
    if (!execSilent('which gnome-extensions')) {
        error(
            'gnome-extensions tool not found. Please install gnome-shell-extension-manager or gnome-shell-common package.'
        );
    }

    // Check for GNOME Shell
    const gnomeShellVersion = execSilent('gnome-shell --version');
    if (!gnomeShellVersion) {
        warn('Could not detect GNOME Shell version. Installation may fail.');
    } else {
        const versionMatch = gnomeShellVersion.match(/(\d+\.\d+)/);
        if (versionMatch) {
            const version = parseFloat(versionMatch[1]);
            info(`Detected GNOME Shell ${version}`);

            if (version < 46.0) {
                error(
                    `GNOME Shell ${version} is not supported. This extension requires GNOME Shell 46 or newer.`
                );
            }
        }
    }

    // Check current session type
    const sessionType = process.env.XDG_SESSION_TYPE || 'unknown';
    info(`Running on ${sessionType} session`);

    success('System dependencies check passed');
}

function detectWindowManager() {
    try {
        const sessionType = process.env.XDG_SESSION_TYPE;
        if (sessionType) {
            return sessionType.toLowerCase();
        }

        // Fallback detection
        if (process.env.WAYLAND_DISPLAY) {
            return 'wayland';
        } else if (process.env.DISPLAY) {
            return 'x11';
        }

        return 'unknown';
    } catch (_err) {
        return 'unknown';
    }
}

function getExtensionStatus() {
    try {
        const output = execSilent(`gnome-extensions show ${EXTENSION_UUID}`);
        if (!output) {
            return 'not-installed';
        }

        const lines = output.split('\n');
        const stateLine = lines.find(line => line.trim().startsWith('State:'));

        if (stateLine) {
            const state = stateLine.split(':')[1].trim().toLowerCase();
            return state;
        }

        return 'unknown';
    } catch (_err) {
        return 'not-installed';
    }
}

function enableExtension() {
    log(`Enabling extension ${EXTENSION_UUID}...`);

    try {
        exec(`gnome-extensions enable ${EXTENSION_UUID}`);
        success('Extension enabled successfully');

        const windowManager = detectWindowManager();
        if (windowManager === 'x11') {
            log('Restarting GNOME Shell...');
            try {
                exec('killall -SIGQUIT gnome-shell', { stdio: 'pipe' });
                success('GNOME Shell restarted');
            } catch (_err) {
                warn(
                    'Failed to restart GNOME Shell automatically. Press Alt+F2, type "r", then Enter to restart manually.'
                );
            }
        } else {
            warn('Running on Wayland. To test without logging out:');
            warn('  Run in a new terminal: dbus-run-session gnome-shell --nested --wayland');
            info('Or log out and log back in for the production session.');
        }
    } catch (err) {
        error('Failed to enable extension:', err.message);
    }
}

function disableExtension() {
    log(`Disabling extension ${EXTENSION_UUID}...`);

    try {
        exec(`gnome-extensions disable ${EXTENSION_UUID}`);
        success('Extension disabled successfully');
    } catch (err) {
        error('Failed to disable extension:', err.message);
    }
}

function showStatus() {
    const status = getExtensionStatus();
    const windowManager = detectWindowManager();

    console.log('\n' + '='.repeat(60));
    info('Extension Status');
    console.log('='.repeat(60));
    console.log(`🆔 UUID: ${EXTENSION_UUID}`);
    console.log(`📍 Install Path: ${INSTALL_PATH}`);
    console.log(`📊 Status: ${status}`);
    console.log(`🖥️  Session Type: ${windowManager}`);

    if (existsSync(INSTALL_PATH)) {
        try {
            const stats = lstatSync(INSTALL_PATH);
            if (stats.isSymbolicLink()) {
                const target = realpathSync(INSTALL_PATH);
                console.log(`🔗 Symlink Target: ${target}`);
                console.log('🛠️  Install Type: Development (symlinked)');
            } else {
                console.log('📁 Install Type: Production (copied files)');
            }
        } catch (err) {
            console.log(`❓ Install Type: Unknown (${err.message})`);
        }
    } else {
        console.log('📁 Install Type: Not installed');
    }

    console.log('='.repeat(60) + '\n');
}

function removeExistingInstall() {
    // Check if the path exists at all (file, directory, or symlink)
    try {
        const stats = lstatSync(INSTALL_PATH);
        log('Removing existing installation...');

        if (stats.isSymbolicLink()) {
            rmSync(INSTALL_PATH, { force: true });
            log('Removed existing symlink');
        } else {
            rmSync(INSTALL_PATH, { recursive: true, force: true });
            log('Removed existing directory');
        }
    } catch (err) {
        // Path doesn't exist, which is fine - nothing to remove
        if (err.code === 'ENOENT') {
            return;
        }
        warn(`Could not remove existing installation: ${err.message}`);
    }
}

function installExtension() {
    log('Installing extension...');

    // Ensure extensions directory exists
    mkdirSync(EXTENSIONS_DIR, { recursive: true });

    // Check if distribution exists
    if (!existsSync(DIST_DIR)) {
        error('Distribution directory not found. Run "npm run build" first.');
    }

    if (isSymlink) {
        // Development installation - create symlink (bypasses gnome-extensions install)
        removeExistingInstall();
        log('Creating development symlink...');
        try {
            symlinkSync(realpathSync(DIST_DIR), INSTALL_PATH);
            success(`Extension symlinked from ${DIST_DIR}`);

            // Compile schemas directly since we skipped gnome-extensions install
            const schemasPath = join(INSTALL_PATH, 'schemas');
            if (existsSync(schemasPath)) {
                log('Compiling GSettings schemas...');
                try {
                    exec(`glib-compile-schemas "${schemasPath}"`, { stdio: 'pipe' });
                    success('Schemas compiled successfully');
                } catch (_err) {
                    warn('Schema compilation failed, but extension may still work');
                }
            }
        } catch (err) {
            error(`Failed to create symlink: ${err.message}`);
        }
    } else {
        // Production installation via gnome-extensions install (gTile pattern)
        // This properly notifies GNOME Shell via D-Bus to load the new extension
        const tmpDir = mkdtempSync(join(tmpdir(), 'gnome-ext-'));
        const archivePath = join(tmpDir, `${EXTENSION_UUID}.tgz`);

        log('Creating extension archive...');
        try {
            exec(`tar -czf "${archivePath}" -C "${DIST_DIR}" .`);
            success(`Archive created: ${archivePath}`);
        } catch (err) {
            error(`Failed to create archive: ${err.message}`);
        }

        log('Installing via gnome-extensions install --force...');
        try {
            exec(`gnome-extensions install --force "${archivePath}"`);
            success(`Extension installed to ${INSTALL_PATH}`);
        } catch (err) {
            error(`Failed to install extension: ${err.message}`);
        }

        // Clean up temp archive
        try {
            rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {
            /* ignore cleanup errors */
        }
    }

    success('Extension installation completed');
}

function uninstallExtension() {
    log('Uninstalling extension...');

    // First disable the extension
    const status = getExtensionStatus();
    if (status === 'enabled') {
        disableExtension();
    }

    // Remove installation
    removeExistingInstall();

    if (existsSync(INSTALL_PATH)) {
        error('Failed to completely remove extension installation');
    } else {
        success('Extension uninstalled successfully');
    }
}

function runBuild() {
    log('Building extension...');
    try {
        exec('npm run build:prod');
        success('Build completed');
    } catch (err) {
        error('Build failed:', err.message);
    }
}

// Main function
async function main() {
    try {
        console.log(chalk.bold.magenta('\n🔧 GNOME Extension Installation Manager\n'));

        if (isStatus) {
            checkDependencies();
            showStatus();
            return;
        }

        if (isUninstall) {
            checkDependencies();
            uninstallExtension();
            return;
        }

        if (isEnable) {
            checkDependencies();
            enableExtension();
            return;
        }

        if (isDisable) {
            checkDependencies();
            disableExtension();
            return;
        }

        // Default: install extension
        checkDependencies();

        // If this is a dev install or symlink is requested, we need the build directory, not a package
        if (isSymlink && !existsSync(DIST_DIR)) {
            warn('Distribution directory not found, building...');
            runBuild();
        }

        installExtension();

        if (isSymlink) {
            // Symlink installs need a manual enable since gnome-extensions install wasn't used
            const status = getExtensionStatus();
            if (status !== 'enabled') {
                enableExtension();
            } else {
                success('Extension is already enabled');
            }
        }
        // For non-symlink installs, gnome-extensions install --force handles enable automatically

        console.log('\n' + chalk.green.bold('🎉 Installation completed successfully!'));

        if (isDev) {
            info('Development mode: Extension is symlinked for easy development');
            info('Changes to source files will be reflected after recompiling');
            info(
                'Development cycle: npm run build:dev → restart nested shell (npm run dev:nested)'
            );
        }
    } catch (err) {
        error('Installation failed:', err.message);
    }
}

// Execute main function
main();
