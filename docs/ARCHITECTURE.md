# Architecture

This document describes the technical architecture and design decisions for Claude Statusline v2.0.

## Overview

Claude Statusline is a TypeScript CLI tool that provides git status indicators and environment context for Claude Code. The architecture prioritizes:

- **Performance**: Native JavaScript optimizations over bash interpretation
- **Security**: Type safety and input validation
- **Modularity**: Clean separation of concerns
- **Maintainability**: Testable, documented code

## Project Structure

```
claude-statusline/
├── src/                           # TypeScript source code
│   ├── core/                      # Core functionality
│   │   ├── config.ts             # Configuration management with Zod validation
│   │   ├── security.ts           # Input validation and sanitization
│   │   └── cache.ts              # TTL-based caching system
│   ├── git/                       # Git operations
│   │   └── status.ts             # Git status parsing and indicator formatting
│   ├── ui/                        # User interface components
│   │   ├── symbols.ts            # Symbol detection and Nerd Font support
│   │   └── width.ts              # Terminal width detection and text truncation
│   ├── env/                       # Environment detection
│   │   └── context.ts            # Development tool version detection
│   └── index.ts                   # Main entry point
├── bin/                           # Executable wrappers
│   └── claude-statusline         # Main executable with shebang
├── tests/                         # Test suite
├── scripts/                       # Development utilities
│   └── benchmark.js              # Performance benchmarking
└── dist/                          # Compiled JavaScript (generated)
```

## Core Modules

### Configuration System (`core/config.ts`)

**Purpose**: Centralized configuration management with validation

**Features**:
- **Zod schema validation** for runtime type safety
- **Multiple config sources**: Files (JSON/YAML), environment variables, defaults
- **Hierarchical precedence**: CLI args > env vars > config files > defaults
- **Backward compatibility** with v1.0 environment variables

**Key Design Decisions**:
- Use Zod for both compile-time (TypeScript) and runtime validation
- Support both JSON and YAML for user preference
- Environment variable inheritance for smooth v1.0 → v2.0 migration

```typescript
const ConfigSchema = z.object({
  cacheTTL: z.number().default(300),
  noEmoji: z.boolean().default(false),
  // ... other config fields
});
```

### Security Module (`core/security.ts`)

**Purpose**: Input validation and sanitization

**Features**:
- **JSON input validation** with structure and length checks
- **Path traversal prevention** with comprehensive pattern matching
- **Command injection protection** for all shell interactions
- **String sanitization** for safe display

**Security Layers**:
1. **TypeScript compile-time** type checking
2. **Zod runtime** validation
3. **Custom validation** functions for security-critical inputs
4. **Sanitization** before display or processing

### Caching System (`core/cache.ts`)

**Purpose**: Performance optimization with TTL-based caching

**Features**:
- **File-based caching** with automatic cleanup
- **TTL support** per cache entry
- **Parallel operations** for performance
- **Cache statistics** for monitoring

**Cache Strategy**:
- **Tool versions**: 5-minute TTL (Node.js, Python)
- **Docker version**: 30-minute TTL (less frequent changes)
- **Git information**: 1-minute TTL (branch can change frequently)

### Git Operations (`git/status.ts`)

**Purpose**: Git repository status parsing and indicator generation

**Dependencies**: `simple-git` library for cross-platform git operations

**Features**:
- **Comprehensive status parsing**: staged, unstaged, untracked, conflicts
- **Remote tracking**: ahead/behind status detection
- **Multiple git methods**: fallbacks for different git versions
- **Cross-platform compatibility**: Windows, macOS, Linux

**Status Parsing Logic**:
```typescript
// Parse git --porcelain format
// XY PATH where X=staged, Y=unstaged
if (stagedChar === 'M') indicators.staged++;
if (unstagedChar === 'M') indicators.modified++;
// ... handle all cases
```

### Symbol Management (`ui/symbols.ts`)

**Purpose**: Terminal font detection and symbol selection

**Features**:
- **Nerd Font auto-detection** with multiple methods
- **ASCII fallback** symbol sets
- **Terminal-specific detection** (VSCode, iTerm, etc.)
- **Platform-specific font detection**

**Detection Methods**:
1. **Environment variables**: `NERD_FONT=1`, `TERM_PROGRAM`
2. **Font list analysis**: `fc-list`, `system_profiler`
3. **Installation patterns**: Common Nerd Font locations
4. **Terminal heuristics**: Known Nerd Font-capable terminals

### Width Management (`ui/width.ts`)

**Purpose**: Terminal width detection and text truncation

**Features**:
- **Multiple width detection methods** with fallbacks
- **Smart truncation** with branch prioritization
- **Soft wrapping** support for long content
- **Responsive design** for different terminal sizes

**Width Detection Priority**:
1. **Manual override**: `CLAUDE_CODE_STATUSLINE_FORCE_WIDTH`
2. **Environment**: `COLUMNS`, `CLAUDE_CODE_TERMINAL_WIDTH`
3. **Node.js**: `process.stdout.columns`
4. **System commands**: `tput cols`, `stty size`
5. **Terminal defaults**: Based on `TERM_PROGRAM`, `TERM`

### Environment Detection (`env/context.ts`)

