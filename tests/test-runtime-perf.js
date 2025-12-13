#!/usr/bin/env node

import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

const testData = JSON.stringify({
  workspace: { current_dir: process.cwd() },
  model: { display_name: 'Claude Sonnet 4.5' }
});

function measureRuntime(command, args = [], iterations = 10) {
  const times = [];

  // Warmup
  for (let i = 0; i < 3; i++) {
    execSync(command, args, { input: testData, encoding: 'utf8' });
  }

  // Actual measurements
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    execSync(command, args, { input: testData, encoding: 'utf8' });
    const end = performance.now();
    times.push(end - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  return { avg, min, max };
}

console.log('🚀 Runtime Performance Comparison');
console.log('====================================\n');

// Test Node.js
console.log('Testing Node.js runtime...');
const nodeResult = measureRuntime('node', ['dist/index.js']);
console.log(`Node.js:  Avg: ${nodeResult.avg.toFixed(2)}ms  Min: ${nodeResult.min.toFixed(2)}ms  Max: ${nodeResult.max.toFixed(2)}ms`);

// Test Bun if available
try {
  execSync('bun --version', { stdio: 'ignore' });
  console.log('\nTesting Bun runtime...');
  const bunResult = measureRuntime('bun', ['src/index.ts']);
  console.log(`Bun:     Avg: ${bunResult.avg.toFixed(2)}ms  Min: ${bunResult.min.toFixed(2)}ms  Max: ${bunResult.max.toFixed(2)}ms`);

  const improvement = ((nodeResult.avg - bunResult.avg) / nodeResult.avg * 100).toFixed(1);
  console.log(`\n📊 Bun is ${improvement}% faster than Node.js`);
} catch {
  console.log('\n⚠️  Bun not installed - skipping Bun performance test');
  console.log('Install with: brew install bun');
}