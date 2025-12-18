# Configuration Guide

Complete guide to configuring claude-statusline for your workflow.

## Quick Setup

### Option A: Complete Example with All Options
```bash
# Copy the full example with all options documented
cp .claude-statusline.json.example ~/.claude/.claude-statusline.json
```

### Option B: Minimal Example with Just Essentials
```bash
# Copy minimal example for quick setup
cp .claude-statusline.json.example.min ~/.claude/.claude-statusline.json
```

### Edit Your Configuration
```bash
nano ~/.claude/.claude-statusline.json
```

## Runtime Selection for Maximum Performance

### Understanding the Performance Difference

claude-statusline can run on either Node.js or Bun runtimes, with significant performance differences:

| Runtime | Response Time | Performance | When to Use |
|---------|---------------|------------|-------------|
| **Bun** | ~5ms | ⚡⚡⚡⚡⚡ | Recommended for best performance |
| **Node.js** | ~28ms | ⚡⚡⚡ | Good fallback, widely available |

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

## Configuration Search Order

1. `./.claude-statusline.json` (project-specific)
2. `~/.claude/.claude-statusline.json` (global) ← **Recommended**
3. Environment variables (legacy)

> **Note**: The `~/.claude/` directory is the standard location for Claude Code configurations and hooks. This keeps all your Claude settings organized in one place and follows modern CLI best practices.

## Configuration Options

### Core Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cacheTTL` | number | `300` | Cache duration in seconds for git operations |
| `maxLength` | number | `1000` | Maximum input length (security) |
| `rightMargin` | number | `15` | Right margin for Claude telemetry compatibility |

### Feature Toggles

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `noEmoji` | boolean | `false` | Force ASCII mode instead of Nerd Font symbols |
| `noGitStatus` | boolean | `false` | Disable git status indicators completely |
| `noContextWindow` | boolean | `false` | Disable context window usage display |
| `envContext` | boolean | `false` | Show Node.js, Python, Docker versions |
| `truncate` | boolean | `false` | Enable smart truncation for long statuslines |
| `debugWidth` | boolean | `false` | Show terminal width detection debug info |

### Advanced Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `forceWidth` | number | `null` | Override terminal width detection (testing only) |
| `noSoftWrap` | boolean | `false` | Disable soft-wrapping completely |
| `softWrap` | boolean | `false` | Legacy soft-wrapping (not needed with `truncate: true`) |

### Symbol Customization

#### Nerd Font Symbols (Default)
```json
"symbols": {
  "git": "",        // Git icon
  "model": "󰚩",     // AI model icon
  "contextWindow": "⚡︎", // Context window usage
  "staged": "+",       // Staged changes
  "conflict": "×",     // Merge conflicts
  "stashed": "⚑",     // Stashed changes
  "ahead": "⇡",        // Ahead of upstream
  "behind": "⇣",       // Behind upstream
  "diverged": "⇕",    // Both ahead and behind
  "renamed": "»",     // Renamed files
  "deleted": "✘"      // Deleted files
}
```

#### ASCII Symbols (when `noEmoji: true`)
```json
"asciiSymbols": {
  "git": "@",         // Git icon
  "model": "*",        // AI model icon
  "contextWindow": "#", // Context window usage
  "staged": "+",       // Staged changes
  "conflict": "C",     // Merge conflicts
  "stashed": "$",     // Stashed changes
  "ahead": "A",        // Ahead of upstream
  "behind": "B",       // Behind upstream
  "diverged": "D",    // Both ahead and behind
  "renamed": ">",     // Renamed files
  "deleted": "X"      // Deleted files
}
```

## Complete Example Configuration

### JSON Format
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

### YAML Format (more minimal syntax)
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

> **Note**: The `$schema` property in JSON provides VS Code/other editors with autocompletion and validation. It's JSON-specific and not used in YAML files.

## Environment Variables (Legacy Support)

Environment variables are still supported for backward compatibility. These work in both bash v1.0 and TypeScript v2.0:

### Bash v1.0 & TypeScript v2.0 (Legacy)
- `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` - Force ASCII mode
- `CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1` - Disable git indicators
- `CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1` - Show Node.js, Python, Docker versions
- `CLAUDE_CODE_STATUSLINE_TRUNCATE=1` - Enable smart truncation

### TypeScript v2.0 Only (New Features)
- `CLAUDE_CODE_STATUSLINE_NO_SOFT_WRAP=1` - Disable soft-wrapping
- `CLAUDE_CODE_STATUSLINE_DEBUG_WIDTH=1` - Enable width debugging
- `CLAUDE_CODE_STATUSLINE_NO_CONTEXT_WINDOW=1` - Disable context window usage display

> **Note**: Environment variables are considered legacy. Configuration files are recommended for better organization and more options.

## Popular Configurations

### Minimal Setup (Quick Start)
```json
{
  "envContext": true,
  "truncate": true
}
```

### Developer Setup
```json
{
  "envContext": true,
  "truncate": true,
  "noEmoji": false,
  "debugWidth": false
}
```

### ASCII-Only Setup
```json
{
  "noEmoji": true,
  "envContext": true,
  "truncate": true,
  "symbols": {
    "git": "@",
    "model": "*",
    "staged": "+",
    "conflict": "C",
    "stashed": "$",
    "ahead": "A",
    "behind": "B",
    "diverged": "D",
    "renamed": ">",
    "deleted": "X"
  }
}
```

### Performance-Optimized Setup
```json
{
  "cacheTTL": 600,
  "noGitStatus": false,
  "envContext": false,
  "truncate": true
}
```

## File Formats Supported

- `.claude-statusline.json` - JSON format (recommended for editor support)
- `.claude-statusline.yaml` - YAML format (more minimal syntax)
- `.claude-statusline.yml` - YAML format (deprecated, use `.yaml` instead)

Both formats support exactly the same configuration options.