# Terminal Width Management

This document provides comprehensive analysis of terminal width behavior and optimization strategies for Claude Statusline.

**Implementation Status**: ✅ Smart truncation is implemented via `CLAUDE_CODE_STATUSLINE_TRUNCATE=1` (available in both bash and TypeScript v2.0)

## Width Breakpoint Analysis

### Responsive Design Strategy

Claude Statusline implements intelligent width management with three key principles:

1. **15-character right margin** - Prevents bleeding into Claude Code telemetry
2. **Branch prioritization** - Preserves branch names over project names when truncating
3. **Progressive truncation** - Project → Branch → Indicators (only if absolutely necessary)

### Terminal Width Categories

| Width Range | Experience Level | Typical Use Case | Statusline Behavior |
|-------------|------------------|------------------|-------------------|
| **< 60** | ❌ Poor | Mobile/Split screen | Aggressive truncation, branch prioritized |
| **60-79** | ⚠️ Acceptable | Minimum viable | Smart truncation, critical context preserved |
| **80-99** | ✅ Good | Common laptops | Ideal balance, minimal truncation |
| **100-119** | ✅ Excellent | Desktop/IDE | Usually no truncation needed |
| **120+** | ✅ Perfect | Power users | No constraints, optimal UX |

## Real-World Examples

### Test Case: Long Project + Branch Names

**Test Data**:
- Project: `vibekit-claude-plugins`
- Branch: `feature/issue-20-search-fallback-behavior`
- Indicators: `[+?]`
- Model Info: `Sonnet 4.5`

## Mode Comparison: Basic vs Smart Truncation

### Quick Reference

| Feature | Basic Mode (default) | Smart Truncation Mode |
|---------|---------------------|----------------------|
| **Trigger** | Always active | `CLAUDE_CODE_STATUSLINE_TRUNCATE=1` |
| **Truncation point** | `terminal width - 10` | `terminal width - 15` (right margin) |
| **Priority** | Simple cut-off | Branch > Project > Model |
| **Multi-line** | Never (always single-line) | Yes, with soft-wrapping when needed |
| **Git indicators** | May be cut off | Preserved until last moment |
| **Use case** | Fast, predictable | Maximum information preservation |

## Test Results (Real Data)

*Test data: Project=`claude-statusline`, Branch=`feature/typescript-rewrite-v2.0`, Model=`Test Model`*

### 40 Columns (Extreme Constraint)

**Basic Mode**:
```
----------------------------------------
claude-statusline  feature/..
----------------------------------------
```
*Length: 30 chars - Only project and partial branch*

**Smart Truncation**:
```
----------------------------------------
clau..  feature/typescri.. [!+?]
----------------------------------------
```
*Length: 33 chars - Preserves git indicators*

### 50 Columns (Very Narrow)

**Basic Mode**:
```
--------------------------------------------------
claude-statusline  feature/typescript..
--------------------------------------------------
```
*Length: 40 chars - Model lost, branch partially shown*

**Smart Truncation**:
```
--------------------------------------------------
clau..  feature/typescript-re.. [!+?]
--------------------------------------------------
```
*Length: 38 chars - Git indicators preserved*

### 60 Columns (Minimum Viable)

**Basic Mode**:
```
------------------------------------------------------------
claude-statusline  feature/typescript-rewrite-v..
------------------------------------------------------------
```
*Length: 50 chars - Model and indicators lost*

**Smart Truncation**:
```
------------------------------------------------------------
clau..  feature/typescript-rewrite-v2.0.. [!+?]
------------------------------------------------------------
```
*Length: 48 chars - Preserves git indicators*

### 70 Columns (Tight but Usable)

**Basic Mode**:
```
----------------------------------------------------------------------
claude-statusline  feature/typescript-rewrite-v2.0 [!+?] ..
----------------------------------------------------------------------
```
*Length: 60 chars - Model truncated with ".."*

**Smart Truncation**:
```
----------------------------------------------------------------------
claude-status..  feature/typescript-rewrite-v2.0 [!+?]
----------------------------------------------------------------------
```
*Length: 55 chars - Project truncated, model preserved*

