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

/** PRD-004 C1: PR metadata from stdin. */
export interface PrInfo {
  number: number;
  url: string;
  review_state?: string;
  kind?: string;
}

/**
 * Claude Code input interface
 */
interface ClaudeInput {
  session_id?: string;
  workspace: {
    current_dir: string;
    repo?: { host: string; owner: string; name: string };
    git_worktree?: string;
  };
  model: { display_name: string };
  context_window?: {
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_size: number;
    // New in Claude Code v2.1.15: Pre-calculated percentages
    used_percentage?: number | null;
    remaining_percentage?: number | null;
    // Legacy: Current usage for manual calculation
    current_usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    } | null;
  };
  // Claude Code v1.0.88: true when the most recent API response's total tokens
  // (input + cache + output) exceed a fixed 200k, regardless of window size.
  // Per-response, not latched — clears again once context drops below 200k.
  exceeds_200k_tokens?: boolean;
  worktree?: {
    name: string;
    path: string;
    branch?: string;
    original_cwd: string;
    original_branch?: string;
  };
  pr?: PrInfo;
  cost?: {
    total_cost_usd: number;
    total_duration_ms: number;
    total_api_duration_ms: number;
    total_lines_added: number;
    total_lines_removed: number;
  };
  rate_limits?: RateLimits;
  effort?: { level: string };
  thinking?: { enabled: boolean };
  vim?: { mode: string };
  fast_mode?: boolean;
  agent?: { name: string };
  output_style?: { name: string };
}

/**
 * Main execution function
 */
