import { Config } from '../core/config.js';
import { Cache, cachedCommand, CacheKeys } from '../core/cache.js';
import { getEnvironmentSymbols } from '../ui/symbols.js';

/**
 * Environment version information interface
 */
export interface EnvironmentInfo {
  node?: string;
  python?: string;
  docker?: string;
  vpn?: boolean;
}

/**
 * Environment context detection
 * Ported from bash implementation with enhanced TypeScript safety
 */
export class EnvironmentDetector {
  private config: Config;
  private cache: Cache;

  constructor(config: Config, cache: Cache) {
    this.config = config;
    this.cache = cache;
  }

    /**
   * Get environment information if context is enabled
   */
  async getEnvironmentInfo(): Promise<EnvironmentInfo | null> {
    // Always get VPN status if vpnIndicator is enabled, regardless of envContext
    const shouldGetVPN = this.config.vpnIndicator;

    if (!this.config.envContext && !this.config.vpnIndicator) {
      return null;
    }

    const envInfo: EnvironmentInfo = {};

    // Only fetch environment versions if envContext is enabled
    if (this.config.envContext) {
      const [nodeVersion, pythonVersion, dockerVersion] = await Promise.allSettled([
        this.getNodeVersion(),
        this.getPythonVersion(),
        this.getDockerVersion(),
      ]);

      if (nodeVersion.status === 'fulfilled' && nodeVersion.value) {
        envInfo.node = nodeVersion.value;
      }

      if (pythonVersion.status === 'fulfilled' && pythonVersion.value) {
        envInfo.python = pythonVersion.value;
      }

      if (dockerVersion.status === 'fulfilled' && dockerVersion.value) {
        envInfo.docker = dockerVersion.value;
      }
    }

    // Get VPN status if needed
    if (shouldGetVPN) {
      const vpnStatus = await this.getVPNStatus();
      if (vpnStatus !== null) {
        envInfo.vpn = vpnStatus;
      }
    }

    // Return null if no environment versions were found
    // But still return envInfo if only VPN status is present and vpnIndicator is enabled
    if (Object.keys(envInfo).length === 0) {
      return null;
    }

    return envInfo;
  }

