# AGENTS.md

This file provides operational guidance to AI agents when working with this claude-statusline repository. For project overview and structure, see README.md.

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
CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1 echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"}}' | ./claude-statusline.sh

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
# Check script syntax
bash -n ./claude-statusline.sh

# Run with bash debugging
bash -x ./claude-statusline.sh <<< '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}'

# Check cache status
ls -la /tmp/.claude-statusline-cache/

# Clear cache for testing
rm -rf /tmp/.claude-statusline-cache/

# Test script permissions
chmod +x ./claude-statusline.sh

# Test with different terminal widths
for width in 60 80 100 120; do
    echo "=== $width columns ==="
    COLUMNS=$width echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | ./claude-statusline.sh
    echo ""
done
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
├── claude-statusline.sh    # Main executable script
├── LICENSE                 # Apache 2.0 license
├── README.md              # Project documentation
├── AGENTS.md              # This file - agent operational guidance
└── docs/                  # Detailed documentation
    ├── performance.md     # Performance analysis and benchmarks
    ├── configuration.md   # Environment variables and options
    ├── terminal-widths.md # Width management and responsive design
    └── troubleshooting.md  # Debug guide and common issues
```

### Editing Guidelines
- **Main Script**: Edit `claude-statusline.sh` directly for functionality changes
- **Documentation**: Update relevant documentation files for any feature changes
- **Performance**: Always measure impact after optimizations
- **Security**: Validate all inputs and maintain security posture
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
3. Update `docs/configuration.md` with new options
4. Add tests to this AGENTS.md file
5. Update README.md if feature affects user experience
6. Test performance impact
7. Commit with descriptive message

### Performance Optimization
1. Benchmark current performance
2. Implement optimization
3. Measure improvement
4. Update `docs/performance.md` with new benchmarks
5. Test edge cases and compatibility
6. Document optimization technique in performance.md

### Bug Fixes
1. Identify root cause
2. Implement fix
3. Add regression test to AGENTS.md
4. Update troubleshooting.md if applicable
5. Test across different environments
6. Document fix in commit message

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
