# Changelog

All notable changes to claude-statusline will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [2.1.4] - 2025-01-22

### Fixed
- Context percentage now displays correctly with Claude Code v2.1.15+
- Added support for new `context_window.used_percentage` field
- Maintains backward compatibility with manual calculation fallback

## [2.1.3] - 2025-01-22

### Fixed
- Use display width instead of character count in soft wrapping (#19)
- Prevents garbled output with multi-byte characters (emojis, CJK)

### Changed
- Normalized package.json repository URL per npm standards

## [2.1.2] - 2025-12-19

### Fixed
- Ensure entire model string wraps to next line when exceeding width, preventing mid-word splits
- Model indicator and context usage now stay together as intended

## [2.1.1] - 2025-12-19

### Fixed
- Improved soft wrapping for long model strings to prevent truncation issues (f811a8a)
- Removed legacy bash script references from documentation and fixed curl download commands (73224f1)

### Documentation
- Updated AGENTS.md to reflect current version 2.1.1
- Cleaned up installation documentation to remove deprecated bash script references

## [2.1.0] - 2025-12-18

### Added
- Context window usage display (Beta) (e669571, 0eec6fa, 121f613)
  - Shows percentage of context window consumed when data is available
  - Uses ⚡︎ symbol (Nerd Font) or # symbol (ASCII)
  - Can be disabled with `noContextWindow: true` or `CLAUDE_CODE_STATUSLINE_NO_CONTEXT_WINDOW=1`
  - **Note**: Implementation follows official Claude Code documentation but may show different values compared to `/context` command
  - Calculation includes input tokens + cache tokens (excludes output tokens per spec)

### Fixed
- Restored git symbol () that was accidentally removed in Nerd Font symbol set (e669571)
- Updated context window calculation to strictly follow official Claude Code documentation (121f613)

## [2.0.0] - 2025-12-14

### Major Changes
- Complete rewrite from Bash to TypeScript (deb8af2) - 16 commits over 9 days
- npm distribution for easier installation and updates (13dddbd)
- Cross-platform support including Windows

### Added
- Published to npm registry for global installation
- Available via `npm install -g claude-statusline` and `bun install -g claude-statusline`
- Configuration file support (JSON/YAML) with schema validation
- Enhanced terminal width detection (8 methods vs 3 in v1.0)
- Smart truncation with soft-wrapping to preserve information
- Performance improvements (~30-45ms vs ~99ms execution time)
- Caching system for git operations
- Debug mode for troubleshooting width detection issues
- Zod schema validation for robust configuration parsing
- Parallel async operations for better performance

### Improved
- Better error handling with graceful fallbacks
- More accurate terminal width detection across platforms
- Enhanced git status detection with caching
- Improved Windows Terminal, Ghostty, WezTerm detection
- Nerd Font symbol support with ASCII fallbacks

### Changed
- Default right margin from 10 to 15 characters for Claude Code telemetry compatibility
- Configuration now primarily via files instead of environment variables
- Width detection uses `process.stdout.columns` as preferred method

### Deprecated
- `.claude-statusline.*` file patterns (use `claude-statusline.*` instead)
- `.yml` extension (use `.yaml` instead)
- Environment variable configuration (still supported for v1.0 compatibility)

### Documentation
- Comprehensive README restructure for v2.0 (ba912b7)
- Enhanced terminal width documentation (8e29200)
- Added feature comparison and migration guides

## [1.0.0] - 2025-12-01

### Added
- Initial Bash implementation (7400080)
- Basic terminal width detection (tput cols, fallback to 80)
- Git status indicators (staged, modified, untracked, stashed, etc.)
- ASCII and Nerd Font support with fallbacks (f35825c)
- Environment variable configuration
- Smart truncation mode (b38b6fd)
- Branch prioritization in truncation algorithm
- Cross-platform terminal compatibility
- Comprehensive competitive analysis (49bc38b)

### Features
- Git indicators: [⚑!+?»✘×⇕⇡⇣]
- Model display with Claude Code integration
- Project directory display with truncation
- Installation via direct download (ecc26c7)

### Documentation
- Demo GIF showcasing functionality (301cbc2)
- Icon reference section
- Installation and setup instructions

[2.1.4]: https://github.com/shrwnsan/claude-statusline/compare/v2.1.3...v2.1.4
[2.1.3]: https://github.com/shrwnsan/claude-statusline/compare/v2.1.2...v2.1.3
[2.1.2]: https://github.com/shrwnsan/claude-statusline/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/shrwnsan/claude-statusline/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/shrwnsan/claude-statusline/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/shrwnsan/claude-statusline/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/shrwnsan/claude-statusline/releases/tag/v1.0.0