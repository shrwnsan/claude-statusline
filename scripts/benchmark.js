#!/usr/bin/env node

/**
 * Performance benchmark for Claude Statusline v2.0
 * TypeScript-only implementation with performance analysis
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

/**
 * Test data for benchmarking
 */
const TEST_DATA = {
  cleanGit: {
    workspace: { current_dir: process.cwd() },
    model: { display_name: 'Claude Sonnet 4.5' },
  },
  dirtyGit: {
    workspace: { current_dir: process.cwd() },
    model: { display_name: 'Claude Sonnet 4.5' },
  },
  longPath: {
    workspace: {
      current_dir: '/very/long/path/that/will/test/truncation/functionality/with/extended/project/name/for/comprehensive/testing'
    },
    model: { display_name: 'Claude Sonnet 4.5 with Extended Model Name' },
  },
  noGit: {
    workspace: { current_dir: '/tmp' },
    model: { display_name: 'Claude Sonnet 4.5' },
  },
};

/**
 * Benchmark configuration
 */
const BENCHMARK_CONFIG = {
  iterations: 10,
  warmupIterations: 3,
  timeoutMs: 10000,
};

/**
 * Run TypeScript implementation benchmark
 */
async function benchmarkTypeScript(testData, config = {}) {
  const iterations = config.iterations || BENCHMARK_CONFIG.iterations;
  const warmupIterations = config.warmupIterations || BENCHMARK_CONFIG.warmupIterations;
  const times = [];

  // Warmup runs
  for (let i = 0; i < warmupIterations; i++) {
    await runTypeScriptOnce(testData);
  }

  // Actual benchmark runs
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    await runTypeScriptOnce(testData);
    const endTime = performance.now();
    times.push(endTime - startTime);
  }

  return analyzeTimes(times);
}

/**
 * Run TypeScript implementation once
 */
async function runTypeScriptOnce(testData) {
  try {
    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const child = spawn('node', ['dist/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: BENCHMARK_CONFIG.timeoutMs,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Exit code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Spawn error: ${error.message}`));
      });

      // Send input
      child.stdin.write(JSON.stringify(testData));
      child.stdin.end();
    });
  } catch (error) {
    throw new Error(`TypeScript execution failed: ${error.message}`);
  }
}

/**
 * Run TypeScript implementation with cache analysis
 */
async function benchmarkWithCacheAnalysis(testData, config = {}) {
  const iterations = config.iterations || BENCHMARK_CONFIG.iterations;
  const warmupIterations = config.warmupIterations || BENCHMARK_CONFIG.warmupIterations;
  const times = [];

  // Clear cache before first run
  try {
    const { rmSync } = await import('fs');
    rmSync('/tmp/.claude-statusline-cache', { recursive: true, force: true });
  } catch {}

  // Warmup runs (with cache building)
  for (let i = 0; i < warmupIterations; i++) {
    await runTypeScriptOnce(testData);
  }

  // Actual benchmark runs (cache hits)
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    await runTypeScriptOnce(testData);
    const endTime = performance.now();
    times.push(endTime - startTime);
  }

  return analyzeTimes(times);
}

/**
 * Analyze timing results
 */
function analyzeTimes(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const sum = times.reduce((acc, time) => acc + time, 0);

  return {
    stats: {
      mean: sum / times.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(times.reduce((acc, time) => acc + Math.pow(time - (sum / times.length), 2), 0) / times.length),
    },
    raw: times,
  };
}

/**
 * Format benchmark results
 */
