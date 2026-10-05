# Claude Code Statusline

Simple statusline for Claude Code with project-branch, git indicators, and context usage. Optimized for speed with bun. Just the essentials, none of the bloat.

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![Version](https://img.shields.io/badge/version-2.6.0-green.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.6.0-brightgreen.svg)
![Bun](https://img.shields.io/badge/runtime-Bun-black.svg)

![Demo](https://github.com/user-attachments/assets/8716dc4e-83da-410b-88f2-c47de7dd5930)

## Quick Start

```bash
# Install (bun recommended; npm/pnpm/yarn work too)
bun install -g claude-statusline
```

Add to your `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun claude-statusline",
    "padding": 0,
    "refreshInterval": 3
  }
}
```

> **Why `bun claude-statusline`?** Even when installed with `bun install -g`, the executable's shebang defaults to Node.js (~28ms). Prefixing with `bun` gets you ~5ms. Both work — Node.js is plenty fast for daily use.
>
> `padding: 0` pairs with our `rightMargin` (default 15 — Claude Code's right-side telemetry); `refreshInterval` (seconds, min 1) refreshes git state while the session idles, e.g. background subagents switching branches.

The statusline appears automatically when Claude Code is active.

## What's new in 2.5.0

- **Smart truncation on by default** — Claude Code clips or wraps overly long statuslines anyway; ours degrades gracefully instead. Restore full-line output with `"truncate": false`.
- **Worktree-aware display** — inside git worktrees the project slot shows the repository name from your `origin` remote plus a `·wt:<name>` tag (Nerd Font preset: the `U+F504` project-symlink glyph) instead of the worktree directory name.
- **Faster git** — one `git status --porcelain=v2` spawn replaces 6–8 separate git calls; cached per session with a 5s TTL.
- **Correct context %** — prefers the API's `used_percentage` (e.g. `󱐌5%` = 5% of the window *used*), with `remaining_percentage` / `current_usage` fallbacks.
- **Five new opt-in segments** — see [Opt-in Segments](#opt-in-segments-250).

## Features

```
◉ claude-statusline ·wt:wt-demo demo/wt-feature *Opus ≈24% #27[A] ~$1.23 5h:42% 7d:12% [hgh·thk]
```
*ASCII variant shown; with `"nerdFont": true` the ASCII symbols are replaced with Nerd Font icons.*

### Git Status Indicators

| Indicator | Symbol | Meaning |
|-----------|--------|---------|
| Stashed | ⚑ | stashed changes |
| Deleted | ✘ | files deleted |
| Modified | ! | unstaged changes |
| Staged | + | added to staging area |
| Untracked | ? | new files not tracked |
| Renamed | » | files moved/renamed |
| Conflicts | × | merge conflicts |
| Diverged | ⇕ | ahead and behind upstream |
| Ahead / Behind | ⇡ ⇣ | commits vs upstream |

Detached HEAD renders the short oid instead of a branch name.

### Context Window Usage

Automatically displays context window used percentage when Claude Code provides the data:

```
claude-statusline @ main [$!] *Opus ≈24%
```

Symbol: 󱐌 (`nf-md-lightning_bolt_circle`, U+F140C) in Nerd Font mode, `≈` in ASCII.

**Percentage semantics:**
- Prefers `used_percentage` from the Claude Code API (since v2.1.6) — `≈24%` means 24% used
- Falls back to `100 − remaining_percentage` when only that field is present
- Last resort: computed from `current_usage` (input + cache creation + cache read, relative to the window); output tokens excluded — `used_percentage` is input-only
- Disable with `"noContextWindow": true` or `CLAUDE_CODE_STATUSLINE_NO_CONTEXT_WINDOW=1`

**Exceeds-200k warning marker:** Claude Code also sends an `exceeds_200k_tokens` flag — a *fixed* 200k threshold over the last API response's total tokens, independent of the model's window size. When set, a warning marker is appended (` ≈24%⚠`, Nerd Font; `!!` in ASCII). Since 200k is fixed, it only means "nearly full" on windows ≤ 200k — on extended windows (e.g. 1M) the flag fires from ~20% up. The default `"overLimitWarning": "auto"` renders the marker only on windows ≤ 200k; `"always"` shows the raw flag on any window, `"never"` disables it (env: `CLAUDE_CODE_STATUSLINE_OVER_LIMIT_WARNING=auto|always|never`).

### Opt-in Segments (2.5.0)

Five segments are off by default and read from the stdin payload Claude Code sends. Enable each in the config file, or via environment variable (`=1` to enable):

| Config Key | Environment Variable | Displays |
|------------|---------------------|----------|
| **`"prBadge"`** | `CLAUDE_CODE_STATUSLINE_PR_BADGE=1` | ` #27[A]` — PR number plus review state (`[A]`pproved, `*` pending, `x` changes requested, `-` draft); only while a PR or MR is open |
| **`"costUsage"`** | `CLAUDE_CODE_STATUSLINE_COST_USAGE=1` | ` ~$1.23` — client-side estimate from `cost.total_cost_usd`, not a billing figure |
| **`"rateLimit"`** | `CLAUDE_CODE_STATUSLINE_RATE_LIMIT=1` | ` 5h:42% 7d:12%` — usage windows; requires claude.ai Pro/Max limits or a gateway spend limit in the payload |
| **`"modeIndicators"`** | `CLAUDE_CODE_STATUSLINE_MODE_INDICATORS=1` | ` [thk·fast]` — thinking, vim mode, fast mode, agent, output style (effort always shows as `·high` after the model name) |
| **`"contextTokens"`** | `CLAUDE_CODE_STATUSLINE_CONTEXT_TOKENS=1` | ` ≈25% ~50k/200k` — absolute context tokens appended to the used percentage |

### VPN Status Indicator

Shows VPN connection status on macOS (automatically detects utun interfaces). Disabled by default; enable with `"vpnIndicator": true` in config or `CLAUDE_CODE_STATUSLINE_VPN_INDICATOR=1`:

```
◉ VPN on (connected)
○ VPN off (disconnected)
```

Cached with 30-second TTL. ASCII fallback: `✓·vpn ·` / `✗·vpn ·`. macOS only (`scutil`); Linux/Windows not supported.

### Environment Context

Off by default. With `"envContext": true`, shows development tool versions (each cached 5–30 min):

```
claude-statusline @ main [$!A] *Claude Sonnet 4.5 Node22.17.1 Py3.13.5 Docker28.3.3
```

Supported: Node.js, Python (`python3`/`python`), Docker.

### Smart Width Management

Two modes:

1. **Basic Mode** (`"truncate": false`): simple truncation at `terminal width - 10`, always single-line.
2. **Smart Truncation** (default): 15-character right margin so nothing bleeds into Claude Code's telemetry; branch names preserved over project names; progressive truncation (Project → Branch → Indicators); adapts from 60–200+ characters. Disable soft-wrapping with `"noSoftWrap": true` to force single-line.

| Width | Experience |
|-------|------------|
| < 60 | Aggressive truncation |
| 60–79 | Branch preserved |
| 80–99 | Minimal truncation |
| 100+ | Usually none needed |

## Configuration

**📖 [Complete Configuration Guide](./docs/guides/guide-001-configuration.md)**

```bash
# Quick setup with minimal example
cp .claude-statusline.json.example.min ~/.claude/claude-statusline.json

# Or complete example with all options
cp .claude-statusline.json.example ~/.claude/claude-statusline.json
```

**Configuration search order** (first file found wins; JSON and YAML only):
1. `./claude-statusline.json` or `./claude-statusline.yaml` (project-level)
2. Parent directories (searches up the tree)
3. `~/.claude/claude-statusline.{json,yaml}` (global) ← **Recommended**
4. Environment variables (legacy v1.0 support)

**Defaults:** `envContext` false · `truncate` true · `noEmoji` false (Nerd Font preferred, ASCII fallback) · `noGitStatus` false · `noContextWindow` false · `overLimitWarning` auto · `vpnIndicator` false · `noSoftWrap` false · `rightMargin` 15 · `cacheTTL` 300 · `maxLength` 4096

## Icon Reference & Nerd Font Support

Nerd Font icons are optional: set `"nerdFont": true` in your config or `NERD_FONT=1` to enable. Default is ASCII. **Nerd Fonts v2.3+** required — any font from Homebrew's `nerd-fonts` cask in the last two years qualifies.

```bash
brew install --cask font-fira-code-nerd-font
# or font-jetbrains-mono-nerd-font, font-hack-nerd-font, etc.
# Cross-platform: https://nerdfonts.com/
```

### Icon Comparison

![Icon Comparison Reference](https://github.com/user-attachments/assets/4190fd65-c425-4da7-8659-a7c7a6f15bc0)

| Use Case | Default | ASCII (`"noEmoji": true`) |
|----------|---------|---------------------------|
| Git Repository | `@` | `@` (always) |
| Claude Model | `🤖` | `*` |
| Context Window | `󱐌` | `≈` |
| Stashed Files | `⚑` | `$` |
| Deleted Files | `✘` | `X` |
| Merge Conflicts | `×` | `C` |
| Renamed Files | `»` | `>` |
| Ahead/Behind | `⇡⇣` | `A/B` |
| Diverged | `⇕` | `D` |
| Staged / Modified / Untracked | `+` `!` `?` | always ASCII |

## Examples (ASCII)

```bash
# Default (smart truncation)
◉ claude-statusline @ main [$!A] *Claude Sonnet 4.5 ≈24%

# VPN off indicator enabled
○ claude-statusline @ main [$!A] *Claude Sonnet 4.5 ≈24%

# With environment context enabled
◉ claude-statusline @ main [$!A] *Claude Sonnet 4.5 Node22.17.1 Py3.13.5 Docker28.3.3 ≈24%
```

## Performance

- **Bun runtime**: ~5ms · **Node.js runtime**: ~28ms · **Install size**: 19KB single-file bundle

Fast because of native git commands (no libraries), Bun-optimized execution, smart caching, and a single-file bundle with no module resolution overhead.

*See the [Performance Guide](docs/guides/guide-003-performance.md) for the full optimization story.*

## Documentation

📚 Complete documentation lives in [`docs/`](./docs):

- **[Configuration Guide](./docs/guides/guide-001-configuration.md)** - Complete configuration options and examples
- **[Troubleshooting Guide](./docs/guides/guide-002-troubleshooting.md)** - Common issues and fixes
- **[Performance Guide](./docs/guides/guide-003-performance.md)** - Optimization story and benchmarks
- **[Architecture Reference](./docs/ref/ARCHITECTURE.md)** - Internal architecture
- **[Feature Comparison](./docs/ref/FEATURE_COMPARISON.md)** - Detailed comparison between versions
- **[Migration Guide](./docs/guides/MIGRATION.md)** - Migrating from bash v1.0 to TypeScript v2.0
- **[Documentation Index](./docs/README.md)** - Overview of all documentation

## Verify Installation

```bash
claude-statusline --self-test   # quick self-test with default config
claude-statusline --demo        # 6 rendering presets (ASCII, env, Nerd Font, narrow, worktree, all segments)
```

## Troubleshooting

- **Glyphs render as tofu / random chars**: run `claude-statusline --demo` to compare variants. If ASCII looks correct but Nerd Font shows boxes, install a [Nerd Font](https://nerdfonts.com/) or set `NERD_FONT=1` only when using one.
- **Build failures**: `npm install && npm run build`
- **Performance issues**: clear cache `rm -rf /tmp/.claude-statusline-cache/`
- **Symbol display**: force ASCII mode with `"noEmoji": true`

More in the [Troubleshooting Guide](./docs/guides/guide-002-troubleshooting.md).

## Security

Input validation on all inputs, sanitized shell command execution (no injection), path traversal protection, and TypeScript compile-time + runtime type validation.

## Dependencies

- **Required**: Node.js >= 22.6.0 or Bun >= 1.0.0, Git
- **Runtime**: yaml, zod · **Development**: TypeScript, ESLint, Prettier

## FAQ

**Is it really fast enough for real-time use?** Yes — ~5ms with Bun is instantaneous; benchmarks showing ~136ms include system startup overhead.

**Why is the download only 19KB?** esbuild bundles everything into a single optimized file.

**Do I need Node.js installed?** Node.js or Bun, yes. Bun recommended for best performance.

**How do I see Node/Python versions?** `~/.claude/claude-statusline.json` with `{"envContext": true}`.

**Can I customize the symbols?** `"noEmoji": true` for ASCII, or Nerd Fonts for icons.

## Contributing

See the [Contributing Guidelines](./CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

Apache License 2.0 - see [LICENSE](LICENSE).

## 📦 Legacy: Bash v1.0

> Version 2.0 (TypeScript) is recommended for all users. Bash v1.0 is maintained for legacy environments only.

```bash
curl -L -o claude-statusline.sh https://github.com/shrwnsan/claude-statusline/releases/download/v1.0.0/claude-statusline.sh
chmod +x claude-statusline.sh
```

Limitations: Unix/Linux only, no configuration files, no npm distribution, basic width detection. See [Feature Comparison](./docs/ref/FEATURE_COMPARISON.md).
