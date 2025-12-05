import { Config } from '../core/config.js';

/**
 * Symbol detection and management
 * Ported from bash implementation with enhanced Nerd Font detection
 */

/**
 * Symbol configuration interface
 */
export interface SymbolSet {
  git: string;
  model: string;
  staged: string;
  conflict: string;
  stashed: string;
  ahead: string;
  behind: string;
  diverged: string;
  renamed: string;
  deleted: string;
}

/**
 * ASCII symbol set (fallback)
 */
const ASCII_SYMBOLS: SymbolSet = {
  git: '@',
  model: '*',
  staged: '+',
  conflict: 'C',
  stashed: '$',
  ahead: 'A',
  behind: 'B',
  diverged: 'D',
  renamed: '>',
  deleted: 'X',
};

/**
 * Nerd Font symbol set (enhanced)
 */
const NERD_FONT_SYMBOLS: SymbolSet = {
  git: '',
  model: '󰚩',
  staged: '+',
  conflict: '×',
  stashed: '⚑',
  ahead: '↑',
  behind: '↓',
  diverged: '⇕',
  renamed: '»',
  deleted: '✘',
};

/**
 * Terminal detection results
 */
interface TerminalInfo {
  hasNerdFont: boolean;
  terminal: string;
  font: string;
  method: string;
}

/**
 * Detect Nerd Font support and return appropriate symbols
 */
export async function detectSymbols(config: Config): Promise<SymbolSet> {
  // If emoji/nerd font is explicitly disabled, use ASCII
  if (config.noEmoji) {
    return { ...ASCII_SYMBOLS, ...config.symbols, ...config.asciiSymbols };
  }

  // Try to detect Nerd Font support
  const detection = await detectNerdFontSupport();

  if (detection.hasNerdFont) {
    // Merge user's custom symbols with Nerd Font defaults
    return { ...NERD_FONT_SYMBOLS, ...config.symbols };
  } else {
    // Merge user's custom ASCII symbols with ASCII defaults
    return { ...ASCII_SYMBOLS, ...config.asciiSymbols };
  }
}

/**
 * Comprehensive Nerd Font support detection
 */
async function detectNerdFontSupport(): Promise<TerminalInfo> {
  const terminalInfo: TerminalInfo = {
    hasNerdFont: false,
    terminal: '',
    font: '',
    method: '',
  };

  // Method 1: Environment variable NERD_FONT=1
  if (process.env.NERD_FONT === '1') {
    terminalInfo.hasNerdFont = true;
    terminalInfo.method = 'NERD_FONT env var';
    return terminalInfo;
  }

  // Method 2: Terminal program detection
  const termProgram = process.env.TERM_PROGRAM;
  const term = process.env.TERM;

  if (termProgram) {
    terminalInfo.terminal = termProgram;
    terminalInfo.method = 'TERM_PROGRAM detection';

    // These terminals commonly have Nerd Font support
    const nerdFontTerminals = ['vscode', 'ghostty', 'wezterm', 'iterm'];
    if (nerdFontTerminals.includes(termProgram)) {
      terminalInfo.hasNerdFont = true;
      return terminalInfo;
    }
  }

  if (term) {
    terminalInfo.terminal = term;
    terminalInfo.method = 'TERM detection';

    // These terminal types commonly support Nerd Fonts
    const nerdFontTerms = ['alacritty', 'kitty', 'wezterm', 'ghostty', 'xterm-256color'];
    if (nerdFontTerms.includes(term)) {
      terminalInfo.hasNerdFont = true;
      return terminalInfo;
    }
  }

  // Method 3: Try to detect via font list (Unix/Linux/macOS)
  const fontDetection = await detectViaFontList();
  if (fontDetection.hasNerdFont) {
    terminalInfo.hasNerdFont = true;
    terminalInfo.font = fontDetection.font;
    terminalInfo.method = 'font list detection';
    return terminalInfo;
  }

  // Method 4: Check for common Nerd Font installation patterns
  const installDetection = await detectNerdFontInstallation();
  if (installDetection.hasNerdFont) {
    terminalInfo.hasNerdFont = true;
    terminalInfo.font = installDetection.font;
    terminalInfo.method = 'installation detection';
    return terminalInfo;
  }

  // Method 5: Check environment variables that might indicate font support
  const envDetection = detectFromEnvironment();
  if (envDetection.hasNerdFont) {
    terminalInfo.hasNerdFont = true;
    terminalInfo.method = 'environment detection';
    return terminalInfo;
  }

  // Method 6: Platform-specific detection
  const platformDetection = await detectPlatformSpecific();
  if (platformDetection.hasNerdFont) {
    terminalInfo.hasNerdFont = true;
    terminalInfo.method = 'platform-specific detection';
    return terminalInfo;
  }

  // Default: no Nerd Font detected
  return terminalInfo;
}

/**
 * Detect Nerd Font via font list command
 */
