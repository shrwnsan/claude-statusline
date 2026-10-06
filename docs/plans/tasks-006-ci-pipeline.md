# PRD-006 CI Pipeline + Lint Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zero-out the 184-finding lint baseline, then gate it with a single-job Node 24 GitHub Actions workflow, a versioned pre-commit hook, and a required status check on `main`.

**Architecture:** Three chore commits empty the lint baseline (eslint Node globals config, prettier reflow, case-by-case type-aware fixes with a per-site decision table), then one commit adds `.github/workflows/ci.yml` + `.gitignore` hygiene, one adds `.githooks/pre-commit` + docs. Branch protection is wired via `gh api` only after the first green run. Edits in Task 4 are anchored to code snippets, not line numbers, because Task 3's prettier reflow shifts lines.

**Tech Stack:** eslint 9 (flat config), prettier 3.8.1 (defaults, no rc), `node --test`, GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`), POSIX sh hook.

**Spec:** `docs/plans/prd-006-ci-pipeline.md`

---

### Task 1: Worktree setup and spec/plan commit

**Files:**
- Create: `.worktrees/feat/ci-pipeline/` (worktree root, branch `feat/ci-pipeline`)
- Copy into worktree: `docs/plans/prd-006-ci-pipeline.md`, `docs/plans/tasks-006-ci-pipeline.md`

- [ ] **Step 1: Create the worktree on the feat branch** (`.worktrees` is already excluded via `.git/info/exclude`)

```bash
cd ~/Developer/personal/claude-statusline
git worktree add .worktrees/feat/ci-pipeline -b feat/ci-pipeline
cp docs/plans/prd-006-ci-pipeline.md docs/plans/tasks-006-ci-pipeline.md \
  .worktrees/feat/ci-pipeline/docs/plans/
```

Expected: new branch from current `main` HEAD; two files copied.

- [ ] **Step 2: Commit the docs**

```bash
cd .worktrees/feat/ci-pipeline
git add docs/plans/prd-006-ci-pipeline.md docs/plans/tasks-006-ci-pipeline.md
git commit -m "docs(plans): add prd-006 CI pipeline spec and tasks

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

### Task 2: Declare Node globals in eslint config (kills 68 `no-undef`)

**Files:**
- Modify: `eslint.config.js`
- Modify: `package.json` + `package-lock.json` (new devDep)

- [ ] **Step 1: Record the current error count**

```bash
cd ~/Developer/personal/claude-statusline/.worktrees/feat/ci-pipeline
npx eslint "src/**/*.ts" 2>&1 | grep -cE "error" || true
```

Expected: a large number (~150 error lines). This is the before-value.

- [ ] **Step 2: Install `globals` as an exact devDependency**

```bash
npm install --save-dev --save-exact globals
```

Expected: `package.json` gains `"globals": "16.x.x"` in devDependencies (exact version), lockfile updated.

- [ ] **Step 3: Wire globals + tuned no-unused-vars into the flat config**

In `eslint.config.js`, replace the import block (lines 1-5):

```js
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
```

with:

```js
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
```

Inside the `files: ['**/*.ts']` config object, extend `languageOptions`:

```js
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: globals.node,
    },
```

Replace the two `no-unused-vars` / unused-var lines in `rules`:

```js
      '@typescript-eslint/no-unused-vars': 'error',
```

with:

```js
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
```

