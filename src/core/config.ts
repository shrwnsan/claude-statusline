import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { parse as parseYaml } from 'yaml';

/**
 * Configuration schema for claude-statusline
 */
export const ConfigSchema = z.object({
  // Core settings
  cacheTTL: z.number().default(300), // 5 minutes
  cacheDir: z.string().default('/tmp/.claude-statusline-cache'),
  maxLength: z.number().default(1000), // Maximum input length

  // Feature toggles
  noEmoji: z.boolean().default(false), // Force ASCII mode
  noGitStatus: z.boolean().default(false), // Disable git indicators
  noContextWindow: z.boolean().default(false), // Disable context window usage
  envContext: z.boolean().default(false), // Show environment versions
  vpnIndicator: z.boolean().default(false), // Show VPN status indicator (macOS only)
  truncate: z.boolean().default(false), // Smart truncation
  softWrap: z.boolean().default(false), // Soft wrapping (legacy)
  noSoftWrap: z.boolean().default(false), // Disable soft-wrapping

  // Width and display settings
  forceWidth: z.number().optional(), // Manual width override
  debugWidth: z.boolean().default(false), // Width debugging
  rightMargin: z.number().default(15), // Right margin for Claude telemetry

  // Symbol settings
  symbols: z.object({
    git: z.string().default(''),
    model: z.string().default('󰚩'),
    contextWindow: z.string().default('⚡︎'),
    staged: z.string().default('+'),
    conflict: z.string().default('×'),
    stashed: z.string().default('⚑'),
    ahead: z.string().default('⇡'),
    behind: z.string().default('⇣'),
    diverged: z.string().default('⇕'),
    renamed: z.string().default('»'),
    deleted: z.string().default('✘'),
    vpnOn: z.string().default('◉'),
    vpnOff: z.string().default('○'),
  }).default({}),

  // ASCII fallback symbols
  asciiSymbols: z.object({
    git: z.string().default('@'),
    model: z.string().default('*'),
    contextWindow: z.string().default('#'),
    staged: z.string().default('+'),
    conflict: z.string().default('C'),
    stashed: z.string().default('$'),
    ahead: z.string().default('A'),
    behind: z.string().default('B'),
    diverged: z.string().default('D'),
    renamed: z.string().default('>'),
    deleted: z.string().default('X'),
    vpnOn: z.string().default('◉'),
    vpnOff: z.string().default('○'),
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration instance
 */
export const defaultConfig: Config = ConfigSchema.parse({});

/**
 * Configuration file names to search for (in order of preference)
 */
const CONFIG_FILES = [
  'claude-statusline.json',
  'claude-statusline.yaml',
];

/**
 * Load configuration from file and environment variables
 */
export function loadConfig(cwd: string = process.cwd()): Config {
  let config = { ...defaultConfig };

  // 1. Load from configuration file
  config = { ...config, ...loadConfigFile(cwd) };

  // 2. Override with environment variables
  config = { ...config, ...loadEnvConfig() };

  // Validate final configuration
  return ConfigSchema.parse(config);
}

/**
 * Load configuration from file in the current directory or home directory
 */
function loadConfigFile(cwd: string): Partial<Config> {
  // Search in current directory first, then parent directories, then ~/.claude/
  const searchPaths = [cwd, dirname(cwd), join(homedir(), '.claude')];

  for (const searchPath of searchPaths) {
    for (const filename of CONFIG_FILES) {
      const configPath = join(searchPath, filename);

      if (existsSync(configPath)) {
        try {
          const content = readFileSync(configPath, 'utf-8');

          if (filename.endsWith('.json')) {
            return JSON.parse(content);
          } else if (filename.endsWith('.yaml')) {
            return parseYaml(content);
          }
        } catch (error) {
          console.warn(`[WARNING] Failed to parse config file ${configPath}:`, error instanceof Error ? error.message : String(error));
        }
      }
    }
  }

  return {};
}

/**
 * Load configuration from environment variables
 * Maps v1.0 environment variables to new configuration format
 */
function loadEnvConfig(): Partial<Config> {
  const env: Partial<Config> = {};

  // Feature toggles
  if (process.env.CLAUDE_CODE_STATUSLINE_NO_EMOJI === '1') {
    env.noEmoji = true;
  }

  if (process.env.CLAUDE_CODE_STATUSLINE_NO_GITSTATUS === '1') {
    env.noGitStatus = true;
  }

  if (process.env.CLAUDE_CODE_STATUSLINE_NO_CONTEXT_WINDOW === '1') {
    env.noContextWindow = true;
  }

  if (process.env.CLAUDE_CODE_STATUSLINE_ENV_CONTEXT === '1') {
    env.envContext = true;
  }

  if (process.env.CLAUDE_CODE_STATUSLINE_VPN_INDICATOR === '1') {
    env.vpnIndicator = true;
  }

  if (process.env.CLAUDE_CODE_STATUSLINE_TRUNCATE === '1') {
    env.truncate = true;
  }

  if (process.env.CLAUDE_CODE_STATUSLINE_SOFT_WRAP === '1') {
    env.softWrap = true;
  }

  if (process.env.CLAUDE_CODE_STATUSLINE_NO_SOFT_WRAP === '1') {
    env.noSoftWrap = true;
  }

  // Width settings
  if (process.env.CLAUDE_CODE_STATUSLINE_FORCE_WIDTH) {
    const width = parseInt(process.env.CLAUDE_CODE_STATUSLINE_FORCE_WIDTH, 10);
    if (!isNaN(width) && width > 0) {
      env.forceWidth = width;
    }
  }

  if (process.env.CLAUDE_CODE_STATUSLINE_DEBUG_WIDTH === '1') {
    env.debugWidth = true;
  }

  // Cache directory override
  if (process.env.CLAUDE_CODE_STATUSLINE_CACHE_DIR) {
    env.cacheDir = process.env.CLAUDE_CODE_STATUSLINE_CACHE_DIR;
  }

  return env;
}

/**
 * Get configuration file path for writing
 */
export function getConfigFilePath(cwd: string = process.cwd()): string | null {
  // Prefer claude-statusline.json in the current directory
  const configPath = join(cwd, 'claude-statusline.json');
  return configPath;
}

/**
 * Generate a sample configuration file
 */
export function generateSampleConfig(): string {
  return JSON.stringify({
    $schema: 'https://raw.githubusercontent.com/shrwnsan/claude-statusline/main/config-schema.json',
    // Core settings
    cacheTTL: 300, // 5 minutes
    maxLength: 1000,

    // Feature toggles
    noEmoji: false, // Set to true to force ASCII mode
    noGitStatus: false, // Set to true to disable git indicators
    noContextWindow: false, // Set to true to disable context window usage
    envContext: true, // Set to true to show Node.js, Python versions
    vpnIndicator: true, // Set to true to show VPN status indicator (macOS only)
    truncate: true, // Set to true to enable smart truncation
    softWrap: false, // Set to true to enable soft wrapping

    // Display settings
    rightMargin: 15, // Right margin for Claude telemetry compatibility
    debugWidth: false, // Set to true for width debugging output

    // Custom symbols (optional - will use defaults if not specified)
    symbols: {
      git: '',
      model: '󰚩',
      contextWindow: '⚡︎',
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
    },
  }, null, 2);
}