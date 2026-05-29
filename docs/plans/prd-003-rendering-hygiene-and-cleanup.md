# PRD: Rendering Hygiene & Codebase Cleanup

**Status**: Planning
**Owner**: shrwnsan
**Created**: 2026-05-22
**Target Version**: 2.4.0
**Related Docs**:
- [Claude Code Statusline Docs](https://code.claude.com/docs/en/statusline)
- [CHANGELOG.md](../../CHANGELOG.md)
- [eval-002-comprehensive-code-review.md](./eval-002-comprehensive-code-review.md)

---

## Overview

A retrospective against the current Claude Code statusline contract surfaced
three classes of problems in v2.3.1:

1. **User-visible glyph artifacts** ("random chars") caused by over-eager Nerd
   Font auto-detection and a variation-selector in the default context-window
   symbol.
2. **Dead/duplicate code paths** that increase maintenance cost without adding
   value.
3. **Missing observability surfaces** (no `--self-test`, no graceful
   degradation when validation fails — which causes a *blank* statusline per
   the official docs).

This PRD scopes a focused, low-risk release that fixes (1), cleans up (2), and
introduces a developer-facing self-test (3). It explicitly defers the larger
"modernize for Claude Code 2026" work (new input fields, subagent statusline)
to a follow-up PRD.

## Goals

- Eliminate every observed "random char / tofu" rendering on terminals that do
  not have a Nerd Font installed.
- Make the default behavior safe everywhere (ASCII first, opt-in to Nerd
  Font), with no behavioral change for users who already opted in via config.
- Shrink the surface area of the codebase by removing dead/duplicated logic.
- Add a `--self-test` flag matching the official docs' "Test with mock input"
  pattern.
- Never produce a blank statusline — degrade gracefully on any error path.

## Non-Goals (deferred to future PRDs)

- Reading new Claude Code fields: `cost.*`, `rate_limits.*`,
  `exceeds_200k_tokens`, `worktree.*`, `workspace.repo.*`, `output_style.*`,
  `effort.*`, `thinking.*`, `vim.*`, `agent.*`, `pr.*`.
- Replacing our git shell-outs with `workspace.repo` / `worktree.branch`
  data from Claude Code.
- `subagentStatusLine` support.
- Multi-line output as a first-class feature.

These are all tracked for a separate **PRD-004: Claude Code 2026
Modernization**.

---

## Background — Retro Findings

### Root cause of the "random chars" report

Investigated in [src/ui/symbols.ts](../../src/ui/symbols.ts) and
[src/core/config.ts](../../src/core/config.ts):

1. `detectNerdFontSupport()` returns `hasNerdFont: true` for any terminal in
   `['vscode', 'ghostty', 'wezterm', 'iterm', ...]` — but this conflates
   *terminal program* with *the user's active font*. Users on VSCode/iTerm
   without a Nerd Font installed see tofu (`` `` U+E0A0,
   `` 󰚩 `` U+F06A9).
2. The default `contextWindow` symbol is `'⚡︎'` = U+26A1 + **U+FE0E**
   (text variation selector). Many terminals — Terminal.app, tmux, some
   Alacritty configs — render this as the lightning bolt **plus** a visible
   variation-selector box. This is almost certainly the most visible
   "random char" the user reported.
3. `getEnvironmentSymbols()` in [src/ui/symbols.ts](../../src/ui/symbols.ts)
   returns Nerd Font PUA characters (`''`, `''`, `''`) unconditionally —
   they leak through even when `noEmoji=1` is set, because they are not
   sourced from the resolved `SymbolSet`.

### Other findings (cleanup scope)

- `system_profiler SPFontsDataType` and `brew list | grep -i font` are slow
  shell-outs (often >2s on macOS cold start) — they violate the <100ms budget
  and contradict our own caching philosophy.
- Three overlapping wrap implementations: `applySoftWrap`,
  `applySoftWrapToModelString` ([src/index.ts](../../src/index.ts)) and the
  unused `softWrapText` ([src/ui/width.ts](../../src/ui/width.ts)).
- Dead code: `EnvironmentDetector.formatEnvironmentInfo`,
  `EnvironmentFormatter.format/Verbose/Minimal`, `getAdditionalTools`,
  `testSymbolDisplay`, `softWrapText`.
- Indicator-order validation loop in
  [src/git/status.ts](../../src/git/status.ts#L246-L267) runs on every
  invocation in non-prod — pure overhead validating a static order.
- All `process.exit(1)` paths in [src/index.ts](../../src/index.ts) produce a
  **blank statusline** (per official docs). Should degrade gracefully.
- Config discovery in
  [src/core/config.ts](../../src/core/config.ts#L100-L125) only searches
  `cwd`, one parent, and `~/.claude/`. Should walk all parents (git-style).
- VPN detection at
  [src/env/context.ts](../../src/env/context.ts#L227) re-introduces `sh -c`
  pipelines after the v2.1.7 hardening. Inconsistent with the new posture.

---

## Scope

### Phase A — P0: "Random chars" fixes

| # | Change | File(s) |
|---|---|---|
| A1 | Default `nerdFont` to **opt-in**. Remove terminal-program-implies-NF heuristics. Honor explicit `NERD_FONT=1` env and `nerdFont: true` config. | [src/ui/symbols.ts](../../src/ui/symbols.ts), [src/core/config.ts](../../src/core/config.ts) |
| A2 | Change default `contextWindow` symbol to `≈` (already the ASCII default) — drop U+FE0E variation selector. Keep `⚡` (no VS-16) as a Nerd Font alternative. | [src/core/config.ts](../../src/core/config.ts), [src/ui/symbols.ts](../../src/ui/symbols.ts) |
| A3 | Fix `getEnvironmentSymbols` to source from the resolved `SymbolSet` and provide ASCII labels (`node`, `py`, `dkr`) in ASCII mode. | [src/ui/symbols.ts](../../src/ui/symbols.ts), [src/core/config.ts](../../src/core/config.ts) |
| A4 | Remove `system_profiler` and `brew list` font detection paths. Keep only explicit env/config opt-in. | [src/ui/symbols.ts](../../src/ui/symbols.ts) |

### Phase B — P2: Hygiene & cleanup

| # | Change | File(s) |
|---|---|---|
| B1 | Replace all `process.exit(1)` in main render path with a "minimal mode" fallback that prints `[model] [dir]` rather than going blank. | [src/index.ts](../../src/index.ts) |
| B2 | Walk all parent directories for config discovery (stop at filesystem root or git toplevel). | [src/core/config.ts](../../src/core/config.ts) |
| B3 | Delete dead code: `EnvironmentDetector.formatEnvironmentInfo`, `EnvironmentFormatter.format/Verbose/Minimal`, `softWrapText`, `testSymbolDisplay`, `getAdditionalTools`. | [src/env/context.ts](../../src/env/context.ts), [src/ui/symbols.ts](../../src/ui/symbols.ts), [src/ui/width.ts](../../src/ui/width.ts) |
| B4 | Collapse `applySoftWrap` + `applySoftWrapToModelString` into a single strategy. Document the chosen behavior. | [src/index.ts](../../src/index.ts) |
| B5 | Replace `sh -c "netstat ... \| grep ..."` in VPN detection with `execFile('netstat', ['-rn'])` + in-process filtering. | [src/env/context.ts](../../src/env/context.ts) |
| B6 | Remove indicator-order validation loop (static order). | [src/git/status.ts](../../src/git/status.ts) |

### Phase C — P3 #16: Self-test CLI

| # | Change | File(s) |
|---|---|---|
| C1 | Add `--self-test` flag that injects a canonical mock JSON payload (matching the docs example) and prints the rendered output. Useful for users debugging their config without Claude Code. | [src/index.ts](../../src/index.ts), [bin/claude-statusline](../../bin/claude-statusline) |
| C2 | Add a `--demo` alias that runs the self-test through several preset variants (ASCII, Nerd Font, narrow terminal, with git, with VPN). | [src/index.ts](../../src/index.ts) |
| C3 | Document `--self-test` in [README.md](../../README.md) and [docs/guides/guide-002-troubleshooting.md](../guides/guide-002-troubleshooting.md). | docs |

---

## Decisions

### D1 — Nerd Font is opt-in, not auto-detected
**Decision**: Remove all auto-detection. Users explicitly enable Nerd Font via
`NERD_FONT=1` or `"nerdFont": true` in config. Default is ASCII.
**Rationale**: Auto-detection cannot reliably know which font a terminal is
actually rendering with. False positives produce tofu, which is worse than
plain ASCII. Users who care about icons will set the flag once.
**Alternatives considered**:
- *Probe the terminal via OSC sequences* — fragile, slow, terminal-specific.
- *Ship our own glyph image* — out of scope for a statusline.

### D2 — Drop the variation selector from `contextWindow`
**Decision**: Default to `≈` (already the ASCII default). Nerd Font preset
uses plain `⚡` without U+FE0E.
**Rationale**: Variation selectors are inconsistently honored across
terminals. The character is the root cause of visible artifacts on Terminal.app
and tmux.

### D3 — Never exit non-zero in the render path
**Decision**: All error paths fall back to a minimal `[model] [dir]` render
written to stdout. Errors go to stderr but do not affect exit code.
**Rationale**: Per the official docs, non-zero exit causes a blank statusline.
Blank is worse than degraded.

### D4 — Defer modernization to PRD-004
**Decision**: This PRD does *not* read new fields or replace the git
shell-outs.
**Rationale**: Keep the diff reviewable. Modernization deserves its own design
exercise (especially cost/rate-limit display formatting and worktree UX).
### D5 — Remove dead `softWrap`, keep functional `noSoftWrap`
**Decision**: Delete the `softWrap` config field + `CLAUDE_CODE_STATUSLINE_SOFT_WRAP`
env var (nothing reads `config.softWrap`). Keep `noSoftWrap` and wire it into
the unified wrap helper as the single-line escape hatch.
**Rationale**: `softWrap` is vestigial; removing it is pure cleanup (Zod strips
unknown keys, so existing configs won't break). `noSoftWrap` is live and
documented — removing it would be a breaking change for opted-in users.
### D6 — Self-test reuses a shared `render()` core, not a duplicated pipeline
**Decision**: Extract the orchestration in `main()` into an internal
`render(input, config): Promise<string>` (no stdout / `process.exit`). Both
`main()` and `runSelfTest()` call it; `main()` gains an optional injected-input
param.
**Rationale**: `buildStatusline` only takes pre-computed components, so
exporting it alone would force `runSelfTest` to duplicate ~30 lines of
orchestration and risk drift from the real render path. Tests invoke the binary
as a subprocess, so changing `main()`'s signature is safe.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Users who relied on auto-detected Nerd Fonts suddenly see ASCII. | Document the opt-in clearly in CHANGELOG + README upgrade notes. Provide a `NERD_FONT=1` one-liner. |
| ASCII fallback for env icons (`node`, `py`, `dkr`) looks busier than the icons. | Acceptable — busier > broken. Users with Nerd Fonts still see icons. |
| Removing soft-wrap variants changes wrap behavior for some users. | Snapshot tests at narrow widths (`tests/test_width.sh`, `test_width_long.sh`) must pass before/after. |
| `--self-test` adds CLI argument parsing complexity. | Minimal — single flag check before stdin read. No new dependency. |

---

## Verification Plan

For each phase, before merging:

1. **Functionality**:
   - `bun test` passes (existing suite).
   - `tests/test_width.sh` and `tests/test_width_long.sh` pass.
   - `--self-test` produces non-empty, non-blank output for every preset.
2. **Performance**: `bun run benchmark` shows no regression (target: stay
   under 100ms cold, under 10ms warm).
3. **Compatibility matrix**:
   - macOS Terminal.app (no Nerd Font)
   - iTerm2 (no Nerd Font + Nerd Font)
   - Ghostty + Nerd Font
   - tmux on macOS
   - Linux (Alacritty, gnome-terminal)
4. **No-blank-statusline**: deliberately inject malformed JSON and confirm
   stdout is non-empty.
5. **Visual confirmation**: hexdump output and grep for stray U+FE0E /
   U+FE0F / PUA characters when `noEmoji=1`.

---

## Rollout

- Single PR per phase (A, B, C) for reviewability.
- Bump to `2.4.0` after all three phases merge.
- CHANGELOG entries per phase under the same `2.4.0` heading.
- README upgrade note at the top of the install section explaining the Nerd
  Font opt-in.

---

## Status Tracking

| Phase | Status | PR | Notes |
|---|---|---|---|
| A — P0 rendering fixes | ⬜ Not started | — | — |
| B — P2 cleanup | ⬜ Not started | — | — |
| C — P3 self-test | ⬜ Not started | — | — |

Update this table as each phase progresses (⬜ → 🔄 → ✅).

---

## Out of Scope (tracked elsewhere)

- **PRD-004**: Claude Code 2026 modernization
  - Read `cost.*`, `rate_limits.*`, `exceeds_200k_tokens`, `worktree.*`,
    `workspace.repo.*`, `output_style.*`, `effort.*`, `thinking.*`,
    `vim.*`, `agent.*`, `pr.*`.
  - Replace git shell-outs with provided fields.
  - Make `truncate: true` the default; document `rightMargin` ↔ Claude
    Code's `padding`.
- **PRD-005**: `subagentStatusLine` support
  - Separate entry point, separate render path.
