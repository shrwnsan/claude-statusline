# Configuration Guide

Complete guide to configuring claude-statusline for your workflow.

## Quick Setup

claude-statusline works out of the box with sensible ASCII defaults. To customize it, drop a `claude-statusline.json` into your project root or `~/.claude/`:

```bash
cat > ~/.claude/claude-statusline.json << 'EOF'
{
  "envContext": true
}
EOF
```

## Configuration Search Order

claude-statusline looks for a config file named `claude-statusline.json` or `claude-statusline.yaml` (no leading dot, no `.yml`):

1. **Environment variables** (applied last, always override the file)
2. **Walk upward from the current working directory** to the filesystem root — the first `claude-statusline.json` or `claude-statusline.yaml` found wins (project-specific configs)
3. **`~/.claude/` fallback** — the standard Claude Code config directory

> **Recommended**: put your global config at `~/.claude/claude-statusline.json` and per-project overrides in the project root.

## Runtime Selection for Maximum Performance

### Understanding the Performance Difference

claude-statusline can run on either Node.js or Bun runtimes, with significant performance differences:

| Runtime | Response Time | Performance | When to Use |
|---------|---------------|------------|-------------|
| **Bun** | ~5ms | Excellent (5x faster) | Recommended for best performance |
| **Node.js** | ~28ms | Good | Good fallback, widely available |

> **Important**: Even when installed with `bun install -g`, the executable's shebang defaults to Node.js. To get Bun's performance benefits, you must explicitly specify it in your Claude Code configuration.

### Claude Code Configuration Options

#### Option 1: Maximum Performance (Recommended)
Use Bun runtime explicitly:

```json
// ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "bun claude-statusline"
  }
}
```

#### Option 2: Standard Configuration
Uses Node.js runtime (default shebang):

```json
// ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "claude-statusline"
  }
}
```

### Installation vs Runtime

**Installation Method ≠ Runtime Used:**
- `bun install -g claude-statusline` - Just downloads the package
- `bun claude-statusline` - Actually uses Bun runtime for execution
- `claude-statusline` - Uses Node.js runtime (via shebang)

Both configurations work perfectly. The Bun runtime is 5x faster but requires Bun to be installed. Node.js is more widely available and still provides instant response times.

## Configuration Options

### Core Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cacheTTL` | number | `300` | Cache duration in seconds (default cache TTL) |
| `cacheDir` | string | `/tmp/.claude-statusline-cache` | Cache directory location |
| `maxLength` | number | `4096` | Maximum input length (security) |
| `rightMargin` | number | `15` | Right margin for Claude telemetry compatibility |

### Feature Toggles

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `nerdFont` | boolean | `false` | Opt in to Nerd Font glyphs (default is ASCII) |
| `noEmoji` | boolean | `false` | Force ASCII mode |
| `noGitStatus` | boolean | `false` | Disable git indicators completely |
| `noContextWindow` | boolean | `false` | Disable context window usage display |
| `envContext` | boolean | `false` | Show Node.js, Python, Docker versions |
| `vpnIndicator` | boolean | `false` | Show VPN status indicator (macOS only) |
| `truncate` | boolean | `true` | Smart truncation is on by default; set `false` for full-line output |
| `noSoftWrap` | boolean | `false` | Disable soft-wrapping (force single line) |
| `prBadge` | boolean | `false` | Show PR badge from stdin `pr.*` fields |
| `costUsage` | boolean | `false` | Show `~cost` estimate from stdin `cost.total_cost_usd` |
| `rateLimit` | boolean | `false` | Show rate-limit windows from stdin `rate_limits.*` |
| `modeIndicators` | boolean | `false` | Show mode indicators (effort/thinking/vim/fast/agent/style) |
| `contextTokens` | boolean | `false` | Append `~used/total` absolute context tokens |
| `overLimitWarning` | string | `"auto"` | Exceeds-200k marker: `auto` (only on windows ≤ 200k), `always`, or `never` |
| `debugWidth` | boolean | `false` | Show terminal width detection debug info |

### Advanced Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `forceWidth` | number | *(unset)* | Manual width override (testing / scripting) |
| `rightMargin` | number | `15` | Right margin for Claude telemetry compatibility |

## Width Resolution

Terminal width is resolved with no shell-outs, no `tput`, no `stty` (the statusline command runs with captured output and no tty, so those tools cannot work):

1. `forceWidth` config (if > 0)
2. `COLUMNS` environment variable (Claude Code provides it in the statusline payload env)
3. `process.stdout.columns`
4. Fixed fallback of `80`

Set `"debugWidth": true` to log the resolved width chain to stderr.

## Symbol Customization

### ASCII Symbols (Default)

ASCII is the default symbol set — no Nerd Font required:

```json
"asciiSymbols": {
  "git": "@",
  "worktree": "·wt:",
  "model": "*",
  "contextWindow": "≈",
  "overLimit": "!!",
  "staged": "+",
  "conflict": "C",
  "stashed": "$",
  "ahead": "A",
  "behind": "B",
  "diverged": "D",
  "renamed": ">",
  "deleted": "X",
  "vpnOn": "✓·vpn ·",
  "vpnOff": "✗·vpn ·",
  "node": "node",
  "python": "py",
  "docker": "dkr"
}
```

