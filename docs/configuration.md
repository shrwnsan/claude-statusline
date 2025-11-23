# Configuration Guide

This document provides comprehensive configuration options for Claude Statusline.

## Environment Variables

All configuration is done through environment variables. These can be set in your shell profile (`~/.zshrc`, `~/.bashrc`) or for specific sessions.

### Core Controls

#### `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1`
**Purpose**: Force ASCII mode (disable Nerd Font symbols)
**Use Case**: Terminals without Nerd Font support or rendering issues
**Default**: Not set (auto-detects Nerd Font support)

**Example**:
```bash
# Force ASCII mode
export CLAUDE_CODE_STATUSLINE_NO_EMOJI=1

# Temporarily for one command
CLAUDE_CODE_STATUSLINE_NO_EMOJI=1 echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | claude-statusline
```

**Symbol Changes**:
- Git symbol: `` → `@`
- Model prefix: `󰚩` → `*`
- Stashed symbol: `⚑` → `$`
- Conflict symbol: `×` → `C`

#### `CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1`
**Purpose**: Disable git status indicators
**Use Case**: Faster execution, cleaner display, or non-git directories
**Default**: Not set (git status enabled)

**Example**:
```bash
# Disable git status globally
export CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1

# Result: Only project name and model displayed
.dotfiles
*Claude Sonnet 4.5
```

#### `CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1`
**Purpose**: Show development environment versions (Node.js, Python, Docker)
**Use Case**: Development environments where tool versions matter
**Default**: Not set (environment context disabled)

**Example**:
```bash
# Enable environment context
export CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1

# Result: Tool versions displayed
.dotfiles  main [⚑!⇡]
󰚩Claude Sonnet 4.5 22.17.1 3.13.5 28.3.3
```

**Detected Tools**:
- **Node.js**: `node --version` (cached 5 minutes)
- **Python**: `python3 --version` or `python --version` (cached 5 minutes)
- **Docker**: `docker --version` (cached 30 minutes)

#### `CLAUDE_CODE_STATUSLINE_NO_TRUNCATE=1`
**Purpose**: Disable name truncation (opt-out of smart width management)
**Use Case**: Very wide terminals or when full names are preferred
**Default**: Not set (smart truncation enabled)

**Example**:
```bash
# Disable truncation
export CLAUDE_CODE_STATUSLINE_NO_TRUNCATE=1

# Result: Full names shown regardless of terminal width
vibekit-claude-plugins-super-long-project-name-with-lots-of-details  feature/branch-name-that-is-extremely-long-and-descriptive [!?✘]
```

### Debug Controls

#### Debug Configuration (Updated)
**Note**: Previous versions supported `CLAUDE_STATUSLINE_LOG_LEVEL` environment variable, but this has been removed in favor of standard bash debugging tools.

**Current Debug Method**:
```bash
# Enable execution tracing for one run
bash -x /path/to/claude-statusline <<< '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}'

# Enable for session
set -x; /path/to/claude-statusline <<< '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}'; set +x

# Check syntax
bash -n /path/to/claude-statusline
```

**Use Case**: Debugging script execution, performance issues, syntax validation
**Advantage**: Uses standard bash debugging tools instead of custom logging implementation

## Symbol Reference

### Nerd Font Symbols (Default)
| Purpose | Symbol | Color/Background |
|---------|--------|------------------|
| Git branch | `` | Default |
| Stashed changes | `⚑` | Gray background |
| Staged files | `+` | Green |
| Modified files | `!` | Yellow |
| Untracked files | `?` | Blue |
| Renamed files | `»` | Orange/Magenta |
| Deleted files | `✘` | Red |
| Merge conflicts | `×` | Red |
| Ahead of upstream | `⇡` | Green |
| Behind upstream | `⇣` | Red |
| Model prefix | `󰚩` | Default |
| Node.js version | `` | Green |
| Python version | `` | Blue |
| Docker version | `` | Blue |

### ASCII Fallback Symbols
| Purpose | Symbol | Nerd Font Equivalent |
|---------|--------|---------------------|
| Git branch | `@` | `` |
| Stashed changes | `$` | `⚑` |
| Staged files | `+` | `+` |
| Modified files | `!` | `!` |
| Untracked files | `?` | `?` |
| Renamed files | `R` | `»` |
| Deleted files | `D` | `✘` |
| Merge conflicts | `C` | `×` |
| Ahead of upstream | `A` | `⇡` |
| Behind upstream | `B` | `⇣` |
| Model prefix | `*` | `󰚩` |
| Node.js version | `Node` | `` |
| Python version | `Py` | `` |
| Docker version | `Docker` | `` |

