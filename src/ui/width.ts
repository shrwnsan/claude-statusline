import { Config } from '../core/config.js';

/**
 * Terminal width detection utilities
 * Ported from bash implementation with cross-platform Node.js support
 */

/**
 * Get terminal width using multiple detection methods
 * Ordered from most reliable to fallback methods
 */
export async function getTerminalWidth(config: Config): Promise<number> {
  // Method 0: Respect manual width override first (for testing)
  if (config.forceWidth && config.forceWidth > 0) {
    return config.forceWidth;
  }

  // Method 1: Try COLUMNS environment variable
  const columnsEnv = process.env.COLUMNS;
  if (columnsEnv) {
    const columns = parseInt(columnsEnv, 10);
    if (!isNaN(columns) && columns > 0) {
      return columns;
    }
  }

  // Method 2: Try Node.js process.stdout.columns
  if (process.stdout.columns && process.stdout.columns > 0) {
    return process.stdout.columns;
  }

  // Method 3: Try tput command (Unix/Linux/macOS)
  const tputWidth = await tryCommand('tput', ['cols']);
  if (tputWidth) {
    return tputWidth;
  }

  // Method 4: Try stty command (Unix/Linux/macOS)
  const sttyWidth = await tryStty();
  if (sttyWidth) {
    return sttyWidth;
  }

  // Method 5: Check Claude Code specific environment
  const claudeWidth = process.env.CLAUDE_CODE_TERMINAL_WIDTH;
  if (claudeWidth) {
    const width = parseInt(claudeWidth, 10);
    if (!isNaN(width) && width > 0) {
      return width;
    }
  }

  // Method 6: Terminal-specific defaults
  const termProgram = process.env.TERM_PROGRAM;
  const term = process.env.TERM;

  if (termProgram === 'vscode' && process.env.VSCODE_PID) {
    return 120; // VS Code default
  }

  if (['ghostty', 'wezterm', 'iterm'].includes(termProgram || '')) {
    return 120; // Modern terminals default to wider
  }

  if (term && ['alacritty', 'kitty', 'wezterm', 'ghostty', 'xterm-256color'].includes(term)) {
    return 120; // Modern terminals
  }

  // Method 7: Check for Windows Terminal
  if (process.env.WT_SESSION || process.env.WT_PROFILE_ID) {
    return 120; // Windows Terminal
  }

  // Final fallback: conservative 80-column default
  return 80;
}

/**
 * Execute a command and parse numeric output
 */
async function tryCommand(command: string, args: string[]): Promise<number | null> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync(`${command} ${args.join(' ')}`, {
      timeout: 1000, // 1 second timeout
      encoding: 'utf-8',
    });

    const width = parseInt(stdout.trim(), 10);
    if (!isNaN(width) && width > 0) {
      return width;
    }
  } catch {
    // Command failed or not available
  }

  return null;
}

/**
 * Try stty size command
 */
async function tryStty(): Promise<number | null> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync('stty size', {
      timeout: 1000,
      encoding: 'utf-8',
    });

    // stty size returns: "rows cols"
    const parts = stdout.trim().split(' ');
    if (parts.length === 2) {
      const width = parseInt(parts[1] || '0', 10);
      if (!isNaN(width) && width > 0) {
        return width;
      }
    }
  } catch {
    // stty failed or not available
  }

  return null;
}

/**
 * Debug width detection (matches bash implementation)
 */
