# Claude Statusline Documentation

**Last Updated:** 2026-02-11
**Version:** 2.0.0

Comprehensive documentation for the Claude Code statusline tool.

## Documentation Structure

```
docs/
├── README.md              # This file - main documentation entry point
├── guides/                # User-facing guides and how-to documentation
├── ref/                   # Technical reference and architecture
└── plans/                 # Research, evaluations, and planning docs
```

## Quick Navigation

| For... | Go To |
|--------|-------|
| **New users** | [Main Project README](../README.md) |
| **Configuration** | [Configuration Guide](guides/guide-01-configuration.md) |
| **Troubleshooting** | [Troubleshooting Guide](guides/guide-02-troubleshooting.md) |
| **Migration from v1** | [Migration Guide](guides/MIGRATION.md) |
| **Performance tuning** | [Performance Guide](guides/guide-03-performance.md) |
| **Architecture** | [Architecture Doc](ref/ARCHITECTURE.md) |
| **Feature comparison** | [Feature Comparison](ref/FEATURE_COMPARISON.md) |

---

## Guides (`guides/`)

User-facing documentation with step-by-step instructions.

| Document | Description |
|----------|-------------|
| [guide-01-configuration.md](guides/guide-01-configuration.md) | Complete configuration options and examples |
| [guide-02-troubleshooting.md](guides/guide-02-troubleshooting.md) | Common issues and solutions |
| [guide-03-performance.md](guides/guide-03-performance.md) | Performance optimization and benchmarks |
| [MIGRATION.md](guides/MIGRATION.md) | Migrating from bash v1.0 to TypeScript v2.0 |

---

## Reference (`ref/`)

Technical documentation and architecture.

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ref/ARCHITECTURE.md) | System architecture and design decisions |
| [FEATURE_COMPARISON.md](ref/FEATURE_COMPARISON.md) | Detailed comparison between versions |

---

## Plans (`plans/`)

Research, evaluations, and project planning.

| Document | Type | Description |
|----------|------|-------------|
| [eval-001-terminal-widths.md](plans/eval-001-terminal-widths.md) | Evaluation | Terminal width behavior analysis |
| [eval-002-comprehensive-code-review.md](plans/eval-002-comprehensive-code-review.md) | Evaluation | Comprehensive code review (7.5/10) |
| [prd-01-typescript-perf-optimization.md](plans/prd-01-typescript-perf-optimization.md) | PRD | TypeScript performance optimization requirements |
| [prd-02-vpn-cross-platform-support.md](plans/prd-02-vpn-cross-platform-support.md) | PRD | VPN indicator Linux/WSL support |
| [research-01-sandbox-detection.md](plans/research-01-sandbox-detection.md) | Research | Sandbox detection mechanisms |
| [research-02-competitive-analysis.md](plans/research-02-competitive-analysis.md) | Research | Competitive landscape analysis |
| [research-03-platform-analysis.md](plans/research-03-platform-analysis.md) | Research | Platform compatibility analysis |
| [tasks-02-vpn-cross-platform-support.md](plans/tasks-02-vpn-cross-platform-support.md) | Tasks | Implementation tasks for PRD-02 |

---

## Quick Start

### Installation

```bash
# Bun install (recommended - 5x faster than Node.js)
bun install -g claude-statusline

# Or npm install
npm install -g claude-statusline
```

### Configuration

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

---

## Version Information

### TypeScript v2.0 (Current Stable)
- **Performance**: ~5ms with Bun runtime, ~28ms with Node.js runtime
- **Features**: Configuration files, Windows support, npm distribution
- **Recommended for**: New users, Windows users, performance-critical setups

### Bash v1.0 (Legacy)
- **Performance**: ~99ms
- **Features**: Environment variables, Unix-like systems only
- **Recommended for**: Maximum stability, minimal dependencies

---

## Getting Help

| Resource | Link |
|----------|------|
| **Issues** | [GitHub Issues](https://github.com/shrwnsan/claude-statusline/issues) |
| **Discussions** | [GitHub Discussions](https://github.com/shrwnsan/claude-statusline/discussions) |
| **Contributing** | [CONTRIBUTING.md](../CONTRIBUTING.md) |

---

## Contributing to Documentation

When adding new documentation, follow the naming conventions:

**Pattern**: `prefix-{nnn}-{title}.md` (3-digit incrementing integer, e.g., `prd-002-vpn-support.md`)

| Prefix | Purpose | Example |
|--------|---------|---------|
| `guide-` | How-to guides | `guides/guide-004-advanced-config.md` |
| `eval-` | Evaluation reports | `plans/eval-003-security-audit.md` |
| `prd-` | Requirements | `plans/prd-002-windows-support.md` |
| `research-` | Research findings | `plans/research-004-new-features.md` |
| `retro-` | Retrospectives | `plans/retro-001-v2-release.md` |
| `tasks-` | Implementation tasks | `plans/tasks-002-feature-implementation.md` |

See [guide-006-doc-organization.md](https://github.com/shrwnsan/shrwnsan/blob/main/.dotfiles/docs/guides/guide-006-doc-organization.md) for full documentation patterns.
