#!/usr/bin/env node

/**
 * Validate extension metadata.json for GNOME Shell extension requirements
 * This script ensures the metadata follows GNOME Shell extension standards
 */

import fs from 'fs';
import path from 'path';

function validateMetadata() {
    const metadataPath = path.join(process.cwd(), 'src', 'metadata.json');

    try {
        // Check if file exists
        if (!fs.existsSync(metadataPath)) {
            console.error('❌ metadata.json not found at src/metadata.json');
            process.exit(1);
        }

        // Read and parse JSON
        let metadata;
        try {
            const content = fs.readFileSync(metadataPath, 'utf8');
            metadata = JSON.parse(content);
        } catch (parseError) {
            console.error('❌ Invalid JSON in metadata.json:', parseError.message);
            process.exit(1);
        }

        // Required fields
        const requiredFields = ['uuid', 'name', 'shell-version'];
        const missingFields = [];

        for (const field of requiredFields) {
            if (!metadata[field]) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            console.error('❌ Missing required fields in metadata.json:', missingFields.join(', '));
            process.exit(1);
        }

        // Validate UUID format
        const uuidPattern = /^[a-z0-9-]+@[a-z0-9.-]+$/i;
        if (!uuidPattern.test(metadata.uuid)) {
            console.error('❌ Invalid UUID format. Expected: extension-name@domain.tld');
            process.exit(1);
        }

        // Validate shell-version is array
        if (!Array.isArray(metadata['shell-version'])) {
            console.error('❌ shell-version must be an array');
            process.exit(1);
        }

        if (metadata['shell-version'].length === 0) {
            console.error('❌ shell-version array cannot be empty');
            process.exit(1);
        }

        // Validate shell-version format
        const versionPattern = /^\d+(\.\d+)?$/;
        for (const version of metadata['shell-version']) {
            if (!versionPattern.test(version)) {
                console.error(
                    `❌ Invalid shell-version format: ${version}. Expected: 45, 46, etc.`
                );
                process.exit(1);
            }
        }

        // Optional but recommended fields
        const recommendedFields = ['description', 'url'];
        const missingRecommended = recommendedFields.filter(field => !metadata[field]);

        if (missingRecommended.length > 0) {
            console.warn('⚠️  Recommended fields missing:', missingRecommended.join(', '));
        }

        // Validate optional fields if present
        // GNOME extension spec requires version to be a positive integer.
        // Accept either integer (required by EGO) or string for flexibility.
        if (
            metadata.version !== undefined &&
            typeof metadata.version !== 'number' &&
            typeof metadata.version !== 'string'
        ) {
            console.error('❌ version field must be an integer or string');
            process.exit(1);
        }

        if (metadata.url && typeof metadata.url !== 'string') {
            console.error('❌ url field must be a string');
            process.exit(1);
        }

        if (metadata['gettext-domain'] && typeof metadata['gettext-domain'] !== 'string') {
            console.error('❌ gettext-domain field must be a string');
            process.exit(1);
        }

        if (metadata['settings-schema'] && typeof metadata['settings-schema'] !== 'string') {
            console.error('❌ settings-schema field must be a string');
            process.exit(1);
        }

        // Validate against package.json for consistency
        const packagePath = path.join(process.cwd(), 'package.json');
        if (fs.existsSync(packagePath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

                // Check name consistency
                if (
                    packageJson.extensionMetadata?.name &&
                    metadata.name !== packageJson.extensionMetadata.name
                ) {
                    console.error(
                        '❌ Extension name mismatch between package.json and metadata.json'
                    );
                    process.exit(1);
                }

                // Check UUID consistency
                if (
                    packageJson.extensionMetadata?.uuid &&
                    metadata.uuid !== packageJson.extensionMetadata.uuid
                ) {
                    console.error(
                        '❌ Extension UUID mismatch between package.json and metadata.json'
                    );
                    process.exit(1);
                }

                // Check shell version consistency
                if (packageJson.extensionMetadata?.['shell-version']) {
                    const pkgShellVersions = packageJson.extensionMetadata['shell-version'];
                    const metadataShellVersions = metadata['shell-version'];

                    if (
                        JSON.stringify(pkgShellVersions.sort()) !==
                        JSON.stringify(metadataShellVersions.sort())
                    ) {
                        console.error(
                            '❌ Shell version mismatch between package.json and metadata.json'
                        );
                        process.exit(1);
                    }
                }
            } catch (e) {
                // package.json parsing error - warn but don't fail
                console.warn('⚠️  Could not validate against package.json:', e.message);
            }
        }

        console.log('✅ metadata.json validation passed');

        // Summary
        console.log(`📋 Extension: ${metadata.name} (${metadata.uuid})`);
        console.log(`🛡️  GNOME Shell versions: ${metadata['shell-version'].join(', ')}`);
        if (metadata.version) {
            console.log(`📦 Version: ${metadata.version}`);
        }
        if (metadata.description) {
            console.log(`📝 Description: ${metadata.description}`);
        }
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    }
}

validateMetadata();