### 80 Columns (Standard Terminal)

**Basic Mode**:
```
--------------------------------------------------------------------------------
claude-statusline  feature/typescript-rewrite-v2.0 [!+?] 󰚩Test Model
--------------------------------------------------------------------------------
```
*Length: 69 chars - Everything fits*

**Smart Truncation**:
```
--------------------------------------------------------------------------------
claude-statusline  feature/typescript-rewrite-v2.0 [!+?] 󰚩Test
Model
--------------------------------------------------------------------------------
```
*Length: 69 chars - Soft-wrapping occurs when model is long*

### 90+ Columns (Comfortable)

**Both modes** (identical output):
```
------------------------------------------------------------------------------------------
claude-statusline  feature/typescript-rewrite-v2.0 [!+?] 󰚩Test Model
------------------------------------------------------------------------------------------
```
*Length: 69 chars - No truncation needed*

## Key Findings from Testing

### Soft-Wrapping Behavior

Soft-wrapping in Smart Truncation Mode only occurs when:
1. **Project + git fits** within the terminal width (minus 15-char margin)
2. **Model exceeds** the remaining space
3. **There's a natural break point** (space) in the model string

*Test evidence*: At 80 columns with "Test Model", the project+git fits but the model needs to wrap, resulting in:
```
--------------------------------------------------------------------------------
claude-statusline  feature/typescript-rewrite-v2.0 [!+?] 󰚩Test
Model
--------------------------------------------------------------------------------
```

The model wraps at the space between "Test" and "Model", maintaining readability without duplicating the icon.

### Mode Comparison Summary

| Terminal Width | Basic Mode Behavior | Smart Truncation Behavior | Winner |
|----------------|-------------------|---------------------------|---------|
| **< 50** | Aggressive truncation, loses most context | Preserves git indicators | Smart |
| **50-70** | Loses model info, may cut git indicators | Preserves git indicators, shorter output | Smart |
| **80** | Everything fits in single line | May soft-wrap long model names | Tie* |
| **90+** | No truncation needed | No truncation needed | Tie |

*\*At 80 columns: Basic Mode keeps everything on one line, Smart Truncation may soft-wrap to preserve full model text*

### Practical Recommendations

1. **Use Basic Mode** if you:
   - Prefer predictable single-line output
   - Don't need to preserve model information in narrow terminals
   - Want maximum performance

2. **Use Smart Truncation** if you:
   - Want to preserve git indicators at all costs
   - Don't mind multi-line output when necessary
   - Need to see model information even in narrow terminals

## Additional Testing Information

To reproduce these test results:
```bash
cd tests
./test_width.sh
```

The test script provides:
- Visual terminal width guides (dashed lines) like those shown above
- Side-by-side comparison of both modes
- Exact character lengths for each output
- Clear indication when modes differ or match

Example of test output with visual guides:
```
=== 80 columns (Standard terminal) ===
--------------------------------------------------------------------------------
Basic Mode:
claude-statusline  feature/typescript-rewrite-v2.0 [!+?] 󰚩Test Model
--------------------------------------------------------------------------------
Smart Truncation Mode (CLAUDE_CODE_STATUSLINE_TRUNCATE=1):
claude-statusline  feature/typescript-rewrite-v2.0 [!+?] 󰚩Test
Model
--------------------------------------------------------------------------------
```

## Width Detection Algorithm

### Detection Methods (in order of preference)

#### TypeScript v2.0 Implementation
1. **Manual width override** - `CLAUDE_CODE_STATUSLINE_FORCE_WIDTH` (for testing)
2. **COLUMNS environment variable** - Standard terminal width setting
3. **Node.js process.stdout.columns** - Most reliable for Node.js processes
4. **tput cols command** - Unix/Linux/macOS fallback
5. **stty size command** - Secondary Unix/Linux/macOS fallback
6. **Claude Code specific** - `CLAUDE_CODE_TERMINAL_WIDTH` environment variable
7. **Terminal detection** - Defaults based on `TERM_PROGRAM` and `TERM`
   - VS Code: 120 columns
   - Modern terminals (Ghostty, WezTerm, iTerm): 120 columns
   - Windows Terminal: 120 columns
