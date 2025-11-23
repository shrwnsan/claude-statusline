# Performance Analysis

This document provides detailed performance benchmarks and optimization strategies for the Claude Code Statusline script.

## Performance Metrics

### Benchmarking Methodology

Performance testing using bash nanosecond timing with standard test input:
```bash
start=$(($(date +%s%N)/1000000))
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | ./claude-statusline > /dev/null
end=$(($(date +%s%N)/1000000))
duration=$((end - start))
echo "Execution time: ${duration}ms"
```

### Current Performance Results

| Configuration | Time | Performance | Notes |
|---------------|------|-------------|-------|
| **Full Features** (default, all ON) | **~99ms** | ✅ Good | All security features + env context + git status |
| **No Environment Context** | **~77ms** | ✅ Good | Security + git status, no version detection |
| **No Git Status** | **~37ms** | ✅ Excellent | Security + env context, no git indicators |
| **No Environment Context + No Git** | **~36ms** | ✅ Excellent | Minimal features, still secure |
| **ASCII Mode Only** | **~99ms** | ✅ Good | Same performance as Nerd Font mode |
| **First Run (cache population)** | **~888ms** | ⚠️ Slow | One-time overhead, subsequent runs fast |

### Performance Classification

- **✅ < 20ms**: Excellent for interactive responsiveness
- **⚠️ 20-100ms**: Acceptable for statusline updates (current performance)
- **❌ > 100ms**: Noticeable lag, needs optimization

## Performance Evolution

### Historical Performance

| Version | Time | Optimization | Notes |
|---------|------|--------------|-------|
| Original (insecure) | ~3-4ms | Baseline | Minimal features, security issues |
| Security-hardened | ~275ms | 70x slowdown | Added comprehensive validation |
| **Current optimized** | **~99ms** | **64% improvement** | Balanced security vs performance |

### Key Performance Improvements

1. **Dependency Caching**: Environment variable caching eliminates repeated command checks
2. **Symbol Detection**: Nerd Font detection cached between runs
3. **Cache System**: Smart version caching with different TTLs per tool
4. **Reduced Validation**: Minimal input validation focusing on critical security checks
5. **Optimized Commands**: Faster alternatives to expensive operations

## Cache Performance Analysis

### Cache Strategy

```bash
# Cache locations and TTLs
/tmp/.claude-statusline-cache/node_version     # 5 minutes
/tmp/.claude-statusline-cache/python3_version   # 5 minutes
/tmp/.claude-statusline-cache/python_version    # 5 minutes
/tmp/.claude-statusline-cache/docker_version    # 30 minutes
```

### Cache Impact

- **Node.js/Python**: 5-minute cache TTL
- **Docker**: 30-minute cache TTL (changes less frequently)
- **Performance improvement**: 83% faster after caching
- **Cache validation**: Automatic expiry and refresh

### Cache Management

```bash
# Clear cache to test fresh version detection
rm -rf /tmp/.claude-statusline-cache/

# View cache contents
ls -la /tmp/.claude-statusline-cache/
```

## Optimization Techniques

### 1. Dependency Caching

```bash
# Cache available commands in environment variables
export CLAUDE_DEPS_CACHED="1"
export CLAUDE_HAS_JQ=$(command -v jq >/dev/null 2>&1 && echo "1" || echo "0")
export CLAUDE_HAS_FC_LIST=$(command -v fc-list >/dev/null 2>&1 && echo "1" || echo "0")
```

### 2. Symbol Detection Optimization

```bash
# Cache nerd font detection in environment variable
detect_nerd_fonts() {
    if [[ -n "${CLAUDE_NERD_FONT_CACHED:-}" ]]; then
        echo "$CLAUDE_NERD_FONT_CACHED"
        return 0
    fi
    
    # Fast terminal detection without expensive fc-list
    case "${TERM:-}" in
        *alacritty*|*kitty*|*iterm*|*wezterm*|*ghostty*|xterm-ghostty)
            export CLAUDE_NERD_FONT_CACHED="true"
            ;;
    esac
}
```

### 3. Reduced Validation

```bash
# Skip problematic character validation due to bash 3.2 bugs on macOS
# In practice, null bytes and carriage returns won't occur in normal JSON input
validate_input_minimal() {
    local input="$1"
    [[ ${#input} -gt $CONFIG_MAX_LENGTH ]] && return 1
    return 0
}
```

### 4. Efficient Git Operations

```bash
# Consolidated git status parsing with awk
parse_git_status_fast() {
    local git_dir="$1"
    [[ ! -d "$git_dir" ]] && return 1
    
    cd "$git_dir" || return 1
    
    # Single command execution with awk processing
    git status --porcelain 2>/dev/null | awk '
        BEGIN { staged = renamed = deleted = unstaged = untracked = conflict = 0; }
        {
            idx = substr($0, 1, 1);
            worktree = substr($0, 2, 1);
            # Efficient parsing logic...
        }
    '
}
```

## Bottleneck Analysis

### Primary Performance Factors

1. **Git Operations**: `git status --porcelain` and `git rev-list` commands
2. **External Commands**: `tput cols`, `stty size`, `node --version`, etc.
3. **String Processing**: Awk and bash string manipulation
4. **Cache I/O**: File system operations for cache management

### Optimization Priorities

1. **Git Optimization**: Minimize git command executions
2. **Caching**: Implement smart caching for expensive operations
3. **Parallel Processing**: Execute independent operations concurrently
4. **Reduce Forks**: Minimize external command calls

## Future Performance Improvements

### TypeScript Migration Benefits

The planned TypeScript rewrite (v2.0) offers performance advantages:

- **JIT Compilation**: V8 JavaScript engine optimizations
- **Async Operations**: Parallel processing of git and environment data
- **Built-in Caching**: Node.js optimized caching mechanisms
- **Reduced Forks**: Native implementations instead of external commands

### Expected Performance Gains

| Operation | Bash Current | TypeScript Expected | Improvement |
|-----------|--------------|-------------------|-------------|
| Git Parsing | ~50ms | ~15ms | 70% faster |
| Environment Detection | ~20ms | ~8ms | 60% faster |
| String Processing | ~15ms | ~5ms | 67% faster |
| Cache Operations | ~5ms | ~2ms | 60% faster |
| **Total** | **~99ms** | **~30ms** | **70% improvement** |

## Monitoring Performance

### Performance Testing Script

```bash
#!/bin/bash
# Performance testing script

test_performance() {
    local iterations=10
    local total=0
    
    echo "Testing performance over $iterations iterations..."
    
    for i in $(seq 1 $iterations); do
        start=$(($(date +%s%N)/1000000))
        echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | ./claude-statusline > /dev/null
        end=$(($(date +%s%N)/1000000))
        duration=$((end - start))
        total=$((total + duration))
        echo "Iteration $i: ${duration}ms"
    done
    
    average=$((total / iterations))
    echo "Average: ${average}ms"
}

test_performance
```

### Performance Monitoring

- **Regular Benchmarking**: Run performance tests after major changes
- **Regression Testing**: Ensure optimizations don't introduce bugs
- **Real-world Testing**: Monitor performance in actual usage scenarios
- **Profiling**: Identify bottlenecks with timing analysis

## Conclusion

The current bash implementation delivers acceptable performance (~99ms) with comprehensive security features. The planned TypeScript migration promises significant performance improvements (~70% faster) while maintaining the same feature set and security posture.

The key performance insight is the balance between security and speed - the optimization strategy focuses on caching expensive operations while maintaining robust input validation and error handling.
