import { Config } from '../core/config.js';
import { Cache } from '../core/cache.js';
import { getStatusV2 } from './porcelain.js';

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(config: Config, _cache: Cache) {
    this.config = config;
    // A.3: the v1 branch cache (60s TTL) is gone with its helper; A.4 owns
    // reintroducing caching, so the injected Cache is currently unused.
  }

  /**
   * Get git information for a directory
   */
  async getGitInfo(directory: string): Promise<GitInfo | null> {
    if (this.config.noGitStatus) {
      return null;
    }
    try {
      const v2 = await getStatusV2(directory);
      if (!v2?.oid) {
        return null; // not a repo (exit 128) or git failure
      }
      // Detached HEAD: show short oid instead of "(no branch)" (PRD-004 A1b)
      const branch = v2.head ?? v2.oid.slice(0, 7);
      return { branch, indicators: v2.indicators };
    } catch (error) {
      console.debug('[DEBUG] Git operation failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Format git indicators into display string
   */
  formatIndicators(indicators: GitIndicators, symbols: Config['symbols']): string {
    const indicatorChars: string[] = [];

    if (indicators.stashed > 0) indicatorChars.push(symbols.stashed);
    if (indicators.renamed > 0) indicatorChars.push(symbols.renamed);
    if (indicators.modified > 0) indicatorChars.push('!');
    if (indicators.staged > 0) indicatorChars.push(symbols.staged);
    if (indicators.untracked > 0) indicatorChars.push('?');
    if (indicators.deleted > 0) indicatorChars.push(symbols.deleted);
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
