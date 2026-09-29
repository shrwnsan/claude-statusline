# Troubleshooting Guide

This document provides comprehensive troubleshooting guidance for Claude Statusline.

## Quick Diagnostics

### Basic Health Check

```bash
# Check installation location
which claude-statusline

# Built-in self-test: renders with a canonical mock payload
claude-statusline --self-test

# Demo mode: prints several preset renders (ASCII, Nerd Font, narrow, worktree, all segments)
claude-statusline --demo

# Pipe a real payload JSON manually
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | claude-statusline
```

There are only two CLI flags: `--self-test` and `--demo`. Any other flag (e.g. `--verbose`, `--version`) does not exist.

### Claude Code Integration Check

```bash
# Check settings.json configuration
grep -A 5 statusLine ~/.claude/settings.json

# Test with the exact command configured in settings
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"}}' | claude-statusline
```

## Common Issues and Solutions

### Issue: Statusline Not Appearing

**Symptoms**: Claude Code shows default statusline or no statusline

**Diagnostic Steps**:
```bash
# 1. Check settings.json configuration
grep -A 5 statusLine ~/.claude/settings.json

# 2. Verify the command resolves
which claude-statusline

# 3. Test manually with a payload
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | claude-statusline

# 4. Run the built-in self-test
claude-statusline --self-test
```

**Solutions**:
1. **Fix the command in settings.json**:
   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "claude-statusline",
       "padding": 0
     }
   }
   ```

2. **Use an absolute path** if the binary is not in Claude Code's `PATH`:
   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "/absolute/path/to/claude-statusline"
     }
   }
   ```

3. **Restart Claude Code** after making changes

### Issue: Nerd Font Symbols Not Displaying

**Symptoms**: Square boxes (tofu), question marks, or missing symbols

**Diagnostic Steps**:
```bash
# Test terminal font support directly
echo "  󰚩 ⚑ ✘ ⇡ ⇣"

# Check installed Nerd Fonts
fc-list | grep -i nerd

# Compare ASCII vs Nerd Font renders side by side
claude-statusline --demo
```

**Solutions**:
1. **Install Nerd Fonts**:
   ```bash
   # Using Homebrew (macOS)
   brew install --cask font-jetbrains-mono-nerd-font

   # Or download from https://www.nerdfonts.com/
   ```

2. **Configure Terminal Font**:
   - Terminal/iTerm2: Preferences → Profiles → Text → Font
   - VS Code: Settings → `terminal.integrated.fontFamily`
   - Alacritty: Edit `alacritty.toml` `font.family`

3. **Remember Nerd Font is opt-in**: ASCII is the default. Glyphs only appear when `"nerdFont": true` is set in your config (or `NERD_FONT=1`). If you see tofu, unset the env var or remove the config flag — ASCII mode works everywhere.

### Issue: Performance Problems

**Symptoms**: Laggy updates, slow response, high CPU usage

**Diagnostic Steps**:
```bash
# Measure execution time
time echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | claude-statusline > /dev/null

# Check cache directory
ls -la /tmp/.claude-statusline-cache/
```

**Solutions**:
1. **Clear Cache**:
   ```bash
   rm -rf /tmp/.claude-statusline-cache/
   ```

2. **Disable Features** temporarily to isolate the cause (set `"noGitStatus": true`, `"envContext": false`, etc. in your config)

3. **Check the Runtime**: `"command": "bun claude-statusline"` is ~5x faster than Node.js (see the [Performance Guide](guide-003-performance.md))

### Issue: Git Status Not Showing

**Symptoms**: No git indicators despite being in a git repository

**Background**: claude-statusline runs a single git spawn per refresh:

```
git --no-optional-locks status --porcelain=v2 --branch --show-stash
```

Results are cached per session and directory (`sessionId` + cwd) for 5 seconds. Outside a git repository the command exits 128 and the statusline simply omits the git segment.

**Diagnostic Steps**:
```bash
# Check if in a git repository
git status

# Run the exact command claude-statusline uses
git --no-optional-locks status --porcelain=v2 --branch --show-stash

# Check if git status is disabled
grep -i gitstatus ~/.claude/claude-statusline.json 2>/dev/null
```

**Solutions**:
1. **Re-enable git status**: remove `"noGitStatus": true` from your config, or unset `CLAUDE_CODE_STATUSLINE_NO_GITSTATUS`
2. **Detached HEAD** shows the short commit oid instead of a branch name — that is expected behavior, not a bug
3. **Wait out the cache**: git info refreshes at most every 5 seconds within one Claude Code session

