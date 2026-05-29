# Tasks: Rendering Hygiene & Codebase Cleanup

> Derived from [PRD-003](./prd-003-rendering-hygiene-and-cleanup.md)

**Status**: ⬜ Not started
**Target Version**: 2.4.0

---

## Conventions

- Each task is **independent** unless it lists a dependency.
- Each task names the **single file (or small set)** it owns. Different tasks
  do not edit the same lines.
- Acceptance criteria are objective; a junior dev or subagent should be able
  to self-verify.
- Validation command for every code change:
  ```bash
  bun run build && bun test && bun run lint
  ```
- Update the status table in
  [PRD-003](./prd-003-rendering-hygiene-and-cleanup.md#status-tracking) when
  a phase completes.

---

## Phase A — P0: Rendering fixes (single PR)

Goal: stop emitting glyphs that render as tofu / random chars on terminals
without a Nerd Font.

### Task A.1 — Add `nerdFont` config field

**File**: [src/core/config.ts](../../src/core/config.ts)

1. Add a new boolean field to `ConfigSchema`:
   ```ts
   nerdFont: z.boolean().default(false), // Opt-in Nerd Font glyphs (default: false / ASCII)
   ```
2. In `loadEnvConfig()` add:
   ```ts
   if (process.env.NERD_FONT === '1' || process.env.CLAUDE_CODE_STATUSLINE_NERD_FONT === '1') {
     env.nerdFont = true;
   }
   ```
3. Update `generateSampleConfig()` to include `nerdFont: false` with a comment.

**Acceptance**:
- `Config` type has `nerdFont: boolean`.
- `NERD_FONT=1` or `CLAUDE_CODE_STATUSLINE_NERD_FONT=1` sets `nerdFont = true`.
- Build passes.

---

### Task A.2 — Replace auto-detection with explicit opt-in

**File**: [src/ui/symbols.ts](../../src/ui/symbols.ts)

1. Delete `detectNerdFontSupport`, `detectViaFontList`,
   `detectNerdFontInstallation`, `detectFromEnvironment`,
   `detectPlatformSpecific`, `testSymbolDisplay`, and the `TerminalInfo`
   interface — they are obsolete after Task A.1.
2. Simplify `detectSymbols(config)` to:
   ```ts
   export async function detectSymbols(config: Config): Promise<SymbolSet> {
     if (config.nerdFont && !config.noEmoji) {
       return { ...NERD_FONT_SYMBOLS, ...config.symbols };
     }
     return { ...ASCII_SYMBOLS, ...config.asciiSymbols };
   }
   ```
3. Remove the symbol cache (`symbolCache`, `CACHE_VERSION`) — selection is
   now O(1) and pure.
4. Keep the function `async` so callers don't need to change.

**Dependencies**: Task A.1.

**Acceptance**:
- No filesystem or shell calls remain in `symbols.ts`.
- ASCII is returned unless `config.nerdFont === true && config.noEmoji === false`.
- `bun test` passes.

---

### Task A.3 — Drop variation selector from default `contextWindow` symbol

**Files**:
- [src/core/config.ts](../../src/core/config.ts)
- [src/ui/symbols.ts](../../src/ui/symbols.ts)

1. In `ConfigSchema.symbols`, change `contextWindow` default from `'⚡︎'`
   (U+26A1 + U+FE0E) to `'⚡'` (U+26A1 alone). This is the Nerd Font preset.
2. In `NERD_FONT_SYMBOLS` (symbols.ts) change `contextWindow: '⚡︎'` to
   `contextWindow: '⚡'`.
3. Leave `ASCII_SYMBOLS.contextWindow = '≈'` untouched.
4. Verify with hexdump:
   ```bash
   echo '{"workspace":{"current_dir":"'"$PWD"'"},"model":{"display_name":"X"},"context_window":{"remaining_percentage":50}}' \
     | node dist/index.bundle.js | hexdump -C
   ```
   No `FE 0E` byte sequence should appear in output.

**Acceptance**:
- No occurrence of U+FE0E anywhere in `src/` (grep: `rg $'\ufe0e' src/`).
- Hexdump of default output is free of the variation selector.

---

### Task A.4 — Fix env-icon ASCII leak in `getEnvironmentSymbols`

**Files**:
- [src/ui/symbols.ts](../../src/ui/symbols.ts)
- [src/core/config.ts](../../src/core/config.ts)

1. Add three icons to `SymbolSet` interface and both symbol presets:
   ```ts
   // NERD_FONT_SYMBOLS
   node: '',
   python: '',
   docker: '',
   // ASCII_SYMBOLS
   node: 'node',
   python: 'py',
   docker: 'dkr',
   ```
   Add matching `symbols.node/python/docker` and
   `asciiSymbols.node/python/docker` defaults in `ConfigSchema` (config.ts).
2. Refactor `getEnvironmentSymbols(symbolSet)` to read from `symbolSet`:
   ```ts
   export function getEnvironmentSymbols(symbolSet: SymbolSet) {
     return {
       node: symbolSet.node,
       python: symbolSet.python,
       docker: symbolSet.docker,
       git: symbolSet.git,
       model: symbolSet.model,
     };
   }
   ```
3. In ASCII mode, ensure a space is added between the label and the version
   in the env formatter so output reads `node 22.17` not `node22.17` — adjust
   [src/env/context.ts](../../src/env/context.ts)
   `EnvironmentFormatter.formatWithIcons` to insert a space *only when* the
   icon contains an ASCII letter (heuristic: `/[a-z]/i.test(icon)`).

**Dependencies**: Task A.2 (so `SymbolSet` is the single source of truth).

**Acceptance**:
- `noEmoji=1 envContext=1` output contains no PUA code points
  (grep test: `rg $'[\uE000-\uF8FF]'`).
- ASCII output reads e.g. `node 22.17 py 3.13`.

---

## Phase B — P2: Hygiene & cleanup (single PR)

Goal: shrink surface area, remove dead code, eliminate blank-statusline
failure modes.

### Task B.1 — Replace `process.exit(1)` with minimal-mode fallback

**File**: [src/index.ts](../../src/index.ts)

1. Add a helper at the bottom of the file:
   ```ts
   function renderMinimal(input?: Partial<ClaudeInput>): string {
     const dir = input?.workspace?.current_dir?.split(/[/\\]/).pop() ?? '?';
     const model = input?.model?.display_name ?? '?';
     return `${dir} *${model}`;
   }
   ```
2. Replace each `process.exit(1)` site in `main()` and
   `applySmartTruncation()` with:
   ```ts
   process.stdout.write(renderMinimal(input));
   process.exit(0);
   ```
3. Keep `console.error(...)` for diagnostics — stderr is fine.
4. Keep the top-level `try/catch` but in its `catch` print
   `renderMinimal()` (no args) before exiting 0.

**Acceptance**:
- `rg "process.exit\(1\)" src/index.ts` returns no matches.
- Injecting `{}` (no workspace/model) produces non-empty stdout, exit code 0.

---

### Task B.2 — Walk parent directories for config discovery

**File**: [src/core/config.ts](../../src/core/config.ts)

Replace `loadConfigFile` body:

```ts
function loadConfigFile(cwd: string): Partial<Config> {
  const visited = new Set<string>();
  let dir = cwd;
  while (dir && !visited.has(dir)) {
    visited.add(dir);
    for (const filename of CONFIG_FILES) {
      const configPath = join(dir, filename);
      if (existsSync(configPath)) {
        try {
          const content = readFileSync(configPath, 'utf-8');
          return filename.endsWith('.json') ? JSON.parse(content) : parseYaml(content);
        } catch (err) {
          console.warn(`[WARNING] Failed to parse ${configPath}:`,
            err instanceof Error ? err.message : String(err));
        }
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  // Final fallback: ~/.claude/
  for (const filename of CONFIG_FILES) {
    const configPath = join(homedir(), '.claude', filename);
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, 'utf-8');
      return filename.endsWith('.json') ? JSON.parse(content) : parseYaml(content);
    }
  }
  return {};
}
```

**Acceptance**:
- Config in any ancestor directory of `cwd` is discovered.
- Filesystem root is handled without infinite loop.
- Existing tests pass.

---

### Task B.3 — Delete dead code

**Files**: edit each independently.

| File | Delete |
|---|---|
| [src/env/context.ts](../../src/env/context.ts) | `EnvironmentDetector.formatEnvironmentInfo` (lines 256–272), `getAdditionalTools` (~277–290), `EnvironmentFormatter.format`, `formatCompact`, `formatVerbose`, `formatMinimal` (keep `formatWithIcons` — it is used by index.ts). |
| [src/ui/width.ts](../../src/ui/width.ts) | `softWrapText` (~357–421). |
| [src/ui/symbols.ts](../../src/ui/symbols.ts) | `testSymbolDisplay` (already removed if Task A.2 done — otherwise remove here). |

**Acceptance**:
- Each deleted symbol has zero references: `rg <symbolName> src/ tests/`.
- Build + tests pass.

---

### Task B.4 — Unify soft-wrap implementations

**File**: [src/index.ts](../../src/index.ts)

1. Decide on one strategy: **prefer wrapping the entire model string to the
   second line** when it does not fit (current model-string behavior). Drop
   the generic `applySoftWrap` fallback.
2. Delete `applySoftWrap` and `applySoftWrapToModelString`.
3. Replace their call sites with one new helper:
   ```ts
   function wrapModelString(text: string, maxWidth: number): string {
     return getStringDisplayWidth(text) <= maxWidth ? text : `\n${text}`;
   }
   ```
4. Adjust `applySmartTruncation` to call `wrapModelString` instead.

**Acceptance**:
- Only one wrap helper remains in the file.
- `tests/test_width.sh` and `tests/test_width_long.sh` still pass.
- No mid-string breaks of model name on narrow widths.

---

### Task B.5 — Replace VPN `sh -c` with `execFile`

**File**: [src/env/context.ts](../../src/env/context.ts)

1. Change `getVPNStatus` (macOS branch) to call `netstat` directly and filter
   in JS:
   ```ts
   const { execFile } = await import('child_process');
   const { promisify } = await import('util');
   const exec = promisify(execFile);
   const { stdout } = await exec('netstat', ['-rn'], { timeout: 1000 });
   if (/^default.*utun[0-9]/m.test(stdout)) return true;
   ```
2. Wrap the result in `cachedCommand`-equivalent caching via the existing
   `Cache` API (use the same `cacheKey` and `vpnTTL`).
3. Do the same for the `scutil` fallback: `execFile('scutil', ['--nwi'])`
   then grep for `utun` in JS.

**Acceptance**:
- `rg "sh -c" src/env/context.ts` returns no matches.
- VPN-on / VPN-off detection still works (manual test on macOS).

---

### Task B.6 — Remove indicator-order validation loop

**File**: [src/git/status.ts](../../src/git/status.ts)

Delete lines ~246–267 (the `if (process.env.NODE_ENV !== 'production') { ...
validation loop }` block). The order is enforced by the static sequence of
`if (...) indicatorChars.push(...)` calls immediately below it.

**Acceptance**:
- `formatIndicators` is shorter and only contains the push sequence.
- Build + tests pass.

---

## Phase C — P3 #16: Self-test CLI (single PR)

Goal: let users debug their statusline without launching Claude Code.

### Task C.1 — Add `--self-test` flag

**File**: [src/index.ts](../../src/index.ts)

1. At the very top of `main()`, before reading stdin:
   ```ts
   const args = process.argv.slice(2);
   if (args.includes('--self-test') || args.includes('--demo')) {
     await runSelfTest(args.includes('--demo'));
     return;
   }
   ```
2. Add `runSelfTest(demo: boolean)` that:
   - Builds a canonical mock input matching the official docs example:
     ```ts
     const mock = {
       cwd: process.cwd(),
       workspace: { current_dir: process.cwd() },
       model: { id: 'claude-opus-4-7', display_name: 'Opus' },
       context_window: { remaining_percentage: 75 },
     };
     ```
   - Pipes it through `buildStatusline(...)` and prints to stdout.
   - If `demo`, runs the render under 4 presets:
     1. ASCII default
     2. ASCII + git
     3. Nerd Font (set `config.nerdFont = true` in memory)
     4. Narrow terminal (`forceWidth = 40`)
     Print each labeled block separated by `---`.

**Dependencies**: Tasks A.1 and A.2 (uses `config.nerdFont`).

**Acceptance**:
- `node dist/index.bundle.js --self-test` prints a non-empty statusline and
  exits 0 without any stdin input.
- `--demo` prints 4 labeled variants.

---

### Task C.2 — Document `--self-test` in README and troubleshooting guide

**Files**:
- [README.md](../../README.md)
- [docs/guides/guide-002-troubleshooting.md](../guides/guide-002-troubleshooting.md)

1. README: add a "Verify install" subsection with:
   ```bash
   claude-statusline --self-test
   claude-statusline --demo
   ```
2. Troubleshooting guide: add an entry "Glyphs render as tofu / random chars"
   that recommends running `--demo` and toggling `NERD_FONT=1`.

**Acceptance**:
- Both files reference `--self-test` and `--demo`.

---

### Task C.3 — Add CHANGELOG entry

**File**: [CHANGELOG.md](../../CHANGELOG.md)

Add a `## [2.4.0] - YYYY-MM-DD` section covering all three phases:

```markdown
### Changed
- Nerd Font support is now opt-in via `nerdFont: true` config or `NERD_FONT=1`
  (default: ASCII). Eliminates tofu / random-char rendering on terminals
  without a Nerd Font installed.
- Default `contextWindow` symbol no longer includes the U+FE0E text variation
  selector, fixing visible artifacts on Terminal.app and tmux.

### Added
- `--self-test` and `--demo` CLI flags for verifying rendering without
  launching Claude Code.

### Fixed
- Environment icons (node/python/docker) now respect ASCII mode instead of
  leaking Nerd Font PUA characters.
- Non-zero exits replaced with a minimal-mode render to prevent blank
  statusline (per Claude Code statusline contract).
- Config discovery now walks all parent directories.

### Removed
- Unreliable Nerd Font auto-detection (`system_profiler`, `brew list`,
  terminal-program heuristics).
- Dead code: `EnvironmentDetector.formatEnvironmentInfo`,
  `EnvironmentFormatter.format/Verbose/Minimal`, `softWrapText`,
  `testSymbolDisplay`, `getAdditionalTools`, indicator-order validation loop.
```

**Acceptance**:
- Entry exists and matches existing CHANGELOG format.

---

## Final Gate — Phase D: Verify everything

### Task D.1 — Full verification suite

```bash
# Build
bun run build && bun run build:bundle

# Tests
bun test
tests/test_width.sh
tests/test_width_long.sh

# Lint
bun run lint

# Performance — must stay under 100ms cold, under 10ms warm
bun run benchmark

# Visual sanity checks
node dist/index.bundle.js --demo
CLAUDE_CODE_STATUSLINE_NO_EMOJI=1 echo '{"workspace":{"current_dir":"/tmp"},"model":{"display_name":"Test"}}' \
  | node dist/index.bundle.js | hexdump -C
# Expect: no FE 0E byte sequence, no E0 A0 PUA byte sequence.
```

**Acceptance**:
- All commands succeed.
- Hexdump confirms no variation-selector and no PUA characters in ASCII mode.
- Benchmark within budget.

---

## Task Dependency Graph

```diagram
Phase A (P0 rendering):
  A.1 (config field) ──┬── A.2 (replace detection) ──┐
                       │                              │
  A.3 (drop VS-16)  ───┘                              ├── A.4 (env icons)
                                                      │
Phase B (P2 cleanup) — fully parallel:                │
  B.1 (no exit 1) ─────────────────────────────────┐  │
  B.2 (parent walk) ───────────────────────────────┤  │
  B.3 (dead code) ─────────────────────────────────┤  │
  B.4 (unify wrap) ────────────────────────────────┤  │
  B.5 (no sh -c) ──────────────────────────────────┤  │
  B.6 (no order loop) ─────────────────────────────┤  │
                                                   │  │
Phase C (P3 self-test):                            │  │
  C.1 (--self-test) ── needs A.1, A.2 ─────────────┼──┘
  C.2 (docs) ──────────────────────────────────────┤
  C.3 (CHANGELOG) ─────────────────────────────────┤
                                                   │
Final gate:                                        │
  D.1 (verify all) ◀──────────────────────────────┘
```

**Parallel lanes**:
- **A.1 and A.3** can run simultaneously (different fields in different
  sections).
- **A.2 depends on A.1**; **A.4 depends on A.2**.
- **All Phase B tasks** are independent of each other and of Phase A — they
  can be fanned out to six junior devs / subagents in parallel.
- **Phase C.1** depends on Phase A (uses `config.nerdFont`); **C.2 and C.3**
  are pure docs and can run any time.
- **D.1** is the final integration gate — run after all PRs merge.

**Suggested PR boundaries**:
- PR #1 = Phase A (Tasks A.1–A.4)
- PR #2 = Phase B (Tasks B.1–B.6)
- PR #3 = Phase C (Tasks C.1–C.3)
- D.1 is run on the merge of each PR.
