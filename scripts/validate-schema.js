#!/usr/bin/env node

/**
 * XML well-formedness validation using fast-xml-parser (pure JavaScript,
 * no native binaries, no WASM, no worker threads).
 *
 * Replaces the previous approach of calling the system xmllint binary.
 * fast-xml-parser is a devDependency so validation always works without
 * any system-level setup.
 *
 * Usage (called by lint-staged):
 *   node scripts/validate-schema.js <file1.xml> [file2.xml ...]
 *
 * XMLValidator.validate(text) returns:
 *   - true          : well-formed XML
 *   - { err: { msg, line, col } } : parse error details
 */

import { XMLValidator } from 'fast-xml-parser';
import { readFileSync } from 'fs';

const files = process.argv.slice(2);

if (files.length === 0) {
    process.exit(0);
}

let allValid = true;

for (const filePath of files) {
    let contents;
    try {
        contents = readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error(`❌ Could not read ${filePath}: ${err.message}`);
        allValid = false;
        continue;
    }

    const result = XMLValidator.validate(contents, {
        allowBooleanAttributes: true,
    });

    if (result === true) {
        console.log(`✅ ${filePath} — well-formed XML`);
    } else {
        // result.err = { msg, line, col }
        const { msg = 'unknown error', line, col } = result.err ?? {};
        console.error(`❌ ${filePath}:${line}:${col} — ${msg}`);
        allValid = false;
    }
}

process.exit(allValid ? 0 : 1);
