#!/usr/bin/env node

/**
 * Generate documentation for the GNOME Shell extension
 * This script creates API documentation and updates README badges
 */

import fs from 'fs';
import path from 'path';

function generateApiDocs() {
    console.log('📚 Generating API documentation...');

    // Read all TypeScript files from src/
    const srcDir = path.join(process.cwd(), 'src');
    const typeFiles = [];

    function findTypeFiles(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory() && !file.startsWith('.')) {
                findTypeFiles(fullPath); // Recursive
            } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
                typeFiles.push(fullPath);
            }
        }
    }

    findTypeFiles(srcDir);

    // Extract JSDoc comments and generate markdown
    let apiDocs = `# API Documentation

*Generated automatically from TypeScript source code*

`;

    const modules = {};

    for (const file of typeFiles) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const relativePath = path.relative(srcDir, file);
            const moduleName = relativePath.replace(/\.(ts|js)$/, '').replace(/\//g, '.');

            // Extract exports and their JSDoc comments
            const exports = extractExports(content);
            if (exports.length > 0) {
                modules[moduleName] = exports;
            }
        } catch (error) {
            console.warn(`Warning: Could not process ${file}:`, error.message);
        }
    }

    // Generate documentation for each module
    for (const [moduleName, exports] of Object.entries(modules)) {
        apiDocs += `\n## ${moduleName}\n\n`;

        for (const exp of exports) {
            apiDocs += `### ${exp.name}\n\n`;
            if (exp.description) {
                apiDocs += `${exp.description}\n\n`;
            }
            if (exp.signature) {
                apiDocs += `\`\`\`typescript\n${exp.signature}\n\`\`\`\n\n`;
            }
            if (exp.params && exp.params.length > 0) {
                apiDocs += '**Parameters:**\n\n';
                for (const param of exp.params) {
                    apiDocs += `- \`${param.name}\` (${param.type || 'any'}): ${param.description || 'No description'}\n`;
                }
                apiDocs += '\n';
            }
            if (exp.returns) {
                apiDocs += `**Returns:** ${exp.returns}\n\n`;
            }
            if (exp.example) {
                apiDocs += `**Example:**\n\n\`\`\`typescript\n${exp.example}\n\`\`\`\n\n`;
            }
        }
    }

    // Write API docs
    const docsDir = path.join(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(docsDir, 'api.md'), apiDocs);
    console.log('✅ API documentation generated at docs/api.md');
}

function extractExports(content) {
    const exports = [];

    // Simple regex-based extraction (could be enhanced with AST parsing)
    const exportRegex = /export\s+(class|interface|function|const|type|enum)\s+(\w+)/g;

    let match;
    while ((match = exportRegex.exec(content)) !== null) {
        const [, type, name] = match;

        // Try to find JSDoc comment before the export
        const beforeExport = content.substring(0, match.index);
        const lines = beforeExport.split('\n');

        let jsdocStart = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line === '*/') {
                continue;
            }
            if (line.startsWith('*')) {
                continue;
            }
            if (line.startsWith('/**')) {
                jsdocStart = i;
                break;
            }
            if (line && !line.startsWith('//')) {
                break;
            }
        }

        let description = '';
        if (jsdocStart >= 0) {
            const jsdocLines = lines.slice(jsdocStart, lines.length);
            description = jsdocLines
                .join('\n')
                .replace(/\/\*\*|\*\/|\*/g, '')
                .trim();
        }

        exports.push({
            name,
            type,
            description,
            signature: `${type} ${name}`, // Could be enhanced
        });
    }

    return exports;
}

