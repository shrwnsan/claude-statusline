#!/bin/bash

# =============================================================================
# Claude Code Statusline Script - PRAGMATIC VERSION
# Simple, secure, and focused on the core functionality
# =============================================================================

# Simple configuration
readonly CONFIG_CACHE_TTL=300              # 5 minutes cache TTL
readonly CONFIG_CACHE_DIR="/tmp/.claude-statusline-cache"
readonly CONFIG_MAX_LENGTH=1000            # Reasonable input limit

# Simple error handling
log_error() { echo "[ERROR] $*" >&2; }

# =============================================================================
# ESSENTIAL SECURITY ONLY
# =============================================================================

# Basic input validation (the important stuff)
validate_input() {
    local input="$1"

    # Strip trailing whitespace
    input="${input%"${input##*[![:space:]]}"}"

    # Essential checks only
    [[ ${#input} -eq 0 ]] && return 1
    [[ ${#input} -gt $CONFIG_MAX_LENGTH ]] && return 1
    [[ "$input" =~ \{.*\} ]] || return 1  # Basic JSON check
    [[ $(echo "$input" | tr -cd '"' | wc -c) -eq 0 ]] && return 1  # Has quotes

    # Basic quote validation
    local quote_count
    quote_count=$(echo "$input" | tr -cd '"' | wc -c)
    [[ $((quote_count % 2)) -ne 0 ]] && return 1

    return 0
}

# Simple path validation (prevent obvious attacks)
validate_path() {
    local path="$1"

    [[ -z "$path" ]] && return 1
    [[ ${#path} -gt 4096 ]] && return 1
    [[ "$path" =~ \.\./|\.\.\\\\ ]] && return 1
    # Check for dangerous characters individually
    [[ "$path" == *"["* ]] && return 1
    [[ "$path" == *";"* ]] && return 1
    [[ "$path" == *"&"* ]] && return 1
    [[ "$path" == *"<"* ]] && return 1
    [[ "$path" == *">"* ]] && return 1
    [[ "$path" == *"\`"* ]] && return 1

    return 0
}

# =============================================================================
# SIMPLE CACHE (NO SECURITY OVERKILL)
# =============================================================================

# Simple cache operations (just basic file operations)
read_cache() {
    local cache_file="$1"
    local cache_ttl="$2"
    local current_time
    current_time=$(date +%s)

    [[ ! -f "$cache_file" ]] && return 1
    [[ ! -f "$cache_file.time" ]] && return 1

    local cache_time
    cache_time=$(cat "$cache_file.time" 2>/dev/null) || return 1

    [[ $((current_time - cache_time)) -ge $cache_ttl ]] && return 1

    cat "$cache_file" 2>/dev/null
}

write_cache() {
    local cache_file="$1"
    local cache_data="$2"
    local current_time
    current_time=$(date +%s)

    mkdir -p "$CONFIG_CACHE_DIR" 2>/dev/null || return 1
    echo "$cache_data" > "$cache_file" || return 1
    echo "$current_time" > "$cache_file.time" || return 1
}

# =============================================================================
# SIMPLE SYMBOL DETECTION
# =============================================================================

setup_symbols() {
    # Enhanced nerd font detection for modern terminals
    local has_nerd_font="false"

    # Check explicit Nerd Font indicator
    if [[ "${NERD_FONT:-}" == "1" ]]; then
        has_nerd_font="true"
    # Check for modern terminal programs that typically have Nerd Fonts
    elif [[ "${TERM_PROGRAM:-}" == "vscode" ]] || [[ "${TERM_PROGRAM:-}" == "ghostty" ]] || [[ "${TERM_PROGRAM:-}" == "wezterm" ]] || [[ "${TERM_PROGRAM:-}" == "iterm" ]]; then
        has_nerd_font="true"
    # Check common modern TERM values
    elif [[ "${TERM:-}" =~ alacritty|kitty|iterm|wezterm|ghostty ]]; then
        has_nerd_font="true"
    fi

    if [[ "$has_nerd_font" == "true" ]]; then
        readonly git_symbol=""
        readonly model_prefix="󰚩"
        readonly staged_symbol="+"
        readonly conflict_symbol="×"
        readonly stashed_symbol="⚑"
        readonly sandbox_symbol="󰒘"
    else
        readonly git_symbol="@"
        readonly model_prefix="*"
        readonly staged_symbol="+"
        readonly conflict_symbol="C"
        readonly stashed_symbol="$"
        readonly sandbox_symbol="[*]"
    fi
}

# =============================================================================
# SANDBOX DETECTION
# =============================================================================

detect_sandbox() {
    # Cross-platform sandbox detection based on Claude Code sandbox behaviors
    # Uses universal methods that work on Linux, macOS, and Windows

    # Method 1: Check for sandbox runtime flag (most direct if available)
    if [[ "${SANDBOX_RUNTIME:-}" == "1" ]]; then
        return 0  # In sandbox
    fi

    # Method 2: Check for Claude-specific temp directory (cross-platform temp check)
    local temp_dir="${TMPDIR:-${TMP:-${TEMP:-/tmp}}}"
    if [[ "$temp_dir" =~ claude ]]; then
        return 0  # In sandbox
    fi

    # Method 3: Test for excluded commands (docker excluded in sandbox - cross-platform)
    if ! command -v docker >/dev/null 2>&1; then
        return 0  # Docker not available - likely in sandbox
    fi

    # Method 4: Test write permissions in temp directory (sandbox has restrictions)
    local test_file="$temp_dir/claude-statusline-test-$$"
    if ! echo "test" > "$test_file" 2>/dev/null; then
        return 0  # Cannot write to temp - likely restricted
    else
        rm -f "$test_file" 2>/dev/null
    fi

    # Method 5: Check for multiple Claude environment indicators (cross-platform)
    local claude_indicators=0
    [[ "${CLAUDE_CODE_ENTRYPOINT:-}" == "cli" ]] && ((claude_indicators++))
    [[ "${CLAUDECODE:-}" == "1" ]] && ((claude_indicators++))
    [[ "${CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR:-}" == "1" ]] && ((claude_indicators++))

    # Method 6: Heuristic based on Claude indicators + actual restrictions
    if [[ $claude_indicators -ge 1 ]]; then
        # Consider it sandboxed if we have Claude indicators AND actual restrictions
        local restrictions_found=0

        # Check for command restrictions (based on sandbox config: docker is excluded)
        ! command -v docker >/dev/null 2>&1 && ((restrictions_found++))

        # Check network restrictions (sandbox only allows api.github.com, github.com)
        if command -v curl >/dev/null 2>&1; then
            # Test if we can reach external sites beyond allowed ones
            local network_test_result
            network_test_result=$(curl -m 2 -s "https://example.com" 2>/dev/null | head -c 10)
            if [[ -z "$network_test_result" ]]; then
                ((restrictions_found++))
                echo "$(date): detect_sandbox: Network test failed - no response from example.com" >> /tmp/sandbox-final-debug.log 2>/dev/null || true
            else
                echo "$(date): detect_sandbox: Network test passed - got: $network_test_result" >> /tmp/sandbox-final-debug.log 2>/dev/null || true
            fi
        else
            ((restrictions_found++))  # curl not available at all
            echo "$(date): detect_sandbox: curl not available" >> /tmp/sandbox-final-debug.log 2>/dev/null || true
        fi

        # Check for file restrictions (sandbox cannot read .env files)
        [[ -f "./.env" ]] && [[ ! -r "./.env" ]] && ((restrictions_found++))

        # Return sandbox if we find any restrictions when in Claude Code environment
        if [[ $restrictions_found -ge 1 ]]; then
            echo "$(date): detect_sandbox: SUCCESS - Method 6 found $restrictions_found restrictions" >> /tmp/sandbox-final-debug.log 2>/dev/null || true
            return 0
        fi
    fi

    # Method 7: Check for restricted file access (cross-platform .env test)
    if [[ -f "./.env" ]] && [[ ! -r "./.env" ]]; then
        return 0  # .env exists but not readable - sandbox restriction
    fi

    return 1  # No sandbox detected
}

get_sandbox_indicator() {
    # DEBUG: Log environment and detection results
    echo "$(date): get_sandbox_indicator - FEATURE=${CLAUDE_CODE_STATUSLINE_SHOW_SANDBOX:-notset} DETECT_RESULT=$(detect_sandbox && echo "YES" || echo "NO")" >> /tmp/sandbox-final-debug.log 2>/dev/null || true

    # Skip if feature is explicitly disabled
    if [[ "${CLAUDE_CODE_STATUSLINE_SHOW_SANDBOX:-}" == "0" ]]; then
        return 1
    fi

    # Check if we're actually in a sandbox (feature is enabled, now check real state)
    if detect_sandbox; then
        echo "$sandbox_symbol "
        return 0
    fi

    return 1
}

# =============================================================================
# SIMPLE GIT OPERATIONS
# =============================================================================

get_git_info() {
    local git_dir="$1"

    [[ ! -d "$git_dir" ]] && return 1
    cd "$git_dir" || return 1

    # Skip if git status disabled
    [[ "${CLAUDE_CODE_STATUSLINE_NO_GITSTATUS:-}" == "1" ]] && return 1

    # Get basic git info
    local branch
    branch=$(git branch --show-current 2>/dev/null) || return 1

    # Simple status check
    local status_output
    status_output=$(git status --porcelain 2>/dev/null) || return 1

    # Count changes (simple parsing)
    local staged unstaged untracked conflict stashed
    staged=$(echo "$status_output" | grep -c '^[MADRC].*' 2>/dev/null || echo "0")
    unstaged=$(echo "$status_output" | grep -c '^.[MTD].*' 2>/dev/null || echo "0")
    untracked=$(echo "$status_output" | grep -c '^??' 2>/dev/null || echo "0")
    conflict=$(echo "$status_output" | grep -c '^UU\|^AA\|^DD' 2>/dev/null || echo "0")

    # Check stashes separately
    stashed=$(git stash list 2>/dev/null | wc -l | tr -d ' ')

    # Build simple indicators (stashed first, like original)
    local indicators=""
    [[ $stashed -gt 0 ]] && indicators="${indicators}${stashed_symbol}"
    [[ $unstaged -gt 0 ]] && indicators="${indicators}!"
    [[ $staged -gt 0 ]] && indicators="${indicators}${staged_symbol}"
    [[ $untracked -gt 0 ]] && indicators="${indicators}?"
    [[ $conflict -gt 0 ]] && indicators="${indicators}${conflict_symbol}"

    # Simple output
    if [[ -n "$indicators" ]]; then
        echo " $git_symbol $branch [$indicators]"
    else
        echo " $git_symbol $branch"
    fi
}

# =============================================================================
# SIMPLE ENVIRONMENT INFO
# =============================================================================

get_env_info() {
    # Skip if disabled
    [[ "${CLAUDE_CODE_STATUSLINE_ENV_CONTEXT:-}" != "1" ]] && return 1

    local env_info=""

    # Node.js version
    local node_version
    node_version=$(read_cache "$CONFIG_CACHE_DIR/node_version" "$CONFIG_CACHE_TTL")
    if [[ -z "$node_version" ]] && command -v node >/dev/null 2>&1; then
        node_version=$(node --version 2>/dev/null | sed 's/v//')
        write_cache "$CONFIG_CACHE_DIR/node_version" "$node_version"
    fi

    # Python version
    local python_version
    python_version=$(read_cache "$CONFIG_CACHE_DIR/python_version" "$CONFIG_CACHE_TTL")
    if [[ -z "$python_version" ]]; then
        if command -v python3 >/dev/null 2>&1; then
            python_version=$(python3 --version 2>/dev/null | grep -o '[0-9.]*' | head -1)
        elif command -v python >/dev/null 2>&1; then
            python_version=$(python --version 2>/dev/null | grep -o '[0-9.]*' | head -1)
        fi
        [[ -n "$python_version" ]] && write_cache "$CONFIG_CACHE_DIR/python_version" "$python_version"
    fi

    # Build env info
    [[ -n "$node_version" ]] && env_info="${env_info} Node${node_version}"
    [[ -n "$python_version" ]] && env_info="${env_info} Py${python_version}"

    echo "$env_info"
}

# =============================================================================
# TERMINAL WIDTH (SIMPLIFIED)
# =============================================================================

get_terminal_width() {
    # Try tput first
    if command -v tput >/dev/null 2>&1; then
        local width
        width=$(tput cols 2>/dev/null)
        [[ -n "$width" && "$width" -gt 0 ]] && echo "$width" && return 0
    fi

    # Try COLUMNS variable
    [[ -n "${COLUMNS:-}" && "$COLUMNS" -gt 0 ]] && echo "$COLUMNS" && return 0

    # Default fallback
    echo "80"
}

# Simple truncation
truncate_text() {
    local text="$1"
    local max_length="$2"

    [[ ${#text} -le $max_length ]] && echo "$text" && return 0

    echo "${text:0:$((max_length - 2))}.."
}

# =============================================================================
# MAIN EXECUTION (SIMPLIFIED)
# =============================================================================

main() {
    # Setup
    setup_symbols

    # Read and validate input
    local input
    input=$(cat) || exit 1
    validate_input "$input" || exit 1

    # Extract information
    local full_dir model_name
    full_dir=$(echo "$input" | grep -o '"current_dir"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    model_name=$(echo "$input" | grep -o '"display_name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

    # Basic validation
    [[ -z "$full_dir" ]] && exit 1
    validate_path "$full_dir" || exit 1
    [[ ! -d "$full_dir" ]] && exit 1

    # Set defaults
    [[ -z "$model_name" ]] && model_name="Unknown"

    # Get components
    local project_name git_info env_info sandbox_indicator
    project_name=$(basename "$full_dir")
    git_info=$(get_git_info "$full_dir" 2>/dev/null)
    env_info=$(get_env_info 2>/dev/null)
    sandbox_indicator=$(get_sandbox_indicator 2>/dev/null)

    # Build statusline
    local statusline="$sandbox_indicator$project_name$git_info $model_prefix$model_name$env_info"

    # Simple truncation if needed
    local terminal_width
    terminal_width=$(get_terminal_width)
    if [[ ${#statusline} -gt $((terminal_width - 10)) ]]; then
        statusline=$(truncate_text "$statusline" $((terminal_width - 10)))
    fi

    # Output
    printf "%s" "$statusline"
}

# Run main function
main