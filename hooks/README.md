# oh-my-gemini Hooks

> Deterministic workflow enforcement for Gemini CLI

This directory contains the hook system that transforms oh-my-gemini from a prompt-based extension into a deterministic workflow engine.

## Cross-Platform Support

**v2.0.1** adds full Windows compatibility:

- ✅ Works on Windows (cmd.exe / PowerShell)
- ✅ Works on macOS
- ✅ Works on Linux

The hooks automatically detect the platform and adjust command execution accordingly.

### Windows-Specific Features

1. **Command Normalization**: Automatically converts bash-style commands to Windows equivalents
   - `2>/dev/null` → `2>NUL`
   - `cat file` → `type file`
   - Removes `head`, `tail`, `grep` pipes that don't exist on Windows

2. **Path Handling**: Uses `path.sep` for cross-platform path construction

3. **Security Patterns**: Includes Windows-specific dangerous command blocking
   - `format c:`, `rd /s /q`, `del /f /q`, etc.
   - Windows system directories are protected

4. **Git Commands**: Git commands work identically on all platforms (no normalization needed)

5. **npm/npx Commands**: Uses `.cmd` extension on Windows for npm binaries

## Architecture

```
hooks/
├── hooks.json           # Hook definitions for Gemini CLI (REQUIRED)
├── lib/
│   ├── platform.js      # Cross-platform utilities (NEW in v2.0.1)
│   ├── utils.js         # Shared utilities (I/O, git, etc.)
│   └── config.js        # Configuration loader
├── session-start.js     # SessionStart hook
├── before-agent.js      # BeforeAgent hook (context injection)
├── before-tool.js       # BeforeTool hook (security gates)
├── after-tool.js        # AfterTool hook (auto-verification)
├── tool-filter.js       # BeforeToolSelection hook (mode sandboxing)
├── phase-gate.js        # AfterAgent hook (Conductor phases)
├── ralph-retry.js       # AfterAgent hook (persistence mode)
├── config.default.json  # Default configuration
└── README.md            # This file
```

## Hooks Reference

### SessionStart Hook

**Event:** `SessionStart`  
**File:** `session-start.js`

Fires when a new Gemini CLI session begins.

**Purpose:**
- Load Conductor track state
- Display welcome message with progress
- Initialize session context

### BeforeAgent Hook

**Event:** `BeforeAgent`  
**File:** `before-agent.js`

Fires after user submits a prompt, before agent planning.

**Purpose:**
- Inject git history when prompt mentions bugs/fixes
- Inject recently changed files when continuing work
- Add current Conductor task context

**Triggers:**
| Keywords | Context Injected |
|----------|------------------|
| fix, bug, error, issue | Recent git commits |
| continue, resume, pick up | Recently changed files |
| (always if Conductor active) | Current task info |

### BeforeTool Hook

**Event:** `BeforeTool`  
**Matcher:** `write_file|replace|edit_file|run_shell_command`  
**File:** `before-tool.js`

Fires before matched tools execute.

**Purpose:**
- Block dangerous shell commands
- Block writes to protected paths
- Create git checkpoints

**Blocked Commands (examples):**
```
# Unix
rm -rf /, sudo rm, chmod 777, :(){ :|:& };:

# Windows
format c:, rd /s /q c:\, del /f /q %systemroot%
```

### AfterTool Hook

**Event:** `AfterTool`  
**Matcher:** `write_file|replace|edit_file`  
**File:** `after-tool.js`

Fires after matched tools execute.

**Purpose:**
- Run TypeScript type checking
- Run ESLint
- Inject results into context

### ToolFilter Hook

**Event:** `BeforeToolSelection`  
**File:** `tool-filter.js`

Filters available tools based on detected agent mode.

**Modes:**
| Mode | Detection | Allowed Tools |
|------|-----------|---------------|
| `researcher` | `@researcher` in prompt | read, search, web |
| `architect` | `@architect`, `debug:` | read only |
| `executor` | default | all (with BeforeTool gates) |

### PhaseGate Hook

**Event:** `AfterAgent`
**File:** `phase-gate.js`

Enforces Conductor phase verification gates with session-aware plan loading.

**Verification Tiers (v0.30.0):**
1. **`ask_user` available:** Instructs the model to call `ask_user` with a yes/no verification question
2. **Strict mode (fallback):** Blocks progression with `decision: "deny"`
3. **Advisory mode (fallback):** Shows warning message via `systemMessage`

**Session-Aware Plan Loading:**
Checks for session-specific plan files before falling back to global Conductor state:
- `.gemini/sessions/{session_id}/plan.md`
- `.gemini/memory/sessions/{session_id}/plan.md`
- `.gemini/plans/{session_id}.md`

### RalphRetry Hook

**Event:** `AfterAgent`  
**File:** `ralph-retry.js`

Implements persistence mode (don't give up!).

**Activation:**
Include `@ralph` or `don't give up` in your prompt.

## Configuration

### Configuration Files (Priority Order)

1. **Project:** `.gemini/omg-config.json` (highest)
2. **User:** `~/.gemini/omg-config.json`
3. **Defaults:** `hooks/config.default.json` (lowest)

### Example Configuration

```json
{
  "phaseGates": {
    "enabled": true,
    "strict": false
  },
  "autoVerification": {
    "enabled": true,
    "typecheck": true,
    "lint": true,
    "timeout": 30000
  },
  "security": {
    "gitCheckpoints": true
  },
  "ralph": {
    "enabled": true,
    "maxRetries": 5
  }
}
```

### Debugging

Enable debug logging with environment variable:

```bash
# Unix
export OMG_DEBUG=1

# Windows (cmd)
set OMG_DEBUG=1

# Windows (PowerShell)
$env:OMG_DEBUG = "1"
```

## Troubleshooting

### Hooks Not Triggering (Windows)

1. **Check Node.js is installed and in PATH:**
   ```cmd
   node --version
   ```

2. **Verify hooks are registered:**
   ```
   /hooks panel
   ```

3. **Enable debug mode:**
   ```cmd
   set OMG_DEBUG=1
   ```

### TypeScript Errors Not Showing

1. Verify `tsconfig.json` exists in project root
2. Check that `tsc` is installed: `npm ls typescript`
3. Try running manually: `npx tsc --noEmit`

## Development

### Testing Hooks

```bash
# Test a hook with sample input
echo '{"prompt": "fix the bug", "cwd": "."}' | node hooks/before-agent.js

# Test with debug output
export OMG_DEBUG=1
echo '{"prompt": "test"}' | node hooks/session-start.js
```

## Tool Output Masking (v0.30.0)

Gemini CLI v0.30.0 enables tool output masking by default. This affects how hook-injected context reaches the model.

**Behavior:**
- `systemMessage` output always survives masking (separate channel)
- `additionalContext` in `hookSpecificOutput` may be stripped under aggressive masking

**Dual-Channel Strategy:**
oh-my-gemini hooks use dual-channel injection:
- Critical context (errors, phase gates) → `systemMessage` (guaranteed delivery)
- Supplementary context (git history, Conductor state) → `additionalContext` with `systemMessage` summary fallback

**If masking causes issues:**
Add to `.gemini/settings.json`:
```json
{
  "toolOutputMasking": false
}
```

See `docs/decisions/masking-compatibility.md` for full details.

## Changelog

### v2.1.0 (v0.30.0 Alignment)
- `ask_user` support in phase gates (three-tier verification)
- Session-aware plan loading (`resolveSessionPlanPath`)
- Dual-channel context injection for masking compatibility
- Policy migration: `commandPrefix` → `commandRegex` in `omg-security.toml`
- New `omg-plan-mode.toml` policy for plan-mode write restrictions
- Removed `experimental` block from manifest (features stable in v0.30.0)
- Engine requirement bumped to `>=0.30.0`
- `sessionPlanPath` config key for manual session path override

### v2.0.1
- Added full Windows compatibility
- New `platform.js` module for cross-platform utilities
- Windows-specific security patterns
- Fixed `2>/dev/null` and other bash-isms on Windows
- npm/npx commands use `.cmd` extension on Windows

### v2.0.0
- Initial hook-based implementation
- Replaced prompt-based enforcement with deterministic hooks