export async function debugWidthDetection(config: Config): Promise<void> {
  if (!config.debugWidth) {
    return;
  }

  console.error('[WIDTH DEBUG] Debug mode enabled');

  console.error('[WIDTH DEBUG] Methods tried:');

  // Test process.stdout.columns
  if (process.stdout.columns) {
    console.error(`[WIDTH DEBUG] process.stdout.columns: ${process.stdout.columns}`);
  } else {
    console.error('[WIDTH DEBUG] process.stdout.columns: not available');
  }

  // Test COLUMNS variable
  const columnsEnv = process.env.COLUMNS;
  if (columnsEnv) {
    console.error(`[WIDTH DEBUG] COLUMNS variable: ${columnsEnv}`);
  } else {
    console.error('[WIDTH DEBUG] COLUMNS variable: not set');
  }

  // Test tput
  const tputWidth = await tryCommand('tput', ['cols']);
  if (tputWidth) {
    console.error(`[WIDTH DEBUG] tput cols: ${tputWidth}`);
  } else {
    console.error('[WIDTH DEBUG] tput: not available or failed');
  }

  // Test stty
  const sttyWidth = await tryStty();
  if (sttyWidth) {
    console.error(`[WIDTH DEBUG] stty size: ${sttyWidth}`);
  } else {
    console.error('[WIDTH DEBUG] stty: not available or failed');
  }

  // Test environment variables
  console.error(`[WIDTH DEBUG] CLAUDE_CODE_STATUSLINE_FORCE_WIDTH: ${config.forceWidth || 'not set'}`);
  console.error(`[WIDTH DEBUG] COLUMNS variable: ${columnsEnv || 'not set'}`);
  console.error(`[WIDTH DEBUG] CLAUDE_CODE_TERMINAL_WIDTH: ${process.env.CLAUDE_CODE_TERMINAL_WIDTH || 'not set'}`);
  console.error(`[WIDTH DEBUG] TERM_PROGRAM: ${process.env.TERM_PROGRAM || 'not set'}`);
  console.error(`[WIDTH DEBUG] TERM: ${process.env.TERM || 'not set'}`);

  // Show final result
  const finalWidth = await getTerminalWidth(config);
  console.error(`[WIDTH DEBUG] Final detected width: ${finalWidth}`);
  console.error(`[WIDTH DEBUG] Statusline will use: ${finalWidth - config.rightMargin} columns max`);
}

/**
 * Text truncation utilities
 */

/**
 * Simple text truncation with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Edge case: if maxLength is too small, return minimal result
  if (maxLength < 4) {
    return '..';
  }

  return `${text.substring(0, maxLength - 2)}..`;
}

/**
 * Smart truncation with branch prioritization (matches bash implementation)
 */
export function smartTruncate(
  project: string,
  gitInfo: string,
  maxLen: number,
  _config: Config
): string {
  // Step 1: Check if everything fits
  if (project.length + gitInfo.length <= maxLen) {
    return '';
  }

  // Step 2: Truncate project only (preserve branch)
  const projLen = maxLen - gitInfo.length - 2;
  if (projLen >= 5) {
    return `${project.substring(0, projLen)}..${gitInfo}`;
  }

  // Step 3: Truncate project + branch (preserve indicators)
  let indicators = '';
  const bracketMatch = gitInfo.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    indicators = bracketMatch[1] || '';
  }

  const branchLen = maxLen - indicators.length - 8;
  if (branchLen >= 8) {
    const gitPrefix = gitInfo.substring(0, Math.min(gitInfo.length, branchLen));
    return `${project.substring(0, 4)}..${gitPrefix}..${indicators ? ` [${indicators}]` : ''}`;
  }

  // Step 4: Basic fallback
  return `${project.substring(0, maxLen)}..`;
}

/**
 * Soft wrapping function (experimental)
 */
export function softWrapText(
  text: string,
  maxLength: number,
  wrapChar: 'newline' | 'space' = 'newline',
  modelPrefix: string = '*'
): string {
  if (text.length <= maxLength) {
    return text;
  }

  if (wrapChar === 'newline') {
    // Smart wrap: try to break at space or safe character
    let breakPos = maxLength;
    let foundBreak = false;

    // Look for safe break points (spaces)
    for (let i = Math.min(maxLength - 1, text.length - 1); i > Math.max(maxLength - 20, 0) && i >= 0; i--) {
      const char = text[i];
      if (char === ' ') {
        breakPos = i;
        foundBreak = true;
        break;
      }
    }

    // If no safe break found and we're very close to max_length, just fit without wrapping
    if (!foundBreak && maxLength - text.length > -3) {
      return text;
    }

    const firstLine = text.substring(0, breakPos);
    let secondLine = text.substring(breakPos);

    // Remove leading space from second line if we broke at space
    if (secondLine.startsWith(' ')) {
      secondLine = secondLine.substring(1);
    }

    // Only wrap if second line has meaningful content
    if (secondLine) {
      return `${firstLine}\n${modelPrefix}${secondLine}`;
    } else {
      return firstLine;
    }
  } else {
    // Use space separator for wrapping
    const firstLine = text.substring(0, maxLength);
    const secondLine = text.substring(maxLength);
    return `${firstLine} ${secondLine}`;
  }
}