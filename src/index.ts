#!/usr/bin/env node

/**
 * Claude Statusline - TypeScript v2.0
 * Main entry point
 */

import { readFileSync } from 'fs';
import { loadConfig, Config } from './core/config.js';
import { validateInput, validateDirectory } from './core/security.js';
import { Cache } from './core/cache.js';
import { GitOperations } from './git/status.js';
import { detectSymbols, getEnvironmentSymbols, SymbolSet } from './ui/symbols.js';
import { getTerminalWidth, truncateText, smartTruncate, debugWidthDetection, getStringDisplayWidth } from './ui/width.js';
import { EnvironmentDetector, EnvironmentFormatter } from './env/context.js';

/**
 * Claude Code input interface
 */
interface ClaudeInput {
  workspace: {
    current_dir: string;
  };
  model: {
    display_name: string;
  };
  context_window?: {
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_size: number;
    // New in Claude Code v2.1.15: Pre-calculated percentages
    used_percentage?: number;
    remaining_percentage?: number;
    // Legacy: Current usage for manual calculation
    current_usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    };
  };
}

/**
 * Main execution function
 */
export async function main(injected?: ClaudeInput): Promise<void> {
  try {
    // Self-test / demo mode: inject mock input, skip stdin
    const args = process.argv.slice(2);
    if (args.includes('--self-test') || args.includes('--demo')) {
      await runSelfTest(args.includes('--demo'));
      return;
    }

    // Load configuration
    const config = loadConfig();

    // Read input from stdin (or use injected input for testing)
    const input = injected ?? await readInput();
    if (!input) {
      process.exit(0);
    }
    if (!validateInput(JSON.stringify(input), config)) {
      console.error('[ERROR] Invalid input received');
      process.stdout.write(renderMinimal(input));
      return;
    }

    const { fullDir, modelName, contextWindow } = extractInputInfo(input);
    if (!fullDir || !modelName) {
      console.error('[ERROR] Failed to extract required information from input');
      process.stdout.write(renderMinimal(input));
      return;
    }

    const isValidDir = await validateDirectory(fullDir);
    if (!isValidDir) {
      console.error('[ERROR] Invalid or inaccessible directory:', fullDir);
      process.stdout.write(renderMinimal(input));
      return;
    }

    process.stdout.write(await render(input, fullDir, modelName, contextWindow, config));

  } catch (error) {
    console.error('[ERROR]', error instanceof Error ? error.message : String(error));
    process.stdout.write(renderMinimal());
  }
}

/**
 * Read JSON input from stdin
 * Returns null if no input is provided (handles graceful degradation)
 */
