#!/usr/bin/env node

/**
 * SuperTab Chrome Extension Package Verification Script
 * 验证打包文件的完整性和正确性
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 必需的文件列表
const REQUIRED_FILES = [
  'manifest.json',
  'background/service-worker.js',
  'ui/sidebar/sidebar.html',
  'ui/sidebar/sidebar.css',
  'ui/sidebar/sidebar.js',
  'ui/settings/settings.html',
  'ui/settings/settings.css',
  'ui/settings/settings.js',
  'images/icon16.png',
  'images/icon32.png',
  'images/icon48.png',
  'images/icon128.png'
];

// 检查文件是否存在
function checkFilesExist(files) {
  const missing = [];
  const existing = [];

  files.forEach(file => {
    if (fs.existsSync(file)) {
      existing.push(file);
    } else {
      missing.push(file);
    }
  });

  return { missing, existing };
}

// 验证manifest.json
function validateManifest() {
  try {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

    const checks = {
      manifest_version: manifest.manifest_version === 3,
      name: typeof manifest.name === 'string' && manifest.name.length > 0,
      version: typeof manifest.version === 'string' && manifest.version.length > 0,
      has_background: !!manifest.background,
      has_side_panel: !!manifest.side_panel,
      has_icons: !!manifest.icons,
      has_permissions: Array.isArray(manifest.permissions)
    };

    return {
      valid: Object.values(checks).every(Boolean),
      checks
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// 检查zip文件
function checkZipPackage() {
  const zipFiles = fs.readdirSync('.').filter(f => f.endsWith('.zip') && f.includes('SuperTab'));

  if (zipFiles.length === 0) {
    return { exists: false, files: [] };
  }

  return {
    exists: true,
    files: zipFiles.map(f => ({
      name: f,
      size: fs.statSync(f).size,
      mtime: fs.statSync(f).mtime
    }))
  };
}

// 主验证函数
function main() {
  console.log('🔍 SuperTab Chrome Extension Package Verification');
  console.log('=' .repeat(60));

  // 检查必需文件
  console.log('\n📁 检查必需文件...');
  const { missing, existing } = checkFilesExist(REQUIRED_FILES);

  if (missing.length > 0) {
    console.log('❌ 缺少文件:');
    missing.forEach(file => console.log(`   - ${file}`));
  }

  console.log(`✅ 存在文件: ${existing.length}/${REQUIRED_FILES.length}`);

  // 验证manifest
  console.log('\n📋 验证manifest.json...');
  const manifestValidation = validateManifest();

  if (manifestValidation.valid) {
    console.log('✅ manifest.json 格式正确');
  } else {
    console.log('❌ manifest.json 验证失败:');
    if (manifestValidation.checks) {
      Object.entries(manifestValidation.checks).forEach(([key, value]) => {
        console.log(`   ${value ? '✅' : '❌'} ${key}`);
      });
    }
    if (manifestValidation.error) {
      console.log(`   错误: ${manifestValidation.error}`);
    }
  }

  // 检查打包文件
  console.log('\n📦 检查打包文件...');
  const zipCheck = checkZipPackage();

  if (zipCheck.exists) {
    console.log('✅ 找到打包文件:');
    zipCheck.files.forEach(zip => {
      const sizeKB = (zip.size / 1024).toFixed(1);
      console.log(`   - ${zip.name} (${sizeKB}KB)`);
    });
  } else {
    console.log('❌ 未找到打包文件');
  }

  // 总结
  console.log('\n📊 验证总结');
  console.log('=' .repeat(30));

  const allFilesPresent = missing.length === 0;
  const manifestValid = manifestValidation.valid;
  const packageExists = zipCheck.exists;

  console.log(`必需文件完整: ${allFilesPresent ? '✅' : '❌'}`);
  console.log(`Manifest有效: ${manifestValid ? '✅' : '❌'}`);
  console.log(`打包文件存在: ${packageExists ? '✅' : '❌'}`);

  const allValid = allFilesPresent && manifestValid && packageExists;
  console.log(`\n总体状态: ${allValid ? '✅ 可以安装' : '❌ 需要修复'}`);

  return allValid;
}

// 运行验证
if (require.main === module) {
  const isValid = main();
  process.exit(isValid ? 0 : 1);
}

module.exports = { main, checkFilesExist, validateManifest, checkZipPackage };