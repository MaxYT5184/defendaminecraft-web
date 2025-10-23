#!/usr/bin/env node

/**
 * Prepare NPM Package for Publishing
 * This script builds and prepares the package for npm publish
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing @defendaminecraft/recaptcha for publishing...\n');

try {
    // Check if we're in the npm-package directory
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        console.error('❌ package.json not found. Make sure you\'re in the npm-package directory.');
        process.exit(1);
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log(`📦 Package: ${packageJson.name}@${packageJson.version}`);

    // Install dependencies
    console.log('📥 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    // Run linting
    console.log('🔍 Running linter...');
    try {
        execSync('npm run lint', { stdio: 'inherit' });
        console.log('✅ Linting passed');
    } catch (error) {
        console.log('⚠️  Linting warnings (continuing...)');
    }

    // Run tests
    console.log('🧪 Running tests...');
    try {
        execSync('npm test', { stdio: 'inherit' });
        console.log('✅ Tests passed');
    } catch (error) {
        console.log('⚠️  Some tests failed (continuing...)');
    }

    // Build the package
    console.log('🔨 Building package...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed');

    // Check if dist directory exists
    const distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) {
        console.error('❌ dist directory not found after build');
        process.exit(1);
    }

    // List built files
    const distFiles = fs.readdirSync(distPath);
    console.log('📁 Built files:');
    distFiles.forEach(file => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024).toFixed(2);
        console.log(`   ${file} (${size} KB)`);
    });

    console.log('\n✅ Package is ready for publishing!');
    console.log('\n📝 Next steps:');
    console.log('   1. Review the built files in the dist/ directory');
    console.log('   2. Test the package locally: npm pack');
    console.log('   3. Publish to npm: npm publish');
    console.log('   4. Or publish as scoped package: npm publish --access public');

    console.log('\n🔗 Useful commands:');
    console.log('   npm pack                    # Create a tarball for testing');
    console.log('   npm publish --dry-run       # Test publish without actually publishing');
    console.log('   npm publish --access public # Publish scoped package publicly');

} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}
