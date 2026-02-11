# Tasks: VPN Indicator Cross-Platform Support

> Derived from [PRD-02](plans/prd-02-vpn-cross-platform-support.md)

---

## Phase 1: Linux VPN Detection (Code)

### Task 1.1 — Extract macOS logic into `getMacOSVPNStatus()`

**File**: `src/env/context.ts`

Refactor the existing `getVPNStatus()` method:

1. Move lines 212–234 (the macOS-specific body) into a new private method `getMacOSVPNStatus(cacheKey: string, vpnTTL: number): Promise<boolean | null>`.
2. The moved code already uses `cachedCommand` with `cacheKey` and `vpnTTL` — keep it unchanged.
3. The outer `getVPNStatus()` should become a platform dispatcher (see Task 1.3).

**Acceptance criteria**:
- `getMacOSVPNStatus` exists as a private method.
- No functional change on macOS — same command, same caching, same return values.
- `bun run build` passes.

---

### Task 1.2 — Add `getLinuxVPNStatus()` method

**File**: `src/env/context.ts`

Add a new private method directly below `getMacOSVPNStatus()`:

```typescript
private async getLinuxVPNStatus(cacheKey: string, vpnTTL: number): Promise<boolean | null> {
  try {
    const result = await cachedCommand(
      this.cache,
      cacheKey,
      'sh',
      ['-c', 'ls /sys/class/net 2>/dev/null | grep -E "^(tun|tap|wg|ppp|tailscale)[0-9]" && echo "detected" || echo "not detected"'],
      vpnTTL
    );
    return result?.trim() === 'detected';
  } catch (error) {
    console.debug('[DEBUG] Failed to get Linux VPN status:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
```

**Acceptance criteria**:
- Method exists, follows the same pattern as `getMacOSVPNStatus`.
- Uses `cachedCommand` with the same `cacheKey`/`vpnTTL` parameters.
- Returns `true`, `false`, or `null` (on error).
- `bun run build` passes.

---

### Task 1.3 — Refactor `getVPNStatus()` to dispatch by platform

**File**: `src/env/context.ts`

Replace the current `getVPNStatus()` body with a platform dispatcher. Note that the current code declares `cacheKey` and `vpnTTL` inside the platform guard — the refactor hoists them to the dispatcher so both platform methods receive them as parameters.

```typescript
private async getVPNStatus(): Promise<boolean | null> {
  const cacheKey = CacheKeys.VPN_STATUS;
  const vpnTTL = this.config.cacheTTL / 10;

  try {
    switch (process.platform) {
      case 'darwin':
        return await this.getMacOSVPNStatus(cacheKey, vpnTTL);
      case 'linux':
        return await this.getLinuxVPNStatus(cacheKey, vpnTTL);
      default:
        return null;
    }
  } catch (error) {
    console.debug('[DEBUG] Failed to get VPN status:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
```

**Dependencies**: Tasks 1.1 and 1.2 must be merged first.

**Acceptance criteria**:
- Platform guard `if (process.platform !== 'darwin')` is removed.
- Switch dispatches to the two platform methods.
- Unsupported platforms still return `null`.
- `bun run build` passes.

---

### Task 1.4 — Update config docstring

**File**: `src/core/config.ts`

Three locations to update — remove "(macOS only)":

| Line | Current | New |
|------|---------|-----|
| 21 | `vpnIndicator: z.boolean().default(false), // Show VPN status indicator (macOS only)` | `vpnIndicator: z.boolean().default(false), // Show VPN status indicator (macOS/Linux)` |
| 211 | `vpnIndicator: true, // Set to true to show VPN status indicator (macOS only)` | `vpnIndicator: true, // Set to true to show VPN status indicator (macOS/Linux)` |

**Acceptance criteria**:
- No reference to "macOS only" remains in `config.ts`.
- `bun run build` passes.

---

## Phase 2: Documentation & Testing

