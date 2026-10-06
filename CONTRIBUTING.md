# Contributing to Claude Statusline

Thank you for your interest in contributing! This is a small CLI utility, so contributions are typically simple and focused.

## Quick Start

```bash
# Clone and setup
git clone https://github.com/shrwnsan/claude-statusline.git
cd claude-statusline
npm install

# Run tests
npm test

# Build
npm run build
```

## How to Contribute

### Report Bugs
- Open an issue with:
  - What happened
  - What you expected
  - Your OS and terminal
  - Any error messages

### Suggest Features
- Open an issue with:
  - Clear description of the feature
  - Why it would be useful
  - Your use case

### Submit Changes
1. Fork the repository
2. Create a branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Push and open a PR

## Guidelines

- Keep changes small and focused
- Follow the existing code style
- Add tests for new functionality
- Update documentation if needed

## CI

Every pull request runs a single Node 24 job (`.github/workflows/ci.yml`):
`npm ci` → `npm run lint` → `npm run build` → `npm run build:bundle` → `npm test`.
The job is a required status check on `main` — PRs cannot merge red.

### Pre-commit hook (optional)

Lint staged TypeScript files before each commit (takes ~1s):

```sh
git config core.hooksPath .githooks
```

The hook runs eslint only on files you actually staged, so it never blocks
unrelated work. It is opt-in per clone; CI remains the enforcement layer.

## License

By contributing, you agree to license your work under the same [Apache 2.0](./LICENSE) license.