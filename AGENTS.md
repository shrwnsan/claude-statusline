# AGENTS.md

This file provides operational guidance to AI agents when working with this claude-statusline repository. For project overview and structure, see README.md.

**Current Version**: TypeScript v2.1.1 (not bash v1.0)

## Essential Agent Commands

### Project Setup and Testing
```bash
# Test basic functionality
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"}}' | ./claude-statusline.sh

# Test with environment context
CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1 echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"}}' | ./claude-statusline.sh

# Test ASCII mode
CLAUDE_CODE_STATUSLINE_NO_EMOJI=1 echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"}}' | ./claude-statusline.sh

# Test without git status
CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1 echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"}}' | bun dist/index.bundle.js

# Test without context window
CLAUDE_CODE_STATUSLINE_NO_CONTEXT_WINDOW=1 echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"}}' | bun dist/index.bundle.js

# Test smart truncation
CLAUDE_CODE_STATUSLINE_TRUNCATE=1 echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Sonnet 4.5"}}' | ./claude-statusline.sh

# Test performance
start=$(($(date +%s%N)/1000000))
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"}}' | ./claude-statusline.sh > /dev/null
end=$(($(date +%s%N)/1000000))
duration=$((end - start))
echo "Execution time: ${duration}ms"
```

### Debug and Development Commands
```bash
# Check TypeScript compilation (Bun preferred)
bun run build
# or npm run build

# Run with Bun debugging
bun --inspect dist/index.bundle.js
# or node --inspect dist/index.bundle.js

# Check cache status
ls -la /tmp/.claude-statusline-cache/

# Clear cache for testing
rm -rf /tmp/.claude-statusline-cache/

# Run tests
bun test
# or npm test

# Run linting
bun run lint
# or npm run lint

# Performance benchmark
bun run benchmark
# or npm run benchmark
```

## Critical Agent Reminders

### Script Modification Protocol
**MANDATORY**: After any changes to `claude-statusline.sh`, always run comprehensive tests:

```bash
# 1. Syntax validation
bash -n ./claude-statusline.sh

# 2. Basic functionality test
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | ./claude-statusline.sh

# 3. Performance verification (should stay under 100ms)
start=$(($(date +%s%N)/1000000))
for i in {1..5}; do
    echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | ./claude-statusline.sh > /dev/null
done
end=$(($(date +%s%N)/1000000))
duration=$(((end - start) / 5))
echo "Average execution time: ${duration}ms"

# 4. Environment variable combinations
CLAUDE_CODE_STATUSLINE_NO_EMOJI=1 CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1 \
  echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | ./claude-statusline.sh

# 5. Width responsiveness test
for width in 60 80 100; do
    COLUMNS=$width echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | ./claude-statusline.sh
done
```

### Security Requirements
All modifications must implement:
- **Input validation**: Validate JSON structure and content before processing
- **Length limits**: Enforce maximum string lengths to prevent buffer overflow attacks
- **Command injection protection**: Sanitize all shell command inputs and arguments
- **Cache isolation**: Use secure cache directory with proper permissions
- **Error handling**: Implement graceful degradation on failures

### Performance Requirements
- **Execution time**: Must stay under 100ms for normal operation
- **Cache efficiency**: Optimize for cache hits after first run
- **Memory usage**: Minimize memory footprint for embedded systems
- **Resource cleanup**: Proper cleanup of temporary files and cache

### Cross-Platform Compatibility
- **macOS**: Test with default terminal and iTerm2
- **Linux**: Test with common terminal emulators
- **Shell compatibility**: Ensure bash 3.2+ compatibility for macOS
- **Command availability**: Handle missing optional commands gracefully

## Architecture Context for Agents

### Core Components
- **Input Processing**: JSON parsing and validation from Claude Code
- **Git Integration**: Git status parsing and indicator generation
- **Symbol Management**: Nerd Font detection and ASCII fallbacks
- **Width Management**: Terminal width detection and responsive truncation
- **Cache System**: TTL-based caching for environment context
- **Output Generation**: Formatted statusline assembly

### Performance Optimization Strategy
- **Dependency Caching**: Cache available commands in environment variables
- **Smart Caching**: Different TTLs based on expected change frequency
- **Reduced Validation**: Minimal security checks while maintaining protection
- **Optimized Commands**: Use faster alternatives where available
- **Efficient Parsing**: Consolidate git operations and use awk for processing

### Configuration Management
- **Environment Variables**: Primary configuration method
- **No External Config Files**: Avoid additional file dependencies
- **Runtime Detection**: Auto-detect terminal capabilities and fonts
- **Graceful Degradation**: Fallback to basic functionality when features unavailable

## File Structure Guidelines

