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
    # Default ASCII symbols (shared across all modes)
    local ascii_git="@"
    local ascii_model="*"
    local ascii_staged="+"
    local ascii_conflict="C"
    local ascii_stashed="$"
    local ascii_ahead="A"
    local ascii_behind="B"
    local ascii_diverged="D"
    local ascii_renamed=">"
    local ascii_deleted="X"

    # Nerd Font symbols
    local nerd_git=""
    local nerd_model="󰚩"
    local nerd_staged="+"
    local nerd_conflict="×"
    local nerd_stashed="⚑"
    local nerd_ahead="↑"
    local nerd_behind="↓"
    local nerd_diverged="⇕"
    local nerd_renamed="»"
    local nerd_deleted="✘"

    # Determine symbol mode: ASCII, Nerd Font, or NO_EMOJI (forced ASCII)
    local use_nerd_font="false"

    if [[ "${CLAUDE_CODE_STATUSLINE_NO_EMOJI:-}" != "1" ]]; then
        # Detect Nerd Font support (short-circuit evaluation)
        [[ "${NERD_FONT:-}" == "1" ]] ||
        [[ "${TERM_PROGRAM:-}" =~ ^(vscode|ghostty|wezterm|iterm)$ ]] ||
        [[ "${TERM:-}" =~ ^(alacritty|kitty|iterm|wezterm|ghostty)$ ]] &&
        use_nerd_font="true"
    fi

    # Set symbols based on determined mode
    if [[ "$use_nerd_font" == "true" ]]; then
        readonly git_symbol="$nerd_git"
        readonly model_prefix="$nerd_model"
        readonly staged_symbol="$nerd_staged"
        readonly conflict_symbol="$nerd_conflict"
        readonly stashed_symbol="$nerd_stashed"
        readonly ahead_symbol="$nerd_ahead"
        readonly behind_symbol="$nerd_behind"
        readonly diverged_symbol="$nerd_diverged"
        readonly renamed_symbol="$nerd_renamed"
        readonly deleted_symbol="$nerd_deleted"
    else
        readonly git_symbol="$ascii_git"
        readonly model_prefix="$ascii_model"
        readonly staged_symbol="$ascii_staged"
        readonly conflict_symbol="$ascii_conflict"
        readonly stashed_symbol="$ascii_stashed"
        readonly ahead_symbol="$ascii_ahead"
        readonly behind_symbol="$ascii_behind"
        readonly diverged_symbol="$ascii_diverged"
        readonly renamed_symbol="$ascii_renamed"
        readonly deleted_symbol="$ascii_deleted"
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

    # Count changes by parsing git --porcelain format
    # Format: XY PATH where X=staged, Y=unstaged
    local staged unstaged untracked conflict renamed deleted stashed
    staged=0
    unstaged=0
    untracked=0
    conflict=0
    renamed=0
    deleted=0

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue

        local staged_char="${line:0:1}"
        local unstaged_char="${line:1:1}"

        # Check for conflicts
        if [[ "$staged_char" == "U" ]] || [[ "$unstaged_char" == "U" ]] ||
           [[ "$staged_char" == "A" && "$unstaged_char" == "A" ]] ||
           [[ "$staged_char" == "D" && "$unstaged_char" == "D" ]]; then
            ((conflict++))
        # Check for untracked files
        elif [[ "$staged_char" == "?" && "$unstaged_char" == "?" ]]; then
            ((untracked++))
        else
            # Check staged changes (first character)
            case "$staged_char" in
                "M") ((staged++)) ;;     # Modified
                "A") ((staged++)) ;;     # Added
                "D") ((deleted++)) ;;    # Deleted (staged)
                "R") ((renamed++)) ;;    # Renamed (staged)
                "C") ((staged++)) ;;     # Copied (staged)
            esac

            # Check unstaged changes (second character)
            case "$unstaged_char" in
                "M") ((unstaged++)) ;;   # Modified
                "D") ((deleted++)) ;;    # Deleted (unstaged)
                "R") ((renamed++)) ;;    # Renamed (unstaged)
            esac
        fi
    done <<< "$status_output"

    # Check stashes separately
    stashed=$(git stash list 2>/dev/null | wc -l | tr -d ' ')

    # Check ahead/behind status
    local ahead behind
    local ahead_behind_count
    ahead_behind_count=$(git rev-list --count --left-right @{u}...HEAD 2>/dev/null || echo "0	0")
    behind=$(echo "$ahead_behind_count" | cut -f1)
    ahead=$(echo "$ahead_behind_count" | cut -f2)

    # Build indicators following Starship order: ⚑✘!+?⇕⇡⇣
    local indicators=""
    [[ $stashed -gt 0 ]] && indicators="${indicators}${stashed_symbol}"
    [[ $deleted -gt 0 ]] && indicators="${indicators}${deleted_symbol}"
    [[ $unstaged -gt 0 ]] && indicators="${indicators}!"
    [[ $staged -gt 0 ]] && indicators="${indicators}${staged_symbol}"
    [[ $untracked -gt 0 ]] && indicators="${indicators}?"
    [[ $renamed -gt 0 ]] && indicators="${indicators}${renamed_symbol}"
    [[ $conflict -gt 0 ]] && indicators="${indicators}${conflict_symbol}"
    # Check for diverged branches (both ahead and behind) - show single symbol
    if [[ $ahead -gt 0 && $behind -gt 0 ]]; then
        indicators="${indicators}${diverged_symbol}"
    else
        [[ $ahead -gt 0 ]] && indicators="${indicators}${ahead_symbol}"
        [[ $behind -gt 0 ]] && indicators="${indicators}${behind_symbol}"
    fi

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

