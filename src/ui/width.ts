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
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync(command, args, {
      timeout: 1000,
      encoding: 'utf-8' as BufferEncoding,
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
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync('stty', ['size'], {
      timeout: 1000,
      encoding: 'utf-8' as BufferEncoding,
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
  if (getStringDisplayWidth(text) <= maxLength) {
    return text;
  }

  if (maxLength < 4) {
    return '..';
  }

  const chars = Array.from(text);
  let width = 0;
  let endIndex = 0;

  for (let i = 0; i < chars.length; i++) {
    const charWidth = getStringDisplayWidth(chars[i]!);
    if (width + charWidth > maxLength - 2) {
      break;
    }
    width += charWidth;
    endIndex = i + 1;
  }

  return `${chars.slice(0, endIndex).join('')}..`;
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
  const projectWidth = getStringDisplayWidth(project);
  const gitInfoWidth = getStringDisplayWidth(gitInfo);

  // Step 1: Check if everything fits
  if (projectWidth + gitInfoWidth <= maxLen) {
    return '';
  }

  // Step 2: Truncate project only (preserve branch)
  const projLen = maxLen - gitInfoWidth - 2;
  if (projLen >= 5) {
    const projChars = Array.from(project);
    let width = 0;
    let endIndex = 0;
    for (let i = 0; i < projChars.length; i++) {
      const charWidth = getStringDisplayWidth(projChars[i]!);
      if (width + charWidth > projLen) break;
      width += charWidth;
      endIndex = i + 1;
    }
    return `${projChars.slice(0, endIndex).join('')}..${gitInfo}`;
  }

  // Step 3: Truncate project + branch (preserve indicators)
  let indicators = '';
  const bracketMatch = gitInfo.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    indicators = bracketMatch[1] || '';
  }

  const indicatorsWidth = getStringDisplayWidth(indicators);
  const branchLen = maxLen - indicatorsWidth - 8;
  if (branchLen >= 8) {
    const gitChars = Array.from(gitInfo);
    let gitWidth = 0;
    let gitEndIndex = 0;
    for (let i = 0; i < gitChars.length; i++) {
      const charWidth = getStringDisplayWidth(gitChars[i]!);
      if (gitWidth + charWidth > branchLen) break;
      gitWidth += charWidth;
      gitEndIndex = i + 1;
    }
    const gitPrefix = gitChars.slice(0, gitEndIndex).join('');

    const projChars = Array.from(project);
    let projWidth = 0;
    let projEndIndex = 0;
    for (let i = 0; i < projChars.length; i++) {
      const charWidth = getStringDisplayWidth(projChars[i]!);
      if (projWidth + charWidth > 4) break;
      projWidth += charWidth;
      projEndIndex = i + 1;
    }
    const projPrefix = projChars.slice(0, projEndIndex).join('');

    return `${projPrefix}..${gitPrefix}..${indicators ? ` [${indicators}]` : ''}`;
  }

  // Step 4: Basic fallback
  const fallbackChars = Array.from(project);
  let fallbackWidth = 0;
  let fallbackEndIndex = 0;
  for (let i = 0; i < fallbackChars.length; i++) {
    const charWidth = getStringDisplayWidth(fallbackChars[i]!);
    if (fallbackWidth + charWidth > maxLen) break;
    fallbackWidth += charWidth;
    fallbackEndIndex = i + 1;
  }
  return `${fallbackChars.slice(0, fallbackEndIndex).join('')}..`;
}

/**
 * Get the display width of a string, accounting for wide characters (CJK, emoji, Nerd Font icons)
 * Uses wcwidth-style logic where wide characters = 2 columns, narrow = 1 column
 */
export function getStringDisplayWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    const code = char.codePointAt(0) ?? 0;

    // Wide character ranges (CJK, emoji, Nerd Font icons, etc.)
    // CJK Unified Ideographs
    if (code >= 0x1100 && (
      (code >= 0x1100 && code <= 0x115F) || // Hangul Jamo
      (code >= 0x2E80 && code <= 0xA4CF) || // CJK和各种符号
      (code >= 0xAC00 && code <= 0xD7A3) || // Hangul Syllables
      (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
      (code >= 0xFE10 && code <= 0xFE19) || // Vertical forms
      (code >= 0xFE30 && code <= 0xFE6F) || // CJK Compatibility Forms
      (code >= 0xFF00 && code <= 0xFF60) || // Fullwidth Forms
      (code >= 0xFFE0 && code <= 0xFFE6) ||
      (code >= 0x20000 && code <= 0x2FFFD) ||
      (code >= 0x30000 && code <= 0x3FFFD)
    )) {
      width += 2;
    }
    // Emoji and various symbols (including Nerd Font icons in Private Use Area)
    else if (
      (code >= 0x1F300 && code <= 0x1F9FF) || // Emoji
      (code >= 0x2600 && code <= 0x27BF) ||   // Miscellaneous symbols
      (code >= 0xFE00 && code <= 0xFE0F) ||   // Variation Selectors
      (code >= 0x1F000 && code <= 0x1F02F) || // Mahjong tiles
      (code >= 0xE000 && code <= 0xF8FF) ||   // Private Use Area (Nerd Font icons)
      (code >= 0xF0000 && code <= 0xFFFFD) || // Supplementary Private Use Area-A
      (code >= 0x100000 && code <= 0x10FFFD)  // Supplementary Private Use Area-B
    ) {
      width += 2;
    }
    // Combining characters (zero width)
    else if (
      (code >= 0x0300 && code <= 0x036F) ||   // Combining diacritical marks
      (code >= 0x1DC0 && code <= 0x1DFF) ||   // Combining diacritical marks extended
      (code >= 0x20D0 && code <= 0x20FF) ||   // Combining marks for symbols
      (code >= 0xFE20 && code <= 0xFE2F)      // Combining half marks
    ) {
      // Zero width, don't increment
    }
    // Normal ASCII and narrow characters
    else {
      width += 1;
    }
  }
  return width;
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

    // Adjust break position to avoid splitting multi-byte UTF-8 characters
    // UTF-8 continuation bytes have their two most significant bits set to 10 (0x80 to 0xBF)
    while (breakPos > 0 && (text.charCodeAt(breakPos) & 0xC0) === 0x80) {
      breakPos--;
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
    let breakPos = maxLength;

    // Adjust break position to avoid splitting multi-byte UTF-8 characters
    // UTF-8 continuation bytes have their two most significant bits set to 10 (0x80 to 0xBF)
    while (breakPos > 0 && (text.charCodeAt(breakPos) & 0xC0) === 0x80) {
      breakPos--;
    }

    const firstLine = text.substring(0, breakPos);
    const secondLine = text.substring(breakPos);
    return `${firstLine} ${secondLine}`;
  }
}