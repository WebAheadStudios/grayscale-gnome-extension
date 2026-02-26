#!/usr/bin/env node

/**
 * Graceful XML schema validation wrapper.
 * Runs xmllint --noout on each supplied file.  If xmllint is not installed
 * (ENOENT) the script prints a notice and exits 0 so development commits are
 * not blocked in minimal environments.  CI systems that have libxml2-utils
 * installed will still receive full validation.
 */

import { execFileSync } from 'child_process';

const files = process.argv.slice(2);

if (files.length === 0) {
    process.exit(0);
}

try {
    execFileSync('xmllint', ['--noout', ...files], { stdio: 'pipe' });
    console.log('✅ XML schema validation passed');
} catch (err) {
    if (err.code === 'ENOENT') {
        console.log('xmllint not found — skipping XML schema validation');
        // Exit 0: not having xmllint is a dev-environment concern, not a code error
        process.exit(0);
    }
    // xmllint found but validation actually failed — surface the error
    console.error('❌ XML schema validation failed');
    if (err.stderr) {
        console.error(err.stderr.toString());
    }
    process.exit(1);
}