### Issue: Environment Context Not Showing

**Symptoms**: Node.js, Python, or Docker versions not displayed despite enabling

**Diagnostic Steps**:
```bash
# Check if tools are available
command -v node && node --version
command -v python3 && python3 --version
command -v docker && docker --version

# Enable environment context explicitly
CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1 claude-statusline --self-test
```

**Solutions**:
1. **Install Missing Tools** (only the tools you want shown):
   ```bash
   # Install Node.js
   brew install node

   # Install Python
   brew install python

   # Install Docker
   brew install --cask docker
   ```

2. **Clear the version cache**: environment versions are cached for ~8 hours (96x the default `cacheTTL` of 300s). Clear the cache directory to force re-detection:
   ```bash
   rm -rf /tmp/.claude-statusline-cache/
   ```

3. **Enable Environment Context**: set `"envContext": true` in your config

### Issue: Width Management Problems

**Symptoms**: Text cutoff, improper wrapping, or overflow

**Background**: width is resolved with no shell-outs — `tput` and `stty` cannot work here because the statusline command runs with captured output and no tty. The chain is:

1. `"forceWidth"` config value (if > 0)
2. `COLUMNS` environment variable
3. `process.stdout.columns`
4. Fixed fallback of `80`

**Diagnostic Steps**:
```bash
# Inspect the resolved width chain
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | \
  CLAUDE_CODE_STATUSLINE_DEBUG_WIDTH=1 claude-statusline 2>&1

# Simulate a narrow terminal
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | \
  COLUMNS=60 claude-statusline

# Or force a width via config
echo '{"forceWidth": 60}' > claude-statusline.json
claude-statusline --self-test
```

**Solutions**:
1. **Increase Terminal Width**: 80+ characters for basic display, 100+ for full features

2. **Disable Smart Truncation to Isolate**: truncation is ON by default. If you suspect truncation is mangling output, turn it off:
   ```json
   { "truncate": false }
   ```
   This restores full-line output and confirms whether the width chain or truncation logic is at fault.

3. **Check Claude Code's `COLUMNS`**: recent Claude Code versions pass the terminal width via `COLUMNS` in the statusline payload env. If it is wrong, a `"forceWidth"` override wins over it.

### Issue: Garbled Output Artifacts (Claude Code Rendering Bug)

**Symptoms**: Random character fragments appearing at wrong positions in the statusline, such as:
- `in`, `ct`, or other 2-letter fragments at the end of the line
- Characters like `g`, `%` appearing on a separate line below
- Underscores (`__`) or dashes (`──`) on separate lines
- Large amounts of trailing whitespace before artifacts
- Status line scrolling rightward with every character typed

**Example**:
```
claude-statusline  main [!] 󰚩glm-4.7 ⚡0%                    ct
```

**Cause**: This is a **known Claude Code TUI rendering bug**, not an issue with the statusline script. Investigation confirmed:
- Direct execution produces clean output with no artifacts
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
# Verify the output itself is clean
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | claude-statusline | hexdump -C

# Output should end cleanly at the last character with no trailing bytes
```

**Workarounds** (limited effectiveness):
1. **Try disabling custom statusline temporarily** to confirm Claude Code is the cause
2. **Update Claude Code** to the latest version (some TUI bugs have been fixed in newer releases)

**Status**: Known issue in Claude Code's TUI renderer. The statusline produces correct, clean output. Track the linked GitHub issues for updates.

### Issue: Glyphs Render as Tofu / Random Characters

**Symptoms**: Square boxes (tofu), question marks, or random character fragments instead of icons

**Diagnostic Steps**:
```bash
# Run demo mode to compare ASCII vs Nerd Font rendering side-by-side
claude-statusline --demo

# Test with explicit Nerd Font opt-in
NERD_FONT=1 claude-statusline --self-test

# Verify no variation selectors in output
claude-statusline --self-test | hexdump -C | grep 'fe 0e'
```

**Solutions**:
1. **Install a Nerd Font**: Download from [nerdfonts.com](https://nerdfonts.com/) and configure your terminal to use it
2. **Use ASCII mode**: The default is ASCII — if you see tofu, you likely have `NERD_FONT=1` set. Unset it or set `"noEmoji": true` in config
3. **Check terminal font**: Ensure your terminal emulator is actually using the Nerd Font you installed

## Debugging

### Width Debugging

The built-in width debugger prints the resolution chain (config override, `COLUMNS`, `process.stdout.columns`) to stderr:

```bash
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | \
  CLAUDE_CODE_STATUSLINE_DEBUG_WIDTH=1 claude-statusline
