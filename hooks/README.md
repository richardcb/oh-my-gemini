# oh-my-gemini Hooks

This directory contains the hook scripts that integrate oh-my-gemini with Gemini CLI's hook system.

## Overview

Hooks are scripts that Gemini CLI executes at specific points in its lifecycle. They allow oh-my-gemini to:

- **Enforce security** - Block dangerous commands and protected paths
- **Auto-verify** - Run typecheck/lint after code changes
- **Inject context** - Add relevant information based on task type
- **Track state** - Load and display Conductor workflow status

## Hybrid Security Approach

oh-my-gemini uses **both** hooks and TOML policies for security:

| Mechanism | Location | Use Case |
|-----------|----------|----------|
| **TOML Policies** | `policies/omg-security.toml` | Static rules (blocked commands, protected paths) |
| **Hook Scripts** | `hooks/before-tool.js` | Dynamic, context-aware checks (git checkpoints) |

**Why both?**
- TOML policies use the native Policy Engine with tiered priority (Default → User → Admin)
- Hooks provide programmable logic for context-aware decisions
- Static rules in TOML get better performance (native parsing vs Node.js execution)

## Hook Files

### Core Hooks (Phase 1)

| File | Event | Purpose |
|------|-------|---------|
| `session-start.js` | SessionStart | Load Conductor state, show welcome message |
| `before-agent.js` | BeforeAgent | Inject git history, recent changes, current task |
| `before-tool.js` | BeforeTool | Security gates, git checkpoints |
| `after-tool.js` | AfterTool | Auto-verification (typecheck, lint) |

### Advanced Hooks (Phase 2)

| File | Event | Purpose |
|------|-------|---------|
| `phase-gate.js` | AfterAgent | Conductor phase verification gates (advisory/strict) |
| `tool-filter.js` | BeforeToolSelection | Agent-mode tool sandboxing |
| `ralph-retry.js` | AfterAgent | Persistence mode - automatic retry on failure |

## Configuration

Hooks are configured via `config.default.json` (bundled defaults) and can be customized by creating `.gemini/omg-config.json` in your project or `~/.gemini/omg-config.json` for user-wide settings.

### Example Custom Configuration

Create `.gemini/omg-config.json`:

```json
{
  "phaseGates": {
    "strict": true
  },
  "autoVerification": {
    "lint": false
  },
  "security": {
    "gitCheckpoints": false
  }
}
```

### Configuration Options

#### Phase Gates

```json
{
  "phaseGates": {
    "enabled": true,
    "strict": false
  }
}
```

- `enabled`: Enable/disable phase gate detection
- `strict`: If `true`, blocks progression until user confirms. If `false`, shows advisory message only.

#### Auto Verification

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

- `enabled`: Enable/disable auto-verification
- `typecheck`: Run TypeScript type checking
- `lint`: Run linting
- `timeout`: Maximum time (ms) for verification commands

#### Security

```json
{
  "security": {
    "gitCheckpoints": true,
    "blockedCommands": ["rm -rf /", "sudo rm"],
    "blockedPaths": ["node_modules", ".git"]
  }
}
```

- `gitCheckpoints`: Create git commits before file modifications
- `blockedCommands`: Shell command patterns to block
- `blockedPaths`: Directory names/paths to protect from writes

#### Tool Filtering

```json
{
  "toolFilter": {
    "enabled": true,
    "modes": {
      "researcher": {
        "allowed": ["google_web_search", "web_fetch", "read_file"]
      }
    }
  }
}
```

- `enabled`: Enable/disable tool filtering by agent mode
- `modes`: Define allowed tools per mode (researcher, architect, executor)

#### Ralph (Persistence Mode)

```json
{
  "ralph": {
    "enabled": true,
    "maxRetries": 5,
    "triggerPatterns": ["I'm stuck", "failed to"]
  }
}
```

- `enabled`: Enable/disable persistence mode
- `maxRetries`: Maximum retry attempts before escalating to user
- `triggerPatterns`: Phrases that indicate the agent is stuck

#### Context Injection

```json
{
  "contextInjection": {
    "conductorState": true,
    "gitHistory": {
      "enabled": true,
      "onKeywords": ["fix", "bug"],
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

- `conductorState`: Inject active Conductor track info
- `gitHistory`: Inject recent commits when keywords detected
- `recentChanges`: Inject recently changed files when keywords detected

## How Hooks Work

### Communication

Hooks communicate with Gemini CLI via:
- **stdin**: Receives JSON input with context
- **stdout**: Sends JSON output with instructions
- **stderr**: Logging (doesn't affect JSON parsing)

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - stdout parsed as JSON |
| 2 | Block - Action is blocked, stderr used as reason |
| Other | Warning - Non-fatal, CLI continues |

### Example Hook I/O

**BeforeTool Input:**
```json
{
  "hook_event_name": "BeforeTool",
  "tool_name": "write_file",
  "tool_input": {
    "path": "src/index.ts",
    "content": "..."
  },
  "session_id": "abc123",
  "cwd": "/home/user/project"
}
```

**BeforeTool Output (allow):**
```json
{}
```

**BeforeTool Output (block):**
```json
{
  "decision": "deny",
  "reason": "Cannot write to protected path: node_modules"
}
```

## Development

### Testing Hooks Locally

1. Create a test input file:
```bash
echo '{"prompt": "fix the bug", "cwd": "/path/to/project"}' > test-input.json
```

2. Run the hook:
```bash
cat test-input.json | node hooks/before-agent.js
```

3. Check output and stderr for debugging info.

### Debugging

Hooks log to stderr with the `[omg]` prefix. Enable verbose logging in Gemini CLI to see these messages.

### Adding New Hooks

1. Create the hook file in `hooks/`
2. Follow the input/output JSON schema
3. Add configuration options to `config.default.json`
4. Update `gemini-extension.json` to register the hook
5. Document in this README

## Troubleshooting

### Hook Not Running

1. Check hooks are enabled: `/hooks panel`
2. Verify extension is installed: `gemini extensions list`
3. Check matcher pattern matches the tool name

### Verification Failing

1. Ensure `package.json` has `typecheck` or `lint` scripts
2. Check timeout isn't too short for your project
3. Verify the project compiles manually first

### Git Checkpoints Not Created

1. Ensure you're in a git repository
2. Check there are uncommitted changes
3. Verify `gitCheckpoints` is enabled in config

## Security Considerations

Hooks execute with your user privileges. The oh-my-gemini hooks:

- Never execute arbitrary user input as commands
- Block known dangerous patterns by default
- Create checkpoints before destructive operations
- Can be disabled per-hook if needed

Review the hook code if you have security concerns.
