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
import { getTerminalWidth, truncateText, smartTruncate, debugWidthDetection } from './ui/width.js';
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
}

/**
 * Main execution function
 */
export async function main(): Promise<void> {
  try {
    // Load configuration
    const config = loadConfig();

    // Initialize components
    const cache = new Cache(config);
    const gitOps = new GitOperations(config, cache);
    const envDetector = new EnvironmentDetector(config, cache);

    // Debug width detection if enabled
    await debugWidthDetection(config);

    // Read and validate input from stdin
    const input = await readInput();
    if (!validateInput(JSON.stringify(input), config)) {
      console.error('[ERROR] Invalid input received');
      process.exit(1);
    }

    // Extract information from input
    const { fullDir, modelName } = extractInputInfo(input);
    if (!fullDir || !modelName) {
      console.error('[ERROR] Failed to extract required information from input');
      process.exit(1);
    }

    // Validate directory
    const isValidDir = await validateDirectory(fullDir);
    if (!isValidDir) {
      console.error('[ERROR] Invalid or inaccessible directory:', fullDir);
      process.exit(1);
    }

    // Get components (run in parallel for better performance)
    const [gitInfo, envInfo, symbols, terminalWidth] = await Promise.all([
      gitOps.getGitInfo(fullDir),
      envDetector.getEnvironmentInfo(),
      detectSymbols(config),
      getTerminalWidth(config),
    ]);

    // Build statusline
    const statusline = await buildStatusline({
      fullDir,
      modelName,
      gitInfo,
      envInfo,
      symbols,
      terminalWidth,
      config,
    });

    // Output result
    process.stdout.write(statusline);

  } catch (error) {
    console.error('[ERROR]', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Read JSON input from stdin
 */
async function readInput(): Promise<ClaudeInput> {
  try {
    const input = readFileSync(0, 'utf-8'); // Read from stdin (fd 0)
    const parsed = JSON.parse(input.trim());
    return parsed as ClaudeInput;
  } catch (error) {
    throw new Error(`Failed to read or parse input: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract directory and model name from Claude input
 */
function extractInputInfo(input: ClaudeInput): { fullDir: string; modelName: string } {
  const fullDir = input.workspace?.current_dir || '';
  const modelName = input.model?.display_name || 'Unknown';

  return { fullDir, modelName };
}

/**
 * Build the complete statusline string
 */
async function buildStatusline(params: {
  fullDir: string;
  modelName: string;
  gitInfo: any;
  envInfo: any;
  symbols: SymbolSet;
  terminalWidth: number;
  config: Config;
}): Promise<string> {
  const { fullDir, modelName, gitInfo, envInfo, symbols, terminalWidth, config } = params;

  // Get project name
  const projectName = fullDir.split('/').pop() || fullDir.split('\\').pop() || 'project';

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
    envContext = ` ${envFormatter.formatWithIcons(envInfo)}`;
  }

  // Build model string
  const modelString = `${symbols.model}${modelName}${envContext}`;

  // Initial statusline
  let statusline = `${projectName}${gitStatus} ${modelString}`;

  // Apply truncation if enabled
  if (config.truncate) {
    statusline = applySmartTruncation({
      statusline,
      projectName,
      gitStatus,
      modelString,
      terminalWidth,
      config,
      symbols,
    });
  } else {
    // Apply basic truncation (current behavior)
    const maxWidth = terminalWidth - 10;
    if (statusline.length > maxWidth) {
      statusline = truncateText(statusline, maxWidth);
    }
  }

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
  const { statusline, projectName, gitStatus, modelString, terminalWidth, config, symbols } = params;

  // Use 15-char margin for Claude telemetry compatibility
  const maxLen = Math.max(terminalWidth - config.rightMargin, 30);
  const projectGit = `${projectName}${gitStatus}`;

  // Check if everything fits
  if (statusline.length <= maxLen) {
    return statusline;
  }

  // Check if project + space fits, truncate model part only
  if (projectGit.length + 1 <= maxLen) {
    // Smart truncation with soft-wrapping (default behavior)
    // Allow disabling soft-wrapping with config setting
    if (config.noSoftWrap) {
      // Legacy behavior: simple truncation only
      const modelMaxLen = maxLen - projectGit.length - 1;
      const truncatedModel = truncateText(modelString, modelMaxLen);
      return `${projectGit} ${truncatedModel}`;
    } else {
      // Default: soft-wrap model part
      const modelMaxLen = maxLen - projectGit.length - 1;
      const wrappedModel = applySoftWrap(modelString, modelMaxLen, symbols.model);
      return `${projectGit} ${wrappedModel}`;
    }
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
 * Apply soft wrapping to text
 */
function applySoftWrap(text: string, maxLength: number, modelPrefix: string): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find a good break point
  let breakPos = maxLength;
  let foundBreak = false;

  // Look for spaces to break at
  for (let i = Math.min(maxLength - 1, text.length - 1); i > Math.max(maxLength - 20, 0) && i >= 0; i--) {
    if (text[i] === ' ') {
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
}

// Helper function to access git operations
const gitOps = new GitOperations(loadConfig(), new Cache(loadConfig()));

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}