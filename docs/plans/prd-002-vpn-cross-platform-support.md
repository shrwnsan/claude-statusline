# PRD: VPN Indicator Cross-Platform Support

## Overview

Extend the VPN indicator feature (currently macOS-only) to support Linux (including WSL). This will provide consistent VPN status detection across all major platforms supported by the statusline.

**Note**: WSL runs a real Linux kernel (WSL2) or translation layer (WSL1), so the Linux implementation naturally covers WSL as well.

## Current State

### Existing Implementation (macOS only)
- **File**: `src/env/context.ts:207-235`
- **Method**: `getVPNStatus()`
- **Detection Strategy**: Uses `scutil --nwi` to detect `utun` (User Tunnel) network interfaces
- **Config**: `vpnIndicator` option in `src/core/config.ts` (default: `false` — opt-in)
- **Symbols**: `vpnOn` (◉) and `vpnOff` (○) in `src/ui/symbols.ts`
- **Cache TTL**: 30 seconds (`cacheTTL / 10`)

### Current Behavior on Non-macOS
```typescript
private async getVPNStatus(): Promise<boolean | null> {
  // Only support macOS for now
  if (process.platform !== 'darwin') {
    return null;
  }

  const cacheKey = CacheKeys.VPN_STATUS;

  try {
    const vpnTTL = this.config.cacheTTL / 10;
    const result = await cachedCommand(
      this.cache,
      cacheKey,
      'sh',
      ['-c', 'scutil --nwi 2>/dev/null | grep -qi utun && echo "detected" || echo "not detected"'],
      vpnTTL
    );
    return result?.trim() === 'detected';
  } catch (error) {
    console.debug('[DEBUG] Failed to get VPN status:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
```

**Note**: In the current code, `cacheKey` and `vpnTTL` are declared *inside* the platform guard. The refactor moves them to the dispatcher method — a minor structural change.

## Requirements

### Functional Requirements

#### Linux Support (includes WSL)
1. Detect VPN connections on Linux distributions
2. Support common VPN interface types:
   - `tun*` (OpenVPN)
   - `tap*` (Layer 2 VPNs)
   - `wg*` (WireGuard)
   - `ppp*` (PPP-based VPNs)
   - `tailscale*` (Tailscale — uses `tailscale0` on Linux, not `utun`)
3. Use standard Linux tools available on most distributions
4. Gracefully handle missing tools
5. Work on WSL1 and WSL2 (same implementation, since WSL is Linux)

### Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Performance | <50ms additional latency per check |
| Caching | Reuse existing 30-second TTL |
| Fallback | Return `null` if detection fails (no crash) |
| Compatibility | Support existing config/env variables |
| Testing | Add unit tests for new platform detection |

## Technical Design

### Architecture

Refactor `getVPNStatus()` to use platform-specific detection strategies:

```typescript
private async getVPNStatus(): Promise<boolean | null> {
  const cacheKey = CacheKeys.VPN_STATUS;
  const vpnTTL = this.config.cacheTTL / 10;

  try {
    switch (process.platform) {
      case 'darwin':
        return await this.getMacOSVPNStatus(cacheKey, vpnTTL);
      case 'linux':
        // Covers both native Linux and WSL
        return await this.getLinuxVPNStatus(cacheKey, vpnTTL);
      default:
        return null;
    }
  } catch (error) {
    console.debug('[DEBUG] Failed to get VPN status:', error);
    return null;
  }
}
```

### Platform Detection Strategies

#### macOS (existing)
- Uses `scutil --nwi` to detect `utun` interfaces
- No changes needed

#### Linux (includes WSL)
**Method**: Network Interface Check
```bash
ls /sys/class/net 2>/dev/null | grep -E "^(tun|tap|wg|ppp|tailscale)[0-9]"
```

**Rationale**:
- `/sys/class/net` is a standard Linux sysfs interface
- Interface name pattern matching covers common VPN software (including Tailscale, which uses `tailscale0` on Linux rather than `tun*`)
- Fast, requires no additional dependencies
- Works on both native Linux and WSL (WSL1/WSL2)
- No special permissions required

**Optional WSL Enhancement** (future):
- For WSL specifically, could add PowerShell interop to check Windows-side VPN
- This would be a bonus enhancement, not required for initial implementation

### Implementation Details

#### Files to Modify

