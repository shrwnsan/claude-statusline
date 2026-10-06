# PRD-005: Reasoning-effort indicator after model name

**Status**: Approved
**Date**: 2026-10-05
**Related**: PRD-004 C4 (modeIndicators), tasks-005 (implementation plan)

## Problem

Claude Code sends the session's reasoning effort (`effort: { level }`) in the
statusline payload, but the only renderer for it is the opt-in
`modeIndicators` bracket segment (` [hgh·thk]`), which sits at the far end of
the model string and is off by default. Users running `/effort` have no
visible feedback next to the model name.

## Requirement

Render the effort level directly after the model name as `·<level>`
(e.g. `GLM 5.3 Flash·high`). Always-on: no config knob.

- Raw level word, not the compact `EFFORT_TOKEN` mapping (`·high`, not `·hgh`).
  Unknown future level values pass through verbatim.
- Missing `effort`, missing `level`, or empty-string `level` renders nothing —
  the line is byte-identical to today's output.
- When `modeIndicators` is enabled, effort is stripped from the bracket at the
  call site so it never renders twice. All other mode tokens
  (thinking/vim/fast/agent/style) are unaffected.

## Mockups

```
Effort set (payload effort.level = "high"):
shrwnsan.github.io main 󰚩GLM 5.3 Flash·high 󱐌10%

Effort absent (old payloads, effort unset):
shrwnsan.github.io main 󰚩GLM 5.3 Flash 󱐌10%

modeIndicators=1 (effort deduped out of the bracket):
shrwnsan.github.io main 󰚩GLM 5.3 Flash·high 󱐌10% [thk·fast]

Narrow terminal: the suffix truncates as part of the model segment
(no special handling; it lives inside modelString):
shrwnsan.github.io main 󰚩GLM 5.3 Flash·h…
```

## Design

New exported pure function in `src/index.ts`, mirroring the
`formatPrBadge`/`formatCost`/`formatRateLimit` segment pattern:

```ts
export function formatEffortSuffix(effort?: { level?: string }): string {
  if (!effort?.level) return '';
  return `·${effort.level}`;
}
```

`buildStatusline` composes it immediately after `${modelName}`:

```ts
const effortSuffix = formatEffortSuffix(modes?.effort);
const modelString = `${symbols.model}${modelName}${effortSuffix}${envContext}...`;
```

Dedupe: when `effortSuffix` is non-empty, pass `{ ...modes, effort: undefined }`
to `formatModes()`; otherwise pass `modes` unchanged. `formatModes` itself is
untouched, and `EFFORT_TOKEN` stays exclusive to the bracket segment.

## Non-goals

- No config toggle (always-on by design decision).
- No ANSI styling/coloring (statusline is plain text).
- No changes to `EFFORT_TOKEN` compact tokens or `formatModes` internals.
- No change to smart truncation — the suffix is measured and truncated as part
  of `modelString` by the existing `applySmartTruncation` logic.

## Testing

`tests/segments.test.ts`:

1. `formatEffortSuffix({ level: 'high' })` → `·high` (and low/medium/xhigh/max).
2. `formatEffortSuffix()` / `{}` / `{ level: '' }` → `''`.
3. Unknown level (`'ultra'`) → `·ultra` verbatim.
4. Dedupe: with effort present, `buildStatusline` output contains `·high` after
   the model name and `formatModes` receives no effort token — bracket shows
   remaining modes only; with effort absent, bracket keeps its current shape.

## Docs

- `docs/guide-001-configuration.md`: modeIndicators section notes the dedupe.
- `README.md`: feature line.
- `docs/ref/FEATURE_COMPARISON.md`: status of the new segment.
- `CHANGELOG.md`: entry under Unreleased.

## Verification

`bun test`, `bun run lint`, `bun run build && bun run build:bundle`, then the
AGENTS.md self-test commands (`--demo` "All segments on" preset already carries
`effort: { level: 'high' }`) and a live statusline check.
