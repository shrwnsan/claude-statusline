# Claude Code Statusline

Simple statusline for Claude Code with git indicators. Now available in TypeScript v2.0 with enhanced performance and npm distribution!

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![Version](https://img.shields.io/badge/version-2.0.0-green.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.6.0-brightgreen.svg)

![Demo](https://github.com/user-attachments/assets/8716dc4e-83da-410b-88f2-c47de7dd5930)

## Quick Start

### Installation

```bash
# Bun install (recommended - 5x faster than Node.js)
bun install -g claude-statusline

# Or npm install (works well too)
npm install -g claude-statusline

# Or pnpm/yarn
pnpm add -g claude-statusline
yarn global add claude-statusline
```


### Claude Code Configuration

#### Standard Configuration (Node.js Runtime)
Add to your `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "claude-statusline"
  }
}
```

#### ⚡ Performance-Optimized Configuration (Bun Runtime)
For maximum performance (~5ms response time), explicitly use the Bun runtime:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun claude-statusline"
  }
}
```

> **Why specify "bun claude-statusline"?**
> Even when installed with `bun install -g`, the executable's shebang defaults to Node.js. Using "bun claude-statusline" ensures you get the full Bun performance benefits.

### Usage

The statusline automatically displays when Claude Code is active and updates based on your git status and environment.

### Default Configuration

claude-statusline works out-of-the-box with these defaults:
- `envContext`: false (environment versions NOT shown)
- `truncate`: false (basic truncation at terminal width - 10)
- `noEmoji`: false (Nerd Font symbols preferred, ASCII fallback)
- `noGitStatus`: false (git status shown)
- `rightMargin`: 15 (prevents bleeding into Claude Code telemetry)

To see environment versions in your statusline, create a configuration file with:
```json
{"envContext": true}
```
*See the [🎛️ Configuration](#-configuration) section below for how to create and manage config files*

## ⚡ Performance

🚀 **claude-statusline is lightning fast**

- **With Bun runtime**: ~5ms response time (5x faster)
- **With Node.js runtime**: ~28ms response time (still instant)
- **Installation**: 19KB (tiny single-file bundle)

### Real-world experience
```bash
# Install instantly
bun install -g claude-statusline  # Downloads 19KB in <1 second

# Add to Claude Code settings for maximum performance
# ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "bun claude-statusline"
  }
}

# Enjoy instant git status updates! (~5ms with Bun vs ~28ms with Node.js)
```

**Performance Comparison:**
- With `bun claude-statusline`: ~5ms ⚡
- With `claude-statusline` (Node.js): ~28ms ✅
- Both work perfectly - choose based on your preference

### Why so fast?
- ✅ Native git commands (no slow libraries)
- ✅ Optimized for Bun runtime
- ✅ Smart caching (8-hour environment cache)
- ✅ Single-file bundle (no module resolution overhead)

**Fun fact**: We started with a fast bash script (~60ms), accidentally made it slower with TypeScript (~327ms), then optimized it to be 12x faster than the original (~5ms with Bun)!

*See [Performance Guide](docs/guide-03-performance.md) for the full optimization story*

## Features

### Git Status Indicators

- **Stashed**: ⚑ (stashed changes)
- **Deleted**: ✘ (files deleted)
- **Modified**: ! (unstaged changes)
- **Staged**: + (added to staging area)
- **Untracked**: ? (new files not tracked)
- **Renamed**: » (files moved/renamed)
- **Conflicts**: × (merge conflicts)
- **Diverged**: ⇕ (both ahead and behind upstream)
- **Ahead**: ⇡ (commits ahead of upstream)
- **Behind**: ⇣ (commits behind upstream)

### Context Window Usage

Automatically displays context window usage percentage when available (requires Claude Code to send context window data):

```
claude-statusline  main [⚑!] 󰚩Opus ⚡︎27%
```

Shows percentage of context window consumed in the current conversation. The symbol varies by mode:
- **Nerd Font**: ⚡︎ (lightning bolt)
- **ASCII**: # (hash symbol)

Can be disabled with `"noContextWindow": true` or `CLAUDE_CODE_STATUSLINE_NO_CONTEXT_WINDOW=1`.

### Environment Context

When enabled with `"envContext": true`, shows development tool versions:

```
claude-statusline @ main [⚑!⇡] *Claude Sonnet 4.5 Node22.17.1 Py3.13.5 Docker28.3.3
```

*Example shows ASCII mode for universal compatibility. With Nerd Fonts enabled, ASCII symbols are replaced with icons/emojis.*

Supported tools:
- **Node.js**: `node --version` (cached 5 minutes)
- **Python**: `python3 --version` or `python --version` (cached 5 minutes)
- **Docker**: `docker --version` (cached 30 minutes)

### Smart Width Management

Two modes available:

1. **Basic Mode** (default):
   - Simple truncation at `terminal width - 10` characters
   - Always single-line
   - Fast and predictable

2. **Smart Truncation Mode** (`CLAUDE_CODE_STATUSLINE_TRUNCATE=1`):
   - 15-character right margin prevents bleeding into Claude Code telemetry
   - Branch prioritization: Branch names preserved over project names
   - Progressive truncation: Project → Branch → Indicators (if absolutely necessary)
   - Optional soft-wrapping: Can wrap model/environment info to preserve more context
   - Responsive design: Adapts to terminal width from 60-200+ characters
   - Disable soft-wrapping with `"noSoftWrap": true` to force single-line

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

| Use Case | Default Symbol | ASCII Fallback | Notes |
|----------|---------------|---------------|-------|
| **Git Repository** | `@` | `@` | Always ASCII |
| **Stashed Files** | `⚑` | `$` | ASCII when `"noEmoji": true` |
| **Staged Changes** | `+` | `+` | Always ASCII |
| **Modified Files** | `!` | `!` | Always ASCII |
| **Untracked Files** | `?` | `?` | Always ASCII |
| **Renamed Files** | `»` | `>` | ASCII when `"noEmoji": true` |
| **Deleted Files** | `✘` | `X` | ASCII when `"noEmoji": true` |
| **Merge Conflicts** | `×` | `C` | ASCII when `"noEmoji": true` |
| **Ahead/Behind** | `⇡⇣` | `A/B` | ASCII when `"noEmoji": true` |
| **Diverged** | `⇕` | `D` | ASCII when `"noEmoji": true` |
| **Claude Model** | `🤖` | `*` | ASCII when `"noEmoji": true` |
| **Context Window** | `⚡︎` | `#` | ASCII when `"noEmoji": true` |

