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
    else
        readonly git_symbol="@"
        readonly model_prefix="*"
        readonly staged_symbol="+"
        readonly conflict_symbol="C"
        readonly stashed_symbol="$"
    fi
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
    local project_name git_info env_info
    project_name=$(basename "$full_dir")
    git_info=$(get_git_info "$full_dir" 2>/dev/null)
    env_info=$(get_env_info 2>/dev/null)

    # Build statusline
    local statusline="$project_name$git_info $model_prefix$model_name$env_info"

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