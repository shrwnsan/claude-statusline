# PRD-005 Effort-After-Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the session's reasoning effort as `·<level>` directly after the model name (always-on), deduped out of the opt-in `modeIndicators` bracket.

**Architecture:** One new exported pure formatter (`formatEffortSuffix`) in `src/index.ts` following the existing `formatPrBadge`/`formatCost` segment pattern, composed into `modelString` in `buildStatusline`. The dedupe is one call-site expression: when the suffix rendered, `formatModes` receives the modes object with `effort` stripped. Smart truncation needs no changes — the suffix lives inside `modelString`.

**Tech Stack:** TypeScript (node/bun), `node:test` + `assert`, tsc + esbuild, eslint. Tests import from `../dist/index.js`, so **`bun run build` must precede every test run** after source changes.

**Spec:** `docs/plans/prd-005-effort-after-model.md`

---

### Task 1: Worktree setup and spec/plan commit

All implementation work happens in a worktree; the main checkout stays on `main` untouched.

**Files:**
- Create: `.worktrees/feat/effort-after-model/` (worktree root, branch `feat/effort-after-model`)
- Copy into worktree: `docs/plans/prd-005-effort-after-model.md`, `docs/plans/tasks-005-effort-after-model.md`

- [ ] **Step 1: Ensure `.worktrees` is git-ignored (untracked mechanism)**

Run from the main checkout:

```bash
cd ~/Developer/personal/claude-statusline
git check-ignore -q .worktrees || echo ".worktrees" >> .git/info/exclude
git check-ignore -q .worktrees && echo "ignored: yes"
```

Expected: `ignored: yes`

- [ ] **Step 2: Create the worktree on the feat branch**

```bash
git worktree add .worktrees/feat/effort-after-model -b feat/effort-after-model
```

Expected: `Preparing worktree ... new branch 'feat/effort-after-model'` based on `main` (9a364a8).

- [ ] **Step 3: Copy the spec and this plan into the worktree**

The two docs are currently untracked in the main checkout, so they do not travel with the worktree — copy them:

```bash
cp docs/plans/prd-005-effort-after-model.md docs/plans/tasks-005-effort-after-model.md \
  .worktrees/feat/effort-after-model/docs/plans/
```

- [ ] **Step 4: Commit the docs in the worktree**

```bash
cd .worktrees/feat/effort-after-model
git add docs/plans/prd-005-effort-after-model.md docs/plans/tasks-005-effort-after-model.md
git commit -m "docs(plans): add prd-005 effort-after-model spec and tasks

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

All later tasks run inside `.worktrees/feat/effort-after-model`.

---

### Task 2: `formatEffortSuffix` — failing test first

**Files:**
- Modify: `tests/segments.test.ts` (import line 3, append new describe block)
- Modify: `src/index.ts` (add function directly above `formatModes`, ~line 256)

- [ ] **Step 1: Write the failing tests**

In `tests/segments.test.ts`, change the import on line 3 to:

```ts
import { formatCost, formatEffortSuffix, formatModes, formatPrBadge, formatRateLimit } from '../dist/index.js';
```

Append at the end of the file:

```ts
describe('formatEffortSuffix', () => {
  it('renders ·<level> for the raw payload value', () => {
    assert.strictEqual(formatEffortSuffix({ level: 'low' }), '·low');
    assert.strictEqual(formatEffortSuffix({ level: 'medium' }), '·medium');
    assert.strictEqual(formatEffortSuffix({ level: 'high' }), '·high');
    assert.strictEqual(formatEffortSuffix({ level: 'xhigh' }), '·xhigh');
    assert.strictEqual(formatEffortSuffix({ level: 'max' }), '·max');
  });
  it('passes unknown levels through verbatim', () => {
    assert.strictEqual(formatEffortSuffix({ level: 'ultra' }), '·ultra');
  });
  it('returns empty when absent, empty object, or empty level', () => {
    assert.strictEqual(formatEffortSuffix(undefined), '');
    assert.strictEqual(formatEffortSuffix({}), '');
    assert.strictEqual(formatEffortSuffix({ level: '' }), '');
  });
});
```

- [ ] **Step 2: Build and run to verify the tests fail**

```bash
bun run build && bun test tests/segments.test.ts
```

Expected: FAIL at module load — `SyntaxError: The requested module '../dist/index.js' does not provide an export named 'formatEffortSuffix'` (tsc still compiles: nothing in `src/` references the new export yet).

- [ ] **Step 3: Implement the formatter**

In `src/index.ts`, insert directly above the `EFFORT_TOKEN` constant (line ~248):

```ts
/** PRD-005: `·<level>` chip rendered directly after the model name; raw payload value. */
export function formatEffortSuffix(effort?: { level?: string }): string {
  if (!effort?.level) return '';
  return `·${effort.level}`;
}
```

- [ ] **Step 4: Build and run to verify the tests pass**

```bash
bun run build && bun test tests/segments.test.ts
```

Expected: all suites PASS (13 existing tests across `formatModes`/`formatPrBadge`/`formatCost`/`formatRateLimit` + 3 new).

- [ ] **Step 5: Lint the touched source**

```bash
bun run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts tests/segments.test.ts
git commit -m "feat(segments): add formatEffortSuffix for model-name effort chip

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

