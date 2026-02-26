#!/usr/bin/env node

/**
 * Update extension metadata version for releases
 *
 * This script updates the integer version in src/metadata.json to match the
 * release. GNOME Shell extensions require an integer version field; this script
 * extracts the major version component from the semver string and writes it as
 * the GNOME integer version (e.g. "1.2.3" → 1, "2.0.0" → 2).
 *
 * For monotonic integer versioning across minor/patch releases, the script also
 * guarantees the written value is always ≥ the current integer in metadata.json
 * + 1 when the major component has not changed (i.e. minor/patch bumps still
 * produce a higher GNOME version number so EGO can detect updates).
 */

import fs from 'fs';
import path from 'path';

function updateMetadataVersion(newSemver) {
    const metadataPath = path.join(process.cwd(), 'src', 'metadata.json');

    try {
        // Read current metadata
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        const currentGnomeVersion = typeof metadata.version === 'number' ? metadata.version : 0;

        // Extract major component from semver (e.g. "1.2.3" → 1)
        const major = parseInt(newSemver.split('.')[0], 10);

        // Guarantee the GNOME integer always increments: use the larger of
        //   • the semver major (handles major bumps: 1→2, 2→3 …)
        //   • current integer + 1 (handles minor/patch bumps within same major)
        const nextGnomeVersion = Math.max(major, currentGnomeVersion + 1);

        metadata.version = nextGnomeVersion;

        // Write updated metadata with consistent formatting
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 4) + '\n');

        console.log(
            `Updated metadata.json version: ${currentGnomeVersion} → ${nextGnomeVersion} (semver: ${newSemver})`
        );
    } catch (error) {
        console.error('Failed to update metadata.json:', error.message);
        process.exit(1);
    }
}

// Get version from command line argument
const newVersion = process.argv[2];

if (!newVersion) {
    console.error('Version argument required');
    console.error('Usage: node update-metadata-version.js <semver>');
    console.error('Example: node update-metadata-version.js 1.2.3');
    process.exit(1);
}

// Validate version format (basic semver check)
const versionRegex = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
if (!versionRegex.test(newVersion)) {
    console.error(`Invalid version format: "${newVersion}". Expected semver (x.y.z)`);
    process.exit(1);
}

updateMetadataVersion(newVersion);