**Purpose**: Development tool version detection and caching

**Features**:
- **Parallel version detection** for performance
- **Cross-platform command execution**
- **Intelligent caching** with different TTL per tool
- **Graceful fallbacks** for missing tools

**Supported Tools**:
- **Node.js**: `node --version`
- **Python**: `python3 --version` → `python --version`
- **Docker**: `docker --version`

## Data Flow

```
Claude Code Input
       ↓
   Security Validation
       ↓
   Configuration Loading
       ↓
┌─────────────────────────┐
│  Parallel Operations    │
├─────────┬───────────────┤
│ Git     │ Environment   │
│ Status  │ Detection     │
└─────────┴───────────────┘
       ↓
   Symbol Selection
       ↓
   Width Detection
       ↓
   Statusline Assembly
       ↓
   Output to Claude Code
```

## Performance Considerations

### Native JavaScript Optimizations

**v2.0 vs v1.0 Performance Gains**:
- **JSON parsing**: Native `JSON.parse()` vs bash regex
- **Parallel execution**: `Promise.all()` vs sequential bash commands
- **Caching**: Built-in Node.js caching vs file operations
- **String operations**: Optimized V8 engine vs bash string manipulation

### Caching Strategy

**Cache Hierarchy**:
1. **In-memory**: Process-level caching during execution
2. **File-based**: Persistent cache across executions
3. **TTL-based**: Automatic cache invalidation

**Cache Keys**:
- Environment versions: `node_version`, `python3_version`
- Git information: `git_branch_<base64_dir>`, `git_remote_<base64_dir>`

### Memory Management

- **Minimal memory footprint**: Stream processing where possible
- **Efficient data structures**: Use appropriate TypeScript types
- **Cache cleanup**: Automatic TTL-based expiration

## Security Architecture

### Input Validation Layers

1. **TypeScript**: Compile-time type checking
2. **Zod**: Runtime schema validation
3. **Custom validation**: Security-specific checks
4. **Sanitization**: Output sanitization

### Threat Model

**Protected Against**:
- **Command injection**: All shell commands use parameterized execution
- **Path traversal**: Comprehensive path validation
- **Buffer overflow**: Length limits on all inputs
- **Code injection**: JSON parsing with structure validation

**Assumptions**:
- **Claude Code input is trusted** but validated
- **File system access is limited** to user directories
- **Network access is not required** for core functionality

## Cross-Platform Compatibility

### Platform-Specific Considerations

**Windows**:
- **Path handling**: Backward/forward slashes
- **Command execution**: `cmd.exe` vs `powershell`
- **Font detection**: Windows-specific font locations
- **Terminal detection**: Windows Terminal, ConHost

**macOS**:
- **Font detection**: Homebrew Nerd Font installations
- **Command availability**: BSD vs GNU command variants
- **File permissions**: Executable bit handling

**Linux**:
- **Font detection**: Fontconfig, system fonts
- **Terminal diversity**: Wide range of terminal emulators
- **Package managers**: Different font installation methods

### Compatibility Strategy

1. **Node.js API**: Use cross-platform Node.js modules
2. **Conditional logic**: Platform-specific code paths where needed
3. **Fallbacks**: Multiple methods for critical operations
4. **Testing**: Multi-platform testing in CI/CD

## Testing Strategy

### Test Categories

1. **Unit Tests**: Individual module functionality
2. **Integration Tests**: Module interaction testing
3. **Security Tests**: Input validation and attack prevention
4. **Performance Tests**: Benchmarking against baseline
5. **Cross-Platform Tests**: Compatibility verification

### Test Structure

```
tests/
├── security.test.ts      # Security validation tests
├── runner.test.ts        # Main functionality tests
├── git/                  # Git operation tests
├── core/                 # Core module tests
├── ui/                   # UI component tests
└── env/                  # Environment detection tests
```

## Future Extensibility

### Plugin Architecture (Planned)

**Design Goals**:
- **Modular plugins**: Easy to add new indicators
- **Configuration-driven**: Plugin enable/disable via config
- **Performance isolation**: Plugin failures don't affect core
- **Type safety**: Plugin interface definitions

**Plugin Interface Sketch**:
```typescript
interface StatuslinePlugin {
  name: string;
  version: string;
  execute(context: PluginContext): Promise<string | null>;
}
```

### Configuration Schema Evolution

**Backward Compatibility**:
- **Schema versioning**: Config format versioning
- **Migration paths**: Automatic config upgrades
- **Fallback handling**: Graceful degradation for old configs

## Dependencies

### Runtime Dependencies

- **simple-git**: Git operations with cross-platform support
- **zod**: Runtime type validation and schema definition
- **yaml**: YAML configuration file support

### Development Dependencies

- **TypeScript**: Type safety and modern JavaScript features
- **ESLint + Prettier**: Code quality and formatting
- **Node.js test runner**: Native testing framework

### Dependency Strategy

- **Minimal dependencies**: Only essential runtime dependencies
- **Well-maintained packages**: Active development and security
- **Alternative options**: Multiple packages considered for each need
- **Security scanning**: Regular dependency vulnerability scans

---

This architecture is designed to balance performance, security, and maintainability while providing a solid foundation for future enhancements.