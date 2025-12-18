#!/bin/bash

# Test script for terminal width behavior
# Matches the examples from docs/terminal-widths.md

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# First, build the TypeScript code (Bun preferred for speed)
bun run build:prod
# or npm run build

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing claude-statusline across different terminal widths${NC}"
echo "========================================================"
echo ""

# Test data from current directory
TEST_INPUT='{"workspace":{"current_dir":"'$PWD'"},"model":{"display_name":"Test Model"}}'

# Function to draw terminal width guide
draw_width() {
    local width=$1
    printf "${CYAN}"
    printf '%*s\n' "$width" '' | tr ' ' '-'
    printf "${NC}"
}

# Function to compare both modes side by side
compare_modes() {
    local width=$1
    local description=$2
    echo -e "${GREEN}=== $width columns${NC} ${YELLOW}$description${NC}"
    draw_width $width

    # Basic Mode
    echo -e "${BLUE}Basic Mode:${NC}"
    basic_output=$(CLAUDE_CODE_STATUSLINE_FORCE_WIDTH=$width bun dist/index.bundle.js <<< "$TEST_INPUT")
    echo "$basic_output"
    local basic_length=${#basic_output}
    echo -e "${CYAN}Length: $basic_length characters${NC}"
    echo

    # Smart Truncation Mode
    echo -e "${BLUE}Smart Truncation Mode (CLAUDE_CODE_STATUSLINE_TRUNCATE=1):${NC}"
    smart_output=$(CLAUDE_CODE_STATUSLINE_TRUNCATE=1 CLAUDE_CODE_STATUSLINE_FORCE_WIDTH=$width bun dist/index.bundle.js <<< "$TEST_INPUT")
    echo "$smart_output"
    local smart_length=${#smart_output}
    echo -e "${CYAN}Length: $smart_length characters${NC}"
    echo

    # Compare
    if [ "$basic_output" = "$smart_output" ]; then
        echo -e "${YELLOW}→ Both modes produce identical output${NC}"
    else
        echo -e "${YELLOW}→ Modes produce different output${NC}"
    fi

    draw_width $width
    echo
    echo "--------------------------------------------------------"
    echo
}

# Function to test a specific width
test_width() {
    local width=$1
    local description=$2
    echo -e "${GREEN}=== $width columns${NC} ${YELLOW}$description${NC}"

    # Run the statusline with forced width
    CLAUDE_CODE_STATUSLINE_FORCE_WIDTH=$width bun dist/index.bundle.js <<< "$TEST_INPUT"

    # Get the actual length
    local output_length=$(CLAUDE_CODE_STATUSLINE_FORCE_WIDTH=$width bun dist/index.bundle.js <<< "$TEST_INPUT" | wc -c)
    echo "Length: ${output_length} characters"
    echo ""
}

# Test key widths with both modes compared
echo -e "${YELLOW}Comparing Basic Mode vs Smart Truncation Mode:${NC}"
echo ""

# Test widths where behavior differs
compare_modes 40 "(Extreme constraint)"
compare_modes 50 "(Very narrow)"
compare_modes 60 "(Minimum viable)"
compare_modes 70 "(Tight but usable)"
compare_modes 80 "(Standard terminal)"
compare_modes 90 "(Comfortable)"
compare_modes 100 "(Optimal)"
compare_modes 120 "(Spacious)"

echo "========================================================"
echo -e "${BLUE}Width testing complete!${NC}"
echo ""
echo -e "${YELLOW}Summary of findings:${NC}"
echo ""
echo "1. Basic Mode:"
echo "   - Uses width-10 for truncation"
echo "   - Always single-line output"
echo "   - Simple cut-off with '..' suffix"
echo ""
echo "2. Smart Truncation Mode:"
echo "   - Uses width-15 for right margin (Claude telemetry)"
echo "   - Prioritizes: Branch > Project > Model"
echo "   - Can soft-wrap model info if space permits"
echo ""
echo "3. Key observations:"
echo "   - At 100+ columns: Both modes identical"
echo "   - At 60-80 columns: Smart Truncation preserves more context"
echo "   - Below 50 columns: Both modes severely truncated"
echo ""
echo "Check the visual guides above to verify documentation accuracy!"