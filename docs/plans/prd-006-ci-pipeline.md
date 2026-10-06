# PRD-006: Lean CI pipeline and pre-commit lint hook

**Status**: Approved
**Date**: 2026-10-06
**Related**: PRD-005 (in flight as PR #33), lint baseline inventory below

## Problem

The repository has branch protection on `main` (1 approving review, strict,
PRs required) but **zero required status checks** — merges are validated by
nothing. The result is a 184-finding lint baseline across 9 of 11 src files,
plus a recurring pattern of post-release docs/schema drift in the commit
history. `scripts/verify-build.js` exists but is unwired and timestamp-based
(meaningless on fresh checkouts).

## Baseline inventory (2026-10-06, `eslint -f json` full inventory)

| Finding | Count | Nature |
|---|---|---|
| `no-undef` | 68 | Config bug: eslint never declares Node globals (`console`, `process`, …) |
| `prettier/prettier` | 57 | Formatting drift; no prettier rc anywhere (defaults), single local prettier 3.8.1 |
| `no-unsafe-*` family | 26 | Concentrated in `buildStatusline`/`render`'s `any`-typed `gitInfo`/`envInfo` params and the `Promise<any>[]` operations array — root fix is real types, not suppressions |
| `prefer-nullish-coalescing` | 18 | Split: mechanical (`match()[1] ?? null`, `parseInt(env ?? '')`) vs deliberate falsy-guards that keep `\|\|` with a disable + reason (env-var chains, empty-string fallbacks, `resolveBranch` ternary) |
| `require-await` | 4 | `readInput`, `buildStatusline`, `detectSymbols` (src/ui/symbols.ts), `getTerminalWidth` (src/ui/width.ts) — async by API shape; targeted disable with reason |
| misc (`no-explicit-any` ×3, `no-unused-vars` ×2, `prefer-optional-chain` ×2, `ban-ts-comment` ×1, `no-control-regex` ×1, `no-floating-promises` ×1) | 10 | `no-control-regex` IS the control-char sanitizer (disable + reason); `no-floating-promises` is the bottom-of-file `main()` → `void main()` |

Total: **184 findings** (68 + 57 + 59 type-aware).

## Requirements

1. **Lint baseline reaches zero** via a three-commit chore series, then
   `npm run lint` exits 0 and becomes a gate.
2. **Single-job CI workflow** (`.github/workflows/ci.yml`), triggered on
   `pull_request` and `push` to `main`, running on Node 24:
   `npm ci → npm run lint → npm run build → npm run build:bundle → npm test`.
   Includes `permissions: contents: read` and a `concurrency` group with
   `cancel-in-progress`.
3. **Branch protection gains the CI context** as a required status check,
   preserving `strict: true`, 1 required approving review,
   `enforce_admins: false`.
4. **Versioned pre-commit hook** `.githooks/pre-commit` (POSIX sh): eslint
   `--quiet` on staged `.ts` files; no-op when none staged; opt-in per clone
   via `git config core.hooksPath .githooks` (documented; not husky — the
   maintainer's `~/.npmrc` sets `ignore-scripts=true`, which silently skips
   husky's install).
5. **Portability hygiene**: `bun.lock` added to `.gitignore` (currently hidden
   only by the maintainer's global gitignore; fresh clones see it as untracked
   noise).
6. **Docs**: CONTRIBUTING.md gains CI overview + hook enable step; AGENTS.md
   gains a CI section (agents must run `bun run lint` before pushing).

## Decisions (approved)

- **Fix the baseline, then gate lint** (not warn-only, not lint-less CI).
- **Node 24 runner, single job**: the shipped artifact is
  `bin/claude-statusline` → `#!/usr/bin/env node`; bun is a local dev
  accelerator with an untracked lockfile and no shipped artifacts, so CI
  validates the consumer runtime. A bun job becomes warranted only when a bun
  runtime ships (e.g. compiled bun-single-file release asset).
- **`npm ci`** per the tracked lockfile; `npm test` verified green on Node
  24.21.0 (103 pass / 0 fail; `--experimental-strip-types` accepted on 24).
- **Lint fix policy**: fix properly; keep `||` where it is a deliberate falsy
  guard with a targeted inline disable + reason; no blanket suppressions.
- **Non-goals**: no release automation, no benchmark/perf gate (flaky on
  shared runners), no coverage tooling, no commit-msg hook (commit history is
  already conventionally formatted), no Node version matrix (engines floor
  22.6 stays untested for now; matrix is a one-line future extension).

## Mockup

```yaml
# .github/workflows/ci.yml (shape)
name: CI
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run build:bundle
      - run: npm test
```

```sh
# .githooks/pre-commit (shape)
#!/bin/sh
# Opt in: git config core.hooksPath .githooks
staged=$(git diff --cached --name-only --diff-filter=ACMR -- '*.ts')
[ -z "$staged" ] && exit 0
exec npx --no-install eslint --quiet $staged
```

## Testing the tooling

1. Hook: stage a deliberately violating `.ts` fixture → hook exits non-zero;
   remove fixture, re-stage real changes → passes. (Fixture never committed.)
2. Workflow: green run on this PR (and stable on PR #33's branch order — the
   prettier-reflowed files are disjoint from PR #33's `src/index.ts` /
   `tests/segments.test.ts` changes, so no conflict either merge order).
3. Gate: wire the required context via `gh api` (GET current protection →
   merge contexts → PUT), then confirm the check appears on the next PR.

## Verification

`npm run lint` exits 0 locally; workflow green on GitHub; required check
present in branch protection; `git status` clean of new untracked noise on a
simulated fresh clone perspective (`bun.lock` ignored).