### Project Organization
```
claude-statusline/
├── src/                    # TypeScript source code
│   ├── index.ts           # Main entry point
│   ├── core/              # Core functionality
│   ├── git/               # Git operations
│   ├── ui/                # UI formatting
│   ├── env/               # Environment detection
│   └── utils/             # Utility functions
├── dist/                   # Compiled JavaScript output
│   ├── index.bundle.js   # Production bundle (for releases)
│   └── index.js          # Development build
├── bin/                    # Executable wrappers
│   └── claude-statusline # npm package entry point
├── docs/                  # Detailed documentation
│   ├── guide-01-configuration.md   # Configuration options
│   ├── guide-03-performance.md     # Performance analysis
│   ├── MIGRATION.md               # v1.0 to v2.0 migration guide
│   └── CHANGELOG.md               # Version history
├── tests/                 # Test files
├── package.json           # npm configuration
├── tsconfig.json         # TypeScript configuration
├── esbuild.config.js     # Build configuration
├── LICENSE               # Apache 2.0 license
├── README.md             # Project documentation
└── AGENTS.md             # This file - agent operational guidance
```

### Editing Guidelines
- **Main Code**: Edit TypeScript files in `src/` directory
- **Build**: Run `bun run build:prod` for production, `bun run build` for development
- **Documentation**: Update relevant documentation files for any feature changes
- **Performance**: Target ~5ms with Bun, ~28ms with Node.js
- **Security**: TypeScript provides compile-time safety, validate inputs at runtime
- **Testing**: Run comprehensive test suite before commits

## Testing Before Commits

Before committing changes, ensure:

1. **Functionality**: All features work as expected
2. **Performance**: Execution time stays under 100ms
3. **Security**: Input validation and sanitization intact
4. **Compatibility**: Works across different terminal widths and platforms
5. **Documentation**: Updated documentation reflects changes
6. **Cache Behavior**: Cache operations work correctly and cleanup properly

## Common Agent Workflows

### Adding New Features
1. Implement feature in `claude-statusline.sh`
2. Add environment variable control if needed
3. Update `docs/guide-01-configuration.md` with new options
4. Add tests to this AGENTS.md file
5. Update README.md if feature affects user experience
6. Test performance impact
7. Commit with descriptive message

### Performance Optimization
1. Benchmark current performance
2. Implement optimization
3. Measure improvement
4. Update `docs/guide-03-performance.md` with new benchmarks
5. Test edge cases and compatibility
6. Document optimization technique in guide-03-performance.md

### Bug Fixes
1. Identify root cause
2. Implement fix
3. Add regression test to AGENTS.md
4. Update guide-04-troubleshooting.md if applicable
5. Test across different environments
6. Document fix in commit message

## Release Process

### GitHub Release Management
```bash
# Build production bundle
npm run build:prod

# Create standalone executable for release
echo '#!/usr/bin/env node' > claude-statusline && cat dist/index.bundle.js >> claude-statusline
chmod +x claude-statusline

# Create release with proper asset (follow npm package naming)
gh release create vX.Y.Z --title "vX.Y.Z: Description" --notes "Release notes" claude-statusline
```

**Critical Release Requirements**:
- Use `claude-statusline` as asset name (not versioned) for npm package consistency
- Include bundled JavaScript (20KB), not wrapper script (685 bytes)
- Test binary works: `./claude-statusline` should execute (may need proper Claude Code context)

### Documentation Updates
- **README.md examples**: Use ASCII symbols for GitHub compatibility (Nerd Font icons don't render)
- **Context Window examples**: Mark as "(ASCII version)" to avoid broken icon display
- **Configuration files**: Keep Nerd Font symbols as defaults (they're actual defaults)
- **Release notes**: Include installation methods and asset format

## Integration Points

### Claude Code Integration
- **Input Format**: Expects JSON with workspace and model information
- **Output Format**: Single-line statusline with optional wrapping
- **Environment**: Works within Claude Code's execution environment
- **Dependencies**: Requires `git` command availability

### Dotfiles Integration
- **Symlink Management**: Managed through `~/.zsh_data` [symlinks] section
- **External Dependency**: Treated as external tool, not embedded in dotfiles
- **Configuration**: Uses environment variables, not dotfiles-specific configs
- **Updates**: Independent of dotfiles versioning and releases

---

## Emergency Procedures

### Script Not Working
1. Check syntax with `bash -n ./claude-statusline.sh`
2. Test manually with sample input
3. Verify script permissions
4. Check for missing dependencies
5. Clear cache and retest

### Performance Issues
1. Clear cache: `rm -rf /tmp/.claude-statusline-cache/`
2. Test with minimal features
3. Profile execution time
4. Check for expensive operations
5. Optimize or disable problematic features

### Integration Problems
1. Verify symlink target exists and is executable
2. Test Claude Code input format
3. Check environment variable settings
4. Validate JSON parsing
5. Test with different terminal configurations