8. **Hard-coded fallback** - 80 columns (conservative default)

#### Bash Implementation
1. **tput cols** - Most reliable method
   ```bash
   width=$(tput cols 2>/dev/null)
   ```

2. **stty size** - Fallback for systems without tput
   ```bash
   width=$(stty size 2>/dev/null | awk '{print $2}')
   ```

3. **COLUMNS variable** - Environment variable
   ```bash
   width=${COLUMNS:-}
   ```

4. **Hard-coded fallback** - Last resort
   ```bash
   width=80
   ```

### Width Validation

```bash
# Validate detected width
if [[ -n "$width" && "$width" -gt 0 ]]; then
    echo "$width"
else
    echo "80"  # Default fallback
fi
```

## Truncation Algorithm

### Smart Truncation Strategy

```bash
# Pseudo-code for truncation logic
function smart_truncate(project_name, git_info, available_width) {
    # Step 1: Check if everything fits
    total_length = length(project_name + git_info)
    if total_length <= available_width:
        return project_name + git_info
    
    # Step 2: Try truncating project name only
    max_project_length = available_width - length(git_info) - 2  # -2 for ".."
    if max_project_length >= 5:
        truncated_project = substring(project_name, 0, max_project_length) + ".."
        if length(truncated_project + git_info) <= available_width:
            return truncated_project + git_info
    
    # Step 3: Truncate both project and branch
    # Extract branch from git_info (format: " branch [indicators]")
    branch_part = extract_branch_from_git_info(git_info)
    indicators_part = extract_indicators_from_git_info(git_info)
    
    # Aggressive truncation as last resort
    max_branch_length = available_width - 10 - length(indicators_part)  # -10 for "..project.."
    return project_name[..] + branch[..] + indicators_part
}
```

### Branch Preservation Priority

1. **Always preserve branch name** when possible
2. **Truncate project name first** (most visible at a glance)
3. **Truncate branch name** only when absolutely necessary
4. **Preserve git indicators** to last possible moment

## Width Optimization Recommendations

### By Use Case

### Laptop Users (13-15 inch screens)
- **Target**: 100+ columns when possible
- **Minimum**: 80 columns for acceptable experience
- **Strategy**: Use fullscreen terminal or side-by-side with 60+ columns

### Desktop Users (24+ inch monitors)
- **Target**: 120+ columns for optimal experience
- **Minimum**: 100 columns for comfortable viewing
- **Strategy**: Maximize terminal real estate

### SSH/Terminal Users
- **Target**: 80 columns (standard terminal width)
- **Minimum**: 60 columns for basic functionality
- **Strategy**: Accept some truncation for portability

### Split-Screen Workflows
- **Target**: 60+ columns per panel
- **Minimum**: 50 columns for essential information
- **Strategy**: Prioritize branch information over project name

## Terminal Configuration Tips

### Optimizing Terminal Width

**iTerm2 (macOS)**:
```bash
# Profiles → Window → Columns
# Set to 120+ for optimal experience
# Enable "character spacing" adjustments if needed
```

**Terminal.app (macOS)**:
```bash
# Shell → New Window → Columns
# Set to 120+ for development work
# Save as default profile
```

**VS Code Integrated Terminal**:
```json
// settings.json
{
  "terminal.integrated.fontSize": 14,
  "terminal.integrated.fontFamily": "JetBrains Mono",
  "terminal.integrated.scrollback": 10000
}
```

**Alacritty**:
```yaml
# alacritty.yml
window:
  columns: 120
  lines: 30
  padding:
    x: 10
    y: 10
```

### Font Recommendations

**Monospaced Fonts for Coding**:
- **JetBrains Mono** - Excellent for readability
- **Fira Code** - Good ligature support
- **Source Code Pro** - Clean, professional
- **IBM Plex Mono** - Excellent character distinction

**Font Sizes by Screen Size**:
- **13-inch laptops**: 12-14pt
- **15-inch laptops**: 14-16pt
- **24-inch monitors**: 16-18pt
- **27+ inch monitors**: 18-20pt

## Testing Width Behavior

### Manual Testing Script