```

Or set `"debugWidth": true` in your config.

### Comparing Render Presets

`--demo` renders the same payload under six presets (ASCII default, ASCII + git/env, Nerd Font, 40-column truncation, worktree session, all segments on) — useful for narrowing a visual bug to one mode:

```bash
claude-statusline --demo
```

### Manual Payload Testing

Any payload JSON can be piped directly, including the newer optional fields:

```bash
echo '{
  "workspace": {"current_dir": "'"$PWD"'"},
  "model": {"display_name": "Opus"},
  "context_window": {"used_percentage": 42, "context_window_size": 200000},
  "pr": {"number": 27, "review_state": "approved"},
  "cost": {"total_cost_usd": 1.23},
  "rate_limits": {"five_hour": {"used_percentage": 42}}
}' | CLAUDE_CODE_STATUSLINE_PR_BADGE=1 CLAUDE_CODE_STATUSLINE_COST_USAGE=1 \
     CLAUDE_CODE_STATUSLINE_RATE_LIMIT=1 claude-statusline
```

## Performance Profiling

### Quick Timing

```bash
# Cache miss (fresh run)
rm -rf /tmp/.claude-statusline-cache/
time echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | claude-statusline > /dev/null

# Cache hit (subsequent runs)
time echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | claude-statusline > /dev/null
```

See the [Performance Guide](guide-003-performance.md) for expected numbers per runtime.

## Getting Help

### Collect Debug Information

```bash
# Create debug report
cat > debug_report.txt << EOF
=== Claude Statusline Debug Report ===
Date: $(date)
User: $(whoami)
System: $(uname -a)

=== Installation ===
Path: $(which claude-statusline 2>/dev/null || echo "Not found")
Permissions: $(ls -la "$(which claude-statusline 2>/dev/null)" 2>/dev/null || echo "N/A")

=== Environment ===
Shell: $SHELL
Terminal: $TERM
COLUMNS: $COLUMNS
Claude Statusline Variables:
  CLAUDE_CODE_STATUSLINE_NO_EMOJI: $CLAUDE_CODE_STATUSLINE_NO_EMOJI
  CLAUDE_CODE_STATUSLINE_NO_GITSTATUS: $CLAUDE_CODE_STATUSLINE_NO_GITSTATUS
  CLAUDE_CODE_STATUSLINE_ENV_CONTEXT: $CLAUDE_CODE_STATUSLINE_ENV_CONTEXT
  CLAUDE_CODE_STATUSLINE_NERD_FONT: $CLAUDE_CODE_STATUSLINE_NERD_FONT
  NERD_FONT: $NERD_FONT

=== Configuration ===
Config File: $(ls claude-statusline.json claude-statusline.yaml ~/.claude/claude-statusline.json 2>/dev/null || echo "None found")
$(cat claude-statusline.json 2>/dev/null || cat ~/.claude/claude-statusline.json 2>/dev/null || echo "No config file")

=== Git Status ===
Current Directory: $(pwd)
Git Repository: $(git rev-parse --git-dir 2>/dev/null || echo "Not a git repository")
Git Branch: $(git branch --show-current 2>/dev/null || echo "N/A (possibly detached HEAD)")

=== Tool Availability ===
Node.js: $(command -v node >/dev/null && node --version || echo "Not found")
Python: $(command -v python3 >/dev/null && python3 --version || echo "Not found")
Docker: $(command -v docker >/dev/null && docker --version || echo "Not found")

=== Cache Status ===
Cache Directory: /tmp/.claude-statusline-cache/
Cache Contents: $(ls /tmp/.claude-statusline-cache/ 2>/dev/null | wc -l | tr -d ' ') files

=== Test Run ===
Self-test Output:
$(claude-statusline --self-test 2>&1)
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

- **GitHub Issues**: https://github.com/shrwnsan/claude-statusline/issues
- **Discussions**: https://github.com/shrwnsan/claude-statusline/discussions
- **Documentation**: https://github.com/shrwnsan/claude-statusline/blob/main/docs/README.md

---

**Note**: This troubleshooting guide covers the most common issues. If you encounter problems not covered here, please create an issue on GitHub with your debug information.
