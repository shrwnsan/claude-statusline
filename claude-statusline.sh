#!/bin/bash
# Claude Code Statusline Script - CLEAN VERSION
# Simple sandbox detection with no caching complexity
# =============================================================================

# Simple configuration
readonly CONFIG_CACHE_TTL=300              # 5 minutes cache TTL for general data
readonly CONFIG_CACHE_DIR="/tmp/.claude-statusline-cache"
readonly CONFIG_MAX_LENGTH=1000            # Reasonable input limit

# Simple error handling
log_error() { echo "[ERROR] $*" >&2; }

# Input validation
validate_input() {
    local input="$1"
    [[ -z "$input" ]] && return 1
    [[ ${#input} -gt $CONFIG_MAX_LENGTH ]] && return 1
    [[ "$input" =~ ^\{.*\}$ ]] || return 1
    return 0
}

validate_path() {
    local path="$1"
    [[ -z "$path" ]] && return 1
    [[ "$path" =~ \.\. ]] && return 1
    [[ "$path" =~ ^[a-zA-Z0-9_/.-]+$ ]] || return 1
    return 0
}

# Cache operations (for general data only, not sandbox)
read_cache() {
    local cache_file="$1"
    local ttl="$2"
    local time_file="${cache_file}.time"

    [[ -f "$cache_file" && -f "$time_file" ]] || return 1

    local cache_time
    cache_time=$(cat "$time_file" 2>/dev/null)
    [[ -n "$cache_time" ]] || return 1

    local current_time
    current_time=$(date +%s)
    [[ $((current_time - cache_time)) -lt $ttl ]] || return 1

    cat "$cache_file" 2>/dev/null
}

write_cache() {
    local cache_file="$1"
    local value="$2"
    echo "$value" > "$cache_file" 2>/dev/null
    date +%s > "${cache_file}.time" 2>/dev/null
}

# Symbol setup
setup_symbols() {
    if [[ "${NERD_FONT:-}" == "1" ]] || [[ "${TERM_PROGRAM:-}" == "vscode" ]] || [[ "${TERM_PROGRAM:-}" == "ghostty" ]] || [[ "${TERM_PROGRAM:-}" == "wezterm" ]] || [[ "${TERM_PROGRAM:-}" == "iterm" ]] || [[ "${TERM:-}" =~ alacritty|kitty|iterm|wezterm|ghostty ]]; then
        readonly git_symbol=""
        readonly model_prefix="󰚩"
        readonly sandbox_symbol="󰒘"
    else
        readonly git_symbol="@"
        readonly model_prefix="*"
        readonly sandbox_symbol="[*]"
    fi
}

# =============================================================================
# SANDBOX DETECTION (CLEAN VERSION)
# =============================================================================

detect_sandbox() {
    # Method 1: Fast network test - check one domain first for quick detection
    if command -v curl >/dev/null 2>&1; then
        local quick_test
        quick_test=$(curl -m 1 -s "https://httpbin.org/ip" 2>/dev/null | head -c 3)

        # If quick test fails, do comprehensive test
        if [[ -z "$quick_test" ]]; then
            local restricted_domains=0

            # Test example.com
            local example_result=$(curl -m 2 -s "https://example.com" 2>/dev/null | head -c 5)
            [[ -z "$example_result" ]] && ((restricted_domains++))

            # Test jsonplaceholder.typicode.com
            local json_result=$(curl -m 2 -s "https://jsonplaceholder.typicode.com/posts/1" 2>/dev/null | head -c 5)
            [[ -z "$json_result" ]] && ((restricted_domains++))

            # If quick test + any other test fails, we're in sandbox
            if [[ $restricted_domains -ge 1 ]]; then
                return 0
            fi
        fi
    fi

    return 1  # No sandbox detected
}

get_sandbox_indicator() {
    # Skip if feature is explicitly disabled
    if [[ "${CLAUDE_CODE_STATUSLINE_SHOW_SANDBOX:-}" == "0" ]]; then
        return 1
    fi

    # Check if we're actually in a sandbox (fresh detection each call)
    if detect_sandbox; then
        echo "$sandbox_symbol "
        return 0
    fi

    return 1
}

# =============================================================================
# SIMPLE GIT OPERATIONS
# =============================================================================

is_git_repo() {
    local dir="$1"
    [[ -d "$dir/.git" ]] || git -C "$dir" rev-parse --git-dir >/dev/null 2>&1
}

get_git_branch() {
    local dir="$1"
    git -C "$dir" branch --show-current 2>/dev/null
}

get_git_status() {
    local dir="$1"

    # Check if we need to skip git status (performance)
    if [[ "${CLAUDE_CODE_STATUSLINE_NO_GITSTATUS:-}" == "1" ]]; then
        return 0
    fi

    local status_output
    status_output=$(git -C "$dir" status --porcelain 2>/dev/null) || return 1

    local staged unstaged untracked conflict stashed
    staged=$(echo "$status_output" | grep -c '^[MADRC].*' 2>/dev/null || echo "0")
    unstaged=$(echo "$status_output" | grep -c '^.[MTD].*' 2>/dev/null || echo "0")
    untracked=$(echo "$status_output" | grep -c '^??' 2>/dev/null || echo "0")
    conflict=$(echo "$status_output" | grep -c '^UU\|^AA\|^DD' 2>/dev/null || echo "0")
    stashed=$(git -C "$dir" stash list 2>/dev/null | wc -l | tr -d ' ')

    local indicators=""
    [[ $stashed -gt 0 ]] && indicators="${indicators}⚑"
    [[ $unstaged -gt 0 ]] && indicators="${indicators}!"
    [[ $staged -gt 0 ]] && indicators="${indicators}+"
    [[ $untracked -gt 0 ]] && indicators="${indicators}?"
    [[ $conflict -gt 0 ]] && indicators="${indicators}×"

    echo "$indicators"
}

get_git_info() {
    local git_dir="$1"

    is_git_repo "$git_dir" || return 1

    local branch
    branch=$(get_git_branch "$git_dir") || return 1

    local status
    status=$(get_git_status "$git_dir")

    if [[ -n "$status" ]]; then
        echo " $git_symbol $branch [$status]"
    else
        echo " $git_symbol $branch"
    fi
}

# =============================================================================
# ENVIRONMENT INFO
# =============================================================================

get_env_info() {
    local env_info=""
    [[ "${VIRTUAL_ENV:-}" ]] && env_info="${env_info} py"
    [[ "${CONDA_DEFAULT_ENV:-}" ]] && env_info="${env_info} conda"
    [[ "${NODE_ENV:-}" ]] && env_info="${env_info} node"

    [[ -n "$env_info" ]] && echo " ($env_info)" || echo ""
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

get_terminal_width() {
    if command -v tput >/dev/null 2>&1; then
        local width
        width=$(tput cols 2>/dev/null)
        [[ -n "$width" && "$width" -gt 0 ]] && echo "$width" && return 0
    fi

    [[ -n "${COLUMNS:-}" && "$COLUMNS" -gt 0 ]] && echo "$COLUMNS" && return 0
    echo "80"
}

truncate_text() {
    local text="$1"
    local max_length="$2"

    [[ ${#text} -le $max_length ]] && echo "$text" && return 0
    echo "${text:0:$((max_length - 3))}..."
}

# =============================================================================
# MAIN EXECUTION
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