async function detectViaFontList(): Promise<{ hasNerdFont: boolean; font: string }> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Try fc-list (Linux) or system_profiler (macOS)
    let fontListCommand = '';
    const platform = process.platform;

    if (platform === 'linux') {
      fontListCommand = 'fc-list';
    } else if (platform === 'darwin') {
      fontListCommand = 'system_profiler SPFontsDataType 2>/dev/null || system_profiler SPFontsDataType';
    }

    if (fontListCommand) {
      const { stdout } = await execAsync(fontListCommand, {
        timeout: 3000,
        encoding: 'utf-8',
      });

      const nerdFontPatterns = [
        /nerd font/i,
        /symbols only/i,
        /jetbrains mono.*nerd/i,
        /fira code.*nerd/i,
        /hack.*nerd/i,
        /source code pro.*nerd/i,
        /ubuntu mono.*nerd/i,
        /anonymous pro.*nerd/i,
      ];

      for (const pattern of nerdFontPatterns) {
        if (pattern.test(stdout)) {
          // Try to extract font name
          const match = stdout.match(/([^:\n]*)(?=\s*(nerd|symbols))/i);
          const fontName = match ? match[1] : 'Nerd Font';
          return { hasNerdFont: true, font: fontName.trim() };
        }
      }
    }
  } catch {
    // Font detection failed
  }

  return { hasNerdFont: false, font: '' };
}

/**
 * Detect Nerd Font installation in common locations
 */
async function detectNerdFontInstallation(): Promise<{ hasNerdFont: boolean; font: string }> {
  try {
    const { access, readdir } = await import('fs/promises');
    const { homedir } = await import('os');

    const platform = process.platform;
    const fontPaths: string[] = [];

    if (platform === 'darwin') {
      fontPaths.push(
        `${homedir()}/Library/Fonts`,
        '/System/Library/Fonts',
        '/Library/Fonts'
      );
    } else if (platform === 'linux') {
      fontPaths.push(
        `${homedir()}/.local/share/fonts`,
        `${homedir()}/.fonts`,
        '/usr/share/fonts',
        '/usr/local/share/fonts'
      );
    }

    const nerdFontNames = [
      'jetbrains-mono-nerd-font',
      'fira-code-nerd-font',
      'hack-nerd-font',
      'source-code-pro-nerd-font',
      'ubuntu-mono-nerd-font',
      'anonymous-pro-nerd-font',
    ];

    for (const fontPath of fontPaths) {
      try {
        await access(fontPath);
        const files = await readdir(fontPath);

        for (const file of files) {
          const fileName = file.toLowerCase();
          for (const nerdFontName of nerdFontNames) {
            if (fileName.includes(nerdFontName)) {
              return { hasNerdFont: true, font: file };
            }
          }
        }
      } catch {
        // Can't access this font directory
      }
    }
  } catch {
    // Font detection failed
  }

  return { hasNerdFont: false, font: '' };
}

/**
 * Detect Nerd Font support from environment variables
 */
function detectFromEnvironment(): { hasNerdFont: boolean } {
  // Check for various environment variables that might indicate Nerd Font support
  const nerdFontEnvVars = [
    'POWERLINE_COMMAND', // Often used with Nerd Fonts
    'NERDFONTS', // Some terminals set this
    'FONT_FAMILY', // Some terminals expose the current font
  ];

  for (const envVar of nerdFontEnvVars) {
    const value = process.env[envVar];
    if (value && value.toLowerCase().includes('nerd')) {
      return { hasNerdFont: true };
    }
  }

  // Check if we're in a development environment that likely has Nerd Fonts
  if (
    process.env.VSCODE_PID ||
    process.env.TERM_PROGRAM === 'vscode' ||
    process.env.TERM_PROGRAM === 'ghostty' ||
    process.env.TERM_PROGRAM === 'wezterm'
  ) {
    return { hasNerdFont: true };
  }

  return { hasNerdFont: false };
}

/**
 * Platform-specific Nerd Font detection
 */
async function detectPlatformSpecific(): Promise<{ hasNerdFont: boolean }> {
  const platform = process.platform;

  if (platform === 'darwin') {
    // macOS: check if we're in a common development environment
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Check for Homebrew-installed Nerd Fonts
      const { stdout } = await execAsync('brew list | grep -i font', {
        timeout: 2000,
        encoding: 'utf-8',
      });

      if (stdout.includes('nerd')) {
        return { hasNerdFont: true };
      }
    } catch {
      // brew command failed or not available
    }
  }

  return { hasNerdFont: false };
}

/**
 * Get environment symbols with version information
 */
export function getEnvironmentSymbols(symbolSet: SymbolSet): { [key: string]: string } {
  return {
    node: '', // Node.js
    python: '', // Python
    docker: '', // Docker
    git: symbolSet.git,
    model: symbolSet.model,
  };
}

/**
 * Test if symbols can be displayed properly
 */
export async function testSymbolDisplay(symbols: SymbolSet): Promise<boolean> {
  // In a terminal environment, we can't easily test if symbols display correctly
  // For now, we'll assume that if we detected Nerd Font support, they can be displayed
  return true;
}