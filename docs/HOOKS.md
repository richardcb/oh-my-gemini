# oh-my-gemini Hooks Reference

oh-my-gemini v2.0 uses Gemini CLI's hook system to enforce workflows deterministically. This document covers all hooks, their configuration, and customization options.

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
- Load Conductor track state
- Inject project context
- Display welcome message with status

**Output Example:**
```
🚀 oh-my-gemini ready | 📋 Active track: User Authentication (45% complete)
```

**Configuration:** None (always active)

---

### before-agent.js

**Event:** BeforeAgent  
**Fires:** After user submits prompt, before agent planning

**Purpose:**
- Inject git history for bug-fix tasks
- Inject recent file changes for continuation tasks
- Add current Conductor task context

**Triggers:**

| Keyword in Prompt | Context Injected |
|-------------------|------------------|
| fix, bug, error, issue | Recent git commits |
| continue, resume, pick up | Recently changed files |
| implement, build, task | Current Conductor task |

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
- Detect current agent mode
- Filter available tools based on mode
- Enforce tool sandboxing

**Agent Modes:**

| Mode | Detection | Allowed Tools |
|------|-----------|---------------|
| `@researcher` | "@researcher" in prompt | read_file, list_dir, google_web_search, web_fetch |
| `@architect` | "@architect" in prompt | read_file, list_dir, glob, search_file_content |
| `@executor` | Default / "@executor" | All tools (with security gates) |

**Configuration:**
```json
{
  "toolFilter": {
    "enabled": true,
    "modes": {
      "researcher": {
        "allowed": [
          "google_web_search",
          "web_fetch",
          "read_file",
          "list_dir"
        ]
      },
      "architect": {
        "allowed": [
          "read_file",
          "list_dir",
          "glob",
          "search_file_content"
        ]
      },
      "executor": {
        "allowed": "*"
      }
    }
  }
}
```

---

### before-tool.js

**Event:** BeforeTool  
**Matcher:** `write_file|replace|edit_file|create_file|run_shell_command|shell`  
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
**Matcher:** `write_file|replace|edit_file|create_file`  
**Fires:** After matched tool executes

**Purpose:**
- Run TypeScript typecheck after .ts/.tsx files
- Run lint after code files
- Inject errors into context

**Verification Commands:**

| Check | Commands Tried |
|-------|----------------|
| TypeScript | `npm run typecheck`, `npm run type-check`, `npx tsc --noEmit` |
| Lint | `npm run lint` |

**Output on Error:**
```markdown
## ⚠️ TypeScript Errors

Command: `npm run typecheck`

```
src/auth.ts:45:10 - error TS2339: Property 'name' does not exist on type 'User'.
```

---
**Please fix these issues before proceeding to the next task.**
```

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
- Detect Conductor phase completion
- Enforce verification gates
- Prompt for confirmation (strict mode)

**Detection Patterns:**
- "Phase N complete"
- "Completed phase N"
- "Moving to phase N"
- "All tasks in this phase complete"

**Advisory Mode (default):**
Shows a message but allows continuation:
```
📋 Phase Gate: Phase 1 complete (33%). Consider verifying before proceeding.
```

**Strict Mode:**
Forces a retry with verification requirements:
```markdown
🔍 **Phase Gate: Data Layer & Types**

Before proceeding to the next phase, please:

1. **Summarize** what was accomplished
2. **Verify** all requirements are met
3. **Update** the plan.md file
4. **Wait for user confirmation**

Do not proceed until the user explicitly confirms.
```

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
- Detect failure indicators
- Automatically retry with alternative approaches
- Track attempts and escalate after max retries

**Activation:**
Include any of these in your prompt:
- `ralph`
- `persistent`
- `don't give up`
- `keep trying`

**Failure Detection Patterns:**
```
I'm stuck
I cannot
I'm unable
failed to
unable to complete
can't figure out
```

**Retry Strategies:**
1. Break it down into smaller steps
2. Check existing patterns in codebase
3. Verify prerequisites
4. Simplify first
5. Read the errors carefully
6. Check documentation
7. Try a different approach
8. Isolate the issue

**State Tracking:**
Ralph maintains state in `.gemini/.ralph-state.json`:
```json
{
  "attempts": 3,
  "lastPrompt": "...",
  "lastFailure": "...",
  "approaches": ["Break it down", "Check existing patterns", "Simplify first"]
}
```

**Configuration:**
```json
{
  "ralph": {
    "enabled": true,
    "maxRetries": 5,
    "triggerPatterns": [
      "I'm stuck",
      "failed to"
    ]
  }
}
```

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
      "researcher": {
        "allowed": ["google_web_search", "web_fetch", "read_file", "list_dir"]
      },
      "architect": {
        "allowed": ["read_file", "list_dir", "glob", "search_file_content"]
      },
      "executor": {
        "allowed": "*"
      }
    }
  },
  
  "ralph": {
    "enabled": true,
    "maxRetries": 5,
    "triggerPatterns": [
      "I'm stuck",
      "I cannot",
      "failed to"
    ]
  },
  
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

3. **Check experimental features:**
   ```json
   // ~/.gemini/settings.json
   {
     "experimental": {
       "hooks": true
     }
   }
   ```

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

1. Include "ralph" or "persistent" in your prompt
2. Check `ralph.enabled` is true
3. Verify failure patterns match your scenario

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

Currently, hooks can only be disabled by modifying `gemini-extension.json` or removing them from the hooks array. Per-hook disable configuration is planned for a future release.

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

## Changelog

### v2.0.0
- Initial hook implementation
- Replaced prompt-based enforcement with deterministic hooks
- Added 7 hooks: session-start, before-agent, tool-filter, before-tool, after-tool, phase-gate, ralph-retry
