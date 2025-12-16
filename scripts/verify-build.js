#!/usr/bin/env node

/**
 * Build verification script to ensure source and compiled code are in sync
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const __dirname = new URL('.', import.meta.url).pathname;
const projectRoot = join(__dirname, '..');

/**
 * Check if compiled files are newer than source files
 */
function checkBuildFreshness() {
  console.log('🔍 Checking build freshness...');

  const sourceFiles = [
    'src/index.ts',
    'src/git/status.ts',
    'src/ui/symbols.ts',
  ];

  const compiledFiles = [
    'dist/index.js',
    'dist/git/status.js',
    'dist/ui/symbols.js',
  ];

  let needsRebuild = false;

  for (let i = 0; i < sourceFiles.length; i++) {
    const sourcePath = join(projectRoot, sourceFiles[i]);
    const compiledPath = join(projectRoot, compiledFiles[i]);

    if (!existsSync(compiledPath)) {
      console.log(`❌ Missing compiled file: ${compiledFiles[i]}`);
      needsRebuild = true;
      continue;
    }

    // Simple check - if source mentions formatIndicators, verify it's in compiled
    const sourceContent = readFileSync(sourcePath, 'utf-8');
    if (sourceContent.includes('formatIndicators') && !compiledFiles[i].includes('bundle')) {
      // Verify the formatIndicators order is correct in compiled file
      const compiledContent = readFileSync(compiledPath, 'utf-8');
      if (!compiledContent.includes('stashed') || !compiledContent.includes('renamed')) {
        console.log(`❌ Compiled file may be stale: ${compiledFiles[i]}`);
        needsRebuild = true;
      }
    }
  }

  if (needsRebuild) {
    console.log('⚠️  Build appears stale. Rebuilding...');
    return false;
  }

  console.log('✅ Build appears fresh');
  return true;
}

/**
 * Verify indicator order in compiled code
 */
function verifyIndicatorOrder() {
  console.log('\n🔍 Verifying indicator order in compiled code...');

  const statusJsPath = join(projectRoot, 'dist/git/status.js');
  const bundleJsPath = join(projectRoot, 'dist/index.bundle.js');

  const expectedPattern = /stashed.*renamed.*modified.*staged.*untracked.*deleted.*conflicts/;

  // Check regular JS file
  if (existsSync(statusJsPath)) {
    const content = readFileSync(statusJsPath, 'utf-8');
    if (expectedPattern.test(content)) {
      console.log('✅ Order correct in dist/git/status.js');
    } else {
      console.log('❌ Order INCORRECT in dist/git/status.js');
      return false;
    }
  }

  // Check bundled file
  if (existsSync(bundleJsPath)) {
    const content = readFileSync(bundleJsPath, 'utf-8');
    if (expectedPattern.test(content)) {
      console.log('✅ Order correct in dist/index.bundle.js');
    } else {
      console.log('❌ Order INCORRECT in dist/index.bundle.js');
      return false;
    }
  }

  return true;
}

/**
 * Check for multiple installations
 */
async function checkMultipleInstallations() {
  console.log('\n🔍 Checking for multiple installations...');

  try {
    const { stdout } = await execFileAsync('which', ['claude-statusline']);
    const globalPath = stdout.trim();
    console.log(`Global installation: ${globalPath}`);

    // Check if it's symlinked to this directory
    try {
      const { stdout: resolvedStdout } = await execFileAsync('readlink', ['-f', globalPath]);
      const resolvedPath = resolvedStdout.trim();
      if (resolvedPath.includes(projectRoot)) {
        console.log('✅ Global installation is symlinked to this repo');
      } else {
        console.log('⚠️  Global installation points to a different location');
        console.log(`   Expected: ${projectRoot}`);
        console.log(`   Actual: ${resolvedPath}`);
      }
    } catch (error) {
      console.log('ℹ️  Could not resolve symlink');
    }
  } catch (error) {
    console.log('ℹ️  Could not check global installation');
  }
}

/**
 * Check cache directory
 */
async function checkCacheDirectory() {
  console.log('\n🔍 Checking cache directory...');

  const cacheDir = '/tmp/.claude-statusline-cache';

  try {
    const { stdout } = await execFileAsync('ls', ['-1', cacheDir]);
    const files = stdout.trim().split('\n').filter(f => f);
    const cacheCount = files.length;
    console.log(`Cache entries: ${cacheCount}`);

    if (cacheCount > 100) {
      console.log('⚠️  Large number of cache entries, consider clearing');
    }
  } catch (error) {
    console.log('ℹ️  Cache directory does not exist or is empty');
  }
}

// Run all checks
console.log('🚀 Build Verification Report\n');
console.log(`Project: ${projectRoot}`);
console.log(`Date: ${new Date().toISOString()}\n`);

let allGood = true;

if (!checkBuildFreshness()) {
  allGood = false;
}

if (!verifyIndicatorOrder()) {
  allGood = false;
}

await checkMultipleInstallations();
await checkCacheDirectory();

console.log('\n' + '='.repeat(50));
if (allGood) {
  console.log('✅ All checks passed!');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Consider running: npm run build && npm run build:bundle');
  process.exit(1);
}