## Configuration Examples

### Minimal Configuration
```bash
# Only essential features, maximum performance
export CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1
export CLAUDE_CODE_STATUSLINE_NO_EMOJI=1
```

### Development Configuration
```bash
# Full feature set for development environments
export CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1
# git status and smart width management enabled by default
```

### Wide Terminal Configuration
```bash
# For very wide terminals where truncation isn't needed
export CLAUDE_CODE_STATUSLINE_NO_TRUNCATE=1
export CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1
```

### Troubleshooting Configuration
```bash
# Debug mode with ASCII fallback
export CLAUDE_STATUSLINE_LOG_LEVEL=DEBUG
export CLAUDE_CODE_STATUSLINE_NO_EMOJI=1
```

## Claude Code Integration

### Settings.json Configuration

Add to your `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/path/to/claude-statusline",
    "padding": 0
  }
}
```

### Environment Variables in Claude Code

To use environment variables with Claude Code:

1. **Set in Shell Profile**:
   ```bash
   # Add to ~/.zshrc or ~/.bashrc
   export CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1
   ```

2. **Set in Claude Code Settings** (limited support):
   ```json
   {
     "env": {
       "CLAUDE_CODE_STATUSLINE_ENV_CONTEXT": "1"
     }
   }
   ```

3. **Set Per-Session**:
   ```bash
   # Temporarily for current session
   export CLAUDE_CODE_STATUSLINE_NO_EMOJI=1
   # Restart Claude Code to pick up changes
   ```

## Performance Impact by Configuration

| Configuration | Execution Time | Cache Hit | Notes |
|---------------|----------------|-----------|-------|
| **Full Features** | ~99ms | 83% improvement | All features enabled |
| **No Environment Context** | ~77ms | 83% improvement | Security + git only |
| **No Git Status** | ~37ms | 83% improvement | Security + env only |
| **ASCII Mode Only** | ~99ms | 83% improvement | Same performance as Nerd Font |
| **Minimal Features** | ~36ms | 83% improvement | Maximum performance |

## Cache Management

### Cache Location
```
/tmp/.claude-statusline-cache/
├── node_version        # Node.js version (5 min TTL)
├── python3_version     # Python3 version (5 min TTL)
├── python_version      # Python version (5 min TTL)
├── docker_version      # Docker version (30 min TTL)
├── node_version.time   # Cache timestamp
├── python3_version.time
├── python_version.time
└── docker_version.time
```

### Cache Operations

**Clear Cache**:
```bash
# Clear all cache
rm -rf /tmp/.claude-statusline-cache/

# Clear specific tool cache
rm -f /tmp/.claude-statusline-cache/node_version
rm -f /tmp/.claude-statusline-cache/node_version.time
```

**Check Cache Status**:
```bash
# View cache contents
ls -la /tmp/.claude-statusline-cache/

# Check cache age
find /tmp/.claude-statusline-cache/ -name "*.time" -exec ls -la {} \;
```

## Troubleshooting Configuration

### Common Issues

**Symbols Not Displaying**:
```bash
# Force ASCII mode
export CLAUDE_CODE_STATUSLINE_NO_EMOJI=1

# Check terminal font support
echo " 󰚩 ⚑ ✘" | cat -A
```

**Performance Issues**:
```bash
# Disable features temporarily
export CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1
export CLAUDE_CODE_STATUSLINE_NO_EMOJI=1

# Clear cache
rm -rf /tmp/.claude-statusline-cache/
```

**Environment Context Not Showing**:
```bash
# Check if tools are available
command -v node >/dev/null && echo "Node.js found" || echo "Node.js not found"
command -v python3 >/dev/null && echo "Python3 found" || echo "Python3 not found"
command -v docker >/dev/null && echo "Docker found" || echo "Docker not found"

# Clear cache to force refresh
rm -f /tmp/.claude-statusline-cache/*_version
rm -f /tmp/.claude-statusline-cache/*_version.time
```

### Debug Testing

**Test Configuration**:
```bash
# Test with specific environment variables
CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1 CLAUDE_STATUSLINE_LOG_LEVEL=DEBUG \
  echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | \
  /path/to/claude-statusline
```

**Performance Testing**:
```bash
# Time execution with current configuration
start=$(($(date +%s%N)/1000000))
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | \
  /path/to/claude-statusline > /dev/null
end=$(($(date +%s%N)/1000000))
duration=$((end - start))
echo "Execution time: ${duration}ms"
```
