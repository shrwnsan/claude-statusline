import { Config } from '../core/config.js';

/**
 * Terminal width detection utilities
 * Ported from bash implementation with cross-platform Node.js support
 */

const DEFAULT_WIDTH = 80;

/**
 * Terminal width resolution — no shell-outs, no heuristics (PRD-004 A3).
 * Order: forceWidth (manual override) → COLUMNS env (Claude Code provides
 * it in the statusline payload env since 2.1.153) → process.stdout.columns
 * → fixed 80. `tput`/`stty` cannot work here: the statusline command runs
 * with captured output and no tty.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Promise-shaped API shared with the render() operations array
export async function getTerminalWidth(config: Config): Promise<number> {
  if (config.forceWidth && config.forceWidth > 0) {
    return config.forceWidth;
  }
  const columnsEnv = parseInt(process.env.COLUMNS ?? '', 10);
  if (!isNaN(columnsEnv) && columnsEnv > 0) {
    return columnsEnv;
  }
  if (process.stdout.columns && process.stdout.columns > 0) {
    return process.stdout.columns;
  }
  return DEFAULT_WIDTH;
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

  // Test environment variables
  const columnsEnv = process.env.COLUMNS;
  console.error(
    `[WIDTH DEBUG] CLAUDE_CODE_STATUSLINE_FORCE_WIDTH: ${config.forceWidth ?? 'not set'}`
  );
  console.error(`[WIDTH DEBUG] COLUMNS variable: ${columnsEnv ?? 'not set'}`);

  // Show final result
  const finalWidth = await getTerminalWidth(config);
  console.error(`[WIDTH DEBUG] Final detected width: ${finalWidth}`);
  console.error(
    `[WIDTH DEBUG] Statusline will use: ${finalWidth - config.rightMargin} columns max`
  );
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
    indicators = bracketMatch[1] ?? '';
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
    if (
      code >= 0x1100 &&
      ((code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
        (code >= 0x2e80 && code <= 0xa4cf) || // CJK和各种符号
        (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
        (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
        (code >= 0xfe10 && code <= 0xfe19) || // Vertical forms
        (code >= 0xfe30 && code <= 0xfe6f) || // CJK Compatibility Forms
        (code >= 0xff00 && code <= 0xff60) || // Fullwidth Forms
        (code >= 0xffe0 && code <= 0xffe6) ||
        (code >= 0x20000 && code <= 0x2fffd) ||
        (code >= 0x30000 && code <= 0x3fffd))
    ) {
      width += 2;
    }
    // Emoji and various symbols (including Nerd Font icons in Private Use Area)
    else if (
      (code >= 0x1f300 && code <= 0x1f9ff) || // Emoji
      (code >= 0x2600 && code <= 0x27bf) || // Miscellaneous symbols
      (code >= 0xfe00 && code <= 0xfe0f) || // Variation Selectors
      (code >= 0x1f000 && code <= 0x1f02f) || // Mahjong tiles
      (code >= 0xe000 && code <= 0xf8ff) || // Private Use Area (Nerd Font icons)
      (code >= 0xf0000 && code <= 0xffffd) || // Supplementary Private Use Area-A
      (code >= 0x100000 && code <= 0x10fffd) // Supplementary Private Use Area-B
    ) {
      width += 2;
    }
    // Combining characters (zero width)
    else if (
      (code >= 0x0300 && code <= 0x036f) || // Combining diacritical marks
      (code >= 0x1dc0 && code <= 0x1dff) || // Combining diacritical marks extended
      (code >= 0x20d0 && code <= 0x20ff) || // Combining marks for symbols
      (code >= 0xfe20 && code <= 0xfe2f) // Combining half marks
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
