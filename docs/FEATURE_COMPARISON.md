# Feature Comparison: TypeScript v2.0 vs Bash v1.0

Comprehensive comparison between the stable bash implementation and the next-generation TypeScript rewrite.

**Ready to upgrade?** See the [Migration Guide](./MIGRATION.md) for step-by-step instructions.

## Performance Overview

| Version | Execution Time | Performance | Notes |
|---------|----------------|-------------|-------|
| **TypeScript v2.0** | **~30-45ms** | ✅ Excellent | Native JS optimizations |
| Bash v1.0 | ~99ms | ✅ Good | Optimized bash implementation |
| Bash v1.0 (first run) | ~888ms | ⚠️ Slow | One-time cache population |

## Feature Matrix

| Feature | Bash v1.0 | TypeScript v2.0 | Notes |
|---------|-----------|------------------|-------|
| **Core Functionality** |
| Git status indicators | ✅ | ✅ | Branch, staged, modified, untracked, etc. |
| Environment context | ✅ | ✅ | Node.js, Python, Docker versions |
| Smart truncation | ✅ | ✅ | Prevents statusline overflow |
| ASCII/Nerd Font detection | ✅ | ✅ | Auto-detects terminal capabilities |
| Security validation | ✅ | ✅ | Input validation, path sanitization |
| Soft-wrapping | ✅ | ✅ | Advanced text wrapping options |
| **Configuration** |
| Environment variables | ✅ | ✅ | Legacy support in both |
| Configuration files | ❌ | ✅ | `.claude-statusline.json/.yaml` |
| JSON Schema validation | ❌ | ✅ | Editor autocompletion & validation |
| Project-specific configs | ❌ | ✅ | Override global settings |
| **Platform Support** |
| Linux/macOS | ✅ | ✅ | Full support |
| Windows | ❌ | ✅ | Native Node.js support |
| Cross-platform caching | ✅ | ✅ | Both have caching systems |
| **Distribution** |
| Manual download | ✅ | ✅ | Download from releases |
| npm distribution | ❌ | ✅ | `npm install -g claude-statusline` |
| bun distribution | ❌ | ✅ | `bun install -g claude-statusline` |
| **Development Experience** |
| TypeScript types | ❌ | ✅ | Full type safety |
| Editor integration | ❌ | ✅ | JSON Schema support |
| Debug options | ✅ | ✅ | Enhanced debugging in v2.0 |
| Unit tests | ✅ | ✅ | Both have test suites |
| **Advanced Features** |
| Width debugging | ❌ | ✅ | `debugWidth` option |
| Force width override | ❌ | ✅ | `forceWidth` option |
| Configurable symbols | ❌ | ✅ | Custom Nerd Font/ASCII symbols |
| YAML config support | ❌ | ✅ | Alternative config format |
| Cache management | ✅ | ✅ | TTL-based caching |

## Detailed Feature Breakdown

### Core Git Status Features

Both versions provide comprehensive git status:

| Indicator | Bash v1.0 | TypeScript v2.0 | Symbol |
|-----------|-----------|------------------|--------|
| Stashed changes | ✅ | ✅ | ⚑ / $ |
| Staged files | ✅ | ✅ | + |
| Modified files | ✅ | ✅ | ! |
| Untracked files | ✅ | ✅ | ? |
| Renamed files | ✅ | ✅ | » / > |
| Deleted files | ✅ | ✅ | ✘ / X |
| Merge conflicts | ✅ | ✅ | × / C |
| Ahead of upstream | ✅ | ✅ | ↑ / A |
| Behind upstream | ✅ | ✅ | ↓ / B |
| Diverged branches | ✅ | ✅ | ⇕ / D |

### Configuration Capabilities

#### Bash v1.0
- Environment variables only
- Limited customization options
- No persistent configuration storage

#### TypeScript v2.0
- Configuration files with JSON Schema validation
- Project-specific overrides
- Rich customization options
- Multiple config formats (JSON/YAML)

### Platform Compatibility

#### Bash v1.0
- ✅ Linux
- ✅ macOS
- ❌ Windows (requires WSL)
- ❌ Limited Windows Subsystem support

#### TypeScript v2.0
- ✅ Linux
- ✅ macOS
- ✅ Windows (native)
- ✅ Cross-platform Node.js runtime

### Distribution Methods

#### Bash v1.0
- Manual download from GitHub releases
- Direct script execution
- Self-contained bash script

#### TypeScript v2.0
- npm registry (`npm install -g claude-statusline`)
- bun package manager (`bun install -g claude-statusline`)
- GitHub releases (compiled binaries)

### Development & Debugging

#### Bash v1.0
- Manual debugging with `bash -x`
- Basic logging capabilities
- Limited tooling support

#### TypeScript v2.0
- Built-in debugging options (`debugWidth`)
- Comprehensive test suite
- VS Code integration via JSON Schema
- TypeScript development experience

## Migration Decision Guide

### Stay with Bash v1.0 if:
- ✅ You need maximum stability
- ✅ You prefer bash-only solutions
- ✅ You're on Linux/macOS only
- ✅ You want minimal dependencies
- ✅ You're comfortable with environment variables

### Upgrade to TypeScript v2.0 if:
- ✅ You need Windows support
- ✅ You want configuration files
- ✅ You prefer npm package management
- ✅ You want better performance
- ✅ You need advanced customization
- ✅ You want TypeScript development tools

### Gradual Migration Path:
1. **Install TypeScript v2.0** alongside bash v1.0
2. **Copy your environment variables** to a config file
3. **Test with your current workflow**
4. **Switch when ready**

## Performance Benchmarks

Based on typical usage scenarios:

| Scenario | Bash v1.0 | TypeScript v2.0 | Improvement |
|----------|-----------|------------------|-------------|
| **Cold start** | 888ms | 45ms | **19.5x faster** |
| **Warm start** | 99ms | 30ms | **3.3x faster** |
| **No git status** | 37ms | 15ms | **2.5x faster** |
| **Environment context** | 77ms | 25ms | **3.1x faster** |

## Compatibility Matrix

| Use Case | Bash v1.0 | TypeScript v2.0 | Recommendation |
|---------|-----------|------------------|----------------|
| **Linux CLI user** | ✅ Perfect | ✅ Perfect | Either works |
| **macOS CLI user** | ✅ Perfect | ✅ Perfect | Either works |
| **Windows user** | ❌ No support | ✅ Perfect | **Use v2.0** |
| **npm/bun user** | ❌ Manual install | ✅ Native install | **Use v2.0** |
| **Configuration files** | ❌ Not supported | ✅ Full support | **Use v2.0** |
| **Minimal dependencies** | ✅ Bash only | ✅ Node.js only | Either works |
| **Maximum performance** | ✅ Good | ✅ Excellent | **Prefer v2.0** |

## Summary

**TypeScript v2.0 represents a significant evolution** while maintaining full backward compatibility with the core features that made bash v1.0 successful. The main advantages are:

- **19.5x performance improvement** on cold start
- **Native Windows support**
- **Modern configuration system**
- **Package manager integration**
- **Enhanced development experience**

**Bash v1.0 remains viable** for users who prefer maximum stability and minimal dependencies on Unix-like systems.