*Note: Examples show ASCII-compatible symbols. Full statusline with Nerd Fonts shows additional symbols: ⚑✘!+?»×⇕⇡⇣*

### 🎛️ Configuration

**📖 [Complete Configuration Guide](./docs/guide-01-configuration.md)**

Configure with JSON/YAML files:

```bash
# Quick setup with minimal example
cp .claude-statusline.json.example.min ~/.claude/claude-statusline.json

# Or complete example with all options
cp .claude-statusline.json.example ~/.claude/claude-statusline.json

# Edit your configuration
nano ~/.claude/claude-statusline.json
```

**Configuration search order:**
1. `./claude-statusline.json` or `./claude-statusline.yaml` (project-level)
2. Parent directories (searches up the tree)
3. `~/.claude/claude-statusline.{json,yaml}` (global) ← **Recommended**
4. Environment variables (legacy v1.0 support)

*Only JSON and YAML formats are supported. First configuration file found is used.*

## Examples

### Default Behavior
```bash
# Basic truncation (default) - truncated at terminal width minus 10 chars
claude-statusline @ main [⚑!⇡] *Claude Sonnet 4.5

# With environment context enabled
# Set "envContext": true in config file
claude-statusline @ main [⚑!⇡] *Claude Sonnet 4.5 Node22.17.1 Py3.13.5 Docker28.3.3
```

### ASCII Mode (Fallback)
```bash
# With "noEmoji": true in config file
claude-statusline @ main [$!A] *Claude Sonnet 4.5
```

## Documentation

📚 **Complete documentation available in the [`docs/`](./docs) directory:**

- **[Configuration Guide](./docs/guide-01-configuration.md)** - Complete configuration options and examples
- **[Migration Guide](./docs/MIGRATION.md)** - Migrating from bash v1.0 to TypeScript v2.0
- **[Feature Comparison](./docs/FEATURE_COMPARISON.md)** - Detailed comparison between versions
- **[Documentation Index](./docs/README.md)** - Overview of all documentation

## Security

Enhanced security with input validation and type safety:
- **Input Validation**: Comprehensive validation for all inputs
- **Command Injection Prevention**: Sanitized shell command execution
- **Path Traversal Protection**: Comprehensive path validation
- **Type Safety**: TypeScript compile-time and runtime validation

## Dependencies

- **Required**: Node.js >= 22.6.0 or Bun >= 1.0.0, Git (for status parsing)
- **Runtime**: yaml, zod
- **Development**: TypeScript, ESLint, Prettier

## Troubleshooting

**Common Issues:**
- **Build failures**: `npm install && npm run build`
- **Performance issues**: Clear cache `rm -rf /tmp/.claude-statusline-cache/`
- **Symbol display**: Force ASCII mode with `"noEmoji": true` in config

## ❓ Frequently Asked Questions

### Performance
**Q: Is it really fast enough for real-time use?**
A: Yes! With Bun it runs in ~5ms, which is instantaneous for human perception. Even with Node.js it's only ~28ms.

**Q: Why do some benchmarks show ~136ms?**
A: Those include system startup overhead. The actual execution time is much faster (~5ms with Bun). What matters is that it feels instant to users.

**Q: Should I use Bun or Node.js?**
A: Use Bun if you can - it's 5x faster (~5ms vs ~28ms). Configure it as "bun claude-statusline" in your settings.json to get the performance benefits. Node.js is still plenty fast for daily use.

### Installation
**Q: Why is the download only 19KB?**
A: We use esbuild to bundle everything into a single optimized file. No downloading 500+ files!

**Q: Do I need Node.js installed?**
A: Yes, or Bun. We recommend Bun for best performance, but Node.js works perfectly fine.

### Configuration
**Q: How do I see Node/Python versions?**
A: Create `~/.claude/claude-statusline.json` with `{"envContext": true}`.

**Q: Can I customize the symbols?**
A: Yes! Set `"noEmoji": true` for ASCII mode, or use Nerd Fonts for emoji icons.

## Contributing

See our [Contributing Guidelines](./CONTRIBUTING.md) for development setup and pull requests.

## Changelog

View [CHANGELOG.md](./CHANGELOG.md) for detailed version history and updates.

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

## 📦 Legacy: Bash v1.0

> **Note:** Version 2.0 (TypeScript) is recommended for all users. Bash v1.0 is maintained for legacy environments only.

For environments where Node.js/npm is not available:

```bash
curl -o claude-statusline.sh https://github.com/shrwnsan/claude-statusline/releases/download/v1.0.0/claude-statusline.sh
chmod +x claude-statusline.sh
```

**Limitations of v1.0:**
- Unix/Linux only (no Windows support)
- No configuration files
- No npm distribution
- Basic width detection only

See [Feature Comparison](./docs/FEATURE_COMPARISON.md) for details.

