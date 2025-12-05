import { Config } from '../core/config.js';
import { Cache, cachedCommand, CacheKeys } from '../core/cache.js';
import simpleGit, { SimpleGit } from 'simple-git';

/**
 * Git status information interface
 */
export interface GitInfo {
  branch: string;
  indicators: GitIndicators;
}

/**
 * Git status indicators
 */
export interface GitIndicators {
  stashed: number;
  staged: number;
  modified: number;
  untracked: number;
  renamed: number;
  deleted: number;
  conflicts: number;
  ahead: number;
  behind: number;
  diverged: boolean;
}

/**
 * Empty git indicators (no changes)
 */
export const EMPTY_INDICATORS: GitIndicators = {
  stashed: 0,
  staged: 0,
  modified: 0,
  untracked: 0,
  renamed: 0,
  deleted: 0,
  conflicts: 0,
  ahead: 0,
  behind: 0,
  diverged: false,
};

/**
 * Git operations and status parsing
 * Ported from bash implementation with enhanced TypeScript safety
 */
export class GitOperations {
  private config: Config;
  private cache: Cache;

  constructor(config: Config, cache: Cache) {
    this.config = config;
    this.cache = cache;
  }

  /**
   * Get git information for a directory
   */
  async getGitInfo(directory: string): Promise<GitInfo | null> {
    if (this.config.noGitStatus) {
      return null;
    }

    try {
      const git = simpleGit(directory, {
        timeout: { block: 5000 },
      });

      // Check if this is a git repository
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return null;
      }

      // Get current branch
      const branch = await this.getCurrentBranch(git, directory);
      if (!branch) {
        return null;
      }

      // Get status indicators
      const indicators = await this.getGitIndicators(git, directory);

      return { branch, indicators };

    } catch (error) {
      console.debug('[DEBUG] Git operation failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Get current branch name with caching
   */
  private async getCurrentBranch(git: SimpleGit, directory: string): Promise<string | null> {
    const cacheKey = `${CacheKeys.GIT_BRANCH(directory)}_current`;

    // Try cache first
    const cached = await this.cache.get<string>(cacheKey, 60); // 1 minute TTL for branch
    if (cached) {
      return cached;
    }

    try {
      // Try multiple methods to get branch name
      let branch: string | null = null;

      // Method 1: git branch --show-current (most reliable)
      try {
        const result = await git.raw(['branch', '--show-current']);
        branch = result.trim();
      } catch {
        // Method 2: git rev-parse --abbrev-ref HEAD
        try {
          const result = await git.raw(['rev-parse', '--abbrev-ref', 'HEAD']);
          branch = result.trim();
          // Filter out HEAD if not on a branch
          if (branch === 'HEAD') {
            branch = null;
          }
        } catch {
          // Method 3: Parse git branch output
          try {
            const branches = await git.branch();
            branch = branches.current || null;
          } catch {
            // All methods failed
          }
        }
      }

      if (branch && branch.trim()) {
        const finalBranch = branch.trim();
        await this.cache.set(cacheKey, finalBranch);
        return finalBranch;
      }

      return null;

    } catch (error) {
      console.debug('[DEBUG] Failed to get current branch:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Get comprehensive git status indicators
   */
  private async getGitIndicators(git: SimpleGit, directory: string): Promise<GitIndicators> {
    const indicators = { ...EMPTY_INDICATORS };

    try {
      // Get porcelain status for parsing
      const statusResult = await git.raw(['status', '--porcelain']);
      const statusLines = statusResult.trim().split('\n').filter(line => line.trim());

      // Parse each status line
      for (const line of statusLines) {
        if (line.length < 2) continue;

        const stagedChar = line.charAt(0);
        const unstagedChar = line.charAt(1);

        // Check for conflicts (U = unmerged)
        if (stagedChar === 'U' || unstagedChar === 'U' ||
            (stagedChar === 'A' && unstagedChar === 'A') ||
            (stagedChar === 'D' && unstagedChar === 'D')) {
          indicators.conflicts++;
        }
        // Check for untracked files
        else if (stagedChar === '?' && unstagedChar === '?') {
          indicators.untracked++;
        } else {
          // Parse staged changes (first character)
          switch (stagedChar) {
            case 'M':
              indicators.staged++; // Modified
              break;
            case 'A':
              indicators.staged++; // Added
              break;
            case 'D':
              indicators.deleted++; // Deleted (staged)
              break;
            case 'R':
              indicators.renamed++; // Renamed (staged)
              break;
            case 'C':
              indicators.staged++; // Copied (staged)
              break;
          }

          // Parse unstaged changes (second character)
          switch (unstagedChar) {
            case 'M':
              indicators.modified++; // Modified
              break;
            case 'D':
              indicators.deleted++; // Deleted (unstaged)
              break;
            case 'R':
              indicators.renamed++; // Renamed (unstaged)
              break;
          }
        }
      }

      // Get stashed changes count
      indicators.stashed = await this.getStashedCount(git);

      // Get ahead/behind information
      const { ahead, behind } = await this.getAheadBehind(git);
      indicators.ahead = ahead;
      indicators.behind = behind;
      indicators.diverged = ahead > 0 && behind > 0;

    } catch (error) {
      console.debug('[DEBUG] Failed to parse git status:', error instanceof Error ? error.message : String(error));
    }

    return indicators;
  }

  /**
   * Get number of stashed changes
   */
  private async getStashedCount(git: SimpleGit): Promise<number> {
    try {
      const stashList = await git.raw(['stash', 'list']);
      return stashList.trim().split('\n').filter(line => line.trim()).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get ahead/behind count for tracking branch
   */
  private async getAheadBehind(git: SimpleGit): Promise<{ ahead: number; behind: number }> {
    try {
      // Check if we have an upstream branch
      const upstream = await git.raw(['rev-parse', '--abbrev-ref', '@{u}']);
      if (!upstream.trim()) {
        return { ahead: 0, behind: 0 };
      }

      // Get ahead/behind count
      const result = await git.raw(['rev-list', '--count', '--left-right', '@{u}...HEAD']);
      const counts = result.trim().split('\t');

      if (counts.length === 2) {
        const behind = parseInt(counts[0], 10) || 0;
        const ahead = parseInt(counts[1], 10) || 0;
        return { ahead, behind };
      }

    } catch {
      // No upstream or other error
    }

    return { ahead: 0, behind: 0 };
  }

  /**
   * Format git indicators into display string
   */
  formatIndicators(indicators: GitIndicators, symbols: Config['symbols']): string {
    const indicatorChars: string[] = [];

    // Follow Starship order: ⚑✘!+?⇕⇡⇣
    if (indicators.stashed > 0) indicatorChars.push(symbols.stashed);
    if (indicators.deleted > 0) indicatorChars.push(symbols.deleted);
    if (indicators.modified > 0) indicatorChars.push('!');
    if (indicators.staged > 0) indicatorChars.push(symbols.staged);
    if (indicators.untracked > 0) indicatorChars.push('?');
    if (indicators.renamed > 0) indicatorChars.push(symbols.renamed);
    if (indicators.conflicts > 0) indicatorChars.push(symbols.conflict);

    // Ahead/behind status
    if (indicators.diverged) {
      indicatorChars.push(symbols.diverged);
    } else {
      if (indicators.ahead > 0) indicatorChars.push(symbols.ahead);
      if (indicators.behind > 0) indicatorChars.push(symbols.behind);
    }

    return indicatorChars.join('');
  }

  /**
   * Get git status string for display
   */
  formatGitStatus(gitInfo: GitInfo, symbols: Config['symbols']): string {
    const indicators = this.formatIndicators(gitInfo.indicators, symbols);
    const gitSymbol = this.config.noEmoji ? symbols.git : symbols.git;

    if (indicators) {
      return ` ${gitSymbol} ${gitInfo.branch} [${indicators}]`;
    } else {
      return ` ${gitSymbol} ${gitInfo.branch}`;
    }
  }
}