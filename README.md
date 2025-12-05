# Claude Code Statusline

Simple statusline for Claude Code with git indicators. Now available in TypeScript v2.0 with enhanced performance and npm distribution!

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![Version](https://img.shields.io/badge/version-2.0.0--alpha-green.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

![Demo](https://github.com/user-attachments/assets/8716dc4e-83da-410b-88f2-c47de7dd5930)

## Quick Start

### Installation

```bash
# npm install (recommended)
npm install -g claude-statusline

# Or download from releases
curl -o claude-statusline https://github.com/shrwnsan/claude-statusline/releases/download/v2.0.0/claude-statusline
chmod +x claude-statusline
```

<details>
<summary>📦 Legacy: Bash v1.0</summary>

For users who prefer bash-only solutions:

```bash
curl -o claude-statusline.sh https://github.com/shrwnsan/claude-statusline/releases/download/v1.0.0/claude-statusline.sh
chmod +x claude-statusline.sh
```

*Note: v1.0 lacks Windows support, configuration files, and npm distribution. See [Feature Comparison](./docs/FEATURE_COMPARISON.md) for details.*

</details>

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

### Usage

The statusline automatically displays when Claude Code is active and updates based on your git status and environment.

### Verification

After installation, verify it's working:

1. **Check the command is available:**
   ```bash
   claude-statusline --help
   ```

2. **Test in a git repository:**
   ```bash
   cd /path/to/git/repo
   claude-statusline
   ```

3. **Reload Claude Code** and check for the statusline at the bottom

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

### Environment Context

When enabled with `"envContext": true`, shows development tool versions:

```
claude-statusline @ main [⚑!⇡]
*Claude Sonnet 4.5 Node22.17.1 Py3.13.5 Docker28.3.3
```

*Example shows ASCII mode for universal compatibility. With Nerd Fonts enabled, ASCII symbols are replaced with icons/emojis.*

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

*Note: Examples show ASCII-compatible symbols. Full statusline with Nerd Fonts shows additional symbols: ⚑✘!+?»×⇕⇡⇣*

### 🎛️ Configuration

**📖 [Complete Configuration Guide](./docs/CONFIGURATION.md)**

Configure with JSON/YAML files:

```bash
# Quick setup with minimal example
cp .claude-statusline.json.example.min ~/.claude/.claude-statusline.json

# Or complete example with all options
cp .claude-statusline.json.example ~/.claude/.claude-statusline.json

# Edit your configuration
nano ~/.claude/.claude-statusline.json
```

**Configuration search order:**
1. `./.claude-statusline.json` (project-specific)
2. `~/.claude/.claude-statusline.json` (global) ← **Recommended**
3. Environment variables (legacy)

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

- **[Configuration Guide](./docs/CONFIGURATION.md)** - Complete configuration options and examples
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

- **Required**: Node.js >= 18.0.0, Git (for status parsing)
- **Runtime**: simple-git, yaml, zod
- **Development**: TypeScript, ESLint, Prettier

## Troubleshooting

**Common Issues:**
- **Build failures**: `npm install && npm run build`
- **Performance issues**: Clear cache `rm -rf /tmp/.claude-statusline-cache/`
- **Symbol display**: Force ASCII mode with `"noEmoji": true` in config

## Contributing

See our [Contributing Guidelines](./CONTRIBUTING.md) for development setup and pull requests.

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