### Task 2.1 — Update README VPN section

**File**: `README.md`

Update the VPN Status Indicator section (lines 125–140):

1. Change heading description from "on macOS" to "on macOS and Linux (including WSL)".
2. Add Linux detection info: "On Linux, detects `tun*`, `tap*`, `wg*`, `ppp*`, `tailscale*` interfaces via `/sys/class/net`."
3. Fix "Enabled by default on macOS" — the config default is actually `false` (opt-in). Change to: "Disabled by default. Enable with `"vpnIndicator": true` in config or `CLAUDE_CODE_STATUSLINE_VPN_INDICATOR=1`".
4. Replace the final note:
   - **Current**: `**Note:** macOS only feature. Uses scutil to detect VPN interfaces. Linux/Windows support not available.`
   - **New**: `**Note:** Supported on macOS and Linux (including WSL). macOS uses scutil; Linux checks /sys/class/net. Windows (native) is not supported.`

**Acceptance criteria**:
- README accurately reflects macOS + Linux support.
- No mention of "macOS only" in VPN section.

---

### Task 2.2 — Add CHANGELOG entry

**File**: `CHANGELOG.md`

Add a new entry under an `## [Unreleased]` section (or whatever convention the file uses):

```markdown
### Added
- Linux VPN indicator support: detects `tun*`, `tap*`, `wg*`, `ppp*`, `tailscale*` interfaces via `/sys/class/net`
- WSL1/WSL2 VPN detection (uses same Linux implementation)
```

**Acceptance criteria**:
- Entry exists and follows existing CHANGELOG format.

---

### Task 2.3 — Add unit tests for VPN detection (new — no existing VPN tests)

**File**: `tests/vpn.test.ts` (new file)

There are currently **no VPN tests** in the codebase. Write tests covering:

1. **macOS path**: mock `process.platform` as `'darwin'`, verify `scutil` command is used.
2. **Linux path**: mock `process.platform` as `'linux'`, verify `/sys/class/net` command is used.
3. **Unsupported platform**: mock `process.platform` as `'win32'`, verify `null` is returned.
4. **Linux detected**: mock command output containing `"detected"`, verify returns `true`.
5. **Linux not detected**: mock command output containing `"not detected"`, verify returns `false`.
6. **Error handling**: mock command throwing, verify returns `null` (no crash).

Use the same test framework as existing tests (`bun test` with `bun:test`). Check `tests/runner.test.ts` and `tests/security.test.ts` for patterns.

**Acceptance criteria**:
- All new tests pass via `bun test`.
- Existing tests still pass.

---

### Task 2.4 — Verify build and performance

Run the full verification suite:

```bash
# Build
bun run build && bun run build:bundle

# Tests
bun test

# Lint
bun run lint

# Performance (should be <100ms total, <50ms for VPN check)
bun run benchmark
```

**Acceptance criteria**:
- Build succeeds with no errors.
- All tests pass.
- No lint violations.
- Performance stays within targets.

---

## Task Dependency Graph

```
Phase 1 (parallel-safe):
  Task 1.1 (extract macOS) ──┐
  Task 1.2 (add Linux)    ──┤── Task 1.3 (platform dispatch) ── Task 1.4 (config docstring)
                              │
Phase 2 (parallel-safe):      │
  Task 2.1 (README)        ──┤
  Task 2.2 (CHANGELOG)     ──┤── Task 2.4 (verify all)
  Task 2.3 (unit tests)    ──┘
```

**Parallel lanes**:
- Tasks 1.1 and 1.2 can be done simultaneously (different methods, no overlap).
- Tasks 2.1, 2.2, and 2.3 can all be done simultaneously (different files).
- Task 1.3 waits for 1.1 + 1.2 (it wires them together).
- Task 1.4 can run in parallel with 1.1/1.2 (different file) but logically pairs with 1.3.
- Task 2.4 is the final gate.
