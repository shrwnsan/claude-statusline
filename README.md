# Claude Code Statusline

Advanced statusline replacement for Claude Code with comprehensive git indicators, smart width management, and terminal width optimization.

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Bash](https://img.shields.io/badge/language-Bash-4EAA25.svg)

## Overview

This statusline script provides a sophisticated replacement for Claude Code's default status display, featuring:

- **Smart Line Wrapping** (always enabled with 15-char right margin)
- **Branch Prioritization** (branch names preserved over project names)
- **Terminal Width Optimization** (adaptive to different terminal sizes)
- **Environment Controls** (ASCII mode, git status, version context)

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/shrwnsan/claude-statusline.git
cd claude-statusline

# Make the script executable
chmod +x claude-statusline.sh

# Add to your Claude Code settings.json
{
  "statusLine": {
    "type": "command",
    "command": "/path/to/claude-statusline.sh",
    "padding": 0
  }
}
```

### Usage

The statusline automatically displays when Claude Code is active and updates based on your git status and environment.

## Features

### Git Status Indicators

- **Stashed**: ⚑ (gray background with flag)
- **Staged**: + (green, added to staging area)
- **Modified**: ! (yellow, unstaged changes)
- **Untracked**: ? (blue, new files not tracked)
- **Renamed**: » (orange/magenta, files moved/renamed)
- **Deleted**: ✘ (red, files deleted)
- **Conflicts**: × (red, merge conflicts)
- **Ahead**: ⇡ (green, commits ahead of upstream)
- **Behind**: ⇣ (red, commits behind upstream)

### Smart Width Management

- **15-character right margin** prevents bleeding into Claude Code telemetry
- **Branch prioritization**: Branch names preserved over project names
- **Progressive truncation**: Project → Branch → Indicators (if absolutely necessary)
- **Responsive design**: Adapts to terminal width from 60-200+ characters

### Environment Variables

Available controls:

- `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` - Force ASCII mode (no Nerd Fonts)
- `CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1` - Disable git indicators
- `CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1` - Show Node.js, Python, Docker versions
- `CLAUDE_CODE_STATUSLINE_NO_TRUNCATE=1` - Disable project/branch name truncation

## Examples

### Default Behavior (Smart Wrapping)
```bash
# Clean two-line layout (most common)
.dotfiles  main [⚑!⇡]
󰚩Claude Sonnet 4.5

# With environment context
CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1
.dotfiles  main [⚑!⇡]
󰚩Claude Sonnet 4.5 22.17.1 3.13.5 28.3.3
```

### ASCII Mode (Fallback)
```bash
CLAUDE_CODE_STATUSLINE_NO_EMOJI=1
.dotfiles @ main [$!A]
*Claude Sonnet 4.5
```

### Long Names (Branch Prioritization)
```bash
# Long project names get truncated first (branch preserved)
vibekit-claude-plugins-super-long-name  feature/branch-name-that-is-very-long [!?✘]
󰚩glm-4.6 22.17.1 3.13.5 28.3.3
```

## Performance

This script is optimized for performance with smart caching:

- **Execution Time**: ~99ms (optimized from ~888ms first run)
- **Cache Performance**: 83% faster after initial cache population
- **Memory Usage**: Minimal footprint with efficient bash operations

### Performance Benchmark

| Configuration | Time | Performance | Notes |
|---------------|------|-------------|-------|
| **Full Features** (default) | **~99ms** | ✅ Good | All features enabled |
| **No Environment Context** | **~77ms** | ✅ Good | Security + git status only |
| **No Git Status** | **~37ms** | ✅ Excellent | Security + env context only |
| **First Run (cache population)** | **~888ms** | ⚠️ Slow | One-time overhead only |

## Terminal Width Compatibility

### Width Breakpoints

| Width | Experience | Statusline Behavior |
|-------|------------|-------------------|
| **< 60** | Poor | Aggressive truncation |
| **60-79** | Acceptable | Smart truncation, branch preserved |
| **80-99** | Good | Ideal balance, minimal truncation |
| **100-119** | Excellent | Usually no truncation needed |
| **120+** | Perfect | No constraints, optimal UX |

## Architecture

- **Symbol Detection**: Auto-detects Nerd Fonts with ASCII fallbacks
- **Input Validation**: Comprehensive security checks on JSON input
- **Caching System**: Smart version caching with TTL-based invalidation
- **Width Management**: Terminal width detection with multiple fallbacks
- **Font Support**: Progressive enhancement for font capabilities

## Security

The implementation includes strong security measures:

- **Input Sanitization**: Validates JSON structure and content
- **Length Limits**: Prevents buffer overflow attacks
- **Command Injection Protection**: Sanitizes all shell command inputs
- **Cache Isolation**: Separate cache directory with proper permissions
- **Error Handling**: Graceful degradation on failures

## Dependencies

- **Required**: `git` (for status parsing)
- **Optional**: `jq` (for JSON parsing, fallback available), `fc-list` (for font detection)
- **Platform**: Cross-platform (macOS, Linux), optimized for modern terminals

## Roadmap

### Version 1.0 (Current)
- ✅ Optimized bash implementation
- ✅ Smart width management
- ✅ Comprehensive git status
- ✅ Performance caching
- ✅ Environment context

### Version 2.0 (Planned)
- 🔄 TypeScript rewrite for better maintainability
- 🔄 npm/bun distribution
- 🔄 Enhanced performance with JavaScript optimizations
- 🔄 Plugin architecture for extensions
- 🔄 Configuration file support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

When modifying the statusline script:

1. **Test all environment variable combinations**
2. **Verify performance impact** (should stay under 100ms)
3. **Check security implications** (validate all inputs)
4. **Test on multiple terminal widths**
5. **Update this documentation** accordingly

### Performance Testing

Performance should be measured with:
```bash
start=$(($(date +%s%N)/1000000))
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline.sh > /dev/null
end=$(($(date +%s%N)/1000000))
duration=$((end - start))
echo "Execution time: ${duration}ms"
```

### Security Considerations

All changes must maintain security features:
- Input validation and sanitization
- Command injection protection  
- Length limits for buffer overflow prevention
- Proper error handling and graceful degradation

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by the need for better developer experience in Claude Code
- Built with security and performance as primary considerations
- Community feedback has been instrumental in shaping the feature set

---

**Note**: This is the bash version (v1.0). A TypeScript rewrite (v2.0) is planned for improved performance and distribution via npm/bun.
