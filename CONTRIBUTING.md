# Contributing to Claude Statusline

Thank you for your interest in contributing to Claude Statusline! This guide will help you get started with development, testing, and submitting changes.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Performance Guidelines](#performance-guidelines)
- [Security Considerations](#security-considerations)

## Getting Started

### Prerequisites

- **Node.js >= 18.0.0** (for TypeScript development)
- **Git** (for version control)
- **A terminal with Nerd Font support** (for testing symbol rendering)

### Setup Development Environment

1. **Fork and Clone** the repository:
   ```bash
   git clone https://github.com/your-username/claude-statusline.git
   cd claude-statusline
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Build the Project**:
   ```bash
   npm run build
   ```

4. **Verify Setup**:
   ```bash
   # Test the build
   echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | node dist/index.js

   # Run tests
   npm test
   ```

### Project Structure

```
claude-statusline/
├── src/                    # TypeScript source code
├── tests/                  # Test files
├── scripts/                # Development utilities
├── docs/                   # Documentation
└── dist/                   # Compiled JavaScript (generated)
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- **Follow the existing code style** and patterns
- **Add tests** for new functionality
- **Update documentation** if needed
- **Keep changes focused** and atomic

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/security.test.ts

# Build and test manually
npm run build
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"}}' | ./bin/claude-statusline
```

### 4. Performance Testing

```bash
# Quick benchmark
npm run benchmark -- --quick

# Full benchmark suite
npm run benchmark
```

### 5. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature description"

# Use conventional commits:
# feat: new feature
# fix: bug fix
# docs: documentation changes
# style: formatting changes
# refactor: code refactoring
# test: adding or updating tests
# chore: maintenance tasks
```

### 6. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub with:
- **Clear title** describing the change
- **Detailed description** explaining what and why
- **Link to relevant issues**
- **Screenshots** if applicable (for UI changes)

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test pattern
npm test tests/security.test.ts
```

### Writing Tests

**Test Structure**:
```typescript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('Your Module', () => {
  beforeEach(() => {
    // Setup code
  });

  it('should handle basic case', () => {
    // Test implementation
    assert.strictEqual(result, expected);
  });
});
```

### Test Categories

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test module interactions
3. **Security Tests**: Test input validation and edge cases
4. **Performance Tests**: Benchmark critical operations

### Test Coverage Goals

- **Core modules**: >90% coverage
- **Security functions**: 100% coverage
- **Main functionality**: >80% coverage

## Code Style

### TypeScript Guidelines

1. **Use strict TypeScript settings**
2. **Prefer explicit types** over implicit `any`
3. **Use interfaces** for object shapes
4. **Follow existing naming conventions**

### Code Formatting

```bash
# Format code
npm run format

# Check linting
npm run lint
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `git-status.ts`)
- **Classes**: `PascalCase` (e.g., `GitOperations`)
- **Functions/Variables**: `camelCase` (e.g., `getGitInfo`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_INPUT_LENGTH`)

### Documentation

```typescript
/**
 * Brief description of the function.
 *
 * @param param1 - Description of parameter 1
 * @param param2 - Description of parameter 2
 * @returns Description of return value
 * @throws {Error} Description of when it throws
 */
function exampleFunction(param1: string, param2: number): boolean {
  // Implementation
}
```

## Submitting Changes

### Pull Request Checklist

Before submitting a pull request, ensure:

- [ ] **Code follows style guidelines**
- [ ] **Tests pass** (`npm test`)
- [ ] **Build succeeds** (`npm run build`)
- [ ] **Documentation is updated**
- [ ] **Performance impact is considered**
- [ ] **Security implications are reviewed**
- [ ] **Commit messages are conventional**

### Pull Request Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Performance
- [ ] No performance regression
- [ ] Benchmark results (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
```

## Performance Guidelines

### Performance Targets

- **Total execution time**: <50ms (target for v2.0)
- **Git operations**: <30ms
- **Environment detection**: <20ms
- **Memory usage**: Minimal footprint

### Optimization Techniques

1. **Use native JavaScript** methods when possible
2. **Minimize async operations** in critical paths
3. **Use efficient data structures** (Maps, Sets)
4. **Cache expensive operations** appropriately
5. **Avoid unnecessary string operations**

### Performance Testing

```bash
# Benchmark current changes
npm run benchmark

# Compare with baseline
npm run benchmark -- --compare

# Profile memory usage
node --prof dist/index.js
```

## Security Considerations

### Security Review Checklist

Before submitting changes, review for:

- [ ] **Input validation** is comprehensive
- [ ] **Command injection** protection is maintained
- [ ] **Path traversal** prevention is intact
- [ ] **Buffer overflow** protection exists
- [ ] **Error handling** doesn't leak sensitive information
- [ ] **Dependencies** are secure and up-to-date

### Security Best Practices

1. **Validate all inputs** with Zod schemas
2. **Sanitize outputs** before display
3. **Use parameterized commands** for shell execution
4. **Implement rate limiting** if applicable
5. **Follow principle of least privilege**

### Reporting Security Issues

If you discover a security vulnerability:

1. **Do not open a public issue**
2. **Send a detailed report** to: security@example.com
3. **Include steps to reproduce** the vulnerability
4. **Allow time** to address the issue before disclosure

## Getting Help

### Resources

- **GitHub Issues**: [Report bugs or request features](https://github.com/shrwnsan/claude-statusline/issues)
- **Discussions**: [General questions and ideas](https://github.com/shrwnsan/claude-statusline/discussions)
- **Documentation**: [Architecture details](./ARCHITECTURE.md)

### Development Commands

```bash
# Development workflow
npm run dev          # Build with watch mode
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Check code style
npm run format       # Format code
npm run benchmark    # Performance tests
```

## Release Process

Maintainers follow this process for releases:

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with changes
3. **Run full test suite**
4. **Create release tag**
5. **Publish to npm** (if applicable)
6. **Create GitHub release**

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (Apache 2.0).

---

Thank you for contributing to Claude Statusline! Your contributions help make this project better for everyone.