# Changelog

All notable changes to claude-statusline will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2024-12-07

### Changed
- Simplified configuration file patterns to only `claude-statusline.{json,yaml}`
- Removed support for `.claude-statusline.*` and `.yml` file extensions
- Updated configuration search order documentation for clarity

### Improved
- Moved Legacy Bash v1.0 section to bottom with de-emphasis
- Clarified JSON as preferred configuration format
- Enhanced README organization for better user experience

## [2.0.0] - 2024-12-05

### Major Changes
- Complete rewrite from Bash to TypeScript (deb8af2)
- npm distribution for easier installation and updates (13dddbd)
- Cross-platform support including Windows

### Added
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

## [1.0.0] - 2024-12-01

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

[2.0.1]: https://github.com/shrwnsan/claude-statusline/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/shrwnsan/claude-statusline/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/shrwnsan/claude-statusline/releases/tag/v1.0.0