function updateReadmeBadges() {
    console.log('🏷️  Updating README badges...');

    const readmePath = path.join(process.cwd(), 'README.md');
    if (!fs.existsSync(readmePath)) {
        console.warn('README.md not found, skipping badge updates');
        return;
    }

    let readme = fs.readFileSync(readmePath, 'utf8');

    // Get package info
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const repoUrl = packageJson.repository?.url || '';
    const repoName = repoUrl.replace('https://github.com/', '').replace('.git', '');

    // Define badges
    const badges = [
        `![CI](https://github.com/${repoName}/workflows/Continuous%20Integration/badge.svg)`,
        `![Release](https://github.com/${repoName}/workflows/Release/badge.svg)`,
        `[![Code Coverage](https://codecov.io/gh/${repoName}/branch/main/graph/badge.svg)](https://codecov.io/gh/${repoName})`,
        `[![License](https://img.shields.io/badge/license-${packageJson.license}-blue.svg)](LICENSE)`,
        `[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-${packageJson.extensionMetadata?.['shell-version']?.join('%2C%20') || '46'}-blue.svg)](https://extensions.gnome.org/)`,
    ];

    // Find or create badge section
    const badgeSection = badges.join('\n');

    if (readme.includes('![CI]') || readme.includes('![Release]')) {
        // Replace existing badges
        readme = readme.replace(/!\[CI\].*?\n/g, '');
        readme = readme.replace(/!\[Release\].*?\n/g, '');
        readme = readme.replace(/!\[.*?Code Coverage.*?\n/g, '');
        readme = readme.replace(/!\[.*?License.*?\n/g, '');
        readme = readme.replace(/!\[.*?GNOME Shell.*?\n/g, '');

        // Add new badges after title
        const lines = readme.split('\n');
        const titleIndex = lines.findIndex(line => line.startsWith('#'));
        if (titleIndex >= 0) {
            lines.splice(titleIndex + 1, 0, '', badgeSection, '');
            readme = lines.join('\n');
        }
    } else {
        // Add badges after first heading
        const lines = readme.split('\n');
        const titleIndex = lines.findIndex(line => line.startsWith('#'));
        if (titleIndex >= 0) {
            lines.splice(titleIndex + 1, 0, '', badgeSection, '');
            readme = lines.join('\n');
        }
    }

    fs.writeFileSync(readmePath, readme);
    console.log('✅ README badges updated');
}

function generateContributorGuide() {
    console.log('👥 Generating contributor guide...');

    const guide = `# Contributing to Grayscale Toggle Extension

Thank you for considering contributing to this project! This guide will help you get started.

## Development Setup

1. **Prerequisites**
   - Node.js 18+
   - GNOME Shell 46+
   - Git

2. **Clone and Setup**
   \`\`\`bash
   git clone <repository-url>
   cd grayscale-gnome-extension
   npm install
   npm run prepare  # Setup pre-commit hooks
   \`\`\`

3. **Development Workflow**
   \`\`\`bash
   npm run dev      # Build and install extension
   npm run test     # Run tests
   npm run lint     # Check code style
   \`\`\`

## Code Standards

- **TypeScript**: All new code must be written in TypeScript
- **ESLint**: Code must pass linting with no warnings
- **Prettier**: Code must be formatted with Prettier
- **Tests**: New features require tests
- **Documentation**: Public APIs require JSDoc comments

## Commit Guidelines

We use [Conventional Commits](https://conventionalcommits.org/) for commit messages:

\`\`\`
<type>[optional scope]: <description>

[optional body]

[optional footer]
\`\`\`

**Types:**
- \`feat\`: New features
- \`fix\`: Bug fixes
- \`docs\`: Documentation changes
- \`style\`: Code style changes
- \`refactor\`: Code refactoring
- \`test\`: Test changes
- \`chore\`: Maintenance tasks

**Examples:**
\`\`\`
feat: add keyboard shortcut for grayscale toggle
fix(ui): resolve indicator positioning issue
docs: update installation instructions
\`\`\`

## Pull Request Process

1. **Create Feature Branch**
   \`\`\`bash
   git checkout -b feat/your-feature-name
   \`\`\`

2. **Make Changes**
   - Follow code standards
   - Add/update tests
   - Update documentation

3. **Test Your Changes**
   \`\`\`bash
   npm run validate:full  # Run all checks
   \`\`\`

4. **Submit Pull Request**
   - Use descriptive title
   - Fill out PR template
   - Link related issues

## Testing

- **Unit Tests**: \`npm run test\`
- **Coverage**: \`npm run test:coverage\`
- **Integration**: \`npm run test:build\`
- **Performance**: Tests include performance benchmarks

## Architecture

The extension follows a modular architecture:

- **Infrastructure**: Core components and utilities
- **Enhanced**: Advanced effect management
- **Types**: TypeScript type definitions
- **Tests**: Comprehensive test suite

## Getting Help

- Check existing [issues](../../issues) and [discussions](../../discussions)
- Review the [documentation](docs/)
- Ask questions in [discussions](../../discussions)

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions.
`;

    const docsDir = path.join(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(docsDir, 'contributing.md'), guide);
    console.log('✅ Contributor guide generated at docs/contributing.md');
}

// Main execution
async function main() {
    console.log('📖 Starting documentation generation...');

    try {
        generateApiDocs();
        updateReadmeBadges();
        generateContributorGuide();

        console.log('\n✅ Documentation generation completed successfully!');
        console.log('\n📁 Generated files:');
        console.log('  - docs/api.md (API documentation)');
        console.log('  - docs/contributing.md (Contributor guide)');
        console.log('  - README.md (Updated badges)');
    } catch (error) {
        console.error('❌ Documentation generation failed:', error.message);
        process.exit(1);
    }
}

main();
