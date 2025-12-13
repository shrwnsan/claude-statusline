/**
 * Runtime detection utilities for optimizing performance based on the JavaScript runtime
 */

export type Runtime = 'node' | 'bun' | 'unknown';

interface RuntimeInfo {
  runtime: Runtime;
  version: string;
  isBun: boolean;
  isNode: boolean;
}

/**
 * Detect the current JavaScript runtime
 */
export function detectRuntime(): RuntimeInfo {
  // Check for Bun
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis) {
    // @ts-ignore - Bun is a global when running in Bun runtime
    const bunVersion = (globalThis as any).Bun?.version || 'unknown';
    return {
      runtime: 'bun',
      version: bunVersion,
      isBun: true,
      isNode: false,
    };
  }

  // Check for Node.js
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return {
      runtime: 'node',
      version: process.versions.node,
      isBun: false,
      isNode: true,
    };
  }

  // Unknown runtime
  return {
    runtime: 'unknown',
    version: 'unknown',
    isBun: false,
    isNode: false,
  };
}

/**
 * Get the optimal executable for git commands based on runtime
 */
export function getGitExecutable(): string {
  // On Windows, use git.exe
  if (process.platform === 'win32') {
    return 'git.exe';
  }

  // On Unix-like systems, use git
  return 'git';
}

/**
 * Check if the runtime supports native performance optimizations
 */
export function supportsNativeOptimizations(): boolean {
  const { runtime } = detectRuntime();
  return runtime === 'bun';
}

/**
 * Get runtime-specific performance recommendations
 */
export function getPerformanceRecommendations(): string[] {
  const { runtime, version } = detectRuntime();
  const recommendations: string[] = [];

  if (runtime === 'node') {
    recommendations.push('Consider using Bun runtime for 42% better performance');
    const majorVersion = parseInt(version.split('.')[0] || '0');
    if (majorVersion < 20) {
      recommendations.push('Upgrade to Node.js 20+ for better performance');
    }
  } else if (runtime === 'bun') {
    recommendations.push('Using optimal Bun runtime');
  } else {
    recommendations.push('Unknown runtime - performance may vary');
  }

  return recommendations;
}

/**
 * Log runtime information for debugging
 */
export function logRuntimeInfo(): void {
  const { runtime, version } = detectRuntime();
  console.debug(`Running on ${runtime} ${version}`);
}