```bash
#!/bin/bash
# Test statusline across different widths

test_width() {
    local width=$1
    local test_input='{"workspace":{"current_dir":"/Users/karma/Developer/personal/claude-statusline"},"model":{"display_name":"Test Model"}}'
    
    echo "Testing width: $width columns"
    echo "COLUMNS=$width echo '$test_input' | /path/to/claude-statusline"
    echo "---"
    
    COLUMNS=$width echo "$test_input" | /path/to/claude-statusline
    echo ""
    echo "Length: $(COLUMNS=$width echo "$test_input" | /path/to/claude-statusline | wc -c)"
    echo ""
}

# Test common widths
for width in 50 60 70 80 90 100 120 150; do
    test_width $width
done

Note: Test scripts are available in the tests/ directory:
- `test_width.sh` - Standard width testing across common terminal sizes
- `test_width_long.sh` - Testing with long project/branch names
```

### Visual Width Testing

```bash
# Create visual reference
create_width_reference() {
    local width=$1
    
    echo "=== $width columns ==="
    printf "%.${width}s\n" "vibekit-claude-plugins-super-long-project-name  feature/branch-name-that-is-very-long [!?✘]"
    echo ""
}

for width in 60 80 100 120; do
    create_width_reference $width
done
```

## Performance Impact

### Width Detection Performance

#### TypeScript v2.0 Implementation
| Method | Time | Reliability | Notes |
|--------|------|-------------|-------|
| `process.stdout.columns` | <1ms | ✅ High | Most reliable for Node.js |
| `tput cols` | ~2ms | ✅ High | Unix/Linux/macOS fallback |
| `stty size` | ~3ms | ✅ High | Secondary Unix fallback |
| `$COLUMNS` | <1ms | ⚠️ Medium | Environment dependent |
| Terminal detection | <1ms | ✅ High | Smart defaults |
| Hard-coded | <1ms | ✅ High | No detection overhead |

#### Bash Implementation
| Method | Time | Reliability | Notes |
|--------|------|-------------|-------|
| `tput cols` | ~2ms | ✅ High | Most reliable, preferred |
| `stty size` | ~3ms | ✅ High | Good fallback |
| `$COLUMNS` | <1ms | ⚠️ Medium | Environment dependent |
| Hard-coded | <1ms | ✅ High | No detection overhead |

### Truncation Performance

- **No truncation**: ~0ms overhead
- **Project truncation**: ~1ms overhead
- **Branch truncation**: ~2ms overhead
- **Complex truncation**: ~3ms overhead

Overall impact is negligible (< 5ms) compared to total execution time:
- **TypeScript v2.0**: ~30-45ms (with parallel async operations and native optimizations)
- **Bash v1.0**: ~99ms (original implementation)

## Troubleshooting Width Issues

### Common Problems

**Wrong width detection**:
```bash
# Check terminal width reporting
echo "COLUMNS: $COLUMNS"
echo "tput cols: $(tput cols)"
echo "stty size: $(stty size | awk '{print $2}')"
```

**Truncation not working**:
```bash
# Test with different widths
for width in 60 80 100; do
    echo "=== $width columns ==="
    COLUMNS=$width echo '{"workspace":{"current_dir":"'$PWD'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline
done
```

**Force specific width for testing**:
```bash
# Override width detection
export COLUMNS=80
echo '{"workspace":{"current_dir":"'$PWD'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline
```

### Debug Mode for Width Issues

```bash
# Enable debug logging
export CLAUDE_STATUSLINE_LOG_LEVEL=DEBUG

# Test with debug output
echo '{"workspace":{"current_dir":"'$PWD'"},"model":{"display_name":"Test"}}' | /path/to/claude-statusline
```

---

## Summary

Claude Statusline's width management provides:

✅ **Responsive design** adapting to any terminal width
✅ **Smart truncation** preserving critical context
✅ **Branch prioritization** maintaining development workflow
✅ **Performance optimization** with minimal overhead
✅ **Cross-platform compatibility** across terminal types

The 15-character right margin ensures compatibility with Claude Code's telemetry, while the intelligent truncation algorithm maintains readability across all terminal sizes.
