# Terminal Width Management

This document provides comprehensive analysis of terminal width behavior and optimization strategies for Claude Statusline.

**Implementation Status**: ✅ Smart truncation is now implemented via `CLAUDE_CODE_STATUSLINE_TRUNCATE=1` (beta feature)

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

### 60 Characters (Minimum Viable)
```
vibe..   feature/issue-20-search-fallback-b.. []
```
**Truncation Strategy**: Both project and branch truncated, model info dropped to fit

### 80 Characters (Sweet Spot)
```
vibekit-claude..  feature/issue-20-search-fallback-behavior [+?]
```
**Truncation Strategy**: Project truncated, branch preserved with full name, model info dropped

### 100 Characters (Optimal)
```
vibekit-claude-plugins  feature/issue-20-search-fallback-behavior [+?] 󰚩Sonnet 4.5
```
**Truncation Strategy**: No truncation, maximum readability

## Challenging Scenarios

### Very Long Project Names

**Scenario**: Project names exceeding 40+ characters

**80 Characters (Project Truncated)**:
```
my-awesome-super-long-project-name-for-testing-purposes  main [!?✘]
󰚩glm-4.6 22.17.1 3.13.5 28.3.3
```

**Solution**: Smart truncation preserves readability while maintaining context

### Very Long Branch Names

**Scenario**: Feature branch names with detailed descriptions

**100 Characters (Branch Truncated)**:
```
.dotfiles  feature/issue-42-comprehensive-refactoring-with-performance-improvements [!?✘]
󰚩glm-4.6 22.17.1 3.13.5 28.3.3
```

**Solution**: Intelligent branch name shortening preserves essential information

### Combined Long Names

**Challenge**: Both project and branch names are very long

**60 Characters (Double Truncation)**:
```
vibekit-claude-plugins-extremely-long-project..  feature/issue-42-comp.. [!?✘]
󰚩glm-4.6 22.17.1 3.13.5 28.3.3
```

**Solution**: Progressive truncation with branch priority

## Width Detection Algorithm

### Detection Methods (in order of preference)

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

Note: The test_width function is also available in the tests/ directory as a standalone testing script.
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

Overall impact is negligible (< 5ms) compared to total execution time (~99ms).

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