### Nerd Font Symbols (Opt-In)

Nerd Font glyphs are strictly opt-in — no auto-detection. Enable with `"nerdFont": true` in your config or `NERD_FONT=1` in the environment:

```json
"symbols": {
  "git": "",
  "worktree": "",
  "model": "󰚩",
  "contextWindow": "󱐌",
  "overLimit": "⚠",
  "staged": "+",
  "conflict": "×",
  "stashed": "⚑",
  "ahead": "⇡",
  "behind": "⇣",
  "diverged": "⇕",
  "renamed": "»",
  "deleted": "✘",
  "vpnOn": "◉",
  "vpnOff": "○",
  "node": "",
  "python": "",
  "docker": ""
}
```

> **Note**: When Nerd Font mode is active, overrides from `symbols` apply; when ASCII mode is active, overrides come from `asciiSymbols`. Empty-string overrides are ignored, so the built-in defaults still show through.

## Complete Example Configuration

This matches the output of the built-in sample config generator:

```json
{
  "$schema": "https://raw.githubusercontent.com/shrwnsan/claude-statusline/main/config-schema.json",
  "cacheTTL": 300,
  "maxLength": 4096,
  "nerdFont": false,
  "noEmoji": false,
  "noGitStatus": false,
  "noContextWindow": false,
  "envContext": true,
  "vpnIndicator": true,
  "truncate": true,
  "noSoftWrap": false,
  "prBadge": false,
  "costUsage": false,
  "rateLimit": false,
  "modeIndicators": false,
  "contextTokens": false,
  "overLimitWarning": "auto",
  "rightMargin": 15,
  "debugWidth": false,
  "symbols": {
    "git": "",
    "model": "󰚩",
    "contextWindow": "󱐌",
    "worktree": "",
    "staged": "+",
    "conflict": "×",
    "stashed": "⚑",
    "ahead": "⇡",
    "behind": "⇣",
    "diverged": "⇕",
    "renamed": "»",
    "deleted": "✘",
    "vpnOn": "◉",
    "vpnOff": "○"
  }
}
```

> **Note**: The `$schema` property provides VS Code and other editors with autocompletion and validation. YAML configs support exactly the same options (minus `$schema`), in `claude-statusline.yaml`.

## Environment Variables

Environment variables override config file values. Boolean toggles enable when set to `1`; everything else takes its own value.

### Feature Toggles (`=1` to enable)

| Variable | Effect |
|----------|--------|
| `CLAUDE_CODE_STATUSLINE_NERD_FONT=1` (or `NERD_FONT=1`) | Opt in to Nerd Font glyphs |
| `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` | Force ASCII mode |
| `CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1` | Disable git indicators |
| `CLAUDE_CODE_STATUSLINE_NO_CONTEXT_WINDOW=1` | Disable context window display |
| `CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1` | Show Node.js, Python, Docker versions |
| `CLAUDE_CODE_STATUSLINE_VPN_INDICATOR=1` | Show VPN indicator (macOS) |
| `CLAUDE_CODE_STATUSLINE_TRUNCATE=1` | Enable smart truncation (already default) |
| `CLAUDE_CODE_STATUSLINE_NO_SOFT_WRAP=1` | Disable soft-wrapping |
| `CLAUDE_CODE_STATUSLINE_PR_BADGE=1` | Show PR badge |
| `CLAUDE_CODE_STATUSLINE_COST_USAGE=1` | Show `~cost` estimate |
| `CLAUDE_CODE_STATUSLINE_RATE_LIMIT=1` | Show rate-limit windows |
| `CLAUDE_CODE_STATUSLINE_MODE_INDICATORS=1` | Show mode indicators |
| `CLAUDE_CODE_STATUSLINE_CONTEXT_TOKENS=1` | Append absolute context token counts |
| `CLAUDE_CODE_STATUSLINE_DEBUG_WIDTH=1` | Width detection debug output |

### Value Variables

| Variable | Values | Effect |
|----------|--------|--------|
| `CLAUDE_CODE_STATUSLINE_OVER_LIMIT_WARNING` | `auto` \| `always` \| `never` | Exceeds-200k marker mode |
| `CLAUDE_CODE_STATUSLINE_FORCE_WIDTH` | positive integer | Manual width override |
| `CLAUDE_CODE_STATUSLINE_CACHE_DIR` | path | Cache directory override |

## Popular Configurations

### Minimal Setup (Quick Start)
```json
{
  "envContext": true
}
```

### Developer Setup
```json
{
  "envContext": true,
  "nerdFont": true,
  "prBadge": true,
  "costUsage": true
}
```

### Full-Line Output (No Truncation)
```json
{
  "truncate": false
}
```

### Performance-Optimized Setup
```json
{
  "cacheTTL": 600,
  "noGitStatus": false,
  "envContext": false
}
```

## File Formats Supported

- `claude-statusline.json` - JSON format (recommended for editor support)
- `claude-statusline.yaml` - YAML format (more minimal syntax)

Both formats support exactly the same configuration options. Note there is no leading dot in the filenames and `.yml` is not recognized.