| File | Changes |
|------|---------|
| `src/env/context.ts` | Add `getLinuxVPNStatus()`, refactor `getVPNStatus()` |
| `src/core/config.ts` | Update docstring for `vpnIndicator` (remove "macOS only") |
| `src/core/cache.ts` | No changes (defines `CacheKeys.VPN_STATUS` used by both platforms) |
| `src/ui/symbols.ts` | No changes (existing symbols work for all platforms) |
| `README.md` | Update VPN indicator section |
| `CHANGELOG.md` | Add new feature entry |

#### New Method to Add

```typescript
/**
 * Get VPN status on Linux by checking for VPN network interfaces
 * Detects: tun*, tap*, wg*, ppp*, tailscale* interfaces
 * Works on both native Linux and WSL
 */
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

#### Refactored Main Method

```typescript
/**
 * Get VPN status with caching
 * - macOS: Detects UTun (User Tunnel) interfaces via scutil
 * - Linux/WSL: Detects VPN network interfaces (tun*, tap*, wg*, ppp*, tailscale*)
 */
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

/**
 * Get VPN status on macOS
 * Existing implementation - no changes needed
 */
private async getMacOSVPNStatus(cacheKey: string, vpnTTL: number): Promise<boolean | null> {
  // Existing macOS implementation moved here
  // ...
}
```

## Implementation Plan

### Phase 1: Linux Support
**Owner**: TBD
**Estimated Effort**: 2-3 hours

#### Tasks
1. Extract existing macOS code to `getMacOSVPNStatus()` method
2. Create `getLinuxVPNStatus()` method
3. Update `getVPNStatus()` to dispatch by platform
4. Update config docstring (remove "macOS only")
5. Test on Linux with common VPNs (OpenVPN, WireGuard, Tailscale)
6. Test on WSL1 and WSL2

### Phase 2: Documentation & Testing
**Owner**: TBD
**Estimated Effort**: 1 hour

#### Tasks
1. Update README.md with platform support matrix
2. Update CHANGELOG.md
3. Verify existing test suite still passes (no VPN-specific tests exist yet)
4. Add unit tests for platform dispatch and Linux detection

## Success Criteria

- [ ] VPN indicator works on Linux with OpenVPN, WireGuard, and Tailscale
- [ ] VPN indicator works on WSL1 and WSL2
- [ ] Graceful fallback when detection fails (no crashes)
- [ ] All existing tests pass (note: no VPN-specific tests exist yet — this refers to the full test suite)
- [ ] Performance impact <50ms per check
- [ ] Documentation updated

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| False positives (non-VPN tun interfaces) | Low | Acceptable trade-off for simplicity |
| Permission issues on Linux | Low | Reading `/sys/class/net` typically requires no special permissions |
| WSL may not see Windows-side VPN | Low | Document as limitation; can add PowerShell interop later if needed |

## Open Questions

1. **Should we add WSL-specific Windows VPN detection?**
   - Current: Standard Linux interface check
   - Future: Could add PowerShell interop for Windows-side VPN on WSL
   - Decision: Defer to future enhancement if users request it

2. **Should we add custom VPN interface patterns?**
   - Current: Supports standard patterns (`tun*`, `tap*`, `wg*`, `ppp*`, `tailscale*`)
   - Consider: Allow user-configurable patterns in config
   - Decision: Defer until there's a user need

3. **Should we detect VPN type/name?**
   - Current: Boolean on/off
   - Consider: Show VPN name or type for better UX
   - Decision: Out of scope for initial implementation

## Platform Support Matrix

| Platform | Detection Method | Status |
|----------|-----------------|--------|
| macOS | `scutil --nwi` for `utun` interfaces | ✅ Implemented |
| Linux | `/sys/class/net` interface check | 🚧 To implement |
| WSL1 | Same as Linux | 🚧 To implement |
| WSL2 | Same as Linux | 🚧 To implement |
| Windows | N/A (statusline doesn't run on Windows) | ❌ Not supported |

## References

- Current implementation: `src/env/context.ts:207-235`
- Cache key definition: `src/core/cache.ts` (`CacheKeys.VPN_STATUS`)
- Original PR: #22 (macOS VPN indicator)
- Linux sysfs documentation: https://www.kernel.org/doc/Documentation/filesystems/sysfs.txt
