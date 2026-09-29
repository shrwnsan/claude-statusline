# Tasks: Claude Code 2026 Modernization

> Derived from [PRD-004](./prd-004-claude-code-2026-modernization.md)

**Status**: ⬜ Not started
**Target Version**: 2.5.0

---

## Conventions

- Each task is **independent** unless it lists a dependency.
- Each task names the **single file (or small set)** it owns. Different tasks
  do not edit the same lines.
- Acceptance criteria are objective; a junior dev or subagent should be able
  to self-verify.
- Validation command for every code change (both verified working
  2026-09-23; `bun test` runs the `node:test` files via its compat layer):
  ```bash
  bun run build && bun test && bun run lint
  ```
- **Test conventions** (match `tests/security.test.ts`): tests use
  `node:test` + `node:assert` and import the **built** output from
  `../dist/…` — never `../src/`. The build step must run before tests.
- Update the status table in
  [PRD-004](./prd-004-claude-code-2026-modernization.md#status-tracking) when
  a phase completes.
- Commit messages: Conventional Commits with the GLM co-author trailer (see
  each task's commit block).

---

## PRD ↔ Task mapping

- PRD **A1a** (parser + fixtures, new code) → Tasks **A.1 + A.2**
- PRD **A1b** (cutover + deletion) → Task **A.3**
- PRD **A2** (composite cache key) → Task **A.4**
- PRD **A3** (width chain cleanup) → Task **A.5**
- PRD **A4** (README settings docs) → folded into Task **D.4**
- PRD **B1/B2** (payload types + worktree display) → Tasks **B.1–B.3**
- PRD **C1–C4** (free segments) → Tasks **C.1–C.4**
- PRD **D1–D4** (context + truncate default + docs/demo) → Tasks **D.1–D.5**

---

## Phase A — Performance

### Task A.1: Porcelain v2 parser (pure function, new file)

**Files:**
- Create: `src/git/porcelain.ts`
- Test: `tests/porcelain-v2.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/porcelain-v2.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseStatusV2 } from '../dist/git/porcelain.js';

const BRANCHY = `# branch.oid e8d631f0123456789abcdef0123456789abcdef01
# branch.head main
# branch.upstream origin/main
# branch.ab +2 -1
# stash 3
1 M. N... 100644 100644 100644 abc def src/a.ts
1 D. N... 100644 000000 100644 abc 000 src/gone.ts
2 R. N... 100644 100644 100644 abc def R100 src/old.ts\tsrc/new.ts
1 .M N... 100644 100644 100644 abc def src/b.ts
? untracked.txt
`;

describe('parseStatusV2', () => {
  it('parses branch header lines', () => {
    const r = parseStatusV2(BRANCHY);
    assert.strictEqual(r.head, 'main');
    assert.strictEqual(r.detached, false);
    assert.strictEqual(r.upstream, 'origin/main');
    assert.strictEqual(r.ahead, 2);
    assert.strictEqual(r.behind, 1);
    assert.strictEqual(r.stash, 3);
  });

  it('omitted stash line means zero stashes (line is absent, not "# stash 0")', () => {
    const r = parseStatusV2('# branch.oid abc\n# branch.head main\n');
    assert.strictEqual(r.stash, 0);
  });

  it('parses detached HEAD and exposes oid', () => {
    const r = parseStatusV2('# branch.oid e8d631f0123456789abcdef0123456789abcdef01\n# branch.head (detached)\n');
    assert.strictEqual(r.detached, true);
    assert.strictEqual(r.head, null);
    assert.strictEqual(r.oid, 'e8d631f0123456789abcdef0123456789abcdef01');
  });

  it('counts XY indicators from "1" and "2" records', () => {
    const r = parseStatusV2(BRANCHY);
    assert.strictEqual(r.indicators.staged, 1);   // M.
    assert.strictEqual(r.indicators.renamed, 1);  // "2 R." record
    assert.strictEqual(r.indicators.deleted, 1);  // D.
    assert.strictEqual(r.indicators.modified, 1); // .M
    assert.strictEqual(r.indicators.untracked, 1);
  });

  it('counts conflicts from "u" records', () => {
    const r = parseStatusV2('u 1. N... 100644 100644 100644 a b c src/x.ts\n');
    assert.strictEqual(r.indicators.conflicts, 1);
  });

  it('rename records split on TAB (path<TAB>origPath)', () => {
    const r = parseStatusV2('2 R. N... 100644 100644 100644 a b R100 p1\tp2\n');
    assert.strictEqual(r.indicators.renamed, 1);
  });

  it('never produces NaN for missing/absent lines', () => {
    const r = parseStatusV2('');
    assert.strictEqual(r.head, null);
    assert.strictEqual(r.ahead, 0);
    assert.strictEqual(r.behind, 0);
    assert.strictEqual(r.stash, 0);
  });

  it('tolerates CRLF output (Windows)', () => {
    const r = parseStatusV2('# branch.head main\r\n1 M. N... 100644 100644 100644 a b f.ts\r\n');
    assert.strictEqual(r.head, 'main');
    assert.strictEqual(r.indicators.staged, 1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run build && bun test tests/porcelain-v2.test.ts`
Expected: FAIL — `../dist/git/porcelain.js` does not exist yet (build
succeeds; the import fails at test time).

- [ ] **Step 3: Implement the parser**

```typescript
// src/git/porcelain.ts
import { EMPTY_INDICATORS, GitIndicators } from './status.js';

/**
 * Result of parsing `git status --porcelain=v2 --branch --show-stash`.
 * Field notes (verified against git 2.x output, 2026-09-23):
 * - `# stash N` line is OMITTED entirely when zero stashes (default 0).
 * - Detached HEAD emits `# branch.head (detached)`.
 * - Rename "2" records join path and origPath with a literal TAB.
 */
export interface StatusV2 {
  head: string | null;      // branch name; null when detached
  detached: boolean;
  oid: string | null;       // full HEAD oid (from `# branch.oid`)
  upstream: string | null;
  ahead: number;
  behind: number;
  stash: number;
  indicators: GitIndicators;
}

/** Extract XY codes from a "1"/"2" record (chars 2-3 of the line). */
function countXY(ind: GitIndicators, line: string): void {
  const X = line.charAt(2);
  const Y = line.charAt(3);
  switch (X) {
    case 'M': case 'A': case 'C': ind.staged++; break;
    case 'D': ind.deleted++; break;
    case 'R': ind.renamed++; break;
  }
  switch (Y) {
    case 'M': ind.modified++; break;
    case 'D': ind.deleted++; break;
    case 'R': ind.renamed++; break;
  }
}

export function parseStatusV2(output: string): StatusV2 {
  const r: StatusV2 = {
    head: null, detached: false, oid: null, upstream: null,
    ahead: 0, behind: 0, stash: 0,
    indicators: { ...EMPTY_INDICATORS },
  };
  for (const raw of output.split('\n')) {
    const line = raw.trimEnd(); // trim CR/CRLF, keep leading chars intact
    if (!line) continue;
    if (line.startsWith('# branch.head ')) {
      const v = line.slice('# branch.head '.length);
      r.detached = v === '(detached)';
      r.head = r.detached ? null : v;
    } else if (line.startsWith('# branch.oid ')) {
      r.oid = line.slice('# branch.oid '.length);
    } else if (line.startsWith('# branch.upstream ')) {
      r.upstream = line.slice('# branch.upstream '.length);
    } else if (line.startsWith('# branch.ab ')) {
      const m = /(?:^|\s)\+(\d+)\s+-(\d+)$/.exec(line);
      if (m) {
        r.ahead = parseInt(m[1], 10) || 0;
        r.behind = parseInt(m[2], 10) || 0;
      }
    } else if (line.startsWith('# stash ')) {
      r.stash = parseInt(line.slice('# stash '.length), 10) || 0;
    } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      countXY(r.indicators, line);
    } else if (line.startsWith('u ')) {
      r.indicators.conflicts++;
    } else if (line.startsWith('? ')) {
      r.indicators.untracked++;
    }
    // '!' (ignored) records: intentionally not displayed
  }
  // Mirror into indicators so getStatusV2().indicators is a true drop-in
  // GitIndicators: formatIndicators reads stash/ahead/behind/diverged from
  // this object, and the A.3 cutover returns v2.indicators directly.
  // (Without this, those symbols silently never render — caught in review.)
  r.indicators.ahead = r.ahead;
  r.indicators.behind = r.behind;
  r.indicators.stashed = r.stash;
  r.indicators.diverged = r.ahead > 0 && r.behind > 0;
  return r;
}
```

Note: `2` records with a non-R XY code (copy/rewrite) are counted by
`countXY` the same way as `1` records — the XY pair is identical there; the
only difference is the trailing `path<TAB>origPath` suffix, which the parser
ignores.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run build && bun test tests/porcelain-v2.test.ts`
Expected: PASS (all cases, including NaN-guard and CRLF).

- [ ] **Step 5: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add src/git/porcelain.ts tests/porcelain-v2.test.ts
git commit -m "feat(git): add porcelain v2 status parser

Pure-function parser for git status --porcelain=v2 --branch --show-stash,
landed as new code before any cutover (PRD-004 A1a). Handles omitted
stash line, detached HEAD, tab-joined rename records, CRLF.

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task A.2: Live parity test — old pipeline vs new parser

**Dependencies:** Task A.1. **Must merge before A.3 deletes the old pipeline.**

**Files:**
- Test: `tests/porcelain-parity.test.ts`
- Modify: `src/git/porcelain.ts` (append `getStatusV2` — the only src change)

- [ ] **Step 1: Append the command wrapper to `src/git/porcelain.ts`**

```typescript
// src/git/porcelain.ts (append; add executeGitCommand to imports at top)
import { executeGitCommand } from './native.js';

/** One spawn: status v2 + branch + stash. null when not a repo (exit 128). */
export async function getStatusV2(cwd?: string): Promise<StatusV2 | null> {
  try {
    const out = await executeGitCommand(
      ['--no-optional-locks', 'status', '--porcelain=v2', '--branch', '--show-stash'],
      cwd ? { cwd } : {},
    );
    return parseStatusV2(out);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write the parity test**

```typescript
// tests/porcelain-parity.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GitOperations } from '../dist/git/status.js';
import { Cache } from '../dist/core/cache.js';
import { loadConfig } from '../dist/core/config.js';
import { getStatusV2 } from '../dist/git/porcelain.js';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, appendFileSync } from 'fs';
import { tmpdir } from 'os';

/** Throwaway repo with a rich, NON-VACUOUS state (review-hardened):
 *  staged=2, modified=1, untracked=1, renamed=1, deleted=1, stash=1,
 *  ahead=1 with upstream set. Every asserted counter is non-zero. */
export function makeSandbox(suffix: string): string {
  const dir = mkdtempSync(`${tmpdir()}/cs-${suffix}-`);
  const g = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  const gbare = (...args: string[]) => execFileSync('git', args, { stdio: 'ignore' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  g('config', 'commit.gpgsign', 'false');
  writeFileSync(`${dir}/a.txt`, 'one\n');
  writeFileSync(`${dir}/b.txt`, 'two\n');
  writeFileSync(`${dir}/f.txt`, 'gone\n');
  g('add', '.');
  g('commit', '-qm', 'init');
  gbare('clone', '--bare', dir, `${dir}-remote.git`);
  g('remote', 'add', 'origin', `${dir}-remote.git`);
  g('push', '-q', '-u', 'origin', 'HEAD');    // upstream set
  appendFileSync(`${dir}/a.txt`, 'second\n');
  g('commit', '-qam', 'second');              // ahead: 1
  writeFileSync(`${dir}/b.txt`, 'stashme\n');
  g('stash', 'push', '-q', '--', 'b.txt');    // stash: 1 (path-limited)
  g('mv', 'b.txt', 'z.txt');                  // staged: R
  writeFileSync(`${dir}/a.txt`, 'dirty\n');   // modified (unstaged)
  writeFileSync(`${dir}/c.txt`, 'three\n');
  g('add', 'c.txt');                          // staged: A
  writeFileSync(`${dir}/my file.txt`, 'spaced\n');
  g('add', './my file.txt');                  // staged: A (space in path)
  g('rm', '-q', 'f.txt');                     // staged: D
  writeFileSync(`${dir}/e.txt`, 'untracked\n'); // untracked
  return dir;
}

describe('porcelain v2 parity with v1 pipeline', () => {
  it('reports identical branch and indicator counts', async () => {
    const dir = makeSandbox('parity');
    const config = { ...loadConfig(), noGitStatus: false, cacheDir: `${dir}/.git/cs-cache` };
    const ops = new GitOperations(config, new Cache(config));

    const oldInfo = await ops.getGitInfo(dir);       // v1 multi-shell pipeline
    const v2 = await getStatusV2(dir);               // new single-call parser

    assert.notStrictEqual(oldInfo, null);
    assert.notStrictEqual(v2, null);
    assert.strictEqual(v2!.head, oldInfo!.branch);
    assert.strictEqual(v2!.indicators.staged, oldInfo!.indicators.staged);
    assert.strictEqual(v2!.indicators.modified, oldInfo!.indicators.modified);
    assert.strictEqual(v2!.indicators.untracked, oldInfo!.indicators.untracked);
    assert.strictEqual(v2!.indicators.renamed, oldInfo!.indicators.renamed);
    assert.strictEqual(v2!.indicators.deleted, oldInfo!.indicators.deleted);
    assert.strictEqual(v2!.indicators.stashed, oldInfo!.indicators.stashed);
    assert.strictEqual(v2!.indicators.ahead, oldInfo!.indicators.ahead);
    assert.strictEqual(v2!.indicators.behind, oldInfo!.indicators.behind);
    assert.strictEqual(v2!.indicators.diverged, oldInfo!.indicators.diverged);
    // Non-vacuousness guards — the comparisons above must not pass 0-vs-0
    // (review: the original sandbox had no upstream/stash and could not
    // catch indicators-mirroring bugs)
    assert.strictEqual(oldInfo!.indicators.staged, 2);
    assert.strictEqual(oldInfo!.indicators.renamed, 1);
    assert.strictEqual(oldInfo!.indicators.deleted, 1);
    assert.strictEqual(oldInfo!.indicators.stashed, 1);
    assert.strictEqual(oldInfo!.indicators.ahead, 1);
    assert.strictEqual(oldInfo!.indicators.behind, 0);
  });
});
```

- [ ] **Step 3: Run and reconcile any mismatches**

Run: `bun run build && bun test tests/porcelain-parity.test.ts`
Expected: PASS. If a count differs, the **v2 parser is wrong** (the v1
pipeline is the released behavior) — fix `src/git/porcelain.ts`, not this
test, unless the mismatch is the deliberate detached-HEAD improvement.

- [ ] **Step 4: Commit**

```bash
bun run build && bun test && bun run lint
git add src/git/porcelain.ts tests/porcelain-parity.test.ts
git commit -m "test(git): parity suite between v1 pipeline and v2 parser

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task A.3: Cutover — one spawn, delete the corpses

**Dependencies:** Tasks A.1, A.2. This is PRD-004 A1b.

**Files:**
- Modify: `src/git/status.ts` (getGitInfo + helpers)
- Modify: `src/git/native.ts` (delete dead exports)
- Modify: `tests/porcelain-parity.test.ts` (extract helper; replace test)

- [ ] **Step 1: Rewrite `getGitInfo` in `src/git/status.ts`**

Replace the body of `getGitInfo`, delete `getCurrentBranch`,
`getGitIndicators`, `getStashedCount`, `getAheadBehind`, and update imports:

```typescript
import { getStatusV2 } from './porcelain.js';
// The remaining git/* imports from './native.js' can go if unreferenced.

async getGitInfo(directory: string): Promise<GitInfo | null> {
  if (this.config.noGitStatus) {
    return null;
  }
  try {
    const v2 = await getStatusV2(directory);
    if (!v2 || !v2.oid) {
      return null; // not a repo (exit 128) or git failure
    }
    // Detached HEAD: show short oid instead of "(no branch)" (PRD-004 A1b)
    const branch = v2.head ?? v2.oid.slice(0, 7);
    return { branch, indicators: v2.indicators };
  } catch (error) {
    console.debug('[DEBUG] Git operation failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
```

- [ ] **Step 2: Delete dead exports in `src/git/native.ts`**

Delete `checkIsRepo`, `getCurrentBranch`, `getStashList`, `getUpstreamRef`,
and the ahead/behind helper. Keep `executeGitCommand` (used by
`getStatusV2`). Verify nothing else still references the deleted functions:

```bash
grep -rn "checkIsRepo\|getCurrentBranch\|getStashList\|getUpstreamRef\|getAheadBehind\|getPorcelainStatus" src/ tests/
```

Expected: no hits outside `src/git/native.ts` itself after deletion. Delete
any function with zero remaining references (e.g. `getPorcelainStatus`).

- [ ] **Step 3: Replace the parity test with an end-to-end test**

The v1 side of the parity test no longer exists after cutover. First move
`makeSandbox` into `tests/porcelain-parity-helpers.ts` (a plain TS module —
the `tests/**/*.test.ts` glob will not pick it up as a test file) and update
`tests/porcelain-parity.test.ts` to import it from there. Then replace the
parity describe block with `tests/git-info.test.ts`:

```typescript
// tests/git-info.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GitOperations } from '../dist/git/status.js';
import { Cache } from '../dist/core/cache.js';
import { loadConfig } from '../dist/core/config.js';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
// NOTE: local test-to-test imports must use the REAL .ts specifier —
// `node --test --experimental-strip-types` resolves specifiers literally
// (no .js→.ts rewriting; tsconfig emits src/ only), while `bun test`'s
// laxer resolver silently masks the breakage. Always validate with the
// repo's own runner: `npm test`. (Found in A.3 review.)
import { makeSandbox } from './porcelain-parity-helpers.ts';

describe('getGitInfo (consolidated single-spawn)', () => {
  it('reports branch and indicators from one porcelain v2 call', async () => {
    const dir = makeSandbox('gitinfo');
    const config = { ...loadConfig(), noGitStatus: false, cacheDir: `${dir}/.git/cs-cache` };
    const info = await new GitOperations(config, new Cache(config)).getGitInfo(dir);
    assert.notStrictEqual(info, null);
    assert.strictEqual(info!.indicators.staged, 2);
    assert.strictEqual(info!.indicators.renamed, 1);
    assert.strictEqual(info!.indicators.deleted, 1);
    assert.strictEqual(info!.indicators.modified, 1);
    assert.strictEqual(info!.indicators.untracked, 1);
    assert.strictEqual(info!.indicators.stashed, 1);
    assert.strictEqual(info!.indicators.ahead, 1);
  });

  it('returns null outside a repository', async () => {
    const dir = mkdtempSync(`${tmpdir()}/cs-norepo2-`);
    const config = { ...loadConfig(), noGitStatus: false, cacheDir: `${dir}/cache` };
    const info = await new GitOperations(config, new Cache(config)).getGitInfo(dir);
    assert.strictEqual(info, null);
  });
});
```

Delete the old parity describe block from
`tests/porcelain-parity.test.ts` (its v1 subject is gone) — or delete the
file entirely and keep only the helpers module; both are acceptable, but the
helper must survive for `git-info.test.ts`.

- [ ] **Step 4: Validate, verify spawn count, commit**

```bash
bun run build && bun test && bun run lint
node bin/claude-statusline --self-test
# Expected: renders normally. To confirm the single spawn, temporarily add
# `console.error('[SPAWN] git', args.join(' '))` at the top of
# executeGitCommand, run once with a cold cache, count exactly one line,
# then remove the debug line before committing.
git add -A
git commit -m "perf(git): single porcelain-v2 spawn replaces 6-8 git calls

Cutover of PRD-004 A1b: getGitInfo reads branch, upstream, ahead/behind,
stash and indicators from one 'git --no-optional-locks status --porcelain=v2
--branch --show-stash'. Exit 128 doubles as repo detection. Detached HEAD
now renders the short oid instead of '(no branch)'.

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task A.4: Composite session cache key, 5 s TTL

**Dependencies:** Task A.3. PRD-004 A2.

**Files:**
- Modify: `src/core/cache.ts` (CacheKeys)
- Modify: `src/git/status.ts` (getGitInfo signature)
- Modify: `src/index.ts` (thread `session_id`; render + main)
- Test: `tests/cache-keys.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/cache-keys.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CacheKeys } from '../dist/core/cache.js';

describe('GIT_STATUS cache key', () => {
  it('composites session_id and directory, filename-safe (base64)', () => {
    const key = CacheKeys.GIT_STATUS('abc-123', '/repo/a');
    assert.strictEqual(key.startsWith('git_status_'), true);
    assert.strictEqual(key, `git_status_${Buffer.from('abc-123:/repo/a').toString('base64')}`);
    assert.ok(!key.includes('/repo'), 'raw dir must not leak into filename');
    assert.ok(!key.includes('abc-123:'), 'raw session id must not leak into filename');
  });

  it('falls back to directory-only key when session_id is absent', () => {
    const key = CacheKeys.GIT_STATUS(undefined, '/repo/a');
    assert.strictEqual(key, `git_status_${Buffer.from('/repo/a').toString('base64')}`);
  });

  it('different sessions in the same dir do not share entries', () => {
    assert.notStrictEqual(CacheKeys.GIT_STATUS('s1', '/repo/a'), CacheKeys.GIT_STATUS('s2', '/repo/a'));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run build && bun test tests/cache-keys.test.ts`
Expected: FAIL — `CacheKeys.GIT_STATUS` is not defined.

- [ ] **Step 3: Implement**

`src/core/cache.ts`, inside `CacheKeys` (keys become cache *filenames* —
hence base64, same as the existing `GIT_BRANCH` pattern):

```typescript
GIT_STATUS: (sessionId: string | undefined, dir: string) =>
  `git_status_${Buffer.from(sessionId ? `${sessionId}:${dir}` : dir).toString('base64')}`,
```

`src/git/status.ts` — change signature and caching:

```typescript
async getGitInfo(directory: string, sessionId?: string): Promise<GitInfo | null> {
  if (this.config.noGitStatus) return null;
  const cacheKey = CacheKeys.GIT_STATUS(sessionId, directory);
  const cached = await this.cache.get<GitInfo>(cacheKey, 5); // PRD-004 A2: 5 s TTL
  if (cached) return cached;
  try {
    const v2 = await getStatusV2(directory);
    if (!v2 || !v2.oid) return null;
    const info: GitInfo = { branch: v2.head ?? v2.oid.slice(0, 7), indicators: v2.indicators };
    await this.cache.set(cacheKey, info);
    return info;
  } catch (error) {
    console.debug('[DEBUG] Git operation failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
```

`src/index.ts` — thread the session id:

```typescript
// render(): add parameter and pass through
async function render(
  fullDir: string,
  modelName: string,
  contextWindow?: ClaudeInput['context_window'],
  config?: Config,
  sessionId?: string,
): Promise<string> {
  // ... existing body, but:
  const operations: Promise<any>[] = [
    gitOps.getGitInfo(fullDir, sessionId),
    envDetector.getEnvironmentInfo(),
    detectSymbols(config),
  ];
```

```typescript
// main(): pass it (ClaudeInput gains `session_id?: string` in Task B.1;
// until then cast: (input as { session_id?: string }).session_id)
process.stdout.write(await render(fullDir, modelName, contextWindow, config, (input as { session_id?: string }).session_id));
```

`runSelfTest()` stays as-is (no session id → directory fallback, which the
self-test relies on).

- [ ] **Step 4: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add -A
git commit -m "perf(cache): key git cache on <session_id>:<current_dir>, 5s TTL

Official docs pattern (cache on session_id, not pid), hardened into a
composite key: a bare session key serves stale repo-A data after cd-ing
into repo B mid-session. Directory-only fallback covers --self-test.

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task A.5: Width chain — keep only honest sources

**Files:**
- Modify: `src/ui/width.ts`
- Test: `tests/width-chain.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/width-chain.test.ts
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { getTerminalWidth } from '../dist/ui/width.js';
import { loadConfig } from '../dist/core/config.js';

const origCols = process.env.COLUMNS;
afterEach(() => {
  if (origCols === undefined) delete process.env.COLUMNS; else process.env.COLUMNS = origCols;
});

describe('getTerminalWidth chain', () => {
  it('forceWidth wins over everything', async () => {
    process.env.COLUMNS = '120';
    const w = await getTerminalWidth({ ...loadConfig(), forceWidth: 55 });
    assert.strictEqual(w, 55);
  });

  it('COLUMNS is honored when set (Claude Code provides it since 2.1.153)', async () => {
    process.env.COLUMNS = '97';
    const w = await getTerminalWidth({ ...loadConfig() });
    assert.strictEqual(w, 97);
  });

  it('falls back to fixed 80 when nothing is available — never shells out', async () => {
    delete process.env.COLUMNS;
    const w = await getTerminalWidth({ ...loadConfig() });
    assert.strictEqual(w, 80);
  });
});
```

Note: `process.stdout.columns` is `undefined` under the test runner, so the
fixed-80 case runs naturally without mocking.

- [ ] **Step 2: Run to verify failure**

Run: `bun run build && bun test tests/width-chain.test.ts`
Expected: FAIL (tput/stty/TERM_PROGRAM paths still present; fallback ≠ 80).

- [ ] **Step 3: Rewrite `getTerminalWidth`**

Replace the entire function and delete `tryCommand`, the `tput` path, the
`stty` path, and the `TERM_PROGRAM` sniffing table:

```typescript
const DEFAULT_WIDTH = 80;

/**
 * Terminal width resolution — no shell-outs, no heuristics (PRD-004 A3).
 * Order: forceWidth (manual override) → COLUMNS env (Claude Code provides
 * it in the statusline payload env since 2.1.153) → process.stdout.columns
 * → fixed 80. `tput`/`stty` cannot work here: the statusline command runs
 * with captured output and no tty.
 */
export async function getTerminalWidth(config: Config): Promise<number> {
  if (config.forceWidth && config.forceWidth > 0) {
    return config.forceWidth;
  }
  const columnsEnv = parseInt(process.env.COLUMNS || '', 10);
  if (!isNaN(columnsEnv) && columnsEnv > 0) {
    return columnsEnv;
  }
  if (process.stdout.columns && process.stdout.columns > 0) {
    return process.stdout.columns;
  }
  return DEFAULT_WIDTH;
}
```

Remove now-unused imports/helpers in the same file; verify with:

```bash
grep -n "tput\|stty\|TERM_PROGRAM\|tryCommand" src/ui/width.ts
```

Expected: no hits.

- [ ] **Step 4: Validate (width shell scripts included) and commit**

```bash
bun run build && bun test && bun run lint && bash tests/test_width.sh && bash tests/test_width_long.sh
git add -A
git commit -m "refactor(width): drop tput/stty/TERM_PROGRAM width detection

tput and stty cannot work with captured output; the TERM_PROGRAM table
returned a hardcoded 120 exactly when COLUMNS was unset (its only firing
case). Final chain: forceWidth -> COLUMNS -> stdout.columns -> 80.

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

## Phase B — Worktree-aware display

### Task B.1: Extend the stdin payload types

**Files:**
- Modify: `src/index.ts` (ClaudeInput interface only)

- [ ] **Step 1: Extend `ClaudeInput`**

```typescript
interface ClaudeInput {
  session_id?: string;
  workspace: {
    current_dir: string;
    repo?: { host: string; owner: string; name: string };
    git_worktree?: string;
  };
  model: { display_name: string };
  context_window?: {
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_size: number;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
    current_usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    } | null;
  };
  worktree?: {
    name: string;
    path: string;
    branch?: string;
    original_cwd: string;
    original_branch?: string;
  };
}
```

(The `pr`/`cost`/`rate_limits`/mode fields are added in Phase C tasks, each
within its own file ownership.)

- [ ] **Step 2: Wire `session_id` typing**

With `session_id` now typed, replace the Task A.4 cast in `main()` with the
direct `input.session_id`.

- [ ] **Step 3: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add src/index.ts
git commit -m "feat(types): model worktree/repo/session fields from stdin payload

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task B.2: Worktree symbol

**Files:**
- Modify: `src/ui/symbols.ts` (SymbolSet + both presets)

- [ ] **Step 1: Add the symbol**

Interface: `worktree: string;`
ASCII preset: `worktree: '·wt:',`
Nerd preset: `worktree: '',` (nf-oct-repo; verify visually in Step 2)

- [ ] **Step 2: Verify the Nerd glyph renders**

```bash
bun run build && node bin/claude-statusline --demo | cat -v | grep -c "M-pM-^OM-^X"
```

If the glyph shows as replacement/tofu in your terminal, pick another NF
codepoint and re-verify — the ASCII preset is unaffected either way.

- [ ] **Step 3: Commit**

```bash
bun run build && bun test && bun run lint
git add src/ui/symbols.ts
git commit -m "feat(symbols): worktree tag symbol (ASCII '·wt:' default)

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task B.3: Worktree-aware project slot and branch

**Dependencies:** Tasks B.1, B.2. PRD-004 B1/B2.

**Files:**
- Modify: `src/index.ts` (extractInputInfo, buildStatusline, render)
- Test: `tests/worktree-display.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/worktree-display.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatProjectSlot, resolveBranch } from '../dist/index.js';

describe('formatProjectSlot', () => {
  it('plain main checkout: unchanged dirname, no tag', () => {
    assert.strictEqual(
      formatProjectSlot({ repoName: undefined, currentDir: '/x/claude-statusline', worktreeName: undefined, wtSymbol: '·wt:' }),
      'claude-statusline',
    );
  });

  it('linked worktree cwd: repo identity + ·wt: tag', () => {
    assert.strictEqual(
      formatProjectSlot({ repoName: 'claude-statusline', currentDir: '/x/cs-wt-demo', worktreeName: 'cs-wt-demo', wtSymbol: '·wt:' }),
      'claude-statusline ·wt:cs-wt-demo',
    );
  });

  it('repo.name ≠ dirname: project slot comes from workspace.repo.name', () => {
    assert.strictEqual(
      formatProjectSlot({ repoName: 'my-repo', currentDir: '/x/wt-clone', worktreeName: 'wt-clone', wtSymbol: '·wt:' }),
      'my-repo ·wt:wt-clone',
    );
  });

  it('no repo field but inside linked worktree: dirname + tag', () => {
    assert.strictEqual(
      formatProjectSlot({ repoName: undefined, currentDir: '/x/cs-wt-demo', worktreeName: 'cs-wt-demo', wtSymbol: '·wt:' }),
      'cs-wt-demo ·wt:cs-wt-demo',
    );
  });

  it('nerd symbol renders glyph adjacent to the name', () => {
    // U+F421 via escape — never paste raw PUA bytes into source (they do
    // not survive transmission and break byte-verified diffs)
    assert.strictEqual(
      formatProjectSlot({ repoName: 'r', currentDir: '/x/w', worktreeName: 'w', wtSymbol: '' }),
      'r w',
    );
  });
});

describe('resolveBranch', () => {
  it('worktree.branch wins in managed sessions', () => {
    assert.strictEqual(resolveBranch({ gitBranch: 'git-says-x', worktreeBranch: 'worktree-demo' }), 'worktree-demo');
  });
  it('git branch is used otherwise', () => {
    assert.strictEqual(resolveBranch({ gitBranch: 'main', worktreeBranch: undefined }), 'main');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run build && bun test tests/worktree-display.test.ts`
Expected: FAIL — exports do not exist.

- [ ] **Step 3: Implement in `src/index.ts`**

```typescript
export interface ProjectSlotParams {
  repoName?: string;
  currentDir: string;
  worktreeName?: string;
  wtSymbol: string;
}

/** PRD-004 B2: repo identity wins over dirname; worktree tag appended. */
export function formatProjectSlot(p: ProjectSlotParams): string {
  const dirname = p.currentDir.split('/').pop() || p.currentDir.split('\\').pop() || 'project';
  const name = p.repoName ?? dirname;
  return p.worktreeName ? `${name} ${p.wtSymbol}${p.worktreeName}` : name;
}

export function resolveBranch(p: { gitBranch: string; worktreeBranch?: string }): string {
  return p.worktreeBranch ?? p.gitBranch; // PRD-004 B1
}
```

In `extractInputInfo`, also return `repoName: input.workspace?.repo?.name`
and `worktreeName: input.worktree?.name ?? input.workspace?.git_worktree`.
In `buildStatusline`, replace `const projectName = ...` with
`const projectName = formatProjectSlot({ repoName, currentDir: fullDir, worktreeName, wtSymbol: symbols.worktree })`
— everything below (including truncation) already uses `projectName` — and
after `gitInfo` resolves apply
`if (gitInfo) gitInfo = { ...gitInfo, branch: resolveBranch({ gitBranch: gitInfo.branch, worktreeBranch: worktree?.branch }) }`
(thread `worktree`, `repoName`, `worktreeName` into the
`render`/`buildStatusline` param objects alongside `contextWindow`). The
consolidated git command still runs — `worktree.branch` only overrides the
displayed branch.

- [ ] **Step 4: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add -A
git commit -m "feat(display): worktree-aware project slot and branch

Project slot shows workspace.repo.name (fallback dirname) plus a worktree
tag from worktree.name/workspace.git_worktree; managed worktree sessions
display worktree.branch. Fixes worktree dirname masquerading as the
project name (PRD-004 B1/B2).

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

## Phase C — Free segments (stdin-only, opt-in)

Shared shape for C.1–C.4 (each task owns its slice; C.1 shows the pattern
once — repeat it for the others):

1. Config key in `src/core/config.ts` zod schema:
   `prBadge: z.boolean().default(false),` (default **off**, PRD-004 D5)
2. Env mapping in `loadEnvConfig()`:
   `if (process.env.CLAUDE_CODE_STATUSLINE_PR_BADGE === '1') env.prBadge = true;`
3. `generateSampleConfig()` gains `prBadge: false, // Set to true to show PR badge`
4. `ClaudeInput` gains the fields listed per task
5. A pure `formatX(...)` helper in `src/index.ts`, exported and unit-tested
6. `buildStatusline` appends the segment to `modelString` in order:
   contextUsage → pr → cost → rate → modes

### Task C.1: PR badge segment

**Files:** `src/core/config.ts`, `src/index.ts`, `tests/segments.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
// tests/segments.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatPrBadge } from '../dist/index.js';

describe('formatPrBadge', () => {
  it('renders number + state token', () => {
    assert.strictEqual(formatPrBadge({ number: 27, url: 'u', review_state: 'approved' }), ' #27[A]');
    assert.strictEqual(formatPrBadge({ number: 27, url: 'u', review_state: 'pending' }), ' #27*');
    assert.strictEqual(formatPrBadge({ number: 27, url: 'u', review_state: 'changes_requested' }), ' #27x');
    assert.strictEqual(formatPrBadge({ number: 27, url: 'u', review_state: 'draft' }), ' #27-');
  });
  it('renders number only when review_state is absent', () => {
    assert.strictEqual(formatPrBadge({ number: 5, url: 'u' }), ' #5');
  });
  it('returns empty for absent PR', () => {
    assert.strictEqual(formatPrBadge(undefined), '');
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// src/index.ts
export interface PrInfo { number: number; url: string; review_state?: string; kind?: string; }

export function formatPrBadge(pr?: PrInfo): string {
  if (!pr) return '';
  const token = { approved: '[A]', pending: '*', changes_requested: 'x', draft: '-' }[pr.review_state ?? ''] ?? '';
  return ` #${pr.number}${token}`;
}
```

`ClaudeInput` gains `pr?: PrInfo;`. In `buildStatusline` (thread `pr` into
params like `contextWindow`):

```typescript
const prSegment = config.prBadge ? formatPrBadge(pr) : '';
const modelString = `${symbols.model}${modelName}${envContext}${contextUsage}${prSegment}`;
```

- [ ] **Step 3: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add -A
git commit -m "feat(segments): opt-in PR badge from stdin pr.* fields

Zero-subprocess PR segment: number + review-state token. ASCII tokens
[A]/*/x/- in both presets (PRD-004 C1/D5).

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task C.2: Cost segment

**Files:** `src/core/config.ts`, `src/index.ts`, `tests/segments.test.ts`

- [ ] **Step 1: Failing tests** (append to `tests/segments.test.ts`)

```typescript
import { formatCost } from '../dist/index.js';

describe('formatCost', () => {
  it('prefixes ~ to mark the client-side estimate', () => {
    assert.strictEqual(formatCost(1.2344), ' ~$1.23');
    assert.strictEqual(formatCost(0), ' ~$0.00');
  });
  it('returns empty when absent or negative', () => {
    assert.strictEqual(formatCost(undefined), '');
    assert.strictEqual(formatCost(-1), '');
  });
});
```

- [ ] **Step 2: Implement**

```typescript
export function formatCost(totalCostUsd?: number): string {
  if (totalCostUsd === undefined || totalCostUsd < 0) return '';
  return ` ~$${totalCostUsd.toFixed(2)}`;
}
```

Config key `costUsage` (default false), env
`CLAUDE_CODE_STATUSLINE_COST_USAGE`, sample-config entry, `ClaudeInput`
gains `cost?: { total_cost_usd: number; total_duration_ms: number; total_api_duration_ms: number; total_lines_added: number; total_lines_removed: number; }`,
appended to `modelString` after the PR segment.

- [ ] **Step 3: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add -A
git commit -m "feat(segments): opt-in ~\$cost display from cost.total_cost_usd

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task C.3: Rate-limit segment

**Files:** `src/core/config.ts`, `src/index.ts`, `tests/segments.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { formatRateLimit } from '../dist/index.js';

describe('formatRateLimit', () => {
  it('renders only windows that are present', () => {
    assert.strictEqual(formatRateLimit({ five_hour: { used_percentage: 42 } }), ' 5h:42%');
    assert.strictEqual(formatRateLimit({ five_hour: { used_percentage: 42 }, seven_day: { used_percentage: 12 } }), ' 5h:42% 7d:12%');
  });
  it('rounds fractional percentages', () => {
    assert.strictEqual(formatRateLimit({ five_hour: { used_percentage: 42.6 } }), ' 5h:43%');
  });
  it('renders >100 verbatim (docs: spend_limit may exceed 100)', () => {
    assert.strictEqual(formatRateLimit({ spend_limit: { used_percentage: 137 } }), ' spl:137%');
  });
  it('returns empty when absent or empty', () => {
    assert.strictEqual(formatRateLimit(undefined), '');
    assert.strictEqual(formatRateLimit({}), '');
  });
});
```

- [ ] **Step 2: Implement**

```typescript
export interface RateWindow { used_percentage: number; }
export interface RateLimits { five_hour?: RateWindow; seven_day?: RateWindow; spend_limit?: RateWindow; }

export function formatRateLimit(rl?: RateLimits): string {
  if (!rl) return '';
  const parts: string[] = [];
  if (rl.five_hour) parts.push(`5h:${Math.round(rl.five_hour.used_percentage)}%`);
  if (rl.seven_day) parts.push(`7d:${Math.round(rl.seven_day.used_percentage)}%`);
  if (rl.spend_limit) parts.push(`spl:${Math.round(rl.spend_limit.used_percentage)}%`);
  return parts.length ? ` ${parts.join(' ')}` : '';
}
```

Config key `rateLimit` (default false), env
`CLAUDE_CODE_STATUSLINE_RATE_LIMIT`, sample-config entry, `ClaudeInput`
gains `rate_limits?: RateLimits`, appended after cost.

- [ ] **Step 3: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add -A
git commit -m "feat(segments): opt-in rate-limit window display from rate_limits.*

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task C.4: Mode-indicator segment

**Files:** `src/core/config.ts`, `src/index.ts`, `tests/segments.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { formatModes } from '../dist/index.js';

describe('formatModes', () => {
  it('renders compact tokens for present fields only', () => {
    assert.strictEqual(formatModes({ effort: { level: 'high' }, thinking: { enabled: true } }), ' [hgh·thk]');
    assert.strictEqual(formatModes({ vim: { mode: 'INSERT' }, fast_mode: true }), ' [I·fast]');
    assert.strictEqual(formatModes({ agent: { name: 'reviewer' } }), ' [@reviewer]');
  });
  it('maps effort levels', () => {
    assert.strictEqual(formatModes({ effort: { level: 'low' } }), ' [lo]');
    assert.strictEqual(formatModes({ effort: { level: 'xhigh' } }), ' [xh]');
    assert.strictEqual(formatModes({ effort: { level: 'max' } }), ' [mx]');
  });
  it('output_style renders only when not default', () => {
    assert.strictEqual(formatModes({ output_style: { name: 'default' } }), '');
    assert.strictEqual(formatModes({ output_style: { name: 'Explanatory' } }), ' [Explanatory]');
  });
  it('returns empty when nothing present', () => {
    assert.strictEqual(formatModes({}), '');
  });
});
```

- [ ] **Step 2: Implement**

```typescript
export interface ModesInput {
  effort?: { level: string };
  thinking?: { enabled: boolean };
  vim?: { mode: string };
  fast_mode?: boolean;
  agent?: { name: string };
  output_style?: { name: string };
}

const EFFORT_TOKEN: Record<string, string> = { low: 'lo', medium: 'me', high: 'hgh', xhigh: 'xh', max: 'mx' };

export function formatModes(m: ModesInput): string {
  const t: string[] = [];
  if (m.effort) t.push(EFFORT_TOKEN[m.effort.level] ?? m.effort.level);
  if (m.thinking?.enabled) t.push('thk');
  if (m.vim) t.push(m.vim.mode.charAt(0));
  if (m.fast_mode) t.push('fast');
  if (m.agent) t.push(`@${m.agent.name}`);
  if (m.output_style && m.output_style.name !== 'default') t.push(m.output_style.name);
  return t.length ? ` [${t.join('·')}]` : '';
}
```

Config key `modeIndicators` (default false), env
`CLAUDE_CODE_STATUSLINE_MODE_INDICATORS`, sample-config entry, appended
last in `modelString`.

- [ ] **Step 3: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add -A
git commit -m "feat(segments): opt-in mode indicators (effort/thinking/vim/fast/agent/style)

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

## Phase D — Context correctness, defaults, docs, demo

### Task D.1: `used_percentage` preferred, `current_usage` fallback

**Files:**
- Modify: `src/index.ts` (contextUsage block in `buildStatusline`)
- Test: `tests/context-display.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/context-display.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatContextUsage } from '../dist/index.js';

const SYM = '≈';

describe('formatContextUsage', () => {
  it('prefers used_percentage', () => {
    assert.strictEqual(formatContextUsage({ used_percentage: 25.4 }, SYM), ' ≈25%');
  });
  it('null used_percentage with no fallback renders nothing', () => {
    assert.strictEqual(formatContextUsage({ used_percentage: null }, SYM), '');
    assert.strictEqual(formatContextUsage(undefined, SYM), '');
  });
  it('computes from current_usage when percentages are null (docs formula: input-only)', () => {
    assert.strictEqual(formatContextUsage({
      used_percentage: null,
      context_window_size: 200000,
      current_usage: { input_tokens: 50000, output_tokens: 9000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    }, SYM), ' ≈25%'); // output_tokens excluded — used_percentage is input-only
  });
  it('falls back to remaining_percentage only when used_percentage absent', () => {
    assert.strictEqual(formatContextUsage({ remaining_percentage: 75 }, SYM), ' ≈25%');
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

Replace the contextUsage block in `buildStatusline` with a call to:

```typescript
interface ContextWindowInput {
  used_percentage?: number | null;
  remaining_percentage?: number | null;
  context_window_size?: number;
  current_usage?: {
    input_tokens: number;
    output_tokens?: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  } | null;
}

/** PRD-004 D1: docs semantics — used_percentage preferred (input-only),
 *  remaining_percentage fallback, current_usage fallback, null = no render. */
export function formatContextUsage(cw: ContextWindowInput | undefined, symbol: string): string {
  if (!cw) return '';
  let used: number | undefined = cw.used_percentage ?? undefined;
  if (used === undefined && cw.remaining_percentage !== undefined && cw.remaining_percentage !== null) {
    used = 100 - cw.remaining_percentage;
  }
  if (used === undefined && cw.current_usage && cw.context_window_size) {
    const { input_tokens, cache_creation_input_tokens, cache_read_input_tokens } = cw.current_usage;
    used = ((input_tokens + cache_creation_input_tokens + cache_read_input_tokens) / cw.context_window_size) * 100;
  }
  if (used === undefined || used === null || isNaN(used)) return '';
  return ` ${symbol}${Math.round(used)}%`;
}
```

(`config.noContextWindow` gating stays at the call site, unchanged.)

- [ ] **Step 3: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add -A
git commit -m "feat(context): prefer used_percentage, current_usage fallback

Docs-recommended percentage semantics; output tokens excluded from the
fallback formula (used_percentage is input-only). Null renders nothing.

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task D.2: `exceeds_200k_tokens` warning marker

**Files:** `src/ui/symbols.ts`, `src/index.ts`, `tests/context-display.test.ts`

- [ ] **Step 1: Failing test** (append to `tests/context-display.test.ts`)

```typescript
import { formatOverLimit } from '../dist/index.js';

describe('formatOverLimit', () => {
  it('renders the symbol only when exceeded', () => {
    assert.strictEqual(formatOverLimit(true, '!!'), '!!');
    assert.strictEqual(formatOverLimit(false, '!!'), '');
    assert.strictEqual(formatOverLimit(undefined, '!!'), '');
  });
});
```

- [ ] **Step 2: Implement**

```typescript
export function formatOverLimit(exceeds: boolean | undefined, symbol: string): string {
  return exceeds ? symbol : '';
}
```

`SymbolSet` gains `overLimit: '!!'` in the ASCII preset and `overLimit: '⚠'`
in the Nerd preset; append the segment right after `contextUsage` in
`buildStatusline`. `ClaudeInput` gains `exceeds_200k_tokens?: boolean;` and
it is threaded into `buildStatusline` like the other fields.

- [ ] **Step 3: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add -A
git commit -m "feat(context): warning marker when exceeds_200k_tokens is set

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task D.3: Optional absolute-token display

**Files:** `src/core/config.ts`, `src/index.ts`, `tests/context-display.test.ts`

- [ ] **Step 1: Failing tests** (append)

```typescript
import { formatTokenCount } from '../dist/index.js';

describe('formatTokenCount + contextTokens opt-in', () => {
  it('formats absolute counts', () => {
    assert.strictEqual(formatTokenCount(41234), '~41k');
    assert.strictEqual(formatTokenCount(undefined), '');
  });
  it('contextTokens opt-in appends ~used/total', () => {
    assert.strictEqual(
      formatContextUsage({ used_percentage: 25, context_window_size: 200000 }, SYM, { contextTokens: true }),
      ' ≈25% ~50k/200k',
    );
  });
});
```

- [ ] **Step 2: Implement**

```typescript
export function formatTokenCount(n?: number): string {
  if (n === undefined || isNaN(n)) return '';
  return `~${Math.round(n / 1000)}k`;
}
```

Extend `formatContextUsage` with an options param
`(cw, symbol, opts?: { contextTokens?: boolean })`; when
`opts?.contextTokens && cw.context_window_size && used != null`, append
` ${formatTokenCount(cw.context_window_size * used / 100)}/${formatTokenCount(cw.context_window_size)}`.
Config key `contextTokens: z.boolean().default(false)`, env
`CLAUDE_CODE_STATUSLINE_CONTEXT_TOKENS`, sample-config entry.

- [ ] **Step 3: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add -A
git commit -m "feat(context): opt-in absolute token display (~50k/200k)

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task D.4: `truncate` default flip (three places) + README docs

**Files:**
- Modify: `src/core/config.ts` (zod default, `generateSampleConfig`)
- Modify: `README.md`
- Modify: `docs/ref/ARCHITECTURE.md` (stale width-chain doc — see Step 2b)

- [ ] **Step 1: Flip the three places**

1. Zod schema: `truncate: z.boolean().default(true), // Smart truncation (default on; "truncate": false restores full-line output)`
2. `generateSampleConfig()`: value already `true`; update its comment to
   note it is now the default.
3. Env `CLAUDE_CODE_STATUSLINE_TRUNCATE=1` stays as-is (it forces on; the
   config key is the way to turn it off — do not invent a `=0` mapping).

- [ ] **Step 2: README edits**

Upgrade note at the top of the configuration section:

```markdown
**Upgrading to 2.5.0**: smart truncation is now on by default (Claude Code
clips or wraps overly long statuslines anyway — ours degrades gracefully
instead). Restore the old always-full-line behavior with `"truncate": false`.
Inside git worktrees the project slot now shows the repository name from
your `origin` remote plus a `·wt:<name>` tag (Nerd Font preset: dedicated
glyph) instead of the worktree directory name.
```

Recommended settings snippet (PRD-004 A4):

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/bin/claude-statusline",
    "padding": 0,
    "refreshInterval": 3
  }
}
```

With the note: `padding` pairs with our `rightMargin` (default 15 —
Claude Code's right-side telemetry); `refreshInterval` (seconds, min 1)
refreshes git state while the session idles, e.g. background subagents
switching branches.

- [ ] **Step 2b: Fix the stale width-chain doc (found in A.5 review)**

`docs/ref/ARCHITECTURE.md:139` still documents
`CLAUDE_CODE_TERMINAL_WIDTH` as part of the width chain — that variable
and the whole sniffing table were deleted in A.5. Update the section to
describe the new chain: `forceWidth → COLUMNS → process.stdout.columns →
80`; no shell-outs, no terminal-name sniffing.

- [ ] **Step 3: Validate and commit**

```bash
bun run build && bun test && bun run lint
git add -A
git commit -m "feat(config)!: default truncate to true across zod and sample config

BREAKING CHANGE: statuslines now smart-truncate by default. Rollback:
\"truncate\": false. README documents the 2.5.0 display changes and the
recommended statusLine settings (padding, refreshInterval).

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

### Task D.5: `--demo` presets + verification checklist

**Files:**
- Modify: `src/index.ts` (`runSelfTest` mock payloads)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Extend the demo**

Add worktree and full-payload mock inputs to `runSelfTest`:

```typescript
const worktreeInput = {
  ...mockInput,
  session_id: 'demo-session',
  workspace: {
    current_dir: '/tmp/cs-wt-demo',
    repo: { host: 'github.com', owner: 'shrwnsan', name: 'claude-statusline' },
    git_worktree: 'cs-wt-demo',
  },
  worktree: {
    name: 'cs-wt-demo', path: '/tmp/cs-wt-demo', branch: 'demo/wt-feature',
    original_cwd: '/tmp/claude-statusline', original_branch: 'main',
  },
} as unknown as ClaudeInput;

const fullPayloadInput = {
  ...mockInput,
  pr: { number: 27, url: 'https://github.com/shrwnsan/claude-statusline/pull/27', review_state: 'approved' },
  cost: { total_cost_usd: 1.2344, total_duration_ms: 0, total_api_duration_ms: 0, total_lines_added: 0, total_lines_removed: 0 },
  rate_limits: { five_hour: { used_percentage: 42 }, seven_day: { used_percentage: 12 } },
  effort: { level: 'high' },
  thinking: { enabled: true },
  exceeds_200k_tokens: false,
  output_style: { name: 'default' },
} as unknown as ClaudeInput;
```

Presets (thread an optional input param through `render` — it already has
one since the self-test refactor): existing four, plus
`{ label: 'Worktree session', overrides: {}, input: worktreeInput }` and
`{ label: 'All segments on', overrides: { prBadge: true, costUsage: true, rateLimit: true, modeIndicators: true }, input: fullPayloadInput }`.

- [ ] **Step 2: Run the PRD-004 verification checklist**

```bash
bun run build && bun run build:bundle && bun test && bun run lint
bash tests/test_width.sh && bash tests/test_width_long.sh
node bin/claude-statusline --demo          # all presets render, no undefined/NaN
echo 'not json' | node bin/claude-statusline   # minimal fallback, non-empty
# detached HEAD: in a scratch sandbox clone, `git checkout --detach`, then
# render → must show short oid (7 hex), never "(no branch)" (A.3 review)
bun run benchmark                          # warm < 10 ms; no regression
```

**Note (learned 2026-09-23):** `bin/claude-statusline` prefers
`dist/index.bundle.js`, which `bun run build` (plain tsc) does **not**
rebuild — a stale bundle silently rendered 0 bytes with exit 0 while
`dist/index.js` was fine. `build:bundle` must precede any end-to-end
check via the bin wrapper.

Byte-scan for accidental PUA leakage in ASCII mode:

```bash
node bin/claude-statusline --demo | grep -P '[\x{E000}-\x{F8FF}]'
```

Expected: no matches for the default (ASCII) presets. Also scan SOURCE
FILES for NUL/control bytes — shells strip NUL from argv so `grep $'\x00'`
cannot work; use perl (per the B.3 review):

```bash
perl -ne 'print "$ARGV:$.: control byte\n" if /[\x00-\x08\x0B\x0C\x0E-\x1F]/; close ARGV if eof' tests/*.test.ts tests/porcelain-parity-helpers.ts src/index.ts
```

Record checklist results in the PR description.

- [ ] **Step 3: CHANGELOG + final commit**

Add the `2.5.0` section covering: single-spawn git, session cache,
worktree-aware display, opt-in segments, context semantics, truncate
default. Then:

```bash
git add -A
git commit -m "docs(demo): worktree + full-payload --demo presets, 2.5.0 changelog

Co-Authored-By: GLM <zai-org@users.noreply.github.com>"
```

---

## Task status

| Task | Status | PR | Notes |
|---|---|---|---|
| A.1 porcelain v2 parser | ✅ | — | `2118f17` + `28035e3` (review fixes); approved |
| A.2 parity suite | ✅ | — | `54a1398` + rich sandbox hardening; approved |
| A.3 cutover + deletion | ✅ | — | `e587ae9` + `6c8e4e6`; approved; 1 spawn proven |
| A.4 composite cache key | ✅ | — | `97043ed`; approved; cold-1/warm-0 proven |
| A.5 width chain | ✅ | — | `82e08e5` + `68b93b0`; approved ×2 |
| B.1 payload types | ✅ | — | `d8aa193`; approved |
| B.2 worktree symbol | ✅ | — | `7f09915` + `aaf10bd`; approved; glyph corrected to U+F504 post-release (`78004f6`) |
| B.3 worktree display | ✅ | — | `3a41e62`; approved; override proven live |
| C.1 PR badge | ✅ | — | `fce50f4`; review approved |
| C.2 cost | ✅ | — | `505c60a`; review approved |
| C.3 rate limits | ✅ | — | `0b0dad7`; review approved |
| C.4 mode indicators | ✅ | — | `41b5a99`; review approved |
| D.1 context semantics | ✅ | — | `6f7e568`; review approved after docs-parity fix `cfa4b5e` |
| D.2 over-limit marker | ✅ | — | `e1bb87a`; review approved; gated by window size post-release (`e577c3a` — flag is a fixed 200k threshold, `overLimitWarning: auto/always/never`) |
| D.3 absolute tokens | ✅ | — | `1437df0`; review approved |
| D.4 truncate default + docs | ✅ | — | `9e5d153` (BREAKING); review approved |
| D.5 demo + changelog | ✅ | — | `9bab040`; verification checklist executed |
| W6 final review fixes | ✅ | — | `f0a1c19` + `501e6e5`; Findings 1–6 closed; GO verdict |

---

## Follow-up chore (approved in A.4 review — deferred, separate PR after 2.5.0)

- **base64url the cache-key encoding** (`.replace(/\+/g,'-').replace(/\//g,'_')`):
  standard base64 can emit `/` from an aligned `?`/DEL byte, making
  `join(cacheDir, key)` target a nonexistent subdir — `Cache.set` fails
  silently and that dir/session pair goes cold every render. Near-unreachable
  but real. ✅ Resolved 2026-09-30 (`ae0a8fa`, PR #30): base64url chain in
  `CacheKeys.GIT_STATUS`, with adversarial `+`/`/` test.
- **Delete the dead key generators** `GIT_REMOTE_URL` / `GIT_BRANCH`
  (zero callers since the A.3 cutover). ✅ Resolved 2026-09-30 (`ae0a8fa`).
- **Prune stale `git_status_*` cache files on render** — session-scoped keys
  are unbounded (~300 B per session:dir; `cache.clear()` has zero callers).
  ✅ Resolved 2026-09-30 (`ae0a8fa`): `Cache.pruneGitStatus(5)` called after
  each successful set.
- **Truncation-atomic worktree tag** (B.3 review): smart truncation can slice
  inside the tag (`claude-statusline ·wt:fa..`); split slot into name/tag in
  `applySmartTruncation` and drop the tag wholesale before truncating.
  ✅ Resolved 2026-09-30 (`ae0a8fa`).
- **Guard empty `repo.name`** (B.3 review): `p.repoName ?? dirname` keeps
  `''` → empty project slot; `||` is safe here (Claude Code plausibly never
  sends `""`, but one character buys the guard). ✅ Resolved 2026-09-30
  (`ae0a8fa`).
- **Guard empty `vim.mode`** (C review): `formatModes({vim:{mode:''}})`
  renders orphan `' []'` — change `if (m.vim)` to `if (m.vim && m.vim.mode)`.
  Spec-verbatim doc code; unreachable via real stdin. ✅ Resolved 2026-09-30
  (`ae0a8fa`).
- **Verify the "since v2.1.15" version claim** in the README used_percentage
  bullet (D review residual nit): the 2026-09-23 schema audit dated
  used_percentage/remaining_percentage to **2.1.6**; the claim is inherited
  text and likely wrong for both fields. ✅ Resolved 2026-09-28 (`02b6b98`):
  README now says v2.1.6.
- **Guard empty `worktree.branch`** (W6): an empty string would render an
  empty branch slot — same family/unreachability as the empty repo.name and
  vim.mode guards above. ✅ Resolved 2026-09-30 (`ae0a8fa`).
- **Fix the `vpnIndicator` default in README's "Default Configuration"**
  (spotted 2026-09-24): README claims `true` (shown by default) but the zod
  schema defaults it to `false`. ✅ Resolved 2026-09-28 (`02b6b98`): both the
  defaults list and the VPN section now state `false`.
- **Add a `worktree` key to the `symbols`/`asciiSymbols` config schemas**
  (spotted 2026-09-24): `detectSymbols` merges user overrides generically, but
  the schema has no `worktree` key, so the tag glyph is not user-overridable
  despite the config docs implying per-symbol overrides. ✅ Resolved
  2026-09-30 (`ae0a8fa`): `worktree` key in both schemas + override tests.
