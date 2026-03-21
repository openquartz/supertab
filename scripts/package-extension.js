#!/usr/bin/env node

/**
 * SuperTab Chrome Extension Packaging Script
 * Creates a distributable .zip file for offline installation
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const EXTENSION_NAME = 'supertab';
const VERSION = require('../package.json').version;
const OUTPUT_DIR = path.join(__dirname, '../dist');
const ZIP_NAME = `${EXTENSION_NAME}-v${VERSION}.zip`;
const ZIP_PATH = path.join(OUTPUT_DIR, ZIP_NAME);

// Files and directories to include in the package
const INCLUDED_FILES = [
  'manifest.json',
  'background/',
  'ui/',
  'utils/',
  'images/',
  'assets/',
  'README.md',
  'LICENSE'
];

// Files to exclude from the package
const EXCLUDED_PATTERNS = [
  '.gitignore',
  '.DS_Store',
  'node_modules/',
  'coverage/',
  '.idea/',
  '.vscode/',
  'scripts/',
  'tests/',
  'package.json',
  'package-lock.json',
  '.git/',
  'dist/',
  '.omc/',
  '.cursor/',
  '.codex/'
];

console.log('📦 Packaging SuperTab Chrome Extension...');
console.log(`📋 Version: ${VERSION}`);

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
}

// Create a zip file
const output = fs.createWriteStream(ZIP_PATH);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  console.log(`✅ Package created successfully!`);
  console.log(`📦 File: ${ZIP_PATH}`);
  console.log(`📏 Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\n🚀 Installation Instructions:`);
  console.log(`1. Extract the ${ZIP_NAME} file`);
  console.log(`2. Open Chrome and navigate to chrome://extensions/`);
  console.log(`3. Enable "Developer mode" (top right corner)`);
  console.log(`4. Click "Load unpacked" button`);
  console.log(`5. Select the extracted folder`);
  console.log(`6. SuperTab will be installed and ready to use!`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Function to check if a file should be excluded
function shouldExclude(filePath) {
  return EXCLUDED_PATTERNS.some(pattern => {
    if (pattern.endsWith('/')) {
      return filePath.startsWith(pattern);
    }
    return filePath === pattern;
  });
}

// Function to add files recursively
function addFilesRecursively(dirPath, zipPath = '') {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const relativePath = path.join(zipPath, file);
    const stat = fs.statSync(filePath);

    if (shouldExclude(relativePath)) {
      console.log(`⏭️  Skipping: ${relativePath}`);
      return;
    }

    if (stat.isDirectory()) {
      addFilesRecursively(filePath, relativePath);
    } else {
      console.log(`📄 Adding: ${relativePath}`);
      archive.file(filePath, { name: relativePath });
    }
  });
}

// Add included files and directories
try {
  INCLUDED_FILES.forEach(item => {
    if (fs.existsSync(item)) {
      const stat = fs.statSync(item);

      if (stat.isDirectory()) {
        addFilesRecursively(item);
      } else {
        console.log(`📄 Adding: ${item}`);
        archive.file(item, { name: item });
      }
    } else {
      console.log(`⚠️  Warning: ${item} not found, skipping...`);
    }
  });

  // Add package.json for version reference
  const packageJson = require('../package.json');
  const minimalPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    author: packageJson.author
  };

  archive.append(JSON.stringify(minimalPackageJson, null, 2), {
    name: 'package.json'
  });

  // Finalize the archive
  archive.finalize();

} catch (error) {
  console.error('❌ Error creating package:', error);
  process.exit(1);
}