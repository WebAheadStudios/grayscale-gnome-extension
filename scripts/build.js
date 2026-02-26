#!/usr/bin/env node

import chalk from 'chalk';
import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'fs';
import { createRequire } from 'module';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PROJECT_ROOT = join(__dirname, '..');
const BUILD_DIR = join(PROJECT_ROOT, 'build');
const DIST_DIR = join(PROJECT_ROOT, 'dist');
const SRC_DIR = join(PROJECT_ROOT, 'src');
const SCHEMAS_DIR = join(PROJECT_ROOT, 'schemas');
const PO_DIR = join(PROJECT_ROOT, 'po');

// Parse command line arguments
const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

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

function step(stepNumber, total, message) {
    const progress = chalk.magenta(`[${stepNumber}/${total}]`);
    console.log(progress, chalk.bold(message));
}

function exec(command, options = {}) {
    try {
        return execSync(command, {
            stdio: 'inherit',
            cwd: PROJECT_ROOT,
            ...options,
        });
    } catch (err) {
        error(`Command failed: ${command}`);
    }
}

function execSilent(command, options = {}) {
    try {
        return execSync(command, {
            encoding: 'utf8',
            cwd: PROJECT_ROOT,
            ...options,
        });
    } catch (err) {
        return null;
    }
}

// Build steps
async function cleanBuild() {
    log('Cleaning previous builds...');

    if (existsSync(BUILD_DIR)) {
        rmSync(BUILD_DIR, { recursive: true, force: true });
    }
    if (existsSync(DIST_DIR)) {
        rmSync(DIST_DIR, { recursive: true, force: true });
    }

    mkdirSync(BUILD_DIR, { recursive: true });
    mkdirSync(DIST_DIR, { recursive: true });
}

async function validateTypeScript() {
    log('Running TypeScript validation...');

    if (!existsSync(join(PROJECT_ROOT, 'tsconfig.json'))) {
        log('No tsconfig.json found, skipping TypeScript validation');
        return;
    }

    try {
        exec('npx tsc --noEmit');
        success('TypeScript validation passed');
    } catch (err) {
        error('TypeScript validation failed');
    }
}

async function runLinting() {
    log('Running ESLint...');

    try {
        exec('npx eslint src/ --max-warnings 0');
        success('Linting passed');
    } catch (err) {
        error('Linting failed');
    }
}

async function copySourceFiles() {
    log('Copying source files...');

    // Copy all source files (including icon.svg and metadata.json)
    cpSync(SRC_DIR, BUILD_DIR, {
        recursive: true,
        filter: (src, dest) => {
            // Skip TypeScript files in production (we'll use compiled JS)
            if (isProduction && src.endsWith('.ts')) {
                return false;
            }
            return true;
        },
    });

    // Verify icon.svg was included
    const iconDest = join(BUILD_DIR, 'icon.svg');
    if (existsSync(iconDest)) {
        log('Extension icon (icon.svg) included in build');
    } else {
        warn('icon.svg not found in src/ — extension may lack a panel icon');
    }

    success('Source files copied');
}

async function compileSchemas() {
    log('Compiling GSettings schemas...');

    const buildSchemasDir = join(BUILD_DIR, 'schemas');
    mkdirSync(buildSchemasDir, { recursive: true });

    // Copy schema files
    if (existsSync(SCHEMAS_DIR)) {
        const schemaFiles = readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.gschema.xml'));

        for (const file of schemaFiles) {
            cpSync(join(SCHEMAS_DIR, file), join(buildSchemasDir, file));
        }

        // Compile schemas
        const hasGlibCompileSchemas = execSilent('which glib-compile-schemas');
        if (hasGlibCompileSchemas) {
            try {
                execSilent(`glib-compile-schemas "${buildSchemasDir}"`);
                success('GSettings schemas compiled');
            } catch (err) {
                log(
                    'Warning: Schema compilation failed, they will be compiled during installation'
                );
            }
        } else {
            log(
                'Warning: glib-compile-schemas not found, schemas will be compiled during installation'
            );
        }
    } else {
        log('No schemas directory found, skipping...');
    }
}

async function compileTranslations() {
    log('Processing translations...');

    if (!existsSync(PO_DIR)) {
        log('No translations directory found, skipping...');
        return;
    }

    const poFiles = readdirSync(PO_DIR).filter(f => f.endsWith('.po'));

    if (poFiles.length === 0) {
        log('No translation files found, skipping...');
        return;
    }

    const localeDir = join(BUILD_DIR, 'locale');
    mkdirSync(localeDir, { recursive: true });

    const hasMsgfmt = execSilent('which msgfmt');
    if (!hasMsgfmt) {
        log('Warning: msgfmt not found, skipping translations');
        return;
    }

    for (const poFile of poFiles) {
        const lang = basename(poFile, '.po');
        const langDir = join(localeDir, lang, 'LC_MESSAGES');
        mkdirSync(langDir, { recursive: true });

        try {
            execSilent(
                `msgfmt "${join(PO_DIR, poFile)}" -o "${join(langDir, 'grayscale-toggle.mo')}"`
            );
            log(`Compiled translation for ${lang}`);
        } catch (err) {
            log(`Warning: Failed to compile translation for ${lang}`);
        }
    }

    success('Translations processed');
}

