# Troubleshooting Guide

This document provides comprehensive troubleshooting guidance for Claude Statusline.

## Quick Diagnostics

### Basic Health Check

```bash
# Check if script is executable
ls -la /path/to/claude-statusline

# Test script syntax
bash -n /path/to/claude-statusline

# Test basic functionality
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline
```

### Claude Code Integration Check

```bash
# Check settings.json configuration
cat ~/.claude/settings.json | grep -A 5 statusLine

# Test with Claude Code input format
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"}}' | /path/to/claude-statusline

# Check if symlink exists and is valid
ls -la ~/.claude/statusline.sh
readlink ~/.claude/statusline.sh
```

## Common Issues and Solutions

### Issue: Statusline Not Appearing

**Symptoms**: Claude Code shows default statusline or no statusline

**Diagnostic Steps**:
```bash
# 1. Check settings.json configuration
grep -A 5 statusLine ~/.claude/settings.json

# 2. Verify script path is correct
ls -la /path/to/claude-statusline

# 3. Test script manually
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline

# 4. Check script permissions
chmod +x /path/to/claude-statusline
```

**Solutions**:
1. **Update path in settings.json**:
   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "/correct/path/to/claude-statusline",
       "padding": 0
     }
   }
   ```

2. **Create/update symlink**:
   ```bash
   ln -sf /path/to/claude-statusline ~/.claude/statusline.sh
   ```

3. **Restart Claude Code** after making changes

### Issue: Nerd Font Symbols Not Displaying

**Symptoms**: Square boxes, question marks, or missing symbols

**Diagnostic Steps**:
```bash
# Test terminal font support
echo " 󰚩 ⚑ ✘ ⇡ ⇣"

# Check if Nerd Fonts are installed
fc-list | grep -i nerd

# Test with ASCII mode
CLAUDE_CODE_STATUSLINE_NO_EMOJI=1 echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline
```

**Solutions**:
1. **Install Nerd Fonts**:
   ```bash
   # Using Homebrew (macOS)
   brew install font-jetbrains-mono-nerd-font
   
   # Or download from https://www.nerdfonts.com/
   ```

2. **Configure Terminal Font**:
   - Terminal/iTerm2: Preferences → Profiles → Text → Font
   - VS Code: Settings → `terminal.integrated.fontFamily`
   - Alacritty: Edit `alacritty.yml` `font.family`

3. **Force ASCII Mode**:
   ```bash
   export CLAUDE_CODE_STATUSLINE_NO_EMOJI=1
   ```

### Issue: Performance Problems

**Symptoms**: Laggy updates, slow response, high CPU usage

**Diagnostic Steps**:
```bash
# Measure execution time
start=$(($(date +%s%N)/1000000))
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline > /dev/null
end=$(($(date +%s%N)/1000000))
duration=$((end - start))
echo "Execution time: ${duration}ms"

# Check cache directory
ls -la /tmp/.claude-statusline-cache/

# Test with minimal features
CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1 CLAUDE_CODE_STATUSLINE_NO_EMOJI=1 \
  echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline
```

**Solutions**:
1. **Clear Cache**:
   ```bash
   rm -rf /tmp/.claude-statusline-cache/
   ```

2. **Disable Features**:
   ```bash
   export CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1
   export CLAUDE_CODE_STATUSLINE_NO_EMOJI=1
   ```

3. **Check Git Repository Status**:
   ```bash
   # Test git operations in current directory
   git status --porcelain
   git rev-list --count --left-right @{upstream}...HEAD
   ```

### Issue: Git Status Not Showing

**Symptoms**: No git indicators despite being in a git repository

**Diagnostic Steps**:
```bash
# Check if in git repository
git status

# Test git commands manually
git branch --show-current
git status --porcelain

# Check if git status disabled
echo $CLAUDE_CODE_STATUSLINE_NO_GITSTATUS
```

**Solutions**:
1. **Enable git status**:
   ```bash
   unset CLAUDE_CODE_STATUSLINE_NO_GITSTATUS
   ```

2. **Check git repository**:
   ```bash
   # Ensure you're in a git repository
   cd /path/to/git/repo
   git status
   ```

3. **Check git configuration**:
   ```bash
   # Check if git is properly configured
   git config --list
   ```

### Issue: Environment Context Not Showing

**Symptoms**: Node.js, Python, or Docker versions not displayed despite enabling

**Diagnostic Steps**:
```bash
# Check if tools are available
command -v node && node --version
command -v python3 && python3 --version
command -v docker && docker --version

