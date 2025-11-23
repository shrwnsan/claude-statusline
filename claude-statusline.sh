#!/bin/bash

# =============================================================================
# Claude Code Statusline Script - OPTIMIZED VERSION
# Optimized for performance with smart caching and reduced overhead
#
# See README.md for available environment variables (e.g., CLAUDE_CODE_STATUSLINE_WIDTH_LIMIT)
# =============================================================================

# Configuration Constants
readonly CONFIG_CACHE_TTL=300              # 5 minutes default cache TTL
readonly CONFIG_CACHE_TTL_DOCKER=1800      # 30 minutes for Docker cache
readonly CONFIG_CACHE_DIR="/tmp/.claude-statusline-cache"
readonly CONFIG_MAX_LENGTH=2000            # Maximum string length for safety
readonly CONFIG_MIN_RIGHT_MARGIN=15        # Minimum space to preserve for right-side telemetry

# Script initialization
set -uo pipefail  # Exit on error, undefined vars, pipe failures

# =============================================================================
# FAST VALIDATION (ESSENTIAL CHECKS ONLY)
# =============================================================================

# Minimal logging for performance
log_error() { echo "[ERROR] $*" >&2; }

# =============================================================================
# TERMINAL WIDTH DETECTION (OPT-IN)
# =============================================================================

# Get terminal width with fallbacks
get_terminal_width() {
    local width

    # Try tput first (most reliable)
    if command -v tput >/dev/null 2>&1; then
        width=$(tput cols 2>/dev/null)
        [[ -n "$width" && "$width" -gt 0 ]] && echo "$width" && return 0
    fi

    # Try stty
    if command -v stty >/dev/null 2>&1; then
        width=$(stty size 2>/dev/null | awk '{print $2}')
        [[ -n "$width" && "$width" -gt 0 ]] && echo "$width" && return 0
    fi

    # Try COLUMNS variable
    if [[ -n "${COLUMNS:-}" && "$COLUMNS" -gt 0 ]]; then
        echo "$COLUMNS" && return 0
    fi

    # Default fallback for narrow terminals
    echo "80"
}

# Check if truncation is disabled
is_truncation_disabled() {
    [[ "${CLAUDE_CODE_STATUSLINE_NO_TRUNCATE:-}" == "1" ]]
}