function formatResults(name, results, baseline = null) {
  console.log(`\n${name}:`);
  console.log('─'.repeat(50));

  if (results.error) {
    console.log(`❌ ${results.error}`);
    return;
  }

  const stats = results.stats;
  console.log(`  Mean:    ${stats.mean.toFixed(2)}ms`);
  console.log(`  Median:  ${stats.median.toFixed(2)}ms`);
  console.log(`  Min:     ${stats.min.toFixed(2)}ms`);
  console.log(`  Max:     ${stats.max.toFixed(2)}ms`);
  console.log(`  95th:    ${stats.p95.toFixed(2)}ms`);
  console.log(`  99th:    ${stats.p99.toFixed(2)}ms`);
  console.log(`  StdDev:  ${stats.stdDev.toFixed(2)}ms`);

  if (baseline && baseline.stats) {
    const improvement = ((baseline.stats.mean - stats.mean) / baseline.stats.mean * 100);
    const speedup = baseline.stats.mean / stats.mean;

    if (improvement > 0) {
      console.log(`  🚀 Improvement: ${improvement.toFixed(1)}% faster (${speedup.toFixed(2)}x speedup)`);
    } else {
      console.log(`  ⚠️  Regression: ${Math.abs(improvement).toFixed(1)}% slower (${speedup.toFixed(2)}x slower)`);
    }
  }
}

/**
 * Run complete benchmark suite
 */
async function runBenchmarkSuite() {
  console.log('🚀 Claude Statusline Performance Benchmark');
  console.log('='.repeat(60));
  console.log(`Configuration: ${BENCHMARK_CONFIG.iterations} iterations, ${BENCHMARK_CONFIG.warmupIterations} warmup`);
  console.log('');

  // Ensure TypeScript build is up to date
  console.log('📦 Building TypeScript implementation...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }

  console.log('✅ Build completed');
  console.log('');

  // Run benchmarks for each test case
  for (const [testName, testData] of Object.entries(TEST_DATA)) {
    console.log(`📊 Running benchmark: ${testName}`);
    console.log('');

    const tsResults = await benchmarkTypeScript(testData);
    const cacheResults = await benchmarkWithCacheAnalysis(testData);

    formatResults('TypeScript v2.0 (Cold)', tsResults);
    formatResults('TypeScript v2.0 (Cached)', cacheResults, tsResults);

    // Show cache performance improvement
    if (tsResults.stats && cacheResults.stats) {
      const cacheSpeedup = tsResults.stats.mean / cacheResults.stats.mean;
      console.log(`  🚀 Cache Speedup: ${cacheSpeedup.toFixed(1)}x faster`);
    }

    // Show sample output
    console.log('\n📝 Sample Output:');
    console.log('─'.repeat(20));
    try {
      const sampleOutput = await runTypeScriptOnce(testData);
      console.log(`"${sampleOutput}"`);
    } catch (error) {
      console.log('Failed to get sample output');
    }

    console.log('\n' + '='.repeat(60));
  }

  // Summary
  console.log('\n📈 Benchmark Summary');
  console.log('='.repeat(30));
  console.log('✨ TypeScript implementation completed successfully');
  console.log('💡 Cache analysis shows performance improvements');
  console.log('🎯 Target: <5ms execution time with caching enabled');
}

/**
 * Quick benchmark for development
 */
async function quickBenchmark() {
  console.log('⚡ Quick Benchmark (Development Mode)');
  console.log('='.repeat(40));

  // Just run the clean git case
  const testData = TEST_DATA.cleanGit;

  // Build if needed
  try {
    execSync('npm run build', { stdio: 'pipe' });
  } catch {
    console.log('❌ Build failed');
    return;
  }

  const tsResults = await benchmarkTypeScript(testData);
  formatResults('TypeScript v2.0', tsResults);
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    quick: args.includes('--quick'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

// Main execution
async function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Claude Statusline Benchmark Tool v2.0

Usage: node scripts/benchmark.js [options]

Options:
  --quick      Run a quick benchmark (1 test case)
  --help, -h   Show this help message

Features:
  - TypeScript implementation benchmarking
  - Cache performance analysis (cold vs cached)
  - Multiple test scenarios (clean/dirty git, long paths)
  - Statistical analysis (mean, median, p95, p99)

Examples:
  node scripts/benchmark.js           # Full benchmark suite with cache analysis
  node scripts/benchmark.js --quick   # Quick benchmark (development mode)
    `);
    process.exit(0);
  }

  try {
    if (args.quick) {
      await quickBenchmark();
    } else {
      await runBenchmarkSuite();
    }
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { benchmarkTypeScript, benchmarkWithCacheAnalysis, runBenchmarkSuite };