export async function main(injected?: ClaudeInput): Promise<void> {
  // Hoist so catch can still emit a useful minimal fallback if render() throws.
  let input: ClaudeInput | null = null;
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
    input = injected ?? await readInput();
    if (!input) {
      process.exit(0);
    }
    if (!validateInput(JSON.stringify(input), config)) {
      console.error('[ERROR] Invalid input received');
      process.stdout.write(renderMinimal(input));
      return;
    }

    const { fullDir, modelName, contextWindow, repoName, worktreeName } = extractInputInfo(input);
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

    process.stdout.write(
      await render(fullDir, modelName, contextWindow, config, input.session_id, {
        worktree: input.worktree,
        repoName,
        worktreeName,
        pr: input.pr,
        cost: input.cost,
        rateLimits: input.rate_limits,
        modes: {
          effort: input.effort,
          thinking: input.thinking,
          vim: input.vim,
          fast_mode: input.fast_mode,
          agent: input.agent,
          output_style: input.output_style,
        },
        exceeds200k: input.exceeds_200k_tokens,
      }));
  } catch (error) {
    console.error('[ERROR]', error instanceof Error ? error.message : String(error));
    process.stdout.write(renderMinimal(input));
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
function extractInputInfo(input: ClaudeInput): { fullDir: string; modelName: string; contextWindow?: ClaudeInput['context_window']; repoName?: string | undefined; worktreeName?: string | undefined } {
  const fullDir = input.workspace?.current_dir || '';
  const modelName = input.model?.display_name || 'Unknown';
  const contextWindow = input.context_window;
  const repoName = input.workspace?.repo?.name;
  const worktreeName = input.worktree?.name ?? input.workspace?.git_worktree;

  return { fullDir, modelName, contextWindow, repoName, worktreeName };
}

export interface ProjectSlotParams {
  repoName?: string | undefined;
  currentDir: string;
  worktreeName?: string | undefined;
  wtSymbol: string;
}

/** PRD-004 B2: repo identity wins over dirname; worktree tag appended. */
export function formatProjectSlot(p: ProjectSlotParams): string {
  const dirname = p.currentDir.split('/').pop() || p.currentDir.split('\\').pop() || 'project';
  const name = p.repoName || dirname; // `||` guards empty-string repo.name too
  return p.worktreeName ? `${name} ${p.wtSymbol}${p.worktreeName}` : name;
}

/** Split a formatted project slot into name and worktree tag (tag includes its leading marker). */
export function splitProjectSlot(slot: string, wtSymbol: string): { name: string; tag: string } {
  if (!wtSymbol) return { name: slot, tag: '' };
  const idx = slot.lastIndexOf(` ${wtSymbol}`);
  if (idx === -1) return { name: slot, tag: '' };
  return { name: slot.slice(0, idx), tag: slot.slice(idx + 1) };
}

export function resolveBranch(p: { gitBranch: string; worktreeBranch?: string | undefined }): string {
  return p.worktreeBranch ? p.worktreeBranch : p.gitBranch; // PRD-004 B1; `?` guards empty string
}

/** PRD-004 C1: ` #27[A]` style PR badge; ASCII review-state token. */
export function formatPrBadge(pr?: PrInfo): string {
  if (!pr) return '';
  const token =
    { approved: '[A]', pending: '*', changes_requested: 'x', draft: '-' }[pr.review_state ?? ''] ??
    '';
  return ` #${pr.number}${token}`;
}

/** PRD-004 C2: ` ~$1.23` client-side cost estimate. */
export function formatCost(totalCostUsd?: number): string {
  if (totalCostUsd === undefined || totalCostUsd < 0) return '';
  return ` ~$${totalCostUsd.toFixed(2)}`;
}

/** PRD-004 C3: one usage window; spend_limit may exceed 100. */
export interface RateWindow {
  used_percentage: number;
}

export interface RateLimits {
  five_hour?: RateWindow;
  seven_day?: RateWindow;
  spend_limit?: RateWindow;
}

/** PRD-004 C3: ` 5h:42% 7d:12%` rate-limit windows. */
export function formatRateLimit(rl?: RateLimits): string {
  if (!rl) return '';
  const parts: string[] = [];
  if (rl.five_hour) parts.push(`5h:${Math.round(rl.five_hour.used_percentage)}%`);
  if (rl.seven_day) parts.push(`7d:${Math.round(rl.seven_day.used_percentage)}%`);
  if (rl.spend_limit) parts.push(`spl:${Math.round(rl.spend_limit.used_percentage)}%`);
  return parts.length ? ` ${parts.join(' ')}` : '';
}

/** PRD-004 C4: top-level mode/session fields from stdin. */
export interface ModesInput {
  effort?: { level: string } | undefined;
  thinking?: { enabled: boolean } | undefined;
  vim?: { mode: string } | undefined;
  fast_mode?: boolean | undefined;
  agent?: { name: string } | undefined;
  output_style?: { name: string } | undefined;
}

/** PRD-005: `·<level>` chip rendered directly after the model name; raw payload value. */
export function formatEffortSuffix(effort?: { level?: string }): string {
  if (!effort?.level) return '';
  return `·${effort.level}`;
}

const EFFORT_TOKEN: Record<string, string> = {
  low: 'lo',
  medium: 'me',
  high: 'hgh',
  xhigh: 'xh',
  max: 'mx',
};

/** PRD-004 C4: ` [hgh·thk]` compact mode indicators. */
export function formatModes(m?: ModesInput): string {
  if (!m) return '';
  const t: string[] = [];
  if (m.effort) t.push(EFFORT_TOKEN[m.effort.level] ?? m.effort.level);
  if (m.thinking?.enabled) t.push('thk');
  if (m.vim && m.vim.mode) t.push(m.vim.mode.charAt(0));
  if (m.fast_mode) t.push('fast');
  if (m.agent) t.push(`@${m.agent.name}`);
  if (m.output_style && m.output_style.name !== 'default') t.push(m.output_style.name);
  return t.length ? ` [${t.join('·')}]` : '';
}

export interface ContextWindowInput {
  used_percentage?: number | null;
  remaining_percentage?: number | null;
  context_window_size?: number;
  current_usage?: {
    input_tokens: number;
    output_tokens?: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  } | null;
}

/** PRD-004 D3: absolute token counts as ~NNk. */
export function formatTokenCount(n?: number): string {
  if (n === undefined || isNaN(n)) return '';
  return `~${Math.round(n / 1000)}k`;
}

/** PRD-004 D1: docs semantics — used_percentage preferred (input-only),
 *  remaining_percentage fallback, current_usage fallback, null = no render.
 *  D3: opts.contextTokens appends ` ~used/size` absolute counts. */
export function formatContextUsage(cw: ContextWindowInput | undefined, symbol: string, opts?: { contextTokens?: boolean }): string {
  if (!cw) return '';
  let used: number | undefined = cw.used_percentage ?? undefined;
  if (used === undefined && cw.remaining_percentage !== undefined && cw.remaining_percentage !== null) {
    used = 100 - cw.remaining_percentage;
  }
  if (used === undefined && cw.current_usage && cw.context_window_size) {
    const { input_tokens, cache_creation_input_tokens, cache_read_input_tokens } = cw.current_usage;
    used = ((input_tokens + cache_creation_input_tokens + cache_read_input_tokens) / cw.context_window_size) * 100;
  }
  if (used === undefined || used === null || isNaN(used)) return '';
  let out = ` ${symbol}${Math.round(used)}%`;
  if (opts?.contextTokens && cw.context_window_size && used != null) {
    // Total is the exact window size — no `~` (the tilde marks estimates only)
    out += ` ${formatTokenCount((cw.context_window_size * used) / 100)}/${Math.round(cw.context_window_size / 1000)}k`;
  }
  return out;
}

/** Claude Code's fixed threshold behind exceeds_200k_tokens (window-size independent). */
const OVER_LIMIT_THRESHOLD = 200_000;

/**
 * PRD-004 D2: gate for the over-limit warning glyph. The payload flag is a fixed
 * 200k threshold regardless of window size, so 'auto' renders it only where
 * crossing 200k means nearly full (window <= 200k) — on extended windows such as
 * 1M it would otherwise fire from ~20% up. Unknown window size keeps the raw flag
 * behavior (the flag predates context_window_size).
 */
export function shouldShowOverLimit(
  exceeds: boolean | undefined,
  windowSize: number | undefined,
  mode: 'auto' | 'always' | 'never',
): boolean {
  if (!exceeds || mode === 'never') return false;
  if (mode === 'always') return true;
  return windowSize === undefined || windowSize <= OVER_LIMIT_THRESHOLD;
}

/** Warning glyph for the gated exceeds-200k flag. */
export function formatOverLimit(exceeds: boolean | undefined, symbol: string): string {
  return exceeds ? symbol : '';
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
  worktree?: ClaudeInput['worktree'];
  repoName?: string | undefined;
  worktreeName?: string | undefined;
  pr?: ClaudeInput['pr'];
  cost?: ClaudeInput['cost'];
  rateLimits?: ClaudeInput['rate_limits'];
  modes?: ModesInput;
  exceeds200k?: boolean | undefined;
}): Promise<string> {
  const {
    fullDir,
    modelName,
    contextWindow,
    gitInfo,
    envInfo,
    symbols,
    terminalWidth,
    config,
    gitOps,
    worktree,
    repoName,
    worktreeName,
    pr,
    cost,
    rateLimits,
    modes,
    exceeds200k,
  } = params;

  // PRD-004 B3: repo identity wins over dirname; worktree tag appended
  const projectName = formatProjectSlot({ repoName, currentDir: fullDir, worktreeName, wtSymbol: symbols.worktree });

  // Managed worktree sessions report their own branch; override display only
  const displayGitInfo = gitInfo
    ? { ...gitInfo, branch: resolveBranch({ gitBranch: gitInfo.branch, worktreeBranch: worktree?.branch }) }
    : gitInfo;

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
  if (displayGitInfo) {
    gitStatus = gitOps.formatGitStatus(displayGitInfo, symbols);
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
    contextUsage = formatContextUsage(contextWindow, symbols.contextWindow, { contextTokens: config.contextTokens });
  }

  // PRD-004 D2: over-limit warning right after the context segment
  const overLimit = formatOverLimit(
    shouldShowOverLimit(exceeds200k, contextWindow?.context_window_size, config.overLimitWarning),
    symbols.overLimit,
  );

  // PRD-004 C1: opt-in PR badge from stdin pr.* fields
  const prSegment = config.prBadge ? formatPrBadge(pr) : '';

  // PRD-004 C2: opt-in cost estimate from stdin cost.total_cost_usd
  const costSegment = config.costUsage ? formatCost(cost?.total_cost_usd) : '';

  // PRD-004 C3: opt-in rate-limit windows from stdin rate_limits.*
  const rateSegment = config.rateLimit ? formatRateLimit(rateLimits) : '';

  // PRD-004 C4: opt-in mode indicators (effort/thinking/vim/fast/agent/style)
  const modesSegment = config.modeIndicators ? formatModes(modes) : '';

  // Build model string
  const modelString = `${symbols.model}${modelName}${envContext}${contextUsage}${overLimit}${prSegment}${costSegment}${rateSegment}${modesSegment}`;

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
export function applySmartTruncation(params: {
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

  // Check if everything fits (using display width for accuracy)
  const statuslineDisplayWidth = getStringDisplayWidth(statusline);
  if (statuslineDisplayWidth <= maxLen) {
    return statusline;
  }

  // Truncation-atomic worktree tag: once the full line needs trimming, either
  // keep the tag whole (project+git still fits) or drop it wholesale — never
  // slice inside `·wt:<name>`.
  const { name: slotName, tag: slotTag } = splitProjectSlot(projectName, symbols.worktree);
  const tagDropped =
    slotTag !== '' && getStringDisplayWidth(`${projectName}${gitStatus}`) + 1 > maxLen;
  const effectiveProject = tagDropped ? slotName : projectName;

  const projectGit = `${effectiveProject}${gitStatus}`;

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
  const truncated = smartTruncate(effectiveProject, gitStatus, maxLen, config);
  if (truncated) {
    return truncated;
  }

  // Basic fallback
  const fallbackLine = tagDropped ? `${slotName}${gitStatus} ${modelString}` : statusline;
  return truncateText(fallbackLine, maxLen);
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
  fullDir: string,
  modelName: string,
  contextWindow?: ClaudeInput['context_window'],
  config?: Config,
  sessionId?: string,
  payload?: {
    worktree?: ClaudeInput['worktree'];
    repoName?: string | undefined;
    worktreeName?: string | undefined;
    pr?: ClaudeInput['pr'];
    cost?: ClaudeInput['cost'];
    rateLimits?: ClaudeInput['rate_limits'];
    modes?: ModesInput;
    exceeds200k?: boolean | undefined;
  },
): Promise<string> {
  config = config ?? loadConfig();
  const cache = new Cache(config);
  const gitOps = new GitOperations(config, cache);
  const envDetector = new EnvironmentDetector(config, cache);

  await debugWidthDetection(config);

  const operations: Promise<any>[] = [
    gitOps.getGitInfo(fullDir, sessionId),
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
    ...payload,
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

  const worktreeInput = {
    ...mockInput,
    session_id: 'demo-session',
    workspace: {
      current_dir: process.cwd(),
      repo: { host: 'github.com', owner: 'shrwnsan', name: 'claude-statusline' },
      git_worktree: 'cs-wt-demo',
    },
    worktree: {
      name: 'cs-wt-demo', path: '/tmp/cs-wt-demo', branch: 'demo/wt-feature',
      original_cwd: '/tmp/claude-statusline', original_branch: 'main',
    },
  } as unknown as ClaudeInput;

  const fullPayloadInput = {
    ...mockInput,
    pr: { number: 27, url: 'https://github.com/shrwnsan/claude-statusline/pull/27', review_state: 'approved' },
    cost: { total_cost_usd: 1.2344, total_duration_ms: 0, total_api_duration_ms: 0, total_lines_added: 0, total_lines_removed: 0 },
    rate_limits: { five_hour: { used_percentage: 42 }, seven_day: { used_percentage: 12 } },
    effort: { level: 'high' },
    thinking: { enabled: true },
    exceeds_200k_tokens: false,
    output_style: { name: 'default' },
  } as unknown as ClaudeInput;

  const presets: { label: string; configOverrides: Partial<Config>; input?: ClaudeInput }[] = [
    { label: 'ASCII (default)', configOverrides: { nerdFont: false, noEmoji: false } },
    { label: 'ASCII + git + env', configOverrides: { nerdFont: false, noEmoji: false, envContext: true } },
    { label: 'Nerd Font', configOverrides: { nerdFont: true } },
    { label: 'Narrow terminal (40 cols)', configOverrides: { truncate: true, forceWidth: 40 } },
    { label: 'Worktree session', configOverrides: { nerdFont: false }, input: worktreeInput },
    { label: 'All segments on', configOverrides: { nerdFont: false, prBadge: true, costUsage: true, rateLimit: true, modeIndicators: true }, input: fullPayloadInput },
  ];

  if (demo) {
    for (const preset of presets) {
      const config = { ...loadConfig(), ...preset.configOverrides };
      const input = preset.input ?? mockInput;
      const output = await render(
        input.workspace.current_dir,
        input.model.display_name,
        input.context_window,
        config,
        input.session_id,
        {
          worktree: input.worktree,
          repoName: input.workspace.repo?.name,
          worktreeName: input.worktree?.name ?? input.workspace.git_worktree,
          pr: input.pr,
          cost: input.cost,
          rateLimits: input.rate_limits,
          modes: {
            effort: input.effort,
            thinking: input.thinking,
            vim: input.vim,
            fast_mode: input.fast_mode,
            agent: input.agent,
            output_style: input.output_style,
          },
          exceeds200k: input.exceeds_200k_tokens,
        });
      console.log(`\n── ${preset.label} ──`);
      console.log(output);
    }
  } else {
    const config = loadConfig();
    const output = await render(mockInput.workspace.current_dir, mockInput.model.display_name, mockInput.context_window, config);
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