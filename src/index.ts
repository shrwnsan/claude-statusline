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
    if (!input) {
      // No input provided - exit silently (graceful degradation)
      process.exit(0);
    }
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
    // Smart truncation with soft-wrapping (default behavior)
    // Allow disabling soft-wrapping with config setting
    if (config.noSoftWrap) {
      // Legacy behavior: simple truncation only
      const modelMaxLen = maxLen - projectGitDisplayWidth - 1;
      const truncatedModel = truncateText(modelString, modelMaxLen);
      return `${projectGit} ${truncatedModel}`;
    } else {
      // Default: soft-wrap model part
      const modelMaxLen = maxLen - projectGitDisplayWidth - 1;

      // If model string needs wrapping and it starts with model icon,
      // prefer wrapping the entire model string to next line
      const modelIconPattern = /^[󰚩*]/;
      const modelDisplayWidth = getStringDisplayWidth(modelString);
      if (modelIconPattern.test(modelString) && modelDisplayWidth > modelMaxLen) {
        // Wrap entire model to next line
        return `${projectGit}\n${modelString}`;
      }

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
  // Use display width for accurate measurement
  const displayWidth = getStringDisplayWidth(text);
  if (displayWidth <= maxLength) {
    return text;
  }

  // Check if this is a model string (starts with model icon)
  const modelIconPattern = /^[󰚩*]/; // Nerd Font or ASCII model icon
  if (modelIconPattern.test(text)) {
    return applySoftWrapToModelString(text, maxLength);
  }

  // Find a good break point using display width
  let foundBreak = false;

  // Work with actual Unicode characters to avoid splitting multi-byte sequences
  const chars = Array.from(text); // This splits by actual Unicode characters
  let currentDisplayWidth = 0;
  let breakCharIndex = chars.length; // Default to no break
  let lastSpaceIndex = -1;

  // Find the best break point by display width
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (!char) break;

    // Track spaces for potential break points
    if (char === ' ') {
      lastSpaceIndex = i;
    }

    // Calculate display width for this character
    const charWidth = getStringDisplayWidth(char);
    currentDisplayWidth += charWidth;

    // Check if we've exceeded the max length
    if (currentDisplayWidth > maxLength) {
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
  if (!foundBreak && maxLength - currentDisplayWidth > -3 && !startsWithIcon) {
    return text;
  }

  // Special case: if we're starting with an icon and breaking very early,
  // try to keep at least the icon and 1-2 more characters
  if (startsWithIcon && breakCharIndex <= 2 && maxLength >= 3) {
    // Find a better break point after at least 3 characters total (by display width)
    let testWidth = 0;
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      if (!char) break;
      testWidth += getStringDisplayWidth(char);
      if (testWidth >= 3 || testWidth >= maxLength) {
        breakCharIndex = i;
        foundBreak = true;
        break;
      }
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

/**
 * Apply soft wrapping specifically to model strings, keeping the model icon
 * with the model name and context usage as a unit
 */
function applySoftWrapToModelString(text: string, maxLength: number): string {
  // Use display width for accurate measurement
  const displayWidth = getStringDisplayWidth(text);
  if (displayWidth <= maxLength) {
    return text;
  }

  const chars = Array.from(text);

  // Find all space positions to understand the structure
  const spacePositions: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === ' ') {
      spacePositions.push(i);
    }
  }

  // If we have context usage (marked by context window icon like ⚡︎ or #)
  // The structure is: [icon][model] [env] [context icon][percentage]
  // We want to prefer keeping: [icon][model] [context icon][percentage] together if possible

  let contextIconIndex = -1;
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === '⚡' || char === '#') {
      contextIconIndex = i;
      break;
    }
  }

  // Strategy 1: If we have context usage, try to keep it with the model on the second line
  // This ensures the icon and percentage stay together
  if (contextIconIndex > 0) {
    // Find the space before context usage
    const spaceBeforeContext = chars.findIndex((c, i) => i < contextIconIndex && c === ' ');

    if (spaceBeforeContext > 0) {
      // Check if we can fit model + icon + percentage on second line (using display width)
      const contextPart = chars.slice(spaceBeforeContext + 1).join('');
      const contextPartWidth = getStringDisplayWidth(contextPart);
      if (contextPartWidth <= maxLength) {
        // Put model name on first line, context on second line
        const modelPart = chars.slice(0, spaceBeforeContext).join('');
        return `${modelPart}\n${contextPart}`;
      }
    }
  }

  // Strategy 2: Try to find a break point that keeps the model icon with model name
  // Look for first space after model name (if no context or if context doesn't fit)
  if (spacePositions.length > 0) {
    const firstSpaceAfterModel = spacePositions[0];
    if (firstSpaceAfterModel !== undefined && firstSpaceAfterModel > 1) {
      // Check if the model part fits (using display width)
      const modelPart = chars.slice(0, firstSpaceAfterModel).join('');
      const modelPartWidth = getStringDisplayWidth(modelPart);
      if (modelPartWidth <= maxLength) {
        const remainingPart = chars.slice(firstSpaceAfterModel + 1).join('');
        if (remainingPart) {
          return `${modelPart}\n${remainingPart}`;
        }
        return modelPart;
      }
    }
  }

  // Strategy 3: Find break point by display width (not character count)
  // This is the critical fix for the garbled output artifacts
  let currentWidth = 0;
  let breakCharIndex = chars.length;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (!char) break;
    const charWidth = getStringDisplayWidth(char);
    if (currentWidth + charWidth > maxLength) {
      breakCharIndex = i;
      break;
    }
    currentWidth += charWidth;
  }

  // If we found a valid break point
  if (breakCharIndex < chars.length && breakCharIndex > 0) {
    const firstPart = chars.slice(0, breakCharIndex).join('');
    const secondPart = chars.slice(breakCharIndex).join('');
    if (secondPart) {
      return `${firstPart}\n${secondPart}`;
    }
    return firstPart;
  }

  return text;
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}