### Task 3: Compose the suffix into `buildStatusline` with bracket dedupe

**Files:**
- Modify: `src/index.ts:431-435` (modeIndicators segment + model string composition)
- Modify: `tests/segments.test.ts` (append dedupe contract test)

- [ ] **Step 1: Add the dedupe contract test**

Append to `tests/segments.test.ts`:

```ts
describe('formatModes PRD-005 dedupe contract', () => {
  it('renders no effort token when the call site strips effort', () => {
    const modes = { effort: { level: 'high' }, thinking: { enabled: true } };
    assert.strictEqual(formatModes({ ...modes, effort: undefined }), ' [thk]');
  });
});
```

- [ ] **Step 2: Wire the suffix into `buildStatusline`**

In `src/index.ts`, replace lines 431-435:

```ts
  // PRD-004 C4: opt-in mode indicators (effort/thinking/vim/fast/agent/style)
  const modesSegment = config.modeIndicators ? formatModes(modes) : '';

  // Build model string
  const modelString = `${symbols.model}${modelName}${envContext}${contextUsage}${overLimit}${prSegment}${costSegment}${rateSegment}${modesSegment}`;
```

with:

```ts
  // PRD-004 C4: opt-in mode indicators (thinking/vim/fast/agent/style).
  // PRD-005: effort renders as `·<level>` on the model name; strip it from the
  // bracket so it never shows twice. The suffix renders exactly when a level
  // exists, so the bracket can never carry effort after this change.
  const effortSuffix = formatEffortSuffix(modes?.effort);
  const modesForBracket = effortSuffix ? { ...modes, effort: undefined } : modes;
  const modesSegment = config.modeIndicators ? formatModes(modesForBracket) : '';

  // Build model string
  const modelString = `${symbols.model}${modelName}${effortSuffix}${envContext}${contextUsage}${overLimit}${prSegment}${costSegment}${rateSegment}${modesSegment}`;
```

- [ ] **Step 3: Build and run the full test suite**

```bash
bun run build && bun test
```

Expected: all test files PASS (segments, cache-keys, context-display, git-info, porcelain-v2, runner, security, symbols-config, width-chain, worktree-display).

- [ ] **Step 4: Verify composition end-to-end with pipe tests**

From the worktree root (default ASCII config, no env vars):

```bash
# With effort + thinking in payload: suffix after model, deduped bracket
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"},"effort":{"level":"high"},"thinking":{"enabled":true}}' | node dist/index.js

# modeIndicators on: bracket shows thinking only, effort stays on the model name
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"},"effort":{"level":"high"},"thinking":{"enabled":true}}' | CLAUDE_CODE_STATUSLINE_MODE_INDICATORS=1 node dist/index.js

# No effort in payload: byte-identical to the old renderer
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"},"thinking":{"enabled":true}}' | node dist/index.js
```

Expected, respectively:
- `claude-statusline main *Test Model·high [thk]`-style line — contains `Model·high`, and `·high` appears **immediately after the model name** (before the context segment if any)
- second command likewise `*Test Model·high … [thk]` — never ` [hgh·thk]`
- third: contains `*Test Model` with **no** `·` chip and no dangling `·`

- [ ] **Step 5: Verify truncation still measures the suffix**

```bash
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"A Very Long Model Name For Truncation"},"effort":{"level":"high"}}' | CLAUDE_CODE_STATUSLINE_TRUNCATE=1 CLAUDE_CODE_STATUSLINE_FORCE_WIDTH=40 node dist/index.js
```

Expected: single line ≤ 40 display columns; the suffix truncates together with the model segment (never orphaned after the cut).

- [ ] **Step 6: Lint**