async function readInput(): Promise<ClaudeInput | null> {
  try {
    const input = readFileSync(0, 'utf-8'); // Read from stdin (fd 0)
    const trimmed = input.trim();
    if (!trimmed) {
      return null; // No input provided
    }
    const parsed = JSON.parse(trimmed);
    return parsed as ClaudeInput;
  } catch (error) {
    throw new Error(`Failed to read or parse input: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract directory and model name from Claude input
 */
function extractInputInfo(input: ClaudeInput): { fullDir: string; modelName: string; contextWindow?: ClaudeInput['context_window'] } {
  const fullDir = input.workspace?.current_dir || '';
  const modelName = input.model?.display_name || 'Unknown';
  const contextWindow = input.context_window;

  return { fullDir, modelName, contextWindow };
}

/**
 * Build the complete statusline string
 */
async function buildStatusline(params: {
  fullDir: string;
  modelName: string;
  contextWindow?: ClaudeInput['context_window'];
  gitInfo: any;
  envInfo: any;
  symbols: SymbolSet;
  terminalWidth?: number; // Optional - only needed for smart truncation
  config: Config;
  gitOps: GitOperations;
}): Promise<string> {
  const { fullDir, modelName, contextWindow, gitInfo, envInfo, symbols, terminalWidth, config, gitOps } = params;

  // Get project name
  const projectName = fullDir.split('/').pop() || fullDir.split('\\').pop() || 'project';

  // Build VPN indicator (shown before project name when enabled)
  let vpnIndicator = '';
  if (config.vpnIndicator && envInfo?.vpn !== undefined) {
    const vpnSymbol = envInfo.vpn ? symbols.vpnOn : symbols.vpnOff;
    if (vpnSymbol) {
      vpnIndicator = vpnSymbol + ' ';
    }
  }

  // Build git status string
  let gitStatus = '';
  if (gitInfo) {
    gitStatus = gitOps.formatGitStatus(gitInfo, symbols);
  }

  // Build environment context string
  let envContext = '';
  if (envInfo) {
    const envSymbols = getEnvironmentSymbols(symbols);
    const envFormatter = new EnvironmentFormatter(envSymbols);
    const formattedEnv = envFormatter.formatWithIcons(envInfo);
    if (formattedEnv) {
      envContext = ` ${formattedEnv}`;
    }
  }

    // Build context window usage string
    let contextUsage = '';
    if (contextWindow && !config.noContextWindow) {
      const remaining = contextWindow.remaining_percentage;
      if (remaining !== undefined && remaining !== null) {
        contextUsage = ` ${symbols.contextWindow}${Math.round(remaining)}%`;
      }
    }

  // Build model string
  const modelString = `${symbols.model}${modelName}${envContext}${contextUsage}`;

  // Initial statusline
  let statusline = `${vpnIndicator}${projectName}${gitStatus} ${modelString}`;

  // Apply smart truncation if enabled
  if (config.truncate) {
    if (!terminalWidth) {
      console.error('[ERROR] Smart truncation enabled but terminal width not available');
      return statusline; // graceful: return untruncated rather than exit
    }
    statusline = applySmartTruncation({
      statusline,
      projectName,
      gitStatus,
      modelString,
      terminalWidth,
      config,
      symbols,
    });
  }
  // No basic truncation - let terminal handle overflow

  return statusline;
}


/**
 * Apply smart truncation with branch prioritization
 */
function applySmartTruncation(params: {
  statusline: string;
  projectName: string;
  gitStatus: string;
  modelString: string;
  terminalWidth: number;
  config: Config;
  symbols: SymbolSet;
}): string {
  const { statusline, projectName, gitStatus, modelString, terminalWidth, config } = params;

  // Use 15-char margin for Claude telemetry compatibility
  const maxLen = Math.max(terminalWidth - config.rightMargin, 30);
  const projectGit = `${projectName}${gitStatus}`;

  // Check if everything fits (using display width for accuracy)
  const statuslineDisplayWidth = getStringDisplayWidth(statusline);
  if (statuslineDisplayWidth <= maxLen) {
    return statusline;
  }

  // Check if project + space fits, truncate model part only (using display width)
  const projectGitDisplayWidth = getStringDisplayWidth(projectGit);
  if (projectGitDisplayWidth + 1 <= maxLen) {
    const modelMaxLen = maxLen - projectGitDisplayWidth - 1;
    if (config.noSoftWrap) {
      return `${projectGit} ${truncateText(modelString, modelMaxLen)}`; // single-line
    }
    // wrapModelString returns either the model unchanged (fits) or "\n<model>".
    // Keep the separator space on the same-line case; the newline case needs none.
    const wrapped = wrapModelString(modelString, modelMaxLen);
    return wrapped.startsWith('\n') ? `${projectGit}${wrapped}` : `${projectGit} ${wrapped}`;
  }

  // Smart truncation of project+git part
  const truncated = smartTruncate(projectName, gitStatus, maxLen, config);
  if (truncated) {
    return truncated;
  }

  // Basic fallback
  return truncateText(statusline, maxLen);
}


/**
 * Wrap model string to second line if it exceeds maxWidth.
 * Measures by display width (not .length) so multi-byte icons/CJK are accurate.
 */
function wrapModelString(text: string, maxWidth: number): string {
  return getStringDisplayWidth(text) <= maxWidth ? text : `\n${text}`;
}

/**
 * Shared render core — no stdout, no process.exit.
 * Orchestrates git, env, symbol detection and builds the statusline.
 */
async function render(
  _input: ClaudeInput,
  fullDir: string,
  modelName: string,
  contextWindow?: ClaudeInput['context_window'],
  config?: Config,
): Promise<string> {
  config = config ?? loadConfig();
  const cache = new Cache(config);
  const gitOps = new GitOperations(config, cache);
  const envDetector = new EnvironmentDetector(config, cache);

  await debugWidthDetection(config);

  const operations: Promise<any>[] = [
    gitOps.getGitInfo(fullDir),
    envDetector.getEnvironmentInfo(),
    detectSymbols(config),
  ];

  let terminalWidth: number | undefined;
  if (config.truncate) {
    operations.push(getTerminalWidth(config));
  }

  const results = await Promise.all(operations);
  const [gitInfo, envInfo, symbols] = results;

  if (config.truncate && results.length > 3) {
    terminalWidth = results[3];
  }

  return buildStatusline({
    fullDir,
    modelName,
    contextWindow,
    gitInfo,
    envInfo,
    symbols,
    ...(terminalWidth && { terminalWidth }),
    config,
    gitOps,
  });
}

/**
 * Self-test: render with a canonical mock payload (matching official docs example).
 * Useful for users debugging their config without launching Claude Code.
 */
async function runSelfTest(demo: boolean): Promise<void> {
  const mockInput = {
    cwd: process.cwd(),
    workspace: { current_dir: process.cwd() },
    model: { display_name: 'Opus' },
    context_window: { remaining_percentage: 75 },
  } as unknown as ClaudeInput;

  const presets: { label: string; configOverrides: Partial<Config> }[] = [
    { label: 'ASCII (default)', configOverrides: { nerdFont: false, noEmoji: false } },
    { label: 'ASCII + git + env', configOverrides: { nerdFont: false, noEmoji: false, envContext: true } },
    { label: 'Nerd Font', configOverrides: { nerdFont: true } },
    { label: 'Narrow terminal (40 cols)', configOverrides: { truncate: true, forceWidth: 40 } },
  ];

  if (demo) {
    for (const preset of presets) {
      const config = { ...loadConfig(), ...preset.configOverrides };
      const output = await render(mockInput, mockInput.workspace.current_dir, mockInput.model.display_name, mockInput.context_window, config);
      console.log(`\n── ${preset.label} ──`);
      console.log(output);
    }
  } else {
    const config = loadConfig();
    const output = await render(mockInput, mockInput.workspace.current_dir, mockInput.model.display_name, mockInput.context_window, config);
    process.stdout.write(output + '\n');
  }
}

/**
 * Minimal-mode fallback: prints a bare [dir] *[model] to stdout.
 * Used instead of process.exit(1) to avoid blank statusline.
 */
function renderMinimal(input?: Partial<ClaudeInput> | null): string {
  const dir = input?.workspace?.current_dir?.split(/[/\\]/).pop() ?? '?';
  const model = input?.model?.display_name ?? '?';
  return `${dir} *${model}`;
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}