  /**
   * Get Node.js version with caching
   */
  private async getNodeVersion(): Promise<string | null> {
    const cacheKey = CacheKeys.NODE_VERSION;
    // Environment versions change rarely, cache for 8 hours (96x default TTL)
    // Covers a full workday - users rarely update Node/Python/Docker multiple times per day
    const envCacheTTL = this.config.cacheTTL * 96;

    // Try cache first
    const cached = await this.cache.get<string>(cacheKey, envCacheTTL);
    if (cached) {
      return cached;
    }

    try {
      // Method 1: node --version
      let version = await cachedCommand(
        this.cache,
        cacheKey,
        'node',
        ['--version'],
        envCacheTTL
      );

      if (version) {
        // Remove 'v' prefix and clean up
        return version.replace(/^v/, '').trim();
      }

      return null;

    } catch (error) {
      console.debug('[DEBUG] Failed to get Node.js version:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Get Python version with caching (tries python3 first, then python)
   */
  private async getPythonVersion(): Promise<string | null> {
    const python3Key = CacheKeys.PYTHON3_VERSION;
    const pythonKey = CacheKeys.PYTHON_VERSION;
    // Environment versions change rarely, cache for 8 hours (96x default TTL)
    // Covers a full workday - users rarely update Node/Python/Docker multiple times per day
    const envCacheTTL = this.config.cacheTTL * 96;

    // Try python3 first
    try {
      let version = await cachedCommand(
        this.cache,
        python3Key,
        'python3',
        ['--version'],
        envCacheTTL
      );

      if (version) {
        // Extract version number from "Python 3.x.y" format
        const versionMatch = version.match(/(\d+\.\d+\.\d+)/);
        if (versionMatch) {
          return versionMatch[1] || null;
        }
      }
    } catch {
      // python3 not available, try python
    }

    // Fallback to python
    try {
      let version = await cachedCommand(
        this.cache,
        pythonKey,
        'python',
        ['--version'],
        envCacheTTL
      );

      if (version) {
        // Extract version number from "Python 3.x.y" or "Python 2.x.y" format
        const versionMatch = version.match(/(\d+\.\d+\.\d+)/);
        if (versionMatch) {
          return versionMatch[1] || null;
        }
      }
    } catch {
      // python not available either
    }

    return null;
  }

  /**
   * Get Docker version with caching
   */
  private async getDockerVersion(): Promise<string | null> {
    const cacheKey = 'docker_version';

    try {
      let version = await cachedCommand(
        this.cache,
        cacheKey,
        'docker',
        ['--version'],
        this.config.cacheTTL * 96 // Longer TTL for Docker (8 hours vs 5 minutes)
      );

      if (version) {
        // Extract version number from "Docker version 20.x.y" format
        const versionMatch = version.match(/Docker version (\d+\.\d+\.\d+)/);
        if (versionMatch) {
          return versionMatch[1] || null;
        }
      }

      return null;

    } catch (error) {
      console.debug('[DEBUG] Failed to get Docker version:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Get VPN status with caching (macOS only)
   * Detects VPN by checking for UTun (User Tunnel) interfaces
   * Uses execFile (no shell) with in-process filtering
   */
  private async getVPNStatus(): Promise<boolean | null> {
    if (process.platform !== 'darwin') return null;

    const cacheKey = CacheKeys.VPN_STATUS;
    const vpnTTL = this.config.cacheTTL / 10;

    // Read-through cache
    const cached = await this.cache.get<string>(cacheKey, vpnTTL);
    if (cached !== null && cached !== undefined) return cached === '1';

    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(execFile);

    let detected = false;
    try {
      const { stdout } = await exec('netstat', ['-rn'], { timeout: 1000 });
      if (/^default.*utun[0-9]/m.test(stdout)) {
        detected = true;
      } else {
        // Fallback: scutil --nwi, grep for utun in JS
        const { stdout: nwi } = await exec('scutil', ['--nwi'], { timeout: 1000 });
        detected = /utun/i.test(nwi);
      }
    } catch (error) {
      console.debug('[DEBUG] Failed to get VPN status:', error instanceof Error ? error.message : String(error));
      return null;
    }

    await this.cache.set(cacheKey, detected ? '1' : '0');
    return detected;
  }

  /**
   * Check if a specific tool is available in the environment
   */
  async isToolAvailable(tool: string): Promise<boolean> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      await execFileAsync('which', [tool], { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get shell environment information
   */
  getShellEnvironment(): { shell: string; shellVersion?: string } {
    const shell = process.env.SHELL || 'unknown';

    // Try to extract shell version (basic implementation)
    let shellVersion: string | undefined;

    if (shell.includes('bash')) {
      shellVersion = process.env.BASH_VERSION;
    } else if (shell.includes('zsh')) {
      shellVersion = process.env.ZSH_VERSION;
    } else if (shell.includes('fish')) {
      shellVersion = process.env.FISH_VERSION;
    }

    return shellVersion ? { shell, shellVersion } : { shell };
  }

  /**
   * Get operating system information
   */
  getOSInfo(): { platform: string; arch: string; release?: string } {
    const platform = process.platform;
    const arch = process.arch;
    const release = process.env.OSTYPE || process.env.OS;

    return release ? { platform, arch, release } : { platform, arch };
  }
}

/**
 * Environment information formatter for different display modes
 */
export class EnvironmentFormatter {
  private symbols: ReturnType<typeof getEnvironmentSymbols>;

  constructor(symbols: ReturnType<typeof getEnvironmentSymbols>) {
    this.symbols = symbols;
  }

  /**
   * Format with icons (Nerd Font): 22.17 3.13 28.3
   * Format with icons (ASCII): node 22.17 py 3.13 dkr 28.3
   */
  formatWithIcons(envInfo: EnvironmentInfo): string {
    const parts: string[] = [];

    if (envInfo.node) {
      const icon = this.symbols.node;
      const sep = /[a-z]/i.test(icon) ? ' ' : '';
      parts.push(`${icon}${sep}${envInfo.node}`);
    }

    if (envInfo.python) {
      const icon = this.symbols.python;
      const sep = /[a-z]/i.test(icon) ? ' ' : '';
      parts.push(`${icon}${sep}${envInfo.python}`);
    }

    if (envInfo.docker) {
      const icon = this.symbols.docker;
      const sep = /[a-z]/i.test(icon) ? ' ' : '';
      parts.push(`${icon}${sep}${envInfo.docker}`);
    }

    return parts.join(' ');
  }
}