#!/usr/bin/env node

/**
 * Cache clearing utility for claude-statusline
 * Clears all cache directories and forces regeneration
 */

import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const cacheDirs = [
  '/tmp/.claude-statusline-cache',
  join(process.env.HOME || '', '.claude', 'cache'),
];

console.log('🗑️  Clearing claude-statusline caches...');

for (const cacheDir of cacheDirs) {
  if (existsSync(cacheDir)) {
    try {
      rmSync(cacheDir, { recursive: true, force: true });
      console.log(`✅ Cleared: ${cacheDir}`);
    } catch (error) {
      console.error(`❌ Failed to clear ${cacheDir}:`, error.message);
    }
  } else {
    console.log(`ℹ️  Cache does not exist: ${cacheDir}`);
  }
}

console.log('\n✨ Cache clearing complete!');
console.log('   Run your claude-statusline command again to regenerate caches.');