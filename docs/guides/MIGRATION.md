# Migration Guide

Complete guide for migrating from bash v1.0 to TypeScript v2.0 (Released).

**Not sure if you should upgrade?** See the [Feature Comparison](../ref/FEATURE_COMPARISON.md) to compare versions.

## Quick Migration Checklist

- [ ] Install TypeScript v2.0
- [ ] Convert environment variables to config file
- [ ] Test with your current workflow
- [ ] Update Claude Code settings (if needed)
- [ ] Remove bash v1.0 (optional)

## Step 1: Install TypeScript v2.0

### Option A: npm (Recommended)
```bash
npm install -g claude-statusline
```

### Option B: bun
```bash
bun install -g claude-statusline
```

### Option C: Manual Download
```bash
# Download the latest binary for your platform
curl -L -o claude-statusline https://github.com/shrwnsan/claude-statusline/releases/download/v2.0.0/claude-statusline
chmod +x claude-statusline
```

Verify installation:
```bash
claude-statusline --version
```

## Step 2: Convert Environment Variables to Configuration

### Current Environment Variables (Bash v1.0)

Check your current setup:
```bash
echo "NO_EMOJI: $CLAUDE_CODE_STATUSLINE_NO_EMOJI"
echo "NO_GITSTATUS: $CLAUDE_CODE_STATUSLINE_NO_GITSTATUS"
echo "ENV_CONTEXT: $CLAUDE_CODE_STATUSLINE_ENV_CONTEXT"
echo "TRUNCATE: $CLAUDE_CODE_STATUSLINE_TRUNCATE"
```

### Migration Examples

#### Example 1: Basic Setup
**Before (bash v1.0 environment variables):**
```bash
export CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1
export CLAUDE_CODE_STATUSLINE_TRUNCATE=1
```

**After (TypeScript v2.0 config file):**
```bash
# Create configuration file
cp .claude-statusline.json.example.min ~/.claude/.claude-statusline.json

# Or create manually
mkdir -p ~/.claude
cat > ~/.claude/.claude-statusline.json << EOF
{
  "envContext": true,
  "truncate": true
}
EOF
```

#### Example 2: ASCII Mode Setup
**Before (bash v1.0):**
```bash
export CLAUDE_CODE_STATUSLINE_NO_EMOJI=1
export CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1
```

**After (TypeScript v2.0):**
```json
{
  "noEmoji": true,
  "envContext": true,
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

#### Example 3: Full Feature Setup
**Before (bash v1.0):**
```bash
export CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1
export CLAUDE_CODE_STATUSLINE_TRUNCATE=1
export CLAUDE_CODE_STATUSLINE_NO_EMOJI=0
export CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=0
```

**After (TypeScript v2.0):**
```json
{
  "envContext": true,
  "truncate": true,
  "noEmoji": false,
  "noGitStatus": false,
  "debugWidth": false
}
```

### Environment Variable to Config Mapping

| Environment Variable | Config Option | Values |
|---------------------|---------------|---------|
| `CLAUDE_CODE_STATUSLINE_NO_EMOJI=1` | `"noEmoji": true` | boolean |
| `CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1` | `"noGitStatus": true` | boolean |
| `CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1` | `"envContext": true` | boolean |
| `CLAUDE_CODE_STATUSLINE_TRUNCATE=1` | `"truncate": true` | boolean |
| (not available in v1) | `"debugWidth": true` | boolean |
| (not available in v1) | `"rightMargin": 15` | number |

## Step 3: Update Claude Code Settings

If you previously had bash v1.0 in your settings, update the path:

### Standard Configuration (Node.js Runtime)
```json
{
  "statusLine": {
    "type": "command",
    "command": "claude-statusline",
    "padding": 0
  }
}
```

### Performance-Optimized Configuration (Bun Runtime)
For best performance (~5ms), explicitly use Bun:
```json
{
  "statusLine": {
    "type": "command",
    "command": "bun claude-statusline",
    "padding": 0
  }
}
```

> **Performance Note**: Using "bun claude-statusline" gives you ~5ms response time vs ~28ms with standard Node.js. Both work perfectly - choose based on your performance needs.

### With Custom Path (if not in PATH)
```json
{
  "statusLine": {
    "type": "command",
    "command": "/path/to/claude-statusline-v2",
    "padding": 0
  }
}
```

## Step 4: Test Migration

### Test the New Installation
```bash
# Test with sample input
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Migration"}}' | claude-statusline
```

### Test in Claude Code
1. Restart Claude Code to pick up the new binary
2. Verify the statusline appears correctly
3. Check that all your expected features are working

### Common Issues and Solutions

#### Issue: Symbols Not Displaying
**Solution**: The new version has better symbol detection, but you can force ASCII mode:
```json
{
  "noEmoji": true
}
```

#### Issue: Configuration Not Loading
**Solution**: Verify the config file location and format:
```bash
# Check if config exists
ls -la ~/.claude/.claude-statusline.json

# Validate JSON format
cat ~/.claude/.claude-statusline.json | jq .
```

#### Issue: Performance Slower Than Expected
**Solution**: Check cache permissions and clear if needed:
```bash
# Clear cache to force fresh start
rm -rf /tmp/.claude-statusline-cache/
```

## Step 5: Clean Up (Optional)

Once you're satisfied with TypeScript v2.0, you can remove bash v1.0:

### Remove Bash v1.0
```bash
# Remove the bash script if you installed it manually
rm -f /usr/local/bin/claude-statusline-bash
rm -f ~/.local/bin/claude-statusline-bash

# Remove from your .bashrc/.zshrc if added
# Remove lines like: export PATH="$HOME/.local/bin:$PATH"
```

### Remove Environment Variables
```bash
# Remove from .bashrc/.zshrc
unset CLAUDE_CODE_STATUSLINE_NO_EMOJI
unset CLAUDE_CODE_STATUSLINE_NO_GITSTATUS
unset CLAUDE_CODE_STATUSLINE_ENV_CONTEXT
unset CLAUDE_CODE_STATUSLINE_TRUNCATE
```

## Advanced Migration Scenarios

### Scenario 1: Multiple Machines with Different Setups

Create a shared configuration file and sync it:

```bash
# Create a portable config
cat > ~/.claude/.claude-statusline.json << EOF
{
  "envContext": true,
  "truncate": true,
  "noEmoji": false,
  "cacheTTL": 600
}
EOF

# Sync across machines (using your preferred method)
scp ~/.claude/.claude-statusline.json user@machine:~/.claude/
```

### Scenario 2: Team Standardization

Create a team configuration template:

```bash
# Save as team-config.json
{
  "envContext": true,
  "truncate": true,
  "noEmoji": false,
  "debugWidth": false,
  "symbols": {
    "git": "",
    "model": "󰚩",
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

Team members can install with:
```bash
cp team-config.json ~/.claude/.claude-statusline.json
```

### Scenario 3: Gradual Migration with A/B Testing

Keep both versions temporarily for comparison:

```bash
# Test bash v1.0
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline-v1

# Test TypeScript v2.0
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | claude-statusline

# Compare performance
time echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline-v1
time echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | claude-statusline
```

## Validation Checklist

After migration, verify:

- [ ] Statusline appears in Claude Code
- [ ] Git status indicators work correctly
- [ ] Environment context shows if enabled
- [ ] Symbols display correctly (or ASCII fallback works)
- [ ] Performance is satisfactory
- [ ] Configuration file loads properly
- [ ] No error messages in Claude Code console

## Rollback Plan

If you need to rollback to bash v1.0:

```bash
# Restore bash v1.0
cp /path/to/backup/claude-statusline-v1 /usr/local/bin/claude-statusline
chmod +x /usr/local/bin/claude-statusline

# Restore environment variables
echo 'export CLAUDE_CODE_STATUSLINE_ENV_CONTEXT=1' >> ~/.bashrc
echo 'export CLAUDE_CODE_STATUSLINE_TRUNCATE=1' >> ~/.bashrc
source ~/.bashrc

# Update Claude Code settings back to bash path
```

## Support

If you encounter issues during migration:

1. **Check the logs**: Run with debug mode enabled
2. **Validate config**: Use JSON validator or `jq .` on your config file
3. **Test manually**: Use echo/curl to test the binary directly
4. **Check permissions**: Ensure the binary is executable
5. **Report issues**: Open an issue on GitHub with details

## Migration Benefits Summary

After migrating to TypeScript v2.0, you'll enjoy:

- ✅ **19.5x faster cold starts** (45ms vs 888ms)
- ✅ **5x faster runtime with Bun** (~5ms vs ~28ms with Node.js)
- ✅ **Native Windows support**
- ✅ **Configuration file support**
- ✅ **Package manager integration**
- ✅ **Enhanced debugging options**
- ✅ **Better cross-platform compatibility**
- ✅ **Future-proof architecture**