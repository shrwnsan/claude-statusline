# Sandbox Detection Research

## Overview

This document documents research into detecting sandbox environments for statusline indicators, specifically for Claude Code statusline implementations.

## Problem Statement

Claude Code statusline scripts run in a sanitized environment that doesn't receive the actual sandbox environment variables (like `SANDBOX_RUNTIME=1`). This makes automatic sandbox detection challenging.

## Key Findings

### 1. Environment Variable Limitations

**Claude Code Statusline Environment (from debug logs):**
```
FEATURE=notset (CLAUDE_CODE_STATUSLINE_SHOW_SANDBOX not available)
TMPDIR=/var/folders/.../T/ (not /tmp/claude)
SANDBOX_RUNTIME=notset
CLAUDE_CODE_ENTRYPOINT=cli
```

**Available Environment Variables:**
- `CLAUDE_CODE_ENTRYPOINT=cli` - Entry point indicator
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` - **NOT a sandbox indicator** (only disables telemetry)

### 2. Existing Statusline Projects Research

#### Container Detection Approaches (from Starship)

**File-based Detection Methods (Priority Order):**
1. **/.dockerenv** - Docker container indicator
2. **/proc/vz** + **/proc/bc** - OpenVZ detection
3. **/dev/incus/sock** - Incus container socket
4. **/run/.containerenv** - Podman/Others (parse for name/image)
5. **/run/systemd/container** - SystemD containers
6. **/run/host/container-manager** - OCI container manager

**Cross-platform Considerations:**
- Disabled on non-Linux systems entirely
- Special handling for WSL with systemd

#### Claude Code Statusline Projects

**Projects Examined:**
- rz1989s/claude-code-statusline
- dwillitzer/claude-statusline
- Owloops/claude-powerline
- sirmalloc/ccstatusline
- Ido-Levi/claude-code-tamagotchi

**Key Finding: No existing projects have solved sandbox detection.**

All projects focus on:
- Configuration detection
- Git repository detection
- MCP server monitoring
- Security (safe file handling, input validation)

None attempt to detect Claude Code's sandbox/restricted mode.

### 3. Container Detection Methods for Adaptation

**Most Reliable Methods:**
```bash
# File-based checks (most reliable in restricted environments)
if [[ -f "/.dockerenv" ]]; then echo "Docker"; fi
if [[ -d "/proc/vz" ]] && ! [[ -d "/proc/bc" ]]; then echo "OpenVZ"; fi
if [[ -S "/dev/incus/sock" ]]; then echo "Incus"; fi

# System-based detection
systemd-detect-virt --container 2>/dev/null
virt-what 2>/dev/null

# Process namespace analysis
cat /proc/1/cmdline | tr '\0' ' '
```

**Environment-based Detection (Less Reliable):**
```bash
# Container environment variables
grep -q "container=" /proc/1/environ
grep -q docker /proc/1/cgroup

# Kubernetes/OpenShift indicators
[[ -n "${KUBERNETES_PORT:-}" ]]
```

### 4. Potential Sandbox Detection Approaches

#### File-based Detection
- Look for Claude Code-specific files in `/tmp/claude*`
- Check for restricted filesystem access
- Test system file readability (`/proc/version`, `/etc/passwd`)

#### Command Availability Testing
- Sandboxes often restrict system commands
- Test for `uname`, `ps`, `systemctl` availability

#### Process Namespace Analysis
- Compare current PID namespace with init process
- Check if init process looks like system init

#### Resource Limitations
- Check memory/CPU limits typical of sandboxes
- Test network access restrictions

## Implementation Challenges

### 1. Environment Isolation
Claude Code sanitizes the environment passed to statusline scripts, removing sandbox-specific variables.

### 2. False Positives
Container detection methods might trigger in non-sandbox development environments (Docker development containers, etc.).

### 3. Cross-platform Complexity
Different methods work on Linux vs macOS vs Windows.

### 4. Performance Impact
Detection methods must be fast enough for frequent statusline updates.

## Current Implementation Status

### What Works:
- ✅ Feature toggle via `CLAUDE_CODE_STATUSLINE_SHOW_SANDBOX=1`
- ✅ Manual sandbox indicator control
- ✅ Proper icon selection (Nerd Font vs fallback)
- ✅ Statusline integration

### What Doesn't Work:
- ❌ Automatic sandbox detection
- ❌ Environment variable detection (sanitized)
- ❌ Reliable file-based detection (no Claude Code-specific files found)

### Known Limitations:
- Claude Code doesn't pass sandbox state to statusline scripts
- No reliable Claude Code-specific sandbox indicators available
- Container detection methods designed for containers, not application sandboxing

## Recommendations

### Short-term:
- Use manual toggle approach with `CLAUDE_CODE_STATUSLINE_SHOW_SANDBOX=1`
- Document limitation for users
- Request feature from Claude Code team to pass sandbox state

### Long-term:
- Implement multiple detection methods with confidence scoring
- Add configuration for custom detection rules
- Consider file-based monitoring for Claude Code-specific patterns

## Future Research Directions

1. **Claude Code Internal APIs**: Check if Claude Code exposes sandbox state through other means
2. **Process Monitoring**: Monitor Claude Code process characteristics
3. **Filesystem Analysis**: Look for Claude Code sandbox artifacts
4. **Network Behavior**: Analyze network patterns in sandboxed vs non-sandboxed modes
5. **Resource Usage**: Monitor memory/CPU patterns unique to sandboxed execution

## References

- [Starship Container Module](https://github.com/starship/starship)
- [Claude Code Documentation](https://code.claude.com/docs)
- [Container Detection Methods](https://github.com/moby/moby/issues/18390)
- [SystemD Detection](https://www.freedesktop.org/software/systemd/man/systemd-detect-virt.html)

---

**Note:** This represents current research as of the investigation date. Sandbox detection methods may evolve with Claude Code updates.