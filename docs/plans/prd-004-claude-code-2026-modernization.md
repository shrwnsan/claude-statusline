# PRD: Claude Code 2026 Modernization

**Status**: Planning
**Owner**: shrwnsan
**Created**: 2026-09-23
**Target Version**: 2.5.0
**Related Docs**:
- [Claude Code Statusline Docs](https://code.claude.com/docs/en/statusline)
- [prd-003-rendering-hygiene-and-cleanup.md](./prd-003-rendering-hygiene-and-cleanup.md) (defers this work)
- [CHANGELOG.md](../../CHANGELOG.md)

---

## Overview

PRD-003 deliberately deferred all "read the new Claude Code input fields"
work. This PRD picks it up. It is scoped by a schema audit performed
2026-09-23 against the live official docs, verified field-by-field inside the
installed Claude Code CLI (v2.1.267; upstream newest at audit time 2.1.280).

Four work streams:

1. **Performance** — collapse 6 git subprocesses per render into 1, and cache
   per the officially recommended pattern.
2. **Worktree-aware display** — today a linked worktree renders as
   `○ cs-wt-demo  demo/wt-feature …`: the worktree *dirname* masquerades as
   the project name, with no indication it is a worktree.
3. **Free segments** — PR / cost / rate-limit / mode indicators derived
   entirely from stdin fields (zero subprocesses).
4. **Context correctness** — align with docs semantics for
   `context_window.*` and make truncation the default.

## Goals

- Reduce git-related subprocess spawns from 6–8 per render to 1 (and to 0
  branch spawns inside Claude Code worktree sessions) — today only the branch
  lookup is cached; every other call runs bare on every invocation.
- Display linked worktrees as the real project plus a worktree tag, with
  ASCII-safe fallbacks.
- Expose opt-in segments for PR state, session cost, rate limits, and mode
  indicators using only stdin data.
- Follow docs semantics for `context_window` and performance (cache keyed on
  `session_id`, no `tput` shell-out).
- Feature-detect every new field — never version-gate (older CLI versions
  simply omit fields; degraded output must stay correct).

## Non-Goals (deferred)

- `subagentStatusLine` support — separate entry point, separate render path.
  Tracked as **PRD-005**.
- `prompt_cache.*` segment (diagnostic telemetry; niche audience).
- Multi-line output as a first-class feature.
- Replacing git entirely with stdin data — **the payload contains no
  pre-computed git state** (see Background). This corrects PRD-003's
  assumption that shell-outs could be replaced by `workspace.repo` /
  `worktree.branch`.

---

## Background — Payload Schema (audit 2026-09-23)

Fields this PRD consumes, with the version that introduced each:

| Field | Type | Since | Notes |
|---|---|---|---|
| `session_id` | UUID string | 1.0.71 | Officially recommended cache key |
| `workspace.repo` | `{host, owner, name}` | 2.1.145 | Parsed from `origin` remote only; identity only — no path, no branch |
| `workspace.git_worktree` | string | 2.1.98 | Worktree *name* when cwd is inside any linked worktree; absent in main tree |
| `worktree` | `{name, path, branch?, original_cwd, original_branch?}` | 2.1.69 | **Claude Code–managed worktree sessions only** (`--worktree`, EnterWorktree, background agents); `branch`/`original_branch` absent for hook-based worktrees |
| `pr` | `{number, url, review_state?, kind?}` | 2.1.145 (`kind` 2.1.234) | Present only while a PR/MR is open |
| `cost` | `{total_cost_usd, total_duration_ms, total_api_duration_ms, total_lines_added, total_lines_removed}` | 2.0.x | `total_cost_usd` is a client-side estimate; resets on `/clear` |
| `rate_limits` | `{five_hour?, seven_day?, spend_limit?}` each `{used_percentage, resets_at}` | 2.1.80 (`spend_limit` 2.1.251) | claude.ai Pro/Max or gateway spend limits only; windows drop after reset |
| `context_window.used_percentage` | number \| null | 2.1.6 | Docs recommend over `remaining_percentage`; input-only; `null` early and after `/compact` |
| `context_window.context_window_size` | number | 2.0.65 | Enables absolute-token display |
| `context_window.current_usage` | `{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}` \| null | 2.0.70 | Fallback for percentage computation (Phase D1); `null` pre-first-response |
| `exceeds_200k_tokens` | boolean | 1.0.88 | Fixed 200k threshold |
| `effort` | `{level}` | 2.1.119 | Absent if model lacks the effort param |
| `thinking` | `{enabled}` | 2.1.119 | |
| `vim` | `{mode}` | ≤2.1.x | Only when vim mode is on |
| `fast_mode` | boolean | 2.1.x | |
| `agent` | `{name}` | 2.1.x | Only with `--agent`/agent settings |
| `output_style` | `{name}` | ≤2.1.x | Always present; `"default"` unless the user set one (C4 renders it only when ≠ `"default"`) |
| `COLUMNS` / `LINES` env | number | 2.1.153 | Docs: `tput` does **not** work — output is captured |

Key constraints discovered in the audit:

- **No git state in the payload.** No dirty/staged counts, no ahead/behind,
  no stash, no branch (except `worktree.branch` in managed worktree
  sessions). Git state must still be shell-derived.
- **Lifecycle**: 300 ms debounce; a new trigger cancels our in-flight run —
  slow scripts directly delay updates. Official guidance: cache expensive git
  ops keyed on `session_id` (explicitly *not* pid) with a short TTL.
- **Width**: `COLUMNS` is already Method 1 in
  [src/ui/width.ts](../../src/ui/width.ts); the `tput` fallback is dead
  weight in statusline context.

Current render cost being replaced (all in
[src/git/native.ts](../../src/git/native.ts) /
[src/git/status.ts](../../src/git/status.ts)):
`rev-parse --git-dir`, `branch --show-current` (+ up to 2 fallbacks), `status
--porcelain`, `stash list`, `rev-parse --abbrev-ref @{u}`, ahead/behind —
6–8 spawns per render. Only the branch lookup is cached (per-directory, 60 s
TTL, [src/git/status.ts:104](../../src/git/status.ts)); every other call runs
bare on every invocation.

---

## Scope

### Phase A — P0: Performance (git consolidation + caching)

| # | Change | File(s) |
|---|---|---|
| A1a | Add a porcelain v2 parser as **new code alongside** the existing pipeline: parse `git --no-optional-locks status --porcelain=v2 --branch --show-stash` — `# branch.head` (incl. `(detached)` → render short `branch.oid` instead of today's literal `(no branch)`), `# branch.upstream`, `# branch.ab +N -N`, `# stash N` (the line is **omitted entirely** when zero stashes — default 0 on absence, never NaN), and v2 *record types* `1`/`2`/`u`/`?` — these are record types, **not** charAt(0)/charAt(1) pairs; the v1 parser logic does not translate, and rename records join `path<TAB>origPath` with a literal tab. Fixture suite compares old- and new-parser output on identical inputs. Empirically verified 2026-09-23: flags accepted, exit 128 + "not a git repository" outside a repo. | [src/git/native.ts](../../src/git/native.ts), [src/git/status.ts](../../src/git/status.ts), tests |
| A1b | Cut `getGitInfo` over to the v2 parser and delete the corpses: `checkIsRepo` (exit 128 **is** repo detection), the 3-method branch fallback chain, the v1 charAt parser, and the `stash list` / `@{u}` / ahead-behind shell-outs. `--no-optional-locks` avoids index-lock contention with the running Claude session. | [src/git/native.ts](../../src/git/native.ts), [src/git/status.ts](../../src/git/status.ts) |
| A2 | Key the git cache on the **composite** `<session_id>:<current_dir>` (git state is a function of *both* — a bare session key serves stale repo-A data after `cd` into repo B mid-session), TTL 5 s. Fall back to directory key when `session_id` is absent (`--self-test`, injected input). | [src/core/cache.ts](../../src/core/cache.ts), [src/git/status.ts](../../src/git/status.ts), [src/index.ts](../../src/index.ts) |
| A3 | Prune the dead width shell-outs **and** the lying heuristics: remove `tput cols` *and* `stty size` (both useless with captured output), and delete the `TERM_PROGRAM` sniffing that returns a hardcoded 120 exactly when `COLUMNS` is unset — i.e. in the only case where it fires, it is wrong. Final chain: `COLUMNS` → `process.stdout.columns` → `forceWidth` → fixed default. | [src/ui/width.ts](../../src/ui/width.ts) |
| A4 | Document recommended `statusLine` settings in README: `padding` (and its relation to our `rightMargin`), `refreshInterval: 3` so git state refreshes while the session idles. | [README.md](../../README.md) |

### Phase B — P0: Worktree-aware display

| # | Change | File(s) |
|---|---|---|
| B1 | Parse `worktree` from stdin. In managed worktree sessions: use `worktree.branch` directly for the branch slot (skip branch discovery entirely — 0 git spawns for branch), and render a worktree tag. | [src/index.ts](../../src/index.ts), [src/git/status.ts](../../src/git/status.ts) |
| B2 | Render the project slot as the **repo identity**, not the worktree dirname: prefer `workspace.repo.name`, fall back to basename of `current_dir`. Append a worktree tag — Nerd Font preset: dedicated glyph + name; ASCII default: `·wt:<name>` — sourced from `worktree.name` (managed sessions) or `workspace.git_worktree` (any linked worktree cwd). Absent both → exactly today's output. | [src/index.ts](../../src/index.ts), [src/ui/symbols.ts](../../src/ui/symbols.ts), [src/core/config.ts](../../src/core/config.ts) |

Example renders (ASCII default preset; model/context elided for brevity):

```
main checkout:        ◉ claude-statusline  main
managed wt session:   ◉ claude-statusline  worktree-demo-branch ·wt:wt-demo
plain linked wt cwd:  ◉ claude-statusline  demo/wt-feature ·wt:cs-wt-demo
repo.name ≠ dirname:  ◉ claude-statusline  main ·wt:wt-clone
                      (checkout dir is wt-clone; project slot from workspace.repo.name)
detached HEAD:        ◉ claude-statusline  e8d631f
```

The Nerd Font preset renders the same layout with `·wt:` replaced by a
dedicated worktree glyph (picked in tasks-004 alongside the other
`SymbolSet` entries).

### Phase C — P1: Free segments (stdin-only, opt-in)

All segments default **off** (safe-default philosophy, per PRD-003 D1), each
with a config key following the existing `src/core/config.ts` zod pattern and
an env mapping following the existing loader. All symbols ASCII-safe by
default with Nerd Font alternatives, per the PRD-003 symbol system.

| # | Segment | Payload source | Display (ASCII default) |
|---|---|---|---|
| C1 | PR badge | `pr.number`, `pr.review_state` | `#123` + state token — ASCII default `[A]`/`*`/`x`/`-` (approved/pending/changes_requested/draft); Nerd Font glyph alternatives routed through `SymbolSet`. (Do **not** use `✓`/`●`/`✗` as "ASCII" — they are U+2713/U+25CF/U+2717, and `getStringDisplayWidth` miscounts them as 2 columns, poisoning truncation math.) |
| C2 | Cost | `cost.total_cost_usd` | `~$1.23` (`~` marks the client-side estimate; `≈` has the same width-counting hazard) |
| C3 | Rate limits | `rate_limits.five_hour`, `.seven_day` | `5h:42% 7d:12%` (window shown only when present) |
| C4 | Mode indicators | `effort.level`, `thinking.enabled`, `vim.mode`, `fast_mode`, `agent.name`, `output_style.name` | compact tokens, e.g. `hgh`/`thk`/`N`/`fast`/`@agent`; rendered only when the field is present (`output_style` only when ≠ `"default"`) |

### Phase D — P1: Context correctness

| # | Change | File(s) |
|---|---|---|
| D1 | Prefer `used_percentage` (docs recommendation); render it only when non-null (already the behavior for `remaining_percentage` — keep the same guard). Fall back to computing from `current_usage` with the docs formula when percentages are null. | [src/index.ts](../../src/index.ts) |
| D2 | When `exceeds_200k_tokens` is true, append a warning marker to the context segment. | [src/index.ts](../../src/index.ts), [src/ui/symbols.ts](../../src/ui/symbols.ts) |
| D3 | Add optional absolute-token display (`context_window_size` × percentage → `~82k/200k`) behind a config flag. | [src/core/config.ts](../../src/core/config.ts), [src/index.ts](../../src/index.ts) |
| D4 | Flip `truncate` default to `true` (per PRD-003's handoff note — Claude Code wraps/truncates output itself, so untruncated output degrades layout for everyone). README upgrade note. | [src/core/config.ts](../../src/core/config.ts), [README.md](../../README.md) |

---

## Decisions

### D1 — Feature-detect, never version-gate
**Decision**: Every new field is guarded by presence (`if (input.worktree)`),
never by CLI version comparison.
**Rationale**: The schema is absent-by-design across versions; the audit
shows all consumed fields already exist in the installed base (2.1.267).
Version gates would break the `--self-test` mock payloads and add maintenance
burden for zero benefit.
**Alternatives considered**: version map + warnings — rejected (noise for
users who can't control their org's CLI version).

### D2 — Consolidate git; stdin complements, never replaces
**Decision**: One `git status --porcelain=v2 --branch --show-stash` spawn
replaces all git shell-outs. `worktree.branch` skips branch discovery in
managed sessions; `workspace.repo` provides identity only.
**Rationale**: The payload has no git state — PRD-003's "replace shell-outs
with provided fields" is not achievable for indicators. Porcelain v2
`--branch --show-stash` supersedes the 3-method branch fallback chain *and*
fixes the detached-HEAD `(no branch)` leak. `--no-optional-locks` prevents
contending with Claude Code's own git usage.
**Alternatives considered**: keeping the multi-call design and only adding
payload fields — rejected (leaves the dominant latency cost intact).

### D3 — Cache on `<session_id>:<current_dir>`, 5 s TTL
**Decision**: Git cache key becomes the composite
`<session_id>:<current_dir>` (fallback: directory alone when `session_id` is
absent), TTL 5 s — the officially documented pattern, hardened.
**Rationale**: A directory key cannot observe branch switches inside a long
session (today's 60 s TTL shows stale branches after `git checkout`). But a
bare `session_id` key over-corrects into a *new* staleness: sessions follow
`current_dir` across repos, so a session-only key serves repo A's branch
while the user stares at repo B. Git state is a function of both; the key
must be too.
**Alternatives considered**: no cache — rejected (we are invoked on every
assistant message; git cold-start dominates).

### D4 — Worktree display: repo identity + tag
**Decision**: Project slot = `workspace.repo.name` (fallback: dirname); a
worktree tag is appended from `worktree.name` / `workspace.git_worktree`.
Branch slot = `worktree.branch` when present, else git-derived.
**Rationale**: Fixes the "worktree dirname masquerades as project name"
problem without multi-line output or layout redesign. Tag-only approach
degrades to zero change outside worktrees.
**Alternatives considered**: showing `original_branch` / `original_cwd`
hints (`↩ main`) — deferred; tag format is extensible.

### D5 — New segments opt-in, ASCII-safe
**Decision**: `pr` / cost / rate-limit / mode segments ship default-off with
config + env toggles; all symbols route through the resolved `SymbolSet`
with ASCII defaults.
**Rationale**: PRD-003's root-cause lesson: unreadable glyphs and surprise
output erode trust. Opt-in keeps the default line identical for existing
users until they choose otherwise.

### D6 — `used_percentage` preferred, nulls render nothing
**Decision**: Percentages render only when non-null; `null` (pre-first-turn,
post-`/compact`) suppresses the segment rather than showing `NaN%`/`0%`.
**Rationale**: Matches docs semantics; the current guard already does this
for `remaining_percentage` and is extended to the new path.

### D7 — `truncate: true` becomes the default
**Decision**: Flip the default in **all three places it lives** — the zod
schema, `generateSampleConfig` (which has been shipping `true` all along, so
the sample config already told users to enable this), and the env mapping.
`truncate: false` remains available.
**Rationale**: PRD-003 explicitly handed this over: Claude Code wraps or
truncates statusline output itself, so naive long lines already lose content
— our own smart truncation is strictly better. The surprised population is
mostly people who never read the sample config; the README upgrade note plus
the one-line rollback (`"truncate": false`) covers them.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Porcelain v2 parser regressions vs the old multi-command pipeline. | A1a lands the parser + fixture suite with old/new output compared in tests; A1b cuts over only after parity. The mitigation lives in PR structure, not prose. |
| Exotic repos render wrong ahead/behind or paths: shallow clones may omit `branch.ab`; Windows adds CRLF and backslash paths in `2` records. | Parser fixtures for both cases; absent lines default to 0/absent — never NaN, never crash. |
| 5 s TTL shows stale indicators during rapid edits. | Acceptable by design (docs' own example uses 5 s); `refreshInterval` documented so idle-period refresh covers background changes. |
| `workspace.repo.name` can differ from the dirname users know (repo `name` ≠ checkout dir). | B2 only rewrites the project slot when a worktree tag is rendered; plain main-checkout output keeps today's dirname. README upgrade note documents the worktree-slot behavior. |
| `output_style.name` is always present (defaults to `"default"`), so an unconditional token would add permanent noise. | C4 renders it only when the name differs from `"default"`. |
| Rate-limit / cost values confuse non-Pro users ("why is nothing shown?"). | Segments are opt-in (D5); README documents availability requirements. |
| `truncate` default flip changes line appearance for existing users. | README upgrade note with one-line rollback (`"truncate": false`); snapshot tests pin narrow-width behavior. |
| New segments increase line width and trigger truncation. | Smart truncation already prioritizes project+git; segment ordering documented, mode indicators truncated first. |

---

## Verification Plan

1. **Functionality**: `bun test` passes; width scripts
   (`tests/test_width.sh`, `tests/test_width_long.sh`) pass; the A1a parser
   fixture suite covers dirty, staged, renamed (tab-terminated `2` record),
   unmerged `u`, untracked, **zero-stash (line omitted)**, stash non-zero,
   upstream present / **no upstream** / **shallow clone**, detached HEAD,
   and Windows paths.
2. **Spawn count**: instrument or count processes during one render —
   exactly 1 git spawn outside worktree sessions; 0 branch spawns (status
   command still runs for indicators) in managed worktree sessions.
3. **`--demo` presets extended** with mock payloads: managed worktree
   session, plain linked worktree, PR present, cost + rate limits, mode
   indicators, `exceeds_200k_tokens`, detached HEAD.
4. **Feature-detection**: strip each new field from the mock payload and
   assert output degrades to today's rendering (no `undefined`, no `NaN`).
5. **No-blank-statusline**: malformed/truncated JSON still produces the
   minimal render (PRD-003 guarantee must not regress).
6. **Performance**: two measures — (a) spawn-harness cold gate: the repo's
   `bun run benchmark` is spawn-based (node startup ~50 ms floor), so it
   gates cold renders only (target under 100 ms); (b) in-process warm
   measure of `render()` — target sub-millisecond, no regression (0.49 ms →
   0.58 ms median across Phase D, with **0 git spawns** on warm 5 s-TTL
   cache hits, proven by a logging git shim). The ≥50k-file large-repo
   fixture remains a follow-up — no such scenario exists in the benchmark
   yet.
7. **Visual**: hexdump grep for PUA/U+FE0E leakage in ASCII mode when new
   segments are enabled.

---

## Rollout

- One PR per unit — A1a (parser + fixtures), A1b (cutover + deletion),
  A2+A3, B, C, D — split deliberately so a data-layer rewrite never hides
  inside a "performance" PR.
- Implementation tasks tracked in
  `tasks-004-prd-004-claude-code-2026-modernization.md` (to be drafted after
  this PRD is approved, per the PRD → tasks convention).
- Bump to `2.5.0` after all phases merge; single CHANGELOG section with
  per-phase entries.
- README: new "Recommended settings" snippet (`padding`,
  `refreshInterval`), worktree display example, upgrade notes for
  `truncate` default and `repo.name` project slot.

---

## Status Tracking

| Phase | Status | PR | Notes |
|---|---|---|---|
| A — Performance (git consolidation) | ✅ Complete | — | A1a/A1b/A2/A3 landed + review-approved; 1 spawn proven |
| B — Worktree-aware display | ✅ Complete | — | B1/B2/B3 landed + review-approved; override proven live |
| C — Free segments | ✅ Complete | — | C1–C4 landed + review-approved; default-off proven both ways |
| D — Context correctness | ✅ Complete | — | D1–D5 landed + review-approved; docs parity fixed |

Update this table as each phase progresses (⬜ → 🔄 → ✅).

---

## Out of Scope (tracked elsewhere)

- **PRD-005**: `subagentStatusLine` support — per-task rows (id, name,
  status, model, effort, token counts) via the separate `subagentStatusLine`
  command contract (per-task `model`/`contextWindowSize` 2.1.205, `effort`
  2.1.214).
- `prompt_cache.*` display segment.
- Multi-line output as a first-class feature.
