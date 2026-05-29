import { Config } from '../core/config.js';

/**
 * Symbol configuration interface
 */
export interface SymbolSet {
  git: string;
  model: string;
  contextWindow: string;
  staged: string;
  conflict: string;
  stashed: string;
  ahead: string;
  behind: string;
  diverged: string;
  renamed: string;
  deleted: string;
  vpnOn: string;
  vpnOff: string;
  node: string;
  python: string;
  docker: string;
}

/**
 * ASCII symbol set (default / fallback)
 */
const ASCII_SYMBOLS: SymbolSet = {
  git: '@',
  model: '*',
  contextWindow: '≈',
  staged: '+',
  conflict: 'C',
  stashed: '$',
  ahead: 'A',
  behind: 'B',
  diverged: 'D',
  renamed: '>',
  deleted: 'X',
  vpnOn: '✓·vpn ·',
  vpnOff: '✗·vpn ·',
  node: 'node',
  python: 'py',
  docker: 'dkr',
};

/**
 * Nerd Font symbol set (opt-in via nerdFont: true)
 */
const NERD_FONT_SYMBOLS: SymbolSet = {
  git: '',
  model: '󰚩',
  contextWindow: '󱐌',
  staged: '+',
  conflict: '×',
  stashed: '⚑',
  ahead: '⇡',
  behind: '⇣',
  diverged: '⇕',
  renamed: '»',
  deleted: '✘',
  vpnOn: '◉',
  vpnOff: '○',
  node: '',
  python: '',
  docker: '',
};

/**
 * Detect and return the appropriate symbol set based on config.
 * Nerd Font is opt-in only — no auto-detection, no filesystem or shell calls.
 */
export async function detectSymbols(config: Config): Promise<SymbolSet> {
  const base = config.nerdFont && !config.noEmoji ? NERD_FONT_SYMBOLS : ASCII_SYMBOLS;
  const overrides = config.nerdFont && !config.noEmoji ? config.symbols : config.asciiSymbols;

  // Merge: base defaults, then user overrides that are non-empty
  const result = { ...base };
  for (const [key, val] of Object.entries(overrides)) {
    if (val !== '') result[key as keyof SymbolSet] = val;
  }
  return result;
}

/**
 * Get environment symbols from the resolved symbol set.
 * No longer hardcodes Nerd Font PUA characters — respects ASCII mode.
 */
export function getEnvironmentSymbols(symbolSet: SymbolSet): { node: string; python: string; docker: string; git: string; model: string } {
  return {
    node: symbolSet.node,
    python: symbolSet.python,
    docker: symbolSet.docker,
    git: symbolSet.git,
    model: symbolSet.model,
  };
}