async function validateMetadata() {
    log('Validating extension metadata...');

    const metadataPath = join(BUILD_DIR, 'metadata.json');
    if (!existsSync(metadataPath)) {
        error('metadata.json not found in build directory');
    }

    try {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));

        // Validate required fields
        const requiredFields = ['uuid', 'name', 'shell-version'];
        for (const field of requiredFields) {
            if (!metadata[field]) {
                error(`Required field '${field}' missing from metadata.json`);
            }
        }

        success('Metadata validation passed');
        return metadata;
    } catch (err) {
        error('Invalid metadata.json:', err.message);
    }
}

async function validateJavaScript() {
    log('Validating JavaScript syntax...');

    const jsFiles = readdirSync(BUILD_DIR).filter(f => f.endsWith('.js'));

    for (const jsFile of jsFiles) {
        const filePath = join(BUILD_DIR, jsFile);
        try {
            execSilent(`node -c "${filePath}"`);
        } catch (err) {
            error(`Syntax error in ${jsFile}`);
        }
    }

    success('JavaScript validation passed');
}

async function createDistributionPackage() {
    log('Creating distribution package...');

    const metadata = JSON.parse(readFileSync(join(BUILD_DIR, 'metadata.json'), 'utf8'));
    const packageName = `${metadata.uuid}.zip`;
    const packagePath = join(DIST_DIR, packageName);

    // Create zip package
    try {
        exec(`cd "${BUILD_DIR}" && zip -r "${packagePath}" . -x "*.DS_Store" "*/.*"`);
        success(`Package created: ${packagePath}`);

        // Display package contents
        log('Package contents:');
        exec(`unzip -l "${packagePath}"`);

        return packagePath;
    } catch (err) {
        error('Failed to create distribution package');
    }
}

// Installation helper functions
async function getExtensionStatus(uuid) {
    try {
        const output = execSilent(`gnome-extensions show ${uuid}`);
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
    } catch (err) {
        return 'not-installed';
    }
}

async function canInstallNow() {
    // Check if gnome-extensions tool is available
    const hasGnomeExtensions = execSilent('which gnome-extensions');
    if (!hasGnomeExtensions) {
        warn('gnome-extensions tool not found. Cannot auto-install.');
        return false;
    }

    // Check if we're running on GNOME
    const hasGnomeShell = execSilent('which gnome-shell');
    if (!hasGnomeShell) {
        warn('GNOME Shell not detected. Cannot auto-install.');
        return false;
    }

    return true;
}

async function displayInstructions(packagePath) {
    const metadata = JSON.parse(readFileSync(join(BUILD_DIR, 'metadata.json'), 'utf8'));

    const canInstall = await canInstallNow();
    const extensionStatus = canInstall ? await getExtensionStatus(metadata.uuid) : 'unknown';

    console.log('\n' + '='.repeat(60));
    success('Build completed successfully!');
    console.log('='.repeat(60));
    console.log(`📦 Package: ${packagePath}`);
    console.log(`🆔 UUID: ${metadata.uuid}`);
    console.log(`📛 Name: ${metadata.name}`);
    console.log(`🐚 Shell versions: ${metadata['shell-version'].join(', ')}`);

    if (canInstall) {
        console.log(`📊 Current Status: ${extensionStatus}`);
    }

    console.log('\n📋 Quick Installation Commands:');
    console.log(`🚀 Dev install:     ${chalk.cyan('npm run dev:install')}`);
    console.log(`📦 Install:         ${chalk.cyan('npm run install:extension')}`);
    console.log(`✅ Enable:          ${chalk.cyan('npm run enable:extension')}`);
    console.log(`❌ Disable:         ${chalk.cyan('npm run disable:extension')}`);
    console.log(`📊 Check status:    ${chalk.cyan('npm run extension:status')}`);
    console.log(`🗑️  Uninstall:      ${chalk.cyan('npm run uninstall:extension')}`);

    console.log('\n📋 Manual Installation:');
    console.log(
        `1. Install: unzip -o '${packagePath}' -d '$HOME/.local/share/gnome-shell/extensions/${metadata.uuid}/'`
    );
    console.log(`2. Enable: gnome-extensions enable ${metadata.uuid}`);
    console.log(
        "3. Restart GNOME Shell: Alt+F2, type 'r', press Enter (X11) or log out/in (Wayland)"
    );

    console.log('='.repeat(60) + '\n');

    // Suggest next steps based on current status
    if (canInstall) {
        if (extensionStatus === 'not-installed') {
            info('💡 Next step: Run "npm run dev:install" to install and enable the extension');
        } else if (extensionStatus === 'disabled') {
            info('💡 Next step: Run "npm run enable:extension" to enable the extension');
        } else if (extensionStatus === 'enabled') {
            success('Extension is already installed and enabled!');
        }
    }
}

// Main build function
async function build() {
    const startTime = Date.now();

    log(`Starting ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} build...`);
    log(`Project root: ${PROJECT_ROOT}`);

    try {
        // Clean and prepare
        await cleanBuild();

        // Validation steps
        await validateTypeScript();

        if (isProduction) {
            await runLinting();
        }

        // Copy and process files
        await copySourceFiles();
        await compileSchemas();
        await compileTranslations();

        // Validation
        const metadata = await validateMetadata();
        await validateJavaScript();

        // Create package
        const packagePath = await createDistributionPackage();

        // Display results
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        await displayInstructions(packagePath);

        success(`Build completed in ${duration}s`);
    } catch (err) {
        error('Build failed:', err.message);
    }
}

// Watch mode
async function watch() {
    log('Starting watch mode...');
    // For now, just run build once
    // In a full implementation, you'd use a file watcher
    await build();
}

// Main entry point
if (isWatch) {
    watch();
} else {
    build();
}
