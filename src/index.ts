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
  context_window?: {
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_size: number;
    current_usage: {
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
    const { fullDir, modelName, contextWindow } = extractInputInfo(input);
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
    const operations: Promise<any>[] = [
      gitOps.getGitInfo(fullDir),
      envDetector.getEnvironmentInfo(),
      detectSymbols(config),
    ];

    // Only get terminal width if smart truncation is enabled
    let terminalWidth: number | undefined;
    if (config.truncate) {
      operations.push(getTerminalWidth(config));
    }

    const results = await Promise.all(operations);
    const [gitInfo, envInfo, symbols] = results;

    // Extract terminal width from results if it was requested
    if (config.truncate && results.length > 3) {
      terminalWidth = results[3];
    }

    // Build statusline
    const statusline = await buildStatusline({
      fullDir,
      modelName,
      contextWindow,
      gitInfo,
      envInfo,
      symbols,
      ...(terminalWidth && { terminalWidth }), // Only include if defined
      config,
      gitOps,
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

    // Build context window usage string
    let contextUsage = '';
    if (contextWindow && !config.noContextWindow) {
      const percentage = calculateContextWindowPercentage(contextWindow);
      if (percentage !== null) {
        contextUsage = ` ${symbols.contextWindow}${percentage}%`;
      }
    }

  // Build model string
  const modelString = `${symbols.model}${modelName}${envContext}${contextUsage}`;

  // Initial statusline
  let statusline = `${projectName}${gitStatus} ${modelString}`;

  // Apply smart truncation if enabled
  if (config.truncate) {
    if (!terminalWidth) {
      console.error('[ERROR] Smart truncation enabled but terminal width not available');
      process.exit(1);
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
 * Calculate context window usage percentage
 */
function calculateContextWindowPercentage(contextWindow: NonNullable<ClaudeInput['context_window']>): number | null {
  try {
    const { current_usage, context_window_size } = contextWindow;
    
    if (!current_usage || !context_window_size || context_window_size === 0) {
      return null;
    }

    // Calculate total tokens used (input + output from current usage)
    const totalUsed = current_usage.input_tokens + current_usage.output_tokens;
    
    // Calculate percentage
    const percentage = Math.round((totalUsed / context_window_size) * 100);
    
    // Cap at 100% and ensure non-negative
    return Math.max(0, Math.min(100, percentage));
  } catch {
    return null;
  }
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
      const wrappedModel = applySoftWrap(modelString, modelMaxLen);
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
function applySoftWrap(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find a good break point
  let foundBreak = false;

  // Work with actual Unicode characters to avoid splitting multi-byte sequences
  const chars = Array.from(text); // This splits by actual Unicode characters
  let charCount = 0;
  let breakCharIndex = chars.length; // Default to no break
  let lastSpaceIndex = -1;

  // Find the best break point by character count
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    // Track spaces for potential break points
    if (char === ' ') {
      lastSpaceIndex = i;
    }

    // Estimate display width (this is approximate)
    // Most Unicode icons count as 1 display character
    // ASCII characters count as 1
    charCount++;

    // Check if we've exceeded the max length
    if (charCount > maxLength) {
      // If we found a space before this point, use it
      if (lastSpaceIndex >= 0) {
        breakCharIndex = lastSpaceIndex;
      } else {
        // No space found, break before current character
        breakCharIndex = i;
      }
      foundBreak = lastSpaceIndex >= 0;
      break;
    }
  }

  // If everything fits, return as is
  if (breakCharIndex >= chars.length) {
    return text;
  }

  // If no safe break found and we're very close to max_length, just fit without wrapping
  // But only if we're not dealing with a model string that starts with an icon
  const firstChar = chars.length > 0 ? chars[0] : '';
  const startsWithIcon = firstChar && firstChar !== ' ' && Buffer.byteLength(firstChar, 'utf8') > 1;
  if (!foundBreak && maxLength - charCount > -3 && !startsWithIcon) {
    return text;
  }

  // Special case: if we're starting with an icon and breaking very early,
  // try to keep at least the icon and 1-2 more characters
  if (startsWithIcon && breakCharIndex <= 2 && maxLength >= 3) {
    // Find a better break point after at least 3 characters total
    for (let i = 2; i < Math.min(chars.length, maxLength); i++) {
      breakCharIndex = i;
      foundBreak = true;
      break;
    }
  }

  // Build the strings using character indices
  const firstChars = chars.slice(0, breakCharIndex);
  const secondChars = chars.slice(breakCharIndex);

  // Remove leading space from second line if we broke at space
  if (secondChars.length > 0 && secondChars[0] === ' ') {
    secondChars.shift();
  }

  // Join characters back into strings
  const firstLine = firstChars.join('');
  const secondLine = secondChars.join('');

  // Only wrap if second line has meaningful content
  if (secondLine) {
    return `${firstLine}\n${secondLine}`;
  } else {
    return firstLine;
  }
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}