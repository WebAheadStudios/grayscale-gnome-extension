#!/usr/bin/env node

/**
 * Update extension metadata version for releases
 * This script updates the version in src/metadata.json to match the release version
 */

import fs from 'fs';
import path from 'path';

function updateMetadataVersion(newVersion) {
    const metadataPath = path.join(process.cwd(), 'src', 'metadata.json');

    try {
        // Read current metadata
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        // Update version
        metadata.version = newVersion;

        // Write updated metadata
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');

        console.log(`✅ Updated metadata.json version to ${newVersion}`);
    } catch (error) {
        console.error('❌ Failed to update metadata.json:', error.message);
        process.exit(1);
    }
}

// Get version from command line argument
const newVersion = process.argv[2];

if (!newVersion) {
    console.error('❌ Version argument required');
    console.error('Usage: node update-metadata-version.js <version>');
    process.exit(1);
}

// Validate version format (basic semver check)
const versionRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
if (!versionRegex.test(newVersion)) {
    console.error('❌ Invalid version format. Expected semver format (x.y.z)');
    process.exit(1);
}

updateMetadataVersion(newVersion);