```bash
bun run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts tests/segments.test.ts
git commit -m "feat(segments): render effort as ·<level> after model name

Always-on; deduped out of the modeIndicators bracket (PRD-005).

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

### Task 4: Documentation updates

**Files:**
- Modify: `docs/guides/guide-001-configuration.md:103`
- Modify: `README.md:97`
- Modify: `docs/ref/FEATURE_COMPARISON.md:57`
- Modify: `CHANGELOG.md` (new Unreleased section after the header preamble)

- [ ] **Step 1: Update the config guide table row**

In `docs/guides/guide-001-configuration.md` line 103, replace:

```markdown
| `modeIndicators` | boolean | `false` | Show mode indicators (effort/thinking/vim/fast/agent/style) |
```

with:

```markdown
| `modeIndicators` | boolean | `false` | Show mode indicators (thinking/vim/fast/agent/style; effort always renders as `·<level>` after the model name, not here) |
```

(Line 204's sample-config `"modeIndicators": false,` carries no effort-mentioning comment — leave it unchanged. Line 249's env-var table row stays valid.)

- [ ] **Step 2: Update the README segment table row**

In `README.md` line 97, replace:

```markdown
| **`"modeIndicators"`** | `CLAUDE_CODE_STATUSLINE_MODE_INDICATORS=1` | ` [hgh·thk]` — effort level, thinking, vim mode, fast mode, agent, output style |
```

with:

```markdown
| **`"modeIndicators"`** | `CLAUDE_CODE_STATUSLINE_MODE_INDICATORS=1` | ` [thk·fast]` — thinking, vim mode, fast mode, agent, output style (effort always shows as `·high` after the model name) |
```

- [ ] **Step 3: Update the feature comparison row**

In `docs/ref/FEATURE_COMPARISON.md` line 57, replace:

```markdown
| **5 opt-in segments** | `prBadge` (` #27[A]`), `costUsage` (` ~$1.23`), `rateLimit` (` 5h:42% 7d:12%`), `modeIndicators` (` [hgh·thk]`), `contextTokens` (` ~NNk/Nk`) — all default off |
```

with:

```markdown
| **5 opt-in segments + effort chip** | `prBadge` (` #27[A]`), `costUsage` (` ~$1.23`), `rateLimit` (` 5h:42% 7d:12%`), `modeIndicators` (` [thk·fast]`), `contextTokens` (` ~NNk/Nk`) — all default off; plus always-on `·<level>` effort chip after the model name |
```

- [ ] **Step 4: Add the CHANGELOG entry**

In `CHANGELOG.md`, insert between the header preamble (after the line `and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).` and its trailing blank lines) and `## [2.6.0] - 2026-09-30`:

```markdown
## [Unreleased]

### Added
- Always-on reasoning-effort chip: `·<level>` renders directly after the
  model name whenever the payload carries `effort.level` (PRD-005). Effort no
  longer appears in the opt-in `modeIndicators` bracket, which keeps
  thinking/vim/fast/agent/style only.
```

- [ ] **Step 5: Commit**

```bash
git add docs/guides/guide-001-configuration.md README.md docs/ref/FEATURE_COMPARISON.md CHANGELOG.md
git commit -m "docs: effort chip after model name, modeIndicators scope change

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

### Task 5: Full verification (AGENTS.md protocol)

No file changes — verification only. Run from the worktree root.

- [ ] **Step 1: Production build (bundle — the bin wrapper prefers it)**

```bash
bun run build && bun run build:bundle
```

Expected: both succeed; `dist/index.bundle.js` regenerated.

- [ ] **Step 2: Full test suite + lint**

```bash
bun test && bun run lint
```

Expected: all PASS, no lint errors.

- [ ] **Step 3: Self-test demo presets**

```bash
node dist/index.bundle.js --demo
```

Expected: the "All segments on" preset shows `·high` immediately after the model name and a bracket **without** `hgh` (the preset carries `effort: { level: 'high' }` + `thinking: { enabled: true }`); other presets unchanged.

- [ ] **Step 4: Performance check (must stay under 100ms)**

```bash
start=$(($(date +%s%N)/1000000))
for i in {1..5}; do
    echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test Model"},"effort":{"level":"high"}}' | ./bin/claude-statusline > /dev/null
done
end=$(($(date +%s%N)/1000000))
echo "Average execution time: $(((end - start) / 5))ms"
```

Expected: average well under 100ms (repo target ~5ms bun / ~28ms node).

- [ ] **Step 5: ASCII + env-combo smoke tests**

```bash
bash -n ./bin/claude-statusline
echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"Test"},"effort":{"level":"medium"}}' | CLAUDE_CODE_STATUSLINE_NO_EMOJI=1 CLAUDE_CODE_STATUSLINE_NO_GITSTATUS=1 node dist/index.bundle.js
```

Expected: syntax OK; line renders with `·medium` after the model name.

Stop here and hand off to the user — merging/PR/branch cleanup is decided separately (superpowers:finishing-a-development-branch territory), not part of this plan.
