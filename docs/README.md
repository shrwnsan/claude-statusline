# Claude Statusline Documentation

Comprehensive documentation for the Claude Code statusline tool.

## Documentation Structure

### Getting Started
- [**Main README**](../README.md) - Installation, quick start, and overview
- [**Migration Guide**](MIGRATION.md) - Migrating from bash v1.0 to TypeScript v2.0
- [**Configuration Guide**](CONFIGURATION.md) - Complete configuration options and examples

### Reference
- [**Feature Comparison**](FEATURE_COMPARISON.md) - Detailed comparison between versions
- [**Architecture**](ARCHITECTURE.md) - Technical architecture and design (TODO)
- [**Contributing**](CONTRIBUTING.md) - How to contribute to the project (TODO)

## Quick Links

### For New Users
1. [Installation Guide](../README.md#installation)
2. [Quick Configuration](CONFIGURATION.md#quick-setup)
3. [Popular Configurations](CONFIGURATION.md#popular-configurations)

### For Existing Users (bash v1.0)
1. [Migration Guide](MIGRATION.md)
2. [Feature Comparison](FEATURE_COMPARISON.md)
3. [Configuration Changes](MIGRATION.md#step-2-convert-environment-variables-to-configuration)

### For Advanced Users
1. [Complete Configuration Reference](CONFIGURATION.md#configuration-options)
2. [Performance Comparison](FEATURE_COMPARISON.md#performance-benchmarks)
3. [Feature Matrix](FEATURE_COMPARISON.md#feature-matrix)

## Version-Specific Information

### TypeScript v2.0 (Current)
- **Performance**: 19.5x faster cold starts (~45ms vs 888ms)
- **Features**: Configuration files, Windows support, npm distribution
- **Recommended for**: New users, Windows users, performance-critical setups

### Bash v1.0 (Stable)
- **Performance**: Good performance (~99ms)
- **Features**: Environment variables, Unix-like systems only
- **Recommended for**: Maximum stability, minimal dependencies

## Configuration Formats

- **JSON** (`claude-statusline.json`) - Editor autocompletion via JSON Schema
- **YAML** (`claude-statusline.yaml`) - More minimal syntax
- Both formats support exactly the same options

## Quick Reference

### Installation Options
```bash
# npm (recommended)
npm install -g claude-statusline

# bun
bun install -g claude-statusline

# manual download
curl -o claude-statusline https://github.com/shrwnsan/claude-statusline/releases/download/v2.0.0/claude-statusline
chmod +x claude-statusline
```

### Common Configurations
```bash
# Minimal setup
cp .claude-statusline.json.example.min ~/.claude/.claude-statusline.json

# Complete setup
cp .claude-statusline.json.example ~/.claude/.claude-statusline.json
```

### Claude Code Integration
```json
{
  "statusLine": {
    "type": "command",
    "command": "claude-statusline"
  }
}
```

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/shrwnsan/claude-statusline/issues)
- **Discussions**: [GitHub Discussions](https://github.com/shrwnsan/claude-statusline/discussions)
- **Documentation**: This directory and the main README

## File Index

- `/` - Project root with main README
- `/docs/` - This documentation directory
- `/docs/CONFIGURATION.md` - Complete configuration guide
- `/docs/MIGRATION.md` - Migration from bash v1.0 to v2.0
- `/docs/FEATURE_COMPARISON.md` - Version comparison and features
- `/docs/README.md` - This documentation overview
- `/.claude-statusline.json.example` - Complete configuration example
- `/.claude-statusline.json.example.min` - Minimal configuration example