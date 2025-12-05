#!/usr/bin/env node

/**
 * Performance benchmark for Claude Statusline v2.0
 * Compares TypeScript implementation against bash baseline
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
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync('node dist/index.js', {
      input: JSON.stringify(testData),
      timeout: BENCHMARK_CONFIG.timeoutMs,
      encoding: 'utf-8',
    });

    return stdout.trim();
  } catch (error) {
    throw new Error(`TypeScript execution failed: ${error.message}`);
  }
}

/**
 * Run bash implementation benchmark
 */
async function benchmarkBash(testData, config = {}) {
  const iterations = config.iterations || BENCHMARK_CONFIG.iterations;
  const warmupIterations = config.warmupIterations || BENCHMARK_CONFIG.warmupIterations;
  const times = [];

  // Check if bash script exists
  const bashScriptPath = './claude-statusline.sh';
  try {
    readFileSync(bashScriptPath);
  } catch {
    return { error: 'Bash script not found', stats: null };
  }

  // Warmup runs
  for (let i = 0; i < warmupIterations; i++) {
    await runBashOnce(testData, bashScriptPath);
  }

  // Actual benchmark runs
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    await runBashOnce(testData, bashScriptPath);
    const endTime = performance.now();
    times.push(endTime - startTime);
  }

  return analyzeTimes(times);
}

/**
 * Run bash implementation once
 */
async function runBashOnce(testData, bashScriptPath) {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync(`bash ${bashScriptPath}`, {
      input: JSON.stringify(testData),
      timeout: BENCHMARK_CONFIG.timeoutMs,
      encoding: 'utf-8',
    });

    return stdout.trim();
  } catch (error) {
    throw new Error(`Bash execution failed: ${error.message}`);
  }
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
    const bashResults = await benchmarkBash(testData);

    formatResults('TypeScript v2.0', tsResults);
    formatResults('Bash v1.0', bashResults, tsResults);

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
  console.log('💡 Compare results above to see performance improvements');
  console.log('🎯 Target: 2-5x performance improvement over bash v1.0');
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
Claude Statusline Benchmark Tool

Usage: node scripts/benchmark.js [options]

Options:
  --quick      Run a quick benchmark (1 test case)
  --help, -h   Show this help message

Examples:
  node scripts/benchmark.js           # Full benchmark suite
  node scripts/benchmark.js --quick   # Quick benchmark
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

export { benchmarkTypeScript, benchmarkBash, runBenchmarkSuite };