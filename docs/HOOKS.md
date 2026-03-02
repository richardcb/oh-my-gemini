# oh-my-gemini Hooks Reference

oh-my-gemini uses Gemini CLI's hook system to enforce workflows deterministically. This document covers all hooks, their configuration, and customization options.

## Overview

Hooks are scripts that execute at specific points in Gemini CLI's lifecycle. They transform oh-my-gemini from prompt-based suggestions to infrastructure-enforced behavior.

### Hook Events Used

| Event | When It Fires | oh-my-gemini Hook |
|-------|---------------|-------------------|
| SessionStart | CLI startup/resume | `session-start.js` |
| BeforeAgent | After user prompt | `before-agent.js` |
| BeforeToolSelection | Before LLM selects tools | `tool-filter.js` |
| BeforeTool | Before tool executes | `before-tool.js` |
| AfterTool | After tool executes | `after-tool.js` |
| AfterAgent | After agent response | `phase-gate.js`, `ralph-retry.js` |

---

## Hook Details

### session-start.js

**Event:** SessionStart
**Fires:** On startup, resume, or context clear

**Purpose:**
- Load session-specific or global Conductor track state
- Inject project context with plan state label
- Display welcome message with status
- Clean stale session state directories (> 24h)
- Ensure `.gemini/.gitignore` includes `omg-state/`
- Check `experimental.enableAgents` prerequisite

**Session-Aware Plan Loading (v0.30.0):**
The hook now attempts to load a session-specific plan before falling back to the global Conductor plan. It checks:
1. `.gemini/sessions/{session_id}/plan.md`
2. `.gemini/memory/sessions/{session_id}/plan.md`
3. `.gemini/plans/{session_id}.md`

If no session plan is found, falls back to the global Conductor state.

**Stale State Cleanup:**
On each session start, calls `cleanStaleState()` from `dist/lib/mode-state` to remove session directories in `.gemini/omg-state/` older than 24 hours. This prevents unbounded growth of mode, verification, and Ralph state files.

**Subagent Prerequisite Check:**
Checks the user's Gemini CLI `settings.json` for `experimental.enableAgents: true`. If not set, emits a warning via `systemMessage` advising the user to enable it for native subagent routing.

**Output Example:**
```
oh-my-gemini ready | Modes: keyword-driven | Conductor: User Authentication (45% complete)
```

**Configuration:** None (always active). Override session plan path with `sessionPlanPath` in config.

---

### before-agent.js

**Event:** BeforeAgent
**Fires:** After user submits prompt, before agent planning

**Purpose:**
- Resolve the active mode from Magic Keywords (via keyword registry)
- Persist mode state to `.gemini/omg-state/{session}/mode.json` for downstream hooks
- Inject context (git history, Conductor state, recent changes) per mode profile
- Suggest skills via `systemMessage` based on mode and Ralph keywords
- Detect Ralph keywords and suggest the `ralph-mode` skill

**Mode Resolution:**
Calls `resolveModeFromPrompt(prompt)` from the compiled keyword registry (`dist/lib/mode-state`). If `dist/` is not built, falls back to `detectMagicKeywords()` with stub defaults. The resolved mode state is written to `.gemini/omg-state/{session}/mode.json` for all downstream hooks to read.

**Session-Aware Conductor Loading:**
Uses `loadSessionOrGlobalPlan()` to check for session-specific plans before falling back to the global Conductor track. This ensures consistency with `session-start.js` and `phase-gate.js`.

**Phase-Aware Context Injection:**
When a Conductor plan has phase headers (`## Phase N: ...`), the injected context includes the current phase name and position:
```
## Current Conductor Task
**Track:** backend-api
**Plan:** global track
**Phase:** Backend API (2/4)
**Task:** Implement user authentication endpoint
**Progress:** 3/12 (25%) — 4 remaining in phase
```
When the plan has no phase headers, falls back to flat task injection (v1.0 behavior).

**Mode-Aware Context Injection:**
Each mode profile defines context injection behavior:

| Mode | Git History | Conductor State | Recent Changes |
|------|------------|-----------------|----------------|
| `research` | Disabled | Summary only | Disabled |
| `implement` | Keyword-triggered | Full (phase-aware) | Enabled |
| `review` | Always | Summary only | Disabled |
| `quickfix` | Keyword-triggered | Disabled | Disabled |
| `plan` | Disabled | Full (phase-aware) | Disabled |
| `eco` (modifier) | Disabled | Summary only | Disabled |

**Skill Suggestions:**
When a mode has `suggestedSkills` in its profile, a skill suggestion is emitted via `systemMessage`:
- `research` → suggests `research-methodology`
- `review` → suggests `code-review`
- `plan` → suggests `technical-planning`

**Ralph Keyword Detection:**
Calls `detectRalphKeywords(prompt)` from the keyword registry. If Ralph keywords are detected, appends to `systemMessage`: `"Ralph mode active. Consider activating the ralph-mode skill for structured persistence guidance."`

**Configuration:**
```json
{
  "contextInjection": {
    "conductorState": true,
    "gitHistory": {
      "enabled": true,
      "onKeywords": ["fix", "bug", "error"],
      "commitCount": 5
    },
    "recentChanges": {
      "enabled": true,
      "onKeywords": ["continue", "resume"],
      "fileCount": 10
    }
  }
}
```

---

### tool-filter.js

**Event:** BeforeToolSelection
**Fires:** Before LLM selects which tools to use

**Purpose:**
- Read persisted mode state from `.gemini/omg-state/{session}/mode.json`
- Compose mode profile (primary + modifiers) via `composeModeProfile()`
- Filter available tools based on the composed mode profile
- Support MCP tool passthrough for modes that allow it

**Mode-Based Tool Filtering:**

| Mode | Tools | MCP Passthrough |
|------|-------|-----------------|
| `research` | `read_file`, `read_many_files`, `list_directory`, `glob`, `grep_search`, `google_web_search`, `web_fetch`, `delegate_to_agent` | Yes |
| `implement` | All (`"*"`) | N/A |
| `review` | `read_file`, `read_many_files`, `list_directory`, `glob`, `grep_search`, `delegate_to_agent` | No |
| `quickfix` | All (`"*"`) | N/A |
| `plan` | Native (`null` — defers to Gemini CLI plan mode restrictions) | N/A |

Meta-tools (`delegate_to_agent`, `ask_user`, `activate_skill`, `save_memory`, `write_todos`, `get_internal_docs`) are always included in restricted mode allowlists.

**MCP Tool Passthrough:**
When `mcpPassthrough: true` is set on a mode profile (e.g., `research`), the hook scans `llm_request.tools` for tool names containing the `__` separator (MCP tool naming convention) and adds them to the allowed list.

**UNION Aggregation Limitation:**
BeforeToolSelection hooks use UNION aggregation across extensions. If another extension contributes hooks, their `allowedFunctionNames` are merged (not intersected). Subagent `tools` fields in `.gemini/agents/*.md` are the only reliable enforcement mechanism.

**Configuration:**
```json
{
  "toolFilter": {
    "enabled": true,
    "modes": {
      "research": {
        "allowed": ["google_web_search", "web_fetch", "read_file", "list_directory", "glob", "grep_search"]
      },
      "review": {
        "allowed": ["read_file", "list_directory", "glob", "grep_search"]
      },
      "implement": {
        "allowed": "*"
      },
      "quickfix": {
        "allowed": "*"
      },
      "plan": {
        "allowed": ["read_file", "list_directory", "glob", "grep_search", "google_web_search", "web_fetch"]
      }
    }
  }
}
```

---

### before-tool.js

**Event:** BeforeTool  
**Matcher:** `write_file|replace|run_shell_command|shell`
**Fires:** Before matched tool executes

**Purpose:**
- Block dangerous shell commands
- Block writes to protected paths
- Create git checkpoints before modifications

**Blocked Commands (default):**
```
rm -rf /
rm -rf ~
sudo rm
chmod 777
:(){ :|:& };:
```

**Protected Paths (default):**
```
node_modules
.git
/etc
/usr
/var
```

**Git Checkpoints:**
Before modifying files, creates a commit:
```
[omg-checkpoint] Before write_file on auth.ts at 2026-01-29T10-30-00
```

**Configuration:**
```json
{
  "security": {
    "gitCheckpoints": true,
    "blockedCommands": [
      "rm -rf /",
      "sudo rm",
      "chmod 777"
    ],
    "blockedPaths": [
      "node_modules",
      ".git",
      "/etc"
    ]
  }
}
```

**Blocking Behavior:**
When a dangerous operation is detected, the hook returns:
```json
{
  "decision": "deny",
  "reason": "🛑 Security: Blocked dangerous command..."
}
```

---

### after-tool.js

**Event:** AfterTool
**Matcher:** `write_file|replace`
**Fires:** After matched tool executes

**Purpose:**
- Run TypeScript typecheck after .ts/.tsx files
- Run lint after code files
- Inject errors into context
- Write verification state to `.gemini/omg-state/{session}/verification.json` for Ralph v2
- Adjust verification intensity per active mode profile

**Mode-Aware Verification:**

| Mode | TypeCheck | Lint |
|------|-----------|------|
| `research` | Disabled | Disabled |
| `implement` | Enabled | Enabled |
| `review` | Disabled | Enabled |
| `quickfix` | Enabled | Disabled |
| `plan` | Disabled | Disabled |
| `eco` (modifier) | Enabled | Disabled |

**Verification State (Ralph Integration):**
After both checks complete, writes `verification.json` to the session state directory using an atomic temp-file + rename pattern. Schema:
```json
{
  "lastRun": "2026-03-01T10:00:00.000Z",
  "typecheck": { "passed": false, "errorCount": 3, "summary": "TS2339: ..." },
  "lint": { "passed": true, "errorCount": 0, "summary": "" },
  "timestamp": 1740826800000
}
```

This file is read by `ralph-retry.js` to validate agent success claims against actual verification results. Only written when at least one check was not skipped.

**Verification Commands:**

| Check | Commands Tried |
|-------|----------------|
| TypeScript | `npm run typecheck`, `npm run type-check`, `tsc --noEmit` |
| Lint | `npm run lint`, direct `eslint` |

**Configuration:**
```json
{
  "autoVerification": {
    "enabled": true,
    "typecheck": true,
    "lint": true,
    "timeout": 30000
  }
}
```

---

### phase-gate.js

**Event:** AfterAgent
**Fires:** After every agent response

**Purpose:**
- Parse plan phases and detect current phase progress
- Inject advisory guidance via `systemMessage`
- Session-aware plan loading
- Uses shared `parsePhases()` and `findCurrentPhase()` from `hooks/lib/utils.js`

**Verification Mode:**

Phase gates use **advisory mode only**: when a Conductor phase is detected as complete, the hook injects a `systemMessage` guiding the agent to verify tasks before proceeding. There is no strict blocking or native `ask_user` prompting — the agent receives the advisory message and acts accordingly.

**Session-Aware Loading:**
Uses `resolveSessionPlanPath()` to check for session-specific plan files before falling back to global Conductor state. See `session-start.js` for candidate paths.

**Configuration:**
```json
{
  "phaseGates": {
    "enabled": true,
    "strict": false
  }
}
```

---

### ralph-retry.js

**Event:** AfterAgent
**Fires:** After every agent response (when Ralph mode active)

**Purpose:**
- Detect failure indicators in agent response
- Read verification state from `after-tool.js` to validate success claims
- Deny premature "success" when verification shows errors
- Track error signatures for stuck detection
- Generate error-aware retry messages with actual error details
- Force retry up to N attempts, then escalate to user

**Activation:**
Include any of these keywords in your prompt:
- `ralph:`, `@ralph`
- `persistent:`
- `don't give up`
- `keep trying`

Keywords are detected via the compiled keyword registry (`dist/lib/keyword-registry`), with an inline fallback if `dist/` is not built.

**Verification-Aware Completion (v2):**
When the agent claims success, Ralph reads `verification.json` (written by `after-tool.js`). If verification shows errors, Ralph denies completion with the actual error in the retry message — even if the agent says "all done". This prevents premature completion when typecheck or lint is failing.

**Stuck Protocol:**
Tracks error signatures across retries. After `stuckThreshold` (default: 3) consecutive retries with the same error signature, Ralph emits an advisory message instructing the agent to document the blocker and move to the next task. The stuck protocol does NOT deny — it allows the agent to proceed.

**Error-Aware Retry Messages:**
When verification state is available, retry messages include the actual error:
```
Ralph Mode (Attempt 2/5): Verification shows typecheck failing -- TS2339: Property 'x' does not exist. Try a different approach. 12 turns remaining.
```

When verification is unavailable (e.g., research mode), falls back to generic suggestions (v1.0 behavior).

**State Tracking:**
Ralph maintains session-scoped state in `.gemini/omg-state/{session}/ralph.json`:
```json
{
  "attempts": 3,
  "lastTimestamp": "2026-03-01T10:00:00.000Z",
  "lastErrorSignature": "typecheck failing -- TS2339",
  "consecutiveSameError": 2,
  "stuckItems": ["previous blocker description"]
}
```

On first access, automatically migrates from the old `.gemini/ralph-state.json` format if present.

**Mode Integration:**
Reads mode state via `readModeState()` from `dist/lib/mode-state`. When `autoVerification.enabled` is `false` for the active mode (e.g., research, plan), skips verification state reading and uses heuristic-only detection.

**Configuration:**
```json
{
  "ralph": {
    "enabled": true,
    "maxRetries": 5,
    "stuckThreshold": 3,
    "suggestedSkill": "ralph-mode",
    "triggerPatterns": [
      "I'm stuck",
      "I cannot",
      "I'm unable",
      "not possible",
      "failed to",
      "can't figure out",
      "doesn't work"
    ]
  }
}
```

`stuckThreshold` is clamped to [2, 10]. `maxRetries` is clamped to [1, 20].

---

## Configuration Reference

### Configuration File Locations

Configuration is loaded with cascading priority:

1. **Project** (highest): `.gemini/omg-config.json`
2. **User**: `~/.gemini/omg-config.json`
3. **Defaults** (lowest): Bundled `config.default.json`

### Full Configuration Schema

```json
{
  "modes": {
    "enabled": true,
    "default": "implement"
  },

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
    "gitCheckpoints": true,
    "blockedCommands": [
      "rm -rf /",
      "sudo rm",
      "chmod 777"
    ],
    "blockedPaths": [
      "node_modules",
      ".git",
      "/etc"
    ]
  },

  "toolFilter": {
    "enabled": true,
    "modes": {
      "research": {
        "allowed": ["google_web_search", "web_fetch", "read_file", "list_directory", "glob", "grep_search"]
      },
      "review": {
        "allowed": ["read_file", "list_directory", "glob", "grep_search"]
      },
      "implement": {
        "allowed": "*"
      },
      "quickfix": {
        "allowed": "*"
      },
      "plan": {
        "allowed": ["read_file", "list_directory", "glob", "grep_search", "google_web_search", "web_fetch"]
      }
    }
  },

  "ralph": {
    "enabled": true,
    "maxRetries": 5,
    "stuckThreshold": 3,
    "suggestedSkill": "ralph-mode",
    "triggerPatterns": [
      "I'm stuck",
      "I cannot",
      "I'm unable",
      "not possible",
      "failed to",
      "can't figure out",
      "doesn't work"
    ]
  },

  "contextInjection": {
    "enabled": true,
    "conductorState": true,
    "gitHistory": {
      "enabled": true,
      "onKeywords": ["fix", "bug", "error", "issue", "broken", "crash"],
      "commitCount": 5
    },
    "recentChanges": {
      "enabled": true,
      "onKeywords": ["continue", "resume", "where were we", "pick up", "last time"],
      "fileCount": 10
    }
  }
}
```

---

## Troubleshooting

### Hooks Not Running

1. **Check hooks are enabled:**
   ```
   /hooks panel
   ```

2. **Verify extension is installed:**
   ```bash
   gemini extensions list
   ```

3. **Check settings (v0.30.0+ — no experimental flags needed):**
   Hooks are stable in v0.30.0+. If using an older CLI version, ensure experimental flags are set in `~/.gemini/settings.json`.

### Verification Failing

1. Ensure `package.json` has `typecheck` or `lint` scripts
2. Check timeout isn't too short
3. Verify the project compiles manually first

### Git Checkpoints Not Created

1. Ensure you're in a git repository
2. Check there are uncommitted changes
3. Verify `gitCheckpoints` is enabled

### Phase Gates Not Triggering

1. Check you're in a Conductor track
2. Verify `phaseGates.enabled` is true
3. Ensure your response matches phase completion patterns

### Ralph Not Retrying

1. Include `ralph:`, `@ralph`, or `persistent:` in your prompt
2. Check `ralph.enabled` is true
3. Verify failure patterns match your scenario
4. Check `.gemini/omg-state/{session}/ralph.json` for state

### Ralph Denying Correct Completions

1. Check `.gemini/omg-state/{session}/verification.json` — if stale (> 5 min), it will be ignored
2. Ensure typecheck and lint actually pass: `npm run typecheck && npm run lint`
3. If in research/plan mode, verification is automatically skipped

---

## Security Considerations

Hooks execute with your user privileges. The oh-my-gemini hooks:

- **Never** execute arbitrary user input as commands
- **Block** known dangerous patterns by default
- **Create** checkpoints before destructive operations
- **Can be** disabled per-hook if needed

Review the hook code in `hooks/` if you have security concerns.

---

## Extending Hooks

### Adding Custom Blocked Commands

In `.gemini/omg-config.json`:
```json
{
  "security": {
    "blockedCommands": [
      "rm -rf /",
      "your-custom-dangerous-command"
    ]
  }
}
```

### Adding Custom Tool Filters

```json
{
  "toolFilter": {
    "modes": {
      "custom-mode": {
        "allowed": ["read_file", "custom_tool"]
      }
    }
  }
}
```

### Disabling Specific Hooks

Currently, hooks can only be disabled by modifying `hooks/hooks.json` or removing them from the hooks array. Per-hook disable configuration is planned for a future release.

---

## Hook Communication Protocol

Hooks communicate with Gemini CLI via JSON:

**Input (stdin):**
```json
{
  "hook_event_name": "BeforeTool",
  "tool_name": "write_file",
  "tool_input": { "path": "src/index.ts", "content": "..." },
  "session_id": "abc123",
  "cwd": "/home/user/project"
}
```

**Output (stdout):**
```json
{
  "decision": "deny",
  "reason": "Security: Blocked dangerous command",
  "hookSpecificOutput": {
    "additionalContext": "..."
  },
  "systemMessage": "..."
}
```

**Exit Codes:**
- `0`: Success - stdout parsed as JSON
- `2`: Block - Action blocked, stderr as reason
- Other: Warning - Non-fatal, CLI continues

---

## Tool Output Masking (v0.30.0)

v0.30.0 enables tool output masking by default. oh-my-gemini hooks use a dual-channel injection strategy:

- **`systemMessage`**: Always survives masking. Used for critical context (verification errors, phase gate warnings).
- **`additionalContext`**: May be stripped under aggressive masking. Used for supplementary context with `systemMessage` fallback.

If masking causes context loss, add `"toolOutputMasking": false` to `.gemini/settings.json`.

See `docs/decisions/masking-compatibility.md` for full investigation details.

## Changelog

### v1.2.0 (Surgical Context Injection)

#### Surgical Context Injection (PRD 0006)
- Phase-aware Conductor injection in `before-agent.js`: injects current phase name, position, and remaining tasks alongside the task text
- Session-aware Conductor loading in `before-agent.js`: switched from `loadConductorState()` to `loadSessionOrGlobalPlan()` for consistency with other hooks
- Shared phase parsing: extracted `parsePhases()` and `findCurrentPhase()` from `phase-gate.js` to `hooks/lib/utils.js`
- New `findCurrentPhaseAndTask()` in `utils.js`: composes phase parsing + task lookup for per-turn injection
- New `extractFileReferences()` in `utils.js`: regex-based file path extraction from markdown (foundation for PRD 0007)
- Deduplicated `findCurrentTaskFromPlan()` in `session-start.js` — now uses shared `findCurrentTask()` from `utils.js`
- Fallback behavior preserved: plans without phase headers still get v1.0-style flat task injection

### v1.1.0 (Mode System + Enhanced Ralph)

#### Magic Keywords & Keyword Registry (PRD 0004)
- Replaced implicit regex mode detection with deterministic Magic Keywords
- TypeScript keyword registry (`src/lib/keyword-registry.ts`) compiled via esbuild to `dist/`
- `detectMagicKeywords()` and `detectRalphKeywords()` as pure, < 1ms functions
- Deprecated `detectAgentMode()` in `hooks/lib/utils.js`

#### Mode System Infrastructure (PRD 0003)
- 5 primary modes: `research`, `implement`, `review`, `quickfix`, `plan`
- 1 modifier: `eco` (reduces context injection, disables lint)
- Per-session mode state persisted to `.gemini/omg-state/{session}/mode.json`
- Mode profiles define tool access, verification intensity, context injection, phase gates
- `composeModeProfile()` composes primary + modifiers with deep merge
- All downstream hooks read mode state instead of re-detecting from prompt
- Stale session cleanup (> 24h) on session start
- `.gemini/.gitignore` auto-managed for `omg-state/`

#### Enhanced Ralph v2 (PRD 0005)
- Verification state reading: `after-tool.js` writes `verification.json`, `ralph-retry.js` reads it
- Verification-aware completion: denies success claims when typecheck/lint fails
- Stuck protocol: tracks error signatures, fires after `stuckThreshold` consecutive same-error retries
- Error-aware retry messages with actual error details from verification state
- Session-scoped Ralph state in `.gemini/omg-state/{session}/ralph.json`
- Auto-migration from old `.gemini/ralph-state.json` format
- `ralph-mode` skill for structured persistence guidance
- Mode integration: skips verification in research/plan modes

### v1.0.0 (Published Extension Release)
Includes all development milestones below.

#### Internal milestone: v0.30.0 Alignment
- Session-aware plan loading in session-start.js and phase-gate.js
- Dual-channel context injection for masking compatibility
- `sessionPlanPath` config key for manual session path override

#### Internal milestone: Initial Implementation
- Initial hook implementation
- Replaced prompt-based enforcement with deterministic hooks
- Added 7 hooks: session-start, before-agent, tool-filter, before-tool, after-tool, phase-gate, ralph-retry