# Simple truncation function for when truncation is enabled
simple_truncate() {
    local text="$1"
    local max_length="$2"
    local suffix="${3:-..}"

    [[ ${#text} -le $max_length ]] && echo "$text" && return 0

    local truncate_len=$((max_length - ${#suffix}))
    [[ $truncate_len -lt 3 ]] && echo "${text:0:$max_length}" && return 0

    echo "${text:0:$truncate_len}${suffix}"
}

# Smart statusline wrapper that prioritizes branch names over project names
wrap_statusline() {
    local project_name="$1"
    local git_info="$2"
    local model_prefix="$3"
    local model_name="$4"
    local env_info="$5"
    local max_width="$6"

    local project_git="$project_name$git_info"
    local model_env="$model_prefix$model_name$env_info"
    local combined="$project_git $model_env"

    # If everything fits on one line, return as-is
    if [[ ${#combined} -le $max_width ]]; then
        echo "$combined"
        return 0
    fi

    # If project + git fits, wrap before model (ideal case)
    if [[ ${#project_git} -le $max_width ]]; then
        printf "%s\n%s" "$project_git" "$model_env"
        return 0
    fi

    # If truncation is disabled, let terminal handle the overflow
    if is_truncation_disabled; then
        printf "%s\n%s" "$project_git" "$model_env"
        return 0
    fi

    # Smart truncation: prioritize branch over project
    # Extract branch info from git_info (format: " branch [indicators]")
    local branch_part=""
    local indicators_part=""
    # First try: split at first [ to separate indicators
    if [[ "$git_info" =~ ^([^[]*)(\[[^]]*\])?[[:space:]]*$ ]]; then
        branch_part="${BASH_REMATCH[1]}"
        indicators_part="${BASH_REMATCH[2]:-}"
    else
        # Fallback: treat whole thing as branch part
        branch_part="$git_info"
        indicators_part=""
    fi

    # Step 1: Try truncating project name only (preserve full branch)
    local max_project_length=$((max_width - ${#branch_part} - ${#indicators_part} - 3))  # -3 for ".." and spacing
    [[ $max_project_length -lt 5 ]] && max_project_length=5

    local truncated_project="${project_name:0:$max_project_length}.."
    local project_truncated_git="$truncated_project$branch_part$indicators_part"

    if [[ ${#project_truncated_git} -le $max_width ]]; then
        printf "%s\n%s" "$project_truncated_git" "$model_env"
        return 0
    fi

    # Step 2: If still too long, truncate branch more aggressively
    local max_branch_length=$((max_width - ${#truncated_project} - ${#indicators_part} - 6))  # -6 for ".." and spacing
    [[ $max_branch_length -lt 8 ]] && max_branch_length=8

    local truncated_branch="${branch_part:0:$max_branch_length}.."
    local final_git_info="$truncated_project$truncated_branch$indicators_part"

    printf "%s\n%s" "$final_git_info" "$model_env"
}


# Essential input validation only
validate_input_minimal() {
    local input="$1"
    [[ ${#input} -gt $CONFIG_MAX_LENGTH ]] && return 1

    # Skip problematic character validation due to bash 3.2 bugs on macOS
    # In practice, null bytes and carriage returns won't occur in normal JSON input
    return 0
}

# =============================================================================
# DEPENDENCY CACHING (ENVIRONMENT VARIABLES)
# =============================================================================

# Cache dependencies in environment variables to avoid repeated checks
cache_dependencies() {
    if [[ -n "${CLAUDE_DEPS_CACHED:-}" ]]; then
        return 0  # Already cached in this session
    fi

    # Quick dependency check with minimal validation
    local missing_deps=()
    command -v git >/dev/null 2>&1 || missing_deps+=("git")

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi

    # Cache available commands in environment variables
    export CLAUDE_DEPS_CACHED="1"
    export CLAUDE_HAS_JQ=$(command -v jq >/dev/null 2>&1 && echo "1" || echo "0")
    export CLAUDE_HAS_FC_LIST=$(command -v fc-list >/dev/null 2>&1 && echo "1" || echo "0")

    return 0
}

# =============================================================================
# OPTIMIZED SYMBOL CONFIGURATION (CACHED)
# =============================================================================

# Cache nerd font detection in environment variable
detect_nerd_fonts() {
    if [[ -n "${CLAUDE_NERD_FONT_CACHED:-}" ]]; then
        echo "$CLAUDE_NERD_FONT_CACHED"
        return 0
    fi

    local nerd_test="false"

    # Quick environment indicators
    if [[ -n "${NERD_FONT:-}" ]] || [[ "${TERM_PROGRAM:-}" == "vscode" ]]; then
        nerd_test="true"
    elif [[ "${CLAUDE_CODE_STATUSLINE_NO_EMOJI:-}" == "1" ]]; then
        nerd_test="false"
    else
        # Fast terminal detection without fc-list if possible
        case "${TERM:-}" in
            *alacritty*|*kitty*|*iterm*|*wezterm*|*ghostty*|xterm-ghostty)
                # Assume modern terminal has Nerd Fonts (skip expensive fc-list)
                nerd_test="true"
                ;;
        esac
    fi

    # Cache result in environment
    export CLAUDE_NERD_FONT_CACHED="$nerd_test"
    echo "$nerd_test"
}

# Set symbols based on cached Nerd Font detection
setup_symbols() {
    local has_nerd_fonts
    has_nerd_fonts=$(detect_nerd_fonts)

    if [[ "$has_nerd_fonts" == "true" ]]; then
        readonly git_symbol=""
        readonly model_prefix="󰚩"
        readonly staged_symbol="+"
        readonly renamed_symbol="»"
        readonly deleted_symbol="✘"
        readonly conflict_symbol="×"
        readonly ahead_symbol="⇡"
        readonly behind_symbol="⇣"
        readonly stashed_symbol="⚑"
        readonly nodejs_symbol=""
        readonly python_symbol=""
        readonly docker_symbol=""
    else
        readonly git_symbol="@"
        readonly model_prefix="*"
        readonly staged_symbol="+"
        readonly renamed_symbol="R"
        readonly deleted_symbol="D"
        readonly conflict_symbol="C"
        readonly ahead_symbol="A"
        readonly behind_symbol="B"
        readonly stashed_symbol="$"
        readonly nodejs_symbol="Node"
        readonly python_symbol="Py"
        readonly docker_symbol="Docker"
    fi
}

# =============================================================================
# OPTIMIZED CACHE OPERATIONS (SIMPLE FILES)
# =============================================================================

# Simple cache operations without atomic writes
read_simple_cache() {
    local cache_file="$1"
    local cache_ttl="$2"
    local current_time
    current_time=$(date +%s)

    if [[ ! -f "$cache_file" ]]; then
        return 1
    fi

    local cache_time
    cache_time=$(cat "$cache_file.time" 2>/dev/null) || return 1

    if [[ $((current_time - cache_time)) -ge $cache_ttl ]]; then
        return 1
    fi

    cat "$cache_file" 2>/dev/null || return 1
}

write_simple_cache() {
    local cache_file="$1"
    local cache_data="$2"
    local current_time
    current_time=$(date +%s)

    mkdir -p "$CONFIG_CACHE_DIR" || return 1
    echo "$cache_data" > "$cache_file" || return 1
    echo "$current_time" > "$cache_file.time" || return 1
}

# =============================================================================
# FAST ENVIRONMENT CONTEXT (CACHED)
# =============================================================================

# Get cached version with simple file operations
get_cached_version_fast() {
    local command="$1"
    local version_flag="$2"
    local cache_name="$3"
    local cache_ttl="$4"
    local filter_regex="$5"

    local cache_file="$CONFIG_CACHE_DIR/$cache_name"

    # Try cache first
    local cached_version
    cached_version=$(read_simple_cache "$cache_file" "$cache_ttl")

    if [[ -n "$cached_version" ]]; then
        echo "$cached_version"
        return 0
    fi

    # Cache miss - get version
    local version=""
    if command -v "$command" >/dev/null 2>&1; then
        version=$($command "$version_flag" 2>/dev/null)
        if [[ -n "$version" && -n "$filter_regex" ]]; then
            version=$(echo "$version" | grep -o "$filter_regex" | head -1 || echo "")
        fi
    fi

    # Cache if valid
    if [[ -n "$version" ]] && validate_input_minimal "$version"; then
        write_simple_cache "$cache_file" "$version"
    fi

    echo "$version"
}

# Fast environment info with minimal overhead
get_environment_info_fast() {
    # Skip if disabled
    if [[ "${CLAUDE_CODE_STATUSLINE_ENV_CONTEXT:-}" != "1" ]]; then
        echo ""
        return 0
    fi

    # Clean old cache files only occasionally (every 100 runs)
    if [[ $((RANDOM % 100)) -eq 0 ]]; then
        find "$CONFIG_CACHE_DIR" -name "*.time" -mtime +1 -delete 2>/dev/null || true
    fi

    local env_info=""

    # Get versions from cache
    local node_version python_version docker_version

    node_version=$(get_cached_version_fast "node" "--version" "node_version" "$CONFIG_CACHE_TTL" 'v[0-9.]*')
    if [[ -n "$node_version" ]]; then
        node_version=$(echo "$node_version" | sed 's/v//')
        env_info="${env_info} ${nodejs_symbol}${node_version}"
    fi

    # Python version
    if command -v python3 >/dev/null 2>&1; then
        python_version=$(get_cached_version_fast "python3" "--version" "python3_version" "$CONFIG_CACHE_TTL" 'Python [0-9.]*')
    elif command -v python >/dev/null 2>&1; then
        python_version=$(get_cached_version_fast "python" "--version" "python_version" "$CONFIG_CACHE_TTL" 'Python [0-9.]*')
    fi

    if [[ -n "$python_version" ]]; then
        python_version=$(echo "$python_version" | sed 's/Python //')
        env_info="${env_info} ${python_symbol}${python_version}"
    fi

    # Docker version
    docker_version=$(get_cached_version_fast "docker" "--version" "docker_version" "$CONFIG_CACHE_TTL_DOCKER" 'version [0-9.]*')
    if [[ -n "$docker_version" ]]; then
        docker_version=$(echo "$docker_version" | sed 's/version //')
        env_info="${env_info} ${docker_symbol}${docker_version}"
    fi

    echo "$env_info"
}

# =============================================================================
# OPTIMIZED GIT OPERATIONS
# =============================================================================

# Fast git status parsing (consolidated)
parse_git_status_fast() {
    local git_dir="$1"

    [[ ! -d "$git_dir" ]] && return 1

    cd "$git_dir" || return 1

    # Skip if git status disabled
    if [[ "${CLAUDE_CODE_STATUSLINE_NO_GITSTATUS:-}" == "1" ]]; then
        echo "BRANCH:"
        return 0
    fi

    # Get branch info and regular porcelain output
    local branch porcelain_output
    branch=$(git branch --show-current 2>/dev/null || echo "HEAD")
    porcelain_output=$(git status --porcelain 2>/dev/null) || return 1

    # Parse porcelain format with correct logic for all patterns
    echo "$porcelain_output" | awk '
        BEGIN {
            staged = renamed = deleted = unstaged = untracked = conflict = 0;
        }

        {
            # Get index (staged) and worktree (unstaged) characters
            idx = substr($0, 1, 1);
            worktree = substr($0, 2, 1);

            # Handle staged changes (first character)
            if (idx == "A") staged++;        # Added to staging
            else if (idx == "M") staged++;   # Modified in staging
            else if (idx == "D") {           # Deleted in staging
                staged++;
                deleted++;
            }
            else if (idx == "R") {           # Renamed in staging
                staged++;
                renamed++;
            }
            else if (idx == "C") staged++;   # Copied in staging

            # Handle unstaged changes (second character)
            if (worktree == "M") unstaged++; # Modified in worktree
            else if (worktree == "D") deleted++; # Deleted in worktree
            else if (worktree == "A") unstaged++; # Added in worktree (should be rare)
            else if (worktree == "U") unstaged++; # Updated but unmerged

            # Handle untracked files
            if (idx == "?" && worktree == "?") {
                untracked++;
            }

            # Handle conflicts
            if (idx == "U" || worktree == "U" ||
                idx == "A" && worktree == "A" ||   # AA - add/add
                idx == "D" && worktree == "D" ||   # DD - delete/delete
                idx == "U" && worktree == "U") {   # UU - unmerged/unmerged
                conflict++;
            }
        }

        END {
            print "BRANCH:" "'"$branch"'";
            print "STAGED:" staged;
            print "RENAMED:" renamed;
            print "DELETED:" deleted;
            print "UNSTAGED:" unstaged;
            print "UNTRACKED:" untracked;
            print "CONFLICT:" conflict;
            print "STASHED:0";
            print "AHEAD:0";
            print "BEHIND:0";
        }
    '

    # Get ahead/behind info separately
    local ahead_behind
    ahead_behind=$(git rev-list --count --left-right @{upstream}...HEAD 2>/dev/null)
    if [[ -n "$ahead_behind" ]]; then
        local behind ahead
        behind=$(echo "$ahead_behind" | awk '{print $1}')
        ahead=$(echo "$ahead_behind" | awk '{print $2}')
        echo "AHEAD:$ahead"
        echo "BEHIND:$behind"
    fi

    # Check stashes separately and count them properly
    local stash_count
    stash_count=$(git stash list 2>/dev/null | wc -l | tr -d ' ')
    [[ "$stash_count" -gt 0 ]] && echo "STASHED:$stash_count"
}

# Fast git info building
build_git_info_fast() {
    local git_data="$1"

    local git_branch
    git_branch=$(echo "$git_data" | grep "^BRANCH:" | cut -d':' -f2-)

    [[ -z "$git_branch" || "$git_branch" == "HEAD" ]] && return 0

    # Truncate branch name if branch is very long; disable when toggled by env var
    if ! is_truncation_disabled && [[ ${#git_branch} -gt 40 ]]; then
        git_branch=$(simple_truncate "$git_branch" 30)
    fi

    # Extract counts (get the last non-zero value for each metric)
    local staged renamed deleted unstaged untracked conflict stashed ahead behind
    staged=$(echo "$git_data" | grep "^STAGED:" | tail -1 | cut -d':' -f2)
    renamed=$(echo "$git_data" | grep "^RENAMED:" | tail -1 | cut -d':' -f2)
    deleted=$(echo "$git_data" | grep "^DELETED:" | tail -1 | cut -d':' -f2)
    unstaged=$(echo "$git_data" | grep "^UNSTAGED:" | tail -1 | cut -d':' -f2)
    untracked=$(echo "$git_data" | grep "^UNTRACKED:" | tail -1 | cut -d':' -f2)
    conflict=$(echo "$git_data" | grep "^CONFLICT:" | tail -1 | cut -d':' -f2)
    stashed=$(echo "$git_data" | grep "^STASHED:" | tail -1 | cut -d':' -f2)
    ahead=$(echo "$git_data" | grep "^AHEAD:" | tail -1 | cut -d':' -f2)
    behind=$(echo "$git_data" | grep "^BEHIND:" | tail -1 | cut -d':' -f2)

    # Ensure numeric values (default to 0 if empty)
    : ${staged:=0}
    : ${renamed:=0}
    : ${deleted:=0}
    : ${unstaged:=0}
    : ${untracked:=0}
    : ${conflict:=0}
    : ${stashed:=0}
    : ${ahead:=0}
    : ${behind:=0}

    # Build indicators efficiently (single symbols regardless of count)
    # Order: stashed → unstaged → staged → untracked → conflict → renamed → deleted → ahead → behind
    local indicators=""

    [[ "$stashed" -gt 0 ]] && indicators="${indicators}${stashed_symbol}"
    [[ "$unstaged" -gt 0 ]] && indicators="${indicators}!"
    [[ "$staged" -gt 0 ]] && indicators="${indicators}${staged_symbol}"
    [[ "$untracked" -gt 0 ]] && indicators="${indicators}?"
    [[ "$conflict" -gt 0 ]] && indicators="${indicators}${conflict_symbol}"
    [[ "$renamed" -gt 0 ]] && indicators="${indicators}${renamed_symbol}"
    [[ "$deleted" -gt 0 ]] && indicators="${indicators}${deleted_symbol}"
    [[ "$ahead" -gt 0 ]] && indicators="${indicators}${ahead_symbol}"
    [[ "$behind" -gt 0 ]] && indicators="${indicators}${behind_symbol}"

    if [[ -n "$indicators" ]]; then
        echo " $git_symbol $git_branch [$indicators]"
    else
        echo " $git_symbol $git_branch"
    fi
}

# =============================================================================
# MAIN EXECUTION (OPTIMIZED)
# =============================================================================

main() {
    # Fast dependency caching
    cache_dependencies

    # Setup symbols once
    setup_symbols

    # Read and validate input minimally
    local input
    input=$(cat) || exit 1

    validate_input_minimal "$input" || exit 1

    # Extract information with fallback parsing (jq causing issues)
    local full_dir model_name
    # Force fallback parser for now
    full_dir=$(echo "$input" | grep -o '"current_dir"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    model_name=$(echo "$input" | grep -o '"display_name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

    # Validate and sanitize
    [[ -z "$full_dir" || ! -d "$full_dir" ]] && exit 1
    validate_input_minimal "$model_name" || model_name="Unknown"

    local project_name
    project_name=$(basename "$full_dir" | sed 's/[^a-zA-Z0-9_\/\.\:\@ -]//g')
    [[ -z "$project_name" ]] && project_name="unknown"

    # Get components
    local git_info env_info
    local git_data
    git_data=$(parse_git_status_fast "$full_dir" 2>/dev/null)
    git_info=$(build_git_info_fast "$git_data" 2>/dev/null)
    env_info=$(get_environment_info_fast)

    # Build the initial statusline
    local statusline="$project_name$git_info $model_prefix$model_name$env_info"

    # Always apply smart wrapping with 15-char margin
    local terminal_width
    terminal_width=$(get_terminal_width)
    local max_statusline_length=$((terminal_width - CONFIG_MIN_RIGHT_MARGIN))

    # Ensure we have reasonable minimum space
    [[ $max_statusline_length -lt 30 ]] && max_statusline_length=30

    # Smart wrapping (always enabled)
    statusline=$(wrap_statusline "$project_name" "$git_info" "$model_prefix" "$model_name" "$env_info" "$max_statusline_length")

    # Final output
    printf "%s" "$statusline"
}

# Run main function
main