# Check cache files
ls -la /tmp/.claude-statusline-cache/*_version

# Test environment context explicitly
CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1 \
  echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline
```

**Solutions**:
1. **Install Missing Tools**:
   ```bash
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install Python
   sudo apt-get install python3
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

2. **Clear Tool Cache**:
   ```bash
   rm -f /tmp/.claude-statusline-cache/*_version
   rm -f /tmp/.claude-statusline-cache/*_version.time
   ```

3. **Enable Environment Context**:
   ```bash
   export CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1
   ```

### Issue: Width Management Problems

**Symptoms**: Text cutoff, improper wrapping, or overflow

**Diagnostic Steps**:
```bash
# Check terminal width
tput cols
echo $COLUMNS

# Test with width override
export COLUMNS=80
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline

# Test with smart truncation enabled
CLAUDE_CODE_STATUSLINE_TRUNCATE=1 \
  echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Sonnet 4.5"}}' | /path/to/claude-statusline
```

**Solutions**:
1. **Adjust Terminal Width**:
   - Increase terminal width to 80+ characters for optimal experience
   - Use 100+ characters for full feature display

2. **Enable Smart Truncation**:
   ```bash
   export CLAUDE_CODE_STATUSLINE_TRUNCATE=1
   ```

3. **Check Terminal Settings**:
    - Ensure terminal reports correct dimensions
    - Check for custom terminal configurations

### Issue: Garbled Output Artifacts (Claude Code Rendering Bug)

**Symptoms**: Random character fragments appearing at wrong positions in the statusline, such as:
- `in`, `ct`, or other 2-letter fragments at the end of the line
- Characters like `g`, `%` appearing on a separate line below
- Underscores (`__`) or dashes (`──`) on separate lines
- Large amounts of trailing whitespace before artifacts
- Status line scrolling rightward with every character typed

**Example**:
```
claude-statusline  main [!] 󰚩glm-4.7 ⚡︎0%                    ct
```

**Cause**: This is a **known Claude Code TUI rendering bug**, not an issue with the statusline script. Investigation confirmed:
- Direct script execution produces clean output with no artifacts
- Artifacts are fragments from statusline content rendered at incorrect screen positions
- Claude Code's statusline renderer has cursor positioning and screen buffer issues

**Related GitHub Issues**:

| Issue | Description | Status | Created |
|-------|-------------|--------|---------|
| [#8618](https://github.com/anthropics/claude-code/issues/8618) | CLI Terminal UI Rendering Corrupted + Scrolling Instability | Open | Oct 1, 2025 |
| [#14011](https://github.com/anthropics/claude-code/issues/14011) | Hint text corrupts statusline output containing links | Open | Dec 15, 2025 |
| [#14594](https://github.com/anthropics/claude-code/issues/14594) | Text rendering bug - lines dropped and garbled output | Closed | Dec 19, 2025 |

**Diagnostic Steps**:
```bash
# Verify script output is clean
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | bun ~/.claude/claude-statusline | hexdump -C

# Output should end cleanly at the last character (e.g., "0%") with no trailing bytes
```

**Workarounds** (limited effectiveness):
1. **Try disabling custom statusline temporarily** to confirm Claude Code is the cause
2. **Update Claude Code** to the latest version (some TUI bugs have been fixed in newer releases)

**Status**: Known issue in Claude Code's TUI renderer. The statusline script produces correct, clean output. Track the linked GitHub issues for updates.

## Debug Mode

### Enabling Debug Logging

**TypeScript v2.0 (Node.js/Bun)**:
```bash
# Enable debug logging
DEBUG=claude-statusline:* claude-statusline

# Or with verbose flag
claude-statusline --verbose
```

**Bash v1.0 (Legacy)**:
For debugging statusline behavior, use bash built-in debugging:
```bash
# Enable execution tracing for one run
bash -x /path/to/claude-statusline <<< '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}'

# Or enable for session
set -x; /path/to/claude-statusline <<< '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}'; set +x
```

Use `bash -x` for execution tracing and `bash -n` for syntax validation.

**Note**: Previous versions supported `CLAUDE_STATUSLINE_LOG_LEVEL` environment variable, but this has been removed in favor of standard bash debugging tools.

**Debugging Script Issues**:
```bash
# Run with bash debugging
bash -x /path/to/claude-statusline

# Check for syntax errors
bash -n /path/to/claude-statusline
```

## Performance Profiling

### Detailed Performance Analysis

```bash
# Create performance test script
cat > test_performance.sh << 'EOF'
#!/bin/bash

iterations=10
total=0

echo "Testing performance over $iterations iterations..."

for i in $(seq 1 $iterations); do
    start=$(($(date +%s%N)/1000000))
    echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline > /dev/null
    end=$(($(date +%s%N)/1000000))
    duration=$((end - start))
    total=$((total + duration))
    echo "Iteration $i: ${duration}ms"
done

average=$((total / iterations))
echo "Average: ${average}ms"
echo "Min: $(echo $durations | tr ' ' '\n' | sort -n | head -1)ms"
echo "Max: $(echo $durations | tr ' ' '\n' | sort -n | tail -1)ms"

# Store durations for analysis
echo $durations > performance_data.txt
EOF

chmod +x test_performance.sh
./test_performance.sh
```

### Cache Performance Testing

```bash
# Test first run (cache miss)
rm -rf /tmp/.claude-statusline-cache/
echo "First run (cache miss):"
time echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline > /dev/null

# Test subsequent runs (cache hit)
echo "Subsequent runs (cache hit):"
for i in {1..5}; do
    time echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline > /dev/null
done
```

## Getting Help

### Collect Debug Information

```bash
# Create debug report
cat > debug_report.txt << EOF
=== Claude Statusline Debug Report ===
Date: $(date)
User: $(whoami)
System: $(uname -a)

=== Script Information ===
Path: $(which claude-statusline 2>/dev/null || echo "Not found")
Version: $(claude-statusline --version 2>/dev/null || echo "Unknown")
Permissions: $(ls -la /path/to/claude-statusline)

=== Environment ===
Shell: $SHELL
Terminal: $TERM
Claude Statusline Variables:
  CLAUDE_CODE_STATUSLINE_NO_EMOJI: $CLAUDE_CODE_STATUSLINE_NO_EMOJI
  CLAUDE_CODE_STATUSLINE_NO_GITSTATUS: $CLAUDE_CODE_STATUSLINE_NO_GITSTATUS
  CLAUDE_CODE_STATUSLINE_ENV_CONTEXT: $CLAUDE_CODE_STATUSLINE_ENV_CONTEXT
  CLAUDE_CODE_STATUSLINE_TRUNCATE: $CLAUDE_CODE_STATUSLINE_TRUNCATE
  CLAUDE_STATUSLINE_LOG_LEVEL: $CLAUDE_STATUSLINE_LOG_LEVEL

=== Git Status ===
Current Directory: $(pwd)
Git Repository: $(git rev-parse --git-dir 2>/dev/null || echo "Not a git repository")
Git Branch: $(git branch --show-current 2>/dev/null || echo "N/A")
Git Status: $(git status --porcelain 2>/dev/null | wc -l) changes

=== Tool Availability ===
Node.js: $(command -v node >/dev/null && node --version || echo "Not found")
Python: $(command -v python3 >/dev/null && python3 --version || echo "Not found")
Docker: $(command -v docker >/dev/null && docker --version || echo "Not found")

=== Cache Status ===
Cache Directory: /tmp/.claude-statusline-cache/
Cache Contents: $(ls -la /tmp/.claude-statusline-cache/ 2>/dev/null || echo "No cache directory")

=== Test Run ===
Test Output:
$(echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline 2>&1)
EOF

echo "Debug report saved to debug_report.txt"
```

### Reporting Issues

When reporting issues, include:
1. **Debug report** (from above)
2. **Expected vs actual output**
3. **Steps to reproduce**
4. **Your environment** (OS, terminal, Claude Code version)

### Community Support

- **GitHub Issues**: https://github.com/yourusername/claude-statusline/issues
- **Discussions**: https://github.com/yourusername/claude-statusline/discussions
- **Documentation**: https://github.com/yourusername/claude-statusline/blob/main/docs/README.md

---

**Note**: This troubleshooting guide covers the most common issues. If you encounter problems not covered here, please create an issue on GitHub with your debug information.