(The `^_` patterns are standard for intentionally-unused params like `width.ts`'s `_config`.)

- [ ] **Step 4: Verify the no-undef count drops to zero and nothing else regressed**

```bash
npx eslint "src/**/*.ts" -f json 2>/dev/null | node -e "
const rs = JSON.parse(require('fs').readFileSync(0,'utf8'));
let undef = 0, other = 0;
for (const r of rs) for (const m of r.messages) {
  if (m.ruleId === 'no-undef') undef++;
  else if (m.ruleId !== 'prettier/prettier') other++;
}
console.log('no-undef:', undef, '| other type-aware:', other);"
```

Expected: `no-undef: 0 | other type-aware: 59` (same 59 as the PRD inventory — only no-undef disappears).

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js package.json package-lock.json
git commit -m "chore(lint): declare Node globals, tune no-unused-vars ignore pattern

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

### Task 3: Prettier reflow (kills 57 `prettier/prettier`)

**Files:**
- Modify: 9 files under `src/` (formatting only — cache, config, security, env/context, git/native, git/status, ui/symbols, ui/width, utils/runtime)

- [ ] **Step 1: Reflow with the local prettier (defaults, matching the eslint plugin's resolver)**

```bash
npx prettier --write src/
```

Expected: lists ~9 reformatted files (console.* line-wrapping reflows).

- [ ] **Step 2: Verify zero prettier findings remain and tests still pass**

```bash
npx eslint "src/**/*.ts" -f json 2>/dev/null | node -e "
const rs = JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('prettier findings:', rs.flatMap(r => r.messages).filter(m => m.ruleId === 'prettier/prettier').length);"
npm run build > /dev/null 2>&1 && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

Expected: `prettier findings: 0`; `tests 103 / pass 103 / fail 0` (formatting must not change behavior).

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "style: apply prettier defaults across src

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

### Task 4: Type-aware fixes (kills the remaining 59)

Edits are anchored to code snippets — Task 3 moved lines. After all edits, the residual inventory one-liner (Step 10) must print zeros. Policy: fix at the root where a type exists; keep `||` where empty-string/falsy handling is deliberate, with a targeted disable + reason; no blanket suppressions.

**Files:**
- Modify: `src/index.ts`, `src/core/config.ts`, `src/core/cache.ts`, `src/core/security.ts`, `src/git/native.ts`, `src/utils/runtime.ts`, `src/ui/width.ts`, `src/ui/symbols.ts`, `src/env/context.ts`

- [ ] **Step 1: `src/index.ts` — root-cause the `any` cluster (types + Promise.all restructure)**

Add type imports — current:

```ts
import { GitOperations } from './git/status.js';
```

becomes:

```ts
import { GitOperations } from './git/status.js';
import type { GitInfo } from './git/status.js';
```

and current:

```ts
import { EnvironmentDetector, EnvironmentFormatter } from './env/context.js';
```

becomes:

```ts
import { EnvironmentDetector, EnvironmentFormatter } from './env/context.js';
import type { EnvironmentInfo } from './env/context.js';
```

In `buildStatusline`'s params, replace:

```ts
  gitInfo: any;
  envInfo: any;
```

with:

```ts
  gitInfo: GitInfo | null;
  envInfo: EnvironmentInfo | null;
```

In `render()`, replace the operations block:

```ts
  const operations: Promise<any>[] = [
    gitOps.getGitInfo(fullDir, sessionId),
    envDetector.getEnvironmentInfo(),
    detectSymbols(config),
  ];

  let terminalWidth: number | undefined;
  if (config.truncate) {
    operations.push(getTerminalWidth(config));
  }

  const results = await Promise.all(operations);
  const [gitInfo, envInfo, symbols] = results;

  if (config.truncate && results.length > 3) {
    terminalWidth = results[3];
  }
```

with a fixed-arity `Promise.all` that infers real types:

```ts
  const [gitInfo, envInfo, symbols, terminalWidth] = await Promise.all([
    gitOps.getGitInfo(fullDir, sessionId),
    envDetector.getEnvironmentInfo(),
    detectSymbols(config),
    config.truncate ? getTerminalWidth(config) : Promise.resolve(undefined),
  ]);
```

(`terminalWidth` is then `number | undefined`; the existing `...(terminalWidth && { terminalWidth })` spread still compiles. This kills the `Promise<any>[]`, the unsafe array destructuring, and the `results[3]` indexing in one move.)

In `readInput()`, replace:

```ts
    const parsed = JSON.parse(trimmed);
```

with:

```ts
    const parsed: unknown = JSON.parse(trimmed);
```

- [ ] **Step 2: `src/index.ts` — deliberate-falsy keeps with reasons, mechanical fixes**

In `formatProjectSlot`, replace:

```ts
  const dirname = p.currentDir.split('/').pop() || p.currentDir.split('\\').pop() || 'project';
```

with:

```ts
  // `||` is deliberate: a trailing separator yields an empty-string segment
  // that must fall through to the next candidate (?? would keep '').
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const dirname = p.currentDir.split('/').pop() || p.currentDir.split('\\').pop() || 'project';
```

In `resolveBranch`, replace:

```ts
  return p.worktreeBranch ? p.worktreeBranch : p.gitBranch; // PRD-004 B1; `?` guards empty string
```

with:

```ts
  // Ternary is deliberate: an empty-string branch must fall through to the
  // parent branch (?? would keep '').
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return p.worktreeBranch ? p.worktreeBranch : p.gitBranch; // PRD-004 B1; `?` guards empty string
```

In `formatModes`, replace:

```ts
  if (m.vim && m.vim.mode) t.push(m.vim.mode.charAt(0));
```

with:

```ts
  if (m.vim?.mode) t.push(m.vim.mode.charAt(0));
```

Above `async function readInput()` add:

```ts
// eslint-disable-next-line @typescript-eslint/require-await -- async for stdin API symmetry with main(); body is sync readFileSync today
```

Above `async function buildStatusline(` add:

```ts
// eslint-disable-next-line @typescript-eslint/require-await -- Promise-shaped API: all current formatters are sync, call sites await uniformly
```

At the bottom of the file, replace:

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

with:

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  void main(); // errors are handled inside main(); top-level fire-and-forget
}
```

- [ ] **Step 3: `src/core/config.ts` + `src/core/cache.ts`**

In `loadConfigFile` (both the parent-walk and `~/.claude/` loops), replace:

```ts
          return filename.endsWith('.json') ? JSON.parse(content) : parseYaml(content);
```

with (both occurrences — `replace_all`):

```ts
          return (filename.endsWith('.json') ? JSON.parse(content) : parseYaml(content)) as Partial<Config>;
```

In `ensureCacheDir`, replace:

```ts
    } catch (error) {
      // Directory might already exist or we can't create it
      console.warn('[WARNING] Failed to create cache directory:', this.config.cacheDir);
    }
```

with (optional catch binding — the error value is intentionally unused):

```ts
    } catch {
      // Directory might already exist or we can't create it
      console.warn('[WARNING] Failed to create cache directory:', this.config.cacheDir);
    }
```

- [ ] **Step 4: `src/core/security.ts`**

Replace:

```ts
  const quoteCount = (cleanedInput.match(/"/g) || []).length;
```

with (match returns the array or `null` — `??` is exactly the right operator):

```ts
  const quoteCount = (cleanedInput.match(/"/g) ?? []).length;
```

Above the sanitizer, replace:

```ts
  // Remove control characters except common safe ones
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
```

with (the control characters are the entire point of this sanitizer):

```ts
  // Remove control characters except common safe ones
  // eslint-disable-next-line no-control-regex -- matching control characters is this sanitizer's purpose
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
```

- [ ] **Step 5: `src/git/native.ts`**

Replace the stream handlers:

```ts
    git.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    git.stderr.on('data', (data) => {
      stderr += data.toString();
    });
```

with (explicit `Buffer` type removes the implicit-`any` unsafe calls):

```ts
    git.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    git.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
```

Replace the spawn options:

```ts
      cwd: options.cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeout || 5000,
```

with (both `||` are deliberate: empty-string cwd and 0 timeout must fall back to defaults):

```ts
      // `||` is deliberate: '' cwd and 0 timeout must fall back to defaults.
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      cwd: options.cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      timeout: options.timeout || 5000,
```

- [ ] **Step 6: `src/utils/runtime.ts` — one edit kills five findings**

Replace the Bun detection block:

```ts
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis) {
    // @ts-ignore - Bun is a global when running in Bun runtime
    const bunVersion = (globalThis as any).Bun?.version || 'unknown';
```

with (a structural cast removes the `any`, the unsafe assignment, the unsafe member access, the `@ts-ignore`, and `||` → `??` is safe because a present-but-empty version is not a real case):

```ts
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis) {
    const bunVersion = (globalThis as { Bun?: { version?: string } }).Bun?.version ?? 'unknown';
```

Replace the Node check:

```ts
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
```

with:

```ts
  if (typeof process !== 'undefined' && process.versions?.node) {
```

Replace the version parse:

```ts
    const majorVersion = parseInt(version.split('.')[0] || '0');
```

with:

```ts
    const majorVersion = parseInt(version.split('.')[0] ?? '0');
```

- [ ] **Step 7: `src/ui/width.ts`**

Above `export async function getTerminalWidth(` add:

```ts
// eslint-disable-next-line @typescript-eslint/require-await -- Promise-shaped API shared with the render() operations array
```

Replace inside `getTerminalWidth`:

```ts
  const columnsEnv = parseInt(process.env.COLUMNS || '', 10);
```

with (both `undefined` and `''` yield NaN in `parseInt`, so `??` is behavior-identical):

```ts
  const columnsEnv = parseInt(process.env.COLUMNS ?? '', 10);
```

In `debugWidthDetection`, replace:

```ts
  console.error(`[WIDTH DEBUG] CLAUDE_CODE_STATUSLINE_FORCE_WIDTH: ${config.forceWidth || 'not set'}`);
  console.error(`[WIDTH DEBUG] COLUMNS variable: ${columnsEnv || 'not set'}`);
```

with (debug-only output; `??` is acceptable cosmetic behavior):

```ts
  console.error(`[WIDTH DEBUG] CLAUDE_CODE_STATUSLINE_FORCE_WIDTH: ${config.forceWidth ?? 'not set'}`);
  console.error(`[WIDTH DEBUG] COLUMNS variable: ${columnsEnv ?? 'not set'}`);
```

Replace inside `smartTruncate`:

```ts
    indicators = bracketMatch[1] || '';
```

with (a matched `[^]]+` group is never empty; `??` handles only the `undefined` case):

```ts
    indicators = bracketMatch[1] ?? '';
```

(`_config` in `smartTruncate` is covered by the Task 2 `argsIgnorePattern`.)

- [ ] **Step 8: `src/ui/symbols.ts` + `src/env/context.ts`**

Above `export async function detectSymbols(` add:

```ts
// eslint-disable-next-line @typescript-eslint/require-await -- Promise-shaped API shared with the render() operations array
```

In `env/context.ts`, replace all three version-extraction returns (python3, python, docker — identical shape):

```ts
          return versionMatch[1] || null;
```

with (`\d+` groups are never empty when matched; `??` handles only `undefined`):

```ts
          return versionMatch[1] ?? null;
```

Replace in `getShellEnvironment`:

```ts
    const shell = process.env.SHELL || 'unknown';
```

with (env-var convention: empty string means unset and must fall back):

```ts
    // `||` is deliberate: an empty SHELL env var means unset and must fall back.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const shell = process.env.SHELL || 'unknown';
```

Replace in `getOSInfo`:

```ts
    const release = process.env.OSTYPE || process.env.OS;
```

with (deliberate env-var chain: an empty OSTYPE should still consult OS):

```ts
    // `||` is deliberate: empty OSTYPE must fall through to OS.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const release = process.env.OSTYPE || process.env.OS;
```

- [ ] **Step 9: Build, test, and typecheck the refactored code**

```bash
npm run build > /dev/null 2>&1 && echo "BUILD OK" && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

Expected: `BUILD OK`, `tests 103 / pass 103 / fail 0`. The param typing and Promise.all restructure must not change behavior.

- [ ] **Step 10: Verify the residual inventory is zero**

```bash
npx eslint "src/**/*.ts" -f json 2>/dev/null | node -e "
const rs = JSON.parse(require('fs').readFileSync(0,'utf8'));
const rest = rs.flatMap(r => r.messages).filter(m => m.ruleId !== 'prettier/prettier');
for (const m of rest) console.log(m.ruleId, m.line, m.message.slice(0,60));
console.log('remaining type-aware findings:', rest.length);"
```

Expected: `remaining type-aware findings: 0`. If any remain, they are new sites exposed by the restructure — apply the same policy (root fix, or disable with reason) until zero.

- [ ] **Step 11: Commit**

```bash
git add src/
git commit -m "fix(lint): resolve all type-aware findings; zero lint baseline

Root fixes: typed buildStatusline params (GitInfo/EnvironmentInfo), fixed-arity
Promise.all in render(), unknown-typed JSON.parse, Buffer stream params,
structural cast for Bun detection. Deliberate falsy-guards keep || with
targeted disables and reasons.

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

### Task 5: CI workflow + gitignore hygiene

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `.gitignore` (append `bun.lock`)

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
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
        with:
          node-version: 24
          cache: npm

      - name: Install
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build (tsc)
        run: npm run build

      - name: Build (esbuild bundle)
        run: npm run build:bundle

      - name: Test
        run: npm test
```

- [ ] **Step 2: Append `bun.lock` to `.gitignore`** (npm `package-lock.json` is canonical; `bun.lock` is a local accelerator artifact hidden only by the maintainer's global gitignore today)

```bash
printf '\n# Bun local lockfile (package-lock.json is canonical)\nbun.lock\n' >> .gitignore
```

- [ ] **Step 3: Sanity-run the exact CI sequence locally**

```bash
rm -rf node_modules && npm ci > /dev/null 2>&1 && npm run lint && npm run build > /dev/null 2>&1 && npm run build:bundle > /dev/null 2>&1 && npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```

Expected: lint silent (exit 0), `pass 103 / fail 0`. This is precisely what CI will execute.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .gitignore
git commit -m "ci: single-job Node 24 workflow (lint, build, bundle, test)

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

### Task 6: Pre-commit hook + docs

**Files:**
- Create: `.githooks/pre-commit` (executable)
- Modify: `CONTRIBUTING.md`, `AGENTS.md`

- [ ] **Step 1: Create `.githooks/pre-commit`**

```sh
#!/bin/sh
# Pre-commit: lint staged TypeScript files only.
# Opt in per clone: git config core.hooksPath .githooks
# (Not husky: husky's postinstall is skipped when npm ignore-scripts=true.)

staged=$(git diff --cached --name-only --diff-filter=ACMR -- '*.ts')
[ -z "$staged" ] && exit 0

printf '%s\n' "$staged" | xargs npx --no-install eslint --quiet
```

Then make it executable:

```bash
chmod +x .githooks/pre-commit
```

- [ ] **Step 2: CONTRIBUTING.md — hook step in Quick Start and a CI section**

In the Quick Start code block, after the `npm install` line (keeping the block shape), no change is needed — instead insert a new section between `## Guidelines` and `## License`:

```markdown
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
```

- [ ] **Step 3: AGENTS.md — CI section for agents, plus the `bash -n` correction**

Insert a new subsection at the end of the `### Debug and Development Commands` block:

```markdown
# CI gate (mirrors .github/workflows/ci.yml — PRs cannot merge red)
npm ci && npm run lint && npm run build && npm run build:bundle && npm test
```

In `### Script Modification Protocol`, replace the first verification step:

```markdown
# 1. Syntax validation
bash -n ./claude-statusline.sh
```

with:

```markdown
# 1. Syntax validation (bin wrapper is a Node ESM script, not bash)
node --check ./bin/claude-statusline
```

Insert a short section after `### Script Modification Protocol`:

```markdown
### CI Requirements
- `npm run lint` must exit 0 before pushing — the CI job gates `main` as a
  required status check.
- The pre-commit hook (`.githooks/pre-commit`, opt-in via
  `git config core.hooksPath .githooks`) lints staged `.ts` files only.
- CI runs on Node 24 (the shipped runtime; `bin/claude-statusline` is
  `#!/usr/bin/env node`). Bun remains the local dev accelerator.
```

- [ ] **Step 4: Commit**

```bash
git add .githooks/pre-commit CONTRIBUTING.md AGENTS.md
git commit -m "chore(hooks): versioned pre-commit eslint hook; document CI in CONTRIBUTING and AGENTS

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

### Task 7: Hook verification and full local gate

No file changes — verification only. Run from the worktree root.

- [ ] **Step 1: Opt in to the hook and verify it lints staged files**

```bash
git config core.hooksPath .githooks
```

- [ ] **Step 2: Deliberate violation must be rejected**

```bash
printf 'const x: number = 1\nconst y = x  \n' > src/hook-fixture.ts
git add src/hook-fixture.ts
git commit -m "test: hook fixture (must fail)" 2>&1 | tail -5
```

Expected: commit aborted; eslint output shows errors for `hook-fixture.ts` (e.g. `@typescript-eslint/no-unused-vars` for `y`, prettier spacing). If the commit succeeds, the hook is NOT wired — stop and fix `core.hooksPath`.

- [ ] **Step 3: Clean exit when nothing TS is staged**

```bash
git reset src/hook-fixture.ts > /dev/null
trash src/hook-fixture.ts
printf 'x' > /tmp/non-ts.txt && git add /tmp/non-ts.txt 2>/dev/null
git commit -m "chore: non-ts fixture (hook must no-op)" 2>&1 | tail -2; git reset HEAD > /dev/null 2>&1; trash /tmp/non-ts.txt
```

Expected: no lint output from the hook path (empty stage list → `exit 0`). (If the commit itself is blocked for other reasons — e.g. identity — that is fine; the hook's silence is what is under test. Verify with `git diff --cached --name-only --diff-filter=ACMR -- '*.ts' | wc -l` printing `0`.)

- [ ] **Step 4: Full gate, exactly as CI runs it**

```bash
npm ci > /dev/null 2>&1 && npm run lint && echo "LINT: exit 0" && npm run build > /dev/null 2>&1 && npm run build:bundle > /dev/null 2>&1 && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
```

Expected: `LINT: exit 0`, `tests 103 / pass 103 / fail 0`.

- [ ] **Step 5: Confirm the worktree tree is clean**

```bash
git status --short
```

Expected: empty (fixture removed, hook config is local-only `.git/config`, not a file change).

---

### Task 8: Push, PR, green run, branch-protection wiring

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin feat/ci-pipeline
gh pr create --title "ci: lint gate, Node 24 workflow, pre-commit hook (PRD-006)" --body "$(cat <<'EOF'
## Summary

Empties the pre-existing lint baseline (184 findings across 9 src files: 68 no-undef from undeclared Node globals, 57 prettier drift, 59 type-aware findings), then makes lint a hard gate. Adds a single-job Node 24 GitHub Actions workflow (npm ci → lint → build → bundle → test), a versioned opt-in pre-commit eslint hook (`.githooks` + `core.hooksPath`, no husky — maintainer runs `ignore-scripts=true`), `bun.lock` gitignore hygiene, CONTRIBUTING/AGENTS.md documentation, and — after a green run — wires the job as a required status check on `main` (protection currently has strict:true with zero required contexts).

Root fixes over suppressions: typed `buildStatusline` params (`GitInfo`/`EnvironmentInfo`), fixed-arity `Promise.all` in `render()`, `unknown`-typed `JSON.parse`, `Buffer` stream params, structural cast for Bun detection. Deliberate falsy-guards (`||` on env vars and empty-string fallbacks) keep their semantics with targeted disables and reasons.

Spec: `docs/plans/prd-006-ci-pipeline.md`, plan: `docs/plans/tasks-006-ci-pipeline.md`.

## Test Plan

- [x] Residual lint inventory: 0 findings (`eslint -f json` one-liner)
- [x] `npm ci && npm run lint && npm run build && npm run build:bundle && npm test` — 103 pass / 0 fail locally
- [x] Pre-commit hook: staged violation rejected, non-TS stage no-ops, clean tree passes
- [ ] Green CI run on this PR
- [ ] Required context wired on `main` (preserving strict:true, 1 review, enforce_admins:false)
EOF
)"
```

Then append the generator trailer per house rules:

```bash
gh pr view --json body -q .body > /tmp/prbody6.txt
printf '\n🤖 Generated by Claude Code - GLM 5.3 Flash\n' >> /tmp/prbody6.txt
gh pr edit --body-file /tmp/prbody6.txt
```

- [ ] **Step 2: Wait for the first green run**

```bash
gh pr checks --watch 2>&1 | tail -3
```

Expected: the single `ci` check concludes `pass`. On failure: `gh run view <id> --log-failed`, fix, push — repeat until green.

- [ ] **Step 3: Wire the required status check (needs the exact check name from Step 2)**

```bash
gh api repos/shrwnsan/claude-statusline/branches/main/protection > /tmp/prot.json
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('/tmp/prot.json', 'utf8'));
const ctx = p.required_status_checks.contexts || [];
if (!ctx.includes('ci')) ctx.push('ci');
fs.writeFileSync('/tmp/prot-put.json', JSON.stringify({
  required_status_checks: { strict: p.required_status_checks.strict, contexts: ctx },
  enforce_admins: p.enforce_admins.enabled,
  required_pull_request_reviews: {
    dismiss_stale_reviews: p.required_pull_request_reviews.dismiss_stale_reviews,
    require_code_owner_reviews: p.required_pull_request_reviews.require_code_owner_reviews,
    required_approving_review_count: p.required_pull_request_reviews.required_approving_review_count,
    require_last_push_approval: p.required_pull_request_reviews.require_last_push_approval || false,
  },
  restrictions: null,
  required_conversation_resolution: p.required_conversation_resolution?.enabled || false,
}));
"
gh api -X PUT repos/shrwnsan/claude-statusline/branches/main/protection --input /tmp/prot-put.json > /dev/null && echo "protection updated"
gh api repos/shrwnsan/claude-statusline/branches/main/protection -q '.required_status_checks' 
```

Expected: `protection updated`, then JSON showing `"contexts":["ci"]` with `"strict":true` preserved. (The check name `ci` comes from the job id in `ci.yml`; confirm against Step 2's output.)

- [ ] **Step 4: Confirm the gate exists on the next PR**

Ask the user to check PR #33's page — after the next push it should show the `ci` check as required. (GitHub applies required checks to PRs targeting `main` from the next status report onward.)

Stop here. Merge order across PR #33 and this PR is the user's call; prettier-reflowed files are disjoint from PR #33's changes, so neither order conflicts. Branch/worktree cleanup follows the merge decision.