# Smart truncation (opt-in beta feature)
smart_truncate() {
    local project="$1" git_info="$2" max_len="$3"

    # Step 1: Check if everything fits
    [[ $((${#project} + ${#git_info})) -le $max_len ]] && return 0

    # Step 2: Truncate project only (preserve branch)
    local proj_len=$((max_len - ${#git_info} - 2))
    [[ $proj_len -ge 5 ]] && echo "${project:0:$proj_len}..$git_info" && return 0

    # Step 3: Truncate project + branch (preserve indicators)
    local indicators=""
    # Extract indicators using grep to avoid bracket pattern issues
    if echo "$git_info" | grep -q '\['; then
        # Use sed to extract content between brackets
        indicators=$(echo "$git_info" | sed 's/.*\[\([^]]*\)\].*/\1/' 2>/dev/null || echo "")
    fi
    local branch_len=$((max_len - ${#indicators} - 8))
    [[ $branch_len -ge 8 ]] && echo "${project:0:4}..${git_info:0:$branch_len}..${indicators:+ [$indicators]}" && return 0

    # Step 4: Basic fallback
    echo "${project:0:$max_len}.."
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

    # Apply smart truncation if enabled (beta feature)
    local terminal_width
    terminal_width=$(get_terminal_width)

    if [[ "${CLAUDE_CODE_STATUSLINE_TRUNCATE:-}" == "1" ]]; then
        # Use 15-char margin for Claude telemetry compatibility
        local max_len=$((terminal_width - 15))
        [[ $max_len -lt 30 ]] && max_len=30

        # Smart truncation: prioritize branch over project, preserve indicators
        local model_env="$model_prefix$model_name$env_info"
        local project_git="$project_name$git_info"

        # Check if everything fits
        local total_len=$((${#project_git} + ${#model_env} + 1))
        if [[ $total_len -le $max_len ]]; then
            statusline="$project_git $model_env"
        elif [[ ${#project_git} -le $max_len ]]; then
            # Truncate model part only
            local model_max_len=$((max_len - ${#project_git} - 1))
            model_env=$(truncate_text "$model_env" "$model_max_len")
            statusline="$project_git $model_env"
        else
            # Smart truncation of project+git part
            local truncated
            truncated=$(smart_truncate "$project_name" "$git_info" "$max_len" 2>/dev/null)
            if [[ -n "$truncated" ]]; then
                statusline="$truncated"
            else
                statusline=$(truncate_text "$project_git" "$max_len")
            fi
        fi
    else
        # Current simple truncation (default behavior)
        if [[ ${#statusline} -gt $((terminal_width - 10)) ]]; then
            statusline=$(truncate_text "$statusline" $((terminal_width - 10)))
        fi
    fi

    # Output
    printf "%s" "$statusline"
}

# Run main function
main