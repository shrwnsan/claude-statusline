# Claude Code Statusline

Simple statusline for Claude Code with git indicators. Now available in TypeScript v2.0 with enhanced performance and npm distribution!

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![Version](https://img.shields.io/badge/version-2.0.0--alpha-green.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

![Demo](https://github.com/user-attachments/assets/8716dc4e-83da-410b-88f2-c47de7dd5930)

## Overview

This statusline script provides a sophisticated replacement for Claude Code's default status display. Version 2.0 is a complete TypeScript rewrite offering:

- 🚀 **2-5x Performance Improvement** over bash v1.0
- 📦 **npm/bun Distribution** with semver support
- ⚡ **Native JavaScript Optimizations**
- 🔧 **Configuration File Support** (.claude-statusline.json/.yaml)
- 🛡️ **Enhanced Security** with TypeScript type safety
- 🌐 **Cross-Platform Compatibility** (Windows, macOS, Linux)
- 🧪 **Comprehensive Test Suite**

## Quick Start

### Installation

**🚀 Recommended: TypeScript v2.0 (Alpha)**
```bash
# npm install (easiest)
npm install -g claude-statusline

# Or download from releases
curl -o claude-statusline https://github.com/shrwnsan/claude-statusline/releases/download/v2.0.0/claude-statusline
chmod +x claude-statusline
```

**⚠️ Note:** v2.0 is currently in alpha with enhanced performance and npm distribution.

**📦 Alternative: Bash v1.0 (Stable)**
```bash
# Download the stable bash version
curl -o claude-statusline.sh https://github.com/shrwnsan/claude-statusline/releases/download/v1.0.0/claude-statusline.sh
chmod +x claude-statusline.sh
```

### Claude Code Configuration

Add to your `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "claude-statusline"
  }
}
```

### Migrating from v1.0 to v2.0

If you're upgrading from the bash version, simply:

**1. Install v2.0:**
```bash
# Option A: npm install (recommended)
npm install -g claude-statusline

# Option B: Download from releases
curl -o claude-statusline https://github.com/shrwnsan/claude-statusline/releases/download/v2.0.0/claude-statusline
chmod +x claude-statusline
```

**2. Copy your settings (if any):**
```bash
# Check your current environment variables
echo $CLAUDE_CODE_STATUSLINE_NO_EMOJI
echo $CLAUDE_CODE_STATUSLINE_ENV_CONTEXT

# Create .claude-statusline.json with the same settings
# Example: {"envContext": true, "noEmoji": false}
```

**3. Update Claude Code settings:**
```json
{
  "statusLine": {
    "type": "command",
    "command": "claude-statusline"
  }
}
```

### Usage

The statusline automatically displays when Claude Code is active and updates based on your git status and environment.

## Features

### 🚀 Performance Improvements

| Version | Execution Time | Performance | Notes |
|---------|----------------|-------------|-------|
| **TypeScript v2.0** | **~30-45ms** | ✅ Excellent | Native JS optimizations |
| Bash v1.0 | ~99ms | ✅ Good | Optimized bash implementation |
| Bash v1.0 (first run) | ~888ms | ⚠️ Slow | One-time cache population |

### Git Status Indicators

- **Stashed**: ⚑ (gray background with flag)
- **Staged**: + (green, added to staging area)
- **Modified**: ! (yellow, unstaged changes)
- **Untracked**: ? (blue, new files not tracked)
- **Renamed**: » (orange/magenta, files moved/renamed)
- **Deleted**: ✘ (red, files deleted)
- **Conflicts**: × (red, merge conflicts)
- **Diverged**: ⇕ (yellow, both ahead and behind upstream)
- **Ahead**: ⇡ (green, commits ahead of upstream)
- **Behind**: ⇣ (red, commits behind upstream)

### 🎛️ Configuration

#### Configuration Files

Create `.claude-statusline.json` in your project root:

```json
{
  "$schema": "https://raw.githubusercontent.com/shrwnsan/claude-statusline/main/config-schema.json",
  "cacheTTL": 300,
  "maxLength": 1000,
  "noEmoji": false,
  "noGitStatus": false,
  "envContext": true,
  "truncate": true,
  "softWrap": false,
  "rightMargin": 15,
  "debugWidth": false,
  "symbols": {
    "git": "@",
    "model": "*",
    "staged": "+",
    "conflict": "×",
    "stashed": "⚑",
    "ahead": "↑",
    "behind": "↓",
    "diverged": "⇕",
    "renamed": "»",
    "deleted": "✘"
  }
}
```

Or use YAML format (`.claude-statusline.yaml`):

```yaml
cacheTTL: 300
maxLength: 1000
noEmoji: false
noGitStatus: false
envContext: true
truncate: true
softWrap: false
rightMargin: 15
debugWidth: false
symbols:
  git: "@"
  model: "*"
  staged: "+"
  conflict: "×"
  stashed: "⚑"
  ahead: "↑"
  behind: "↓"
  diverged: "⇕"
  renamed: "»"
  deleted: "✘"
```

**Configuration Search Order:**
1. `./.claude-statusline.json` (project-specific)
2. `~/.claude-statusline.json` (global)
3. Environment variables (legacy)

#### Environment Variables (Legacy Support)

Environment variables are still supported for backward compatibility:

- `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` - Force ASCII mode
- `CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1` - Disable git indicators
- `CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1` - Show Node.js, Python, Docker versions
- `CLAUDE_CODE_STATUSLINE_TRUNCATE=1` - Enable smart truncation (includes soft-wrapping by default)
- `CLAUDE_CODE_STATUSLINE_NO_SOFT_WRAP=1` - Disable soft-wrapping (use simple truncation only)
- `CLAUDE_CODE_STATUSLINE_DEBUG_WIDTH=1` - Enable width debugging

### Environment Context

When enabled, shows development tool versions:

```
.dotfiles  main [⚑!⇡]
󰚩Claude Sonnet 4.5 22.17.1 3.13.5 28.3.3
```

Supported tools:
- **Node.js**: `node --version` (cached 5 minutes)
- **Python**: `python3 --version` or `python --version` (cached 5 minutes)
- **Docker**: `docker --version` (cached 30 minutes)

### Smart Width Management

- **15-character right margin** prevents bleeding into Claude Code telemetry
- **Branch prioritization**: Branch names preserved over project names
- **Progressive truncation**: Project → Branch → Indicators (if absolutely necessary)
- **Responsive design**: Adapts to terminal width from 60-200+ characters

### Width Breakpoints

| Width | Experience | Statusline Behavior |
|-------|------------|-------------------|
| **< 60** | Poor | Aggressive truncation |
| **60-79** | Acceptable | Smart truncation, branch preserved |
| **80-99** | Good | Ideal balance, minimal truncation |
| **100-119** | Excellent | Usually no truncation needed |
| **120+** | Perfect | No constraints, optimal UX |

## Icon Reference & Nerd Font Support

**Nerd Font Support (Optional):** Automatically detects Nerd Fonts and falls back to ASCII equivalents.

For enhanced visual icons, install Nerd Fonts:
- **macOS:** `font-jetbrains-mono-nerd-font` via Homebrew
- **Cross-platform:** Download from [nerdfonts.com](https://nerdfonts.com/)

### Icon Comparison

![Icon Comparison Reference](https://github.com/user-attachments/assets/4190fd65-c425-4da7-8659-a7c7a6f15bc0)

### ASCII Mode Display

**ASCII Mode Display:**

| Use Case | ASCII Symbol | Environment Variable | Example |
|----------|--------------|----------------------|---------|
| **Git Repository** | `@` | N/A | `project @ main` |
| **Stashed Files** | `$` | `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` | `[$!+]` (ASCII mode) |
| **Staged Changes** | `+` | N/A | `[$+!]` |
| **Modified Files** | `!` | N/A | `[$!+]` |
| **Untracked Files** | `?` | N/A | `[$!?]` |
| **Renamed Files** | `>` | `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` | `[$>!+]` |
| **Deleted Files** | `X` | `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` | `[$X!+]` |
| **Merge Conflicts** | `C` | `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` | `[$C!+]` |
| **Ahead/Behind** | `A/B` | `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` | `[$!A]` |
| **Diverged** | `D` | `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` | `[$!D]` |
| **Claude Model** | `*` | `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` | `*Claude Sonnet` |

*Note: Examples show ASCII-compatible symbols. Full statusline with Nerd Fonts shows additional symbols: ⚑✘!+?»×⇕⇡⇣*

## Examples

### Default Behavior (Smart Wrapping)
```bash
# Clean two-line layout (most common)
.dotfiles @ main [⚑!⇡]
*Claude Sonnet 4.5

# With environment context
.envContext=1
.dotfiles @ main [⚑!⇡]
*Claude Sonnet 4.5 Node22.17.1 Py3.13.5 Docker28.3.3
```

### ASCII Mode (Fallback)
```bash
.noEmoji=true
.dotfiles @ main [$!A]
*Claude Sonnet 4.5
```

## Performance

The script is optimized for performance with smart caching:

**Bash v1.0 Performance:**
- **Execution Time**: ~99ms (optimized from ~888ms first run)
- **Cache Performance**: 83% faster after initial cache population

**TypeScript v2.0 (Expected):**
- **Execution Time**: ~30-45ms (2-3x faster with native JS optimizations)
- **Benchmark**: `npm run benchmark` (when testing v2.0)

## Security

Enhanced security with input validation and type safety:
- **Input Validation**: Comprehensive validation for all inputs
- **Command Injection Prevention**: Sanitized shell command execution
- **Path Traversal Protection**: Comprehensive path validation
- **Type Safety**: TypeScript compile-time and runtime validation

## Dependencies

- **Required**: Node.js >= 18.0.0, Git (for status parsing)
- **Runtime**: simple-git, yaml, zod
- **Development**: TypeScript, ESLint, Prettier

## Troubleshooting

**Common Issues:**
- **Build failures**: `npm install && npm run build`
- **Performance issues**: Clear cache `rm -rf /tmp/.claude-statusline-cache/`
- **Symbol display**: Force ASCII mode with `"noEmoji": true` in config

## Roadmap

**Version 2.0 (Alpha)**: TypeScript rewrite with enhanced performance and npm distribution

**Future**: Plugin system, custom indicators, theme support

## Contributing

See our [Contributing Guidelines](./CONTRIBUTING.md) for development setup and pull requests.

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

---

**🚀 Version 2.0 is currently in alpha. Feedback welcome!**