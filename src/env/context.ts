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
    if (!this.config.envContext) {
      return null;
    }

    const envInfo: EnvironmentInfo = {};

    // Get version information in parallel for better performance
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

    // Return null if no environment versions were found
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

    // Try cache first
    const cached = await this.cache.get<string>(cacheKey, this.config.cacheTTL);
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
        this.config.cacheTTL
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

    // Try python3 first
    try {
      let version = await cachedCommand(
        this.cache,
        python3Key,
        'python3',
        ['--version'],
        this.config.cacheTTL
      );

      if (version) {
        // Extract version number from "Python 3.x.y" format
        const versionMatch = version.match(/(\d+\.\d+\.\d+)/);
        if (versionMatch) {
          return versionMatch[1];
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
        this.config.cacheTTL
      );

      if (version) {
        // Extract version number from "Python 3.x.y" or "Python 2.x.y" format
        const versionMatch = version.match(/(\d+\.\d+\.\d+)/);
        if (versionMatch) {
          return versionMatch[1];
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
        this.config.cacheTTL * 6 // Longer TTL for Docker (30 minutes vs 5 minutes)
      );

      if (version) {
        // Extract version number from "Docker version 20.x.y" format
        const versionMatch = version.match(/Docker version (\d+\.\d+\.\d+)/);
        if (versionMatch) {
          return versionMatch[1];
        }
      }

      return null;

    } catch (error) {
      console.debug('[DEBUG] Failed to get Docker version:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Format environment information for display
   */
  formatEnvironmentInfo(envInfo: EnvironmentInfo, symbols: ReturnType<typeof getEnvironmentSymbols>): string {
    const parts: string[] = [];

    if (envInfo.node) {
      parts.push(`${symbols.node}${envInfo.node}`);
    }

    if (envInfo.python) {
      parts.push(`${symbols.python}${envInfo.python}`);
    }

    if (envInfo.docker) {
      parts.push(`${symbols.docker}${envInfo.docker}`);
    }

    return parts.join(' ');
  }

  /**
   * Get additional tool versions (for future expansion)
   */
  async getAdditionalTools(): Promise<{ [key: string]: string }> {
    const additionalTools: { [key: string]: string } = {};

    // Future tools could include:
    // - Go version
    // - Rust version
    // - Java version
    // - Ruby version
    // - Kubernetes version
    // - Helm version
    // - etc.

    return additionalTools;
  }

  /**
   * Check if a specific tool is available in the environment
   */
  async isToolAvailable(tool: string): Promise<boolean> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      await execAsync(`command -v ${tool}`, { timeout: 2000 });
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

    return { shell, shellVersion };
  }

  /**
   * Get operating system information
   */
  getOSInfo(): { platform: string; arch: string; release?: string } {
    const platform = process.platform;
    const arch = process.arch;
    const release = process.env.OSTYPE || process.env.OS;

    return { platform, arch, release };
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
   * Format environment info in different styles
   */
  format(envInfo: EnvironmentInfo, style: 'compact' | 'verbose' | 'minimal' = 'compact'): string {
    switch (style) {
      case 'compact':
        return this.formatCompact(envInfo);
      case 'verbose':
        return this.formatVerbose(envInfo);
      case 'minimal':
        return this.formatMinimal(envInfo);
      default:
        return this.formatCompact(envInfo);
    }
  }

  /**
   * Compact format: Node22.17 Py3.13 Docker28.3
   */
  private formatCompact(envInfo: EnvironmentInfo): string {
    const parts: string[] = [];

    if (envInfo.node) {
      parts.push(`Node${envInfo.node}`);
    }

    if (envInfo.python) {
      parts.push(`Py${envInfo.python}`);
    }

    if (envInfo.docker) {
      parts.push(`Docker${envInfo.docker}`);
    }

    return parts.join(' ');
  }

  /**
   * Verbose format: Node.js v22.17.1 • Python 3.13.5 • Docker 28.3.3
   */
  private formatVerbose(envInfo: EnvironmentInfo): string {
    const parts: string[] = [];

    if (envInfo.node) {
      parts.push(`Node.js v${envInfo.node}`);
    }

    if (envInfo.python) {
      parts.push(`Python ${envInfo.python}`);
    }

    if (envInfo.docker) {
      parts.push(`Docker ${envInfo.docker}`);
    }

    return parts.join(' • ');
  }

  /**
   * Minimal format: N22 P17 D28 (just major versions)
   */
  private formatMinimal(envInfo: EnvironmentInfo): string {
    const parts: string[] = [];

    if (envInfo.node) {
      const majorVersion = envInfo.node.split('.')[0];
      parts.push(`N${majorVersion}`);
    }

    if (envInfo.python) {
      const majorVersion = envInfo.python.split('.')[0];
      parts.push(`P${majorVersion}`);
    }

    if (envInfo.docker) {
      const majorVersion = envInfo.docker.split('.')[0];
      parts.push(`D${majorVersion}`);
    }

    return parts.join(' ');
  }

  /**
   * Format with icons: 22.17 3.13 28.3
   */
  formatWithIcons(envInfo: EnvironmentInfo): string {
    const parts: string[] = [];

    if (envInfo.node) {
      parts.push(`${this.symbols.node}${envInfo.node}`);
    }

    if (envInfo.python) {
      parts.push(`${this.symbols.python}${envInfo.python}`);
    }

    if (envInfo.docker) {
      parts.push(`${this.symbols.docker}${envInfo.docker}`);
    }

    return parts.join(' ');
  }
}