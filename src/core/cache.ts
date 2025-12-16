import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { Config } from './config.js';

/**
 * Simple caching system with TTL support
 * Ported from bash implementation with Node.js optimizations
 */


/**
 * Cache wrapper that handles TTL and file operations
 */
export class Cache {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await mkdir(this.config.cacheDir, { recursive: true });
    } catch (error) {
      // Directory might already exist or we can't create it
      console.warn('[WARNING] Failed to create cache directory:', this.config.cacheDir);
    }
  }

  /**
   * Get cache file path for a given key
   */
  private getCachePath(key: string): string {
    return join(this.config.cacheDir, key);
  }

  /**
   * Get cache timestamp file path for a given key
   */
  private getTimestampPath(key: string): string {
    return join(this.config.cacheDir, `${key}.time`);
  }

  /**
   * Read cached data with TTL validation
   */
  async get<T = string>(key: string, ttl: number = this.config.cacheTTL): Promise<T | null> {
    const cachePath = this.getCachePath(key);
    const timestampPath = this.getTimestampPath(key);

    try {
      // Check if cache files exist
      if (!existsSync(cachePath) || !existsSync(timestampPath)) {
        return null;
      }

      // Read timestamp and check TTL
      const timestampContent = await readFile(timestampPath, 'utf-8');
      const timestamp = parseInt(timestampContent.trim(), 10);

      if (isNaN(timestamp)) {
        return null;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const age = currentTime - timestamp;

      // In development, reduce cache TTL to prevent stale data
      const effectiveTTL = process.env.NODE_ENV === 'development' ? Math.min(ttl, 5) : ttl;

      if (age >= effectiveTTL) {
        // Cache expired
        return null;
      }

      // Read cached data
      const dataContent = await readFile(cachePath, 'utf-8');

      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(dataContent) as T;
      } catch {
        return dataContent as T;
      }

    } catch (error) {
      // Any error reading cache should result in cache miss
      console.debug('[DEBUG] Cache read error for key:', key, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Write data to cache with timestamp
   */
  async set<T = string>(key: string, data: T): Promise<boolean> {
    const cachePath = this.getCachePath(key);
    const timestampPath = this.getTimestampPath(key);

    try {
      // Ensure cache directory exists
      await this.ensureCacheDir();

      // Prepare data for storage
      let dataContent: string;
      if (typeof data === 'string') {
        dataContent = data;
      } else {
        dataContent = JSON.stringify(data);
      }

      // Write data and timestamp
      const currentTime = Math.floor(Date.now() / 1000);

      await Promise.all([
        writeFile(cachePath, dataContent, 'utf-8'),
        writeFile(timestampPath, currentTime.toString(), 'utf-8'),
      ]);

      return true;

    } catch (error) {
      console.warn('[WARNING] Failed to write cache for key:', key, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  async has(key: string, ttl: number = this.config.cacheTTL): Promise<boolean> {
    const value = await this.get(key, ttl);
    return value !== null;
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<boolean> {
    const cachePath = this.getCachePath(key);
    const timestampPath = this.getTimestampPath(key);

    try {
      const { unlink } = await import('fs/promises');

      await Promise.allSettled([
        unlink(cachePath),
        unlink(timestampPath),
      ]);

      return true;
    } catch (error) {
      console.warn('[WARNING] Failed to delete cache for key:', key, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<boolean> {
    try {
      const { readdir, unlink } = await import('fs/promises');
      const files = await readdir(this.config.cacheDir);

      await Promise.allSettled(
        files.map(file => unlink(join(this.config.cacheDir, file)))
      );

      return true;
    } catch (error) {
      console.warn('[WARNING] Failed to clear cache:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ total: number; size: number }> {
    try {
      const { readdir, stat } = await import('fs/promises');
      const files = await readdir(this.config.cacheDir);

      let totalSize = 0;
      let cacheFiles = 0;

      for (const file of files) {
        if (!file.endsWith('.time')) {
          cacheFiles++;
          const filePath = join(this.config.cacheDir, file);
          try {
            const stats = await stat(filePath);
            totalSize += stats.size;
          } catch {
            // Skip files that can't be stat'ed
          }
        }
      }

      return { total: cacheFiles, size: totalSize };
    } catch (error) {
      console.warn('[WARNING] Failed to get cache stats:', error instanceof Error ? error.message : String(error));
      return { total: 0, size: 0 };
    }
  }
}

/**
 * Cache key generators for common use cases
 */
export const CacheKeys = {
  NODE_VERSION: 'node_version',
  PYTHON_VERSION: 'python_version',
  PYTHON3_VERSION: 'python3_version',
  DOCKER_VERSION: 'docker_version',
  GIT_REMOTE_URL: (dir: string) => `git_remote_${Buffer.from(dir).toString('base64')}`,
  GIT_BRANCH: (dir: string) => `git_branch_${Buffer.from(dir).toString('base64')}`,
} as const;

/**
 * Cached command execution helper
 * Runs a command and caches the result
 */
export async function cachedCommand(
  cache: Cache,
  key: string,
  command: string,
  args: string[] = [],
  ttl: number = 300
): Promise<string | null> {
  // Try to get from cache first
  const cached = await cache.get<string>(key, ttl);
  if (cached !== null) {
    return cached;
  }

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync(`${command} ${args.join(' ')}`, {
      timeout: 5000, // 5 second timeout
      encoding: 'utf-8',
    });

    const result = stdout.trim();
    if (result) {
      // Cache the successful result
      await cache.set(key, result);
    }

    return result;

  } catch (error) {
    console.debug('[DEBUG] Command execution failed:', command, error instanceof Error ? error.message : String(error));
    return null;
  }
}