# oh-my-gemini

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Hook-enforced multi-agent orchestration for Gemini CLI. Zero learning curve.**

*Inspired by [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode), reimagined for the Gemini ecosystem with deterministic workflow enforcement.*

---

## What's New in v2.0

oh-my-gemini v2.0 introduces **hook-based enforcement** - workflows that were previously enforced through prompts are now enforced through Gemini CLI's hook system, making behavior **deterministic rather than probabilistic**.

| Feature | v1.0 (Prompts) | v2.0 (Hooks) |
|---------|----------------|--------------|
| Tool sandboxing | "Don't use write tools" | `tool-filter` hook blocks them |
| Security gates | "Avoid dangerous commands" | `before-tool` hook rejects them |
| Auto-verification | "Remember to typecheck" | `after-tool` hook runs it |
| Phase gates | "Wait for confirmation" | `phase-gate` hook enforces it |
| Persistence | Skill with retry prompts | `ralph-retry` hook forces retries |

---

## Quick Start

**Step 1: Install**

```bash
gemini extensions install https://github.com/richardcb/oh-my-gemini
```

**Step 2: Enable Experimental Features**

Add to `~/.gemini/settings.json`:

```json
{
  "experimental": {
    "enableAgents": true,
    "skills": true,
    "hooks": true
  }
}
```

**Step 3: Verify Hooks**

```
/hooks panel
```

You should see 7 hooks registered.

**Step 4: Build Something**

```
/omg:autopilot build a REST API for managing tasks
```

---

## Core Features

### 🪝 Hook-Enforced Workflows

oh-my-gemini uses Gemini CLI's hook system for deterministic behavior:

| Hook | Event | What It Does |
|------|-------|--------------|
| `session-start` | SessionStart | Loads Conductor state, shows project status |
| `before-agent` | BeforeAgent | Injects context (git history, current task) |
| `tool-filter` | BeforeToolSelection | Sandboxes tools by agent mode |
| `before-tool` | BeforeTool | Security gates, git checkpoints |
| `after-tool` | AfterTool | Auto-verification (typecheck, lint) |
| `phase-gate` | AfterAgent | Conductor phase enforcement |
| `ralph-retry` | AfterAgent | Persistence mode retry logic |

### 🤖 Specialized Agents

| Agent | Purpose | Tool Access |
|-------|---------|-------------|
| **Orchestrator** | Task coordination and routing | Full |
| **Researcher** | Web search, documentation lookup | Read + Web (enforced by hook) |
| **Architect** | System design, debugging | Read only (enforced by hook) |
| **Executor** | Code implementation | Full (with security gates) |

### 📋 Conductor Workflow

Context-Driven Development with specs and plans:

```bash
/omg:conductor-setup    # Initialize Conductor
/omg:track "feature"    # Start a new feature track
/omg:implement          # Execute the plan
/omg:status             # Check progress
```

**Workflow:** PRD → Technical Plan → Implementation → Review

Phase gates are enforced by the `phase-gate` hook (advisory or strict mode).

### 🔄 Persistence Mode (Ralph)

Never give up until the task is complete:

```
ralph: fix all TypeScript errors in this project
```

The `ralph-retry` hook automatically:
- Detects failure indicators
- Suggests alternative approaches
- Forces retries (up to configurable max)
- Escalates to user after max attempts

---

## Commands

| Command | Description |
|---------|-------------|
| `/omg:setup` | Initialize oh-my-gemini in your project |
| `/omg:status` | Show current orchestration state |
| `/omg:autopilot` | Autonomous task execution |
| `/omg:conductor-setup` | Initialize Conductor workflow |
| `/omg:track` | Start a new feature track |
| `/omg:implement` | Execute the current plan |

---

## Magic Keywords

Include these in your prompts for specific behaviors:

| Keyword | Effect |
|---------|--------|
| `ralph` / `persistent` | Enable persistence mode - don't give up |
| `@researcher` | Switch to research mode (read + web only) |
| `@architect` | Switch to architect mode (read only) |
| `@executor` | Switch to executor mode (full access) |
| `plan` / `design` | Focus on planning before implementation |

---

## Configuration

Customize hook behavior via `.gemini/omg-config.json`:

```json
{
  "phaseGates": {
    "enabled": true,
    "strict": false
  },
  "autoVerification": {
    "enabled": true,
    "typecheck": true,
    "lint": true
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

See [docs/HOOKS.md](docs/HOOKS.md) for full configuration reference.

---

## Project Structure

```
oh-my-gemini/
├── gemini-extension.json    # Extension manifest
├── commands/omg/            # Slash commands
├── .gemini/agents/          # Agent definitions (SubAgent format)
├── skills/                  # Skill definitions
├── hooks/                   # Hook scripts (v2.0)
│   ├── lib/                 # Shared utilities
│   ├── session-start.js
│   ├── before-agent.js
│   ├── tool-filter.js
│   ├── before-tool.js
│   ├── after-tool.js
│   ├── phase-gate.js
│   └── ralph-retry.js
├── policies/                # TOML policy files (v2.0)
│   └── omg-security.toml    # Static security rules
├── conductor/templates/     # Conductor workflow templates
├── mcp/                     # MCP server configurations
├── templates/               # Project templates
├── docs/                    # Documentation
└── examples/                # Real-world examples
```

---

## Requirements

- [Gemini CLI](https://geminicli.com) v0.26.0+ (hooks support)
- Google AI API key or Vertex AI credentials
- Node.js (for hook execution)

---

## Documentation

- [Getting Started](docs/getting-started.md)
- [Hooks Reference](docs/HOOKS.md)
- [Conductor Workflow](conductor/README.md)
- [Contributing](CONTRIBUTING.md)

---

## Roadmap

- [x] Phase 0: Project scaffolding
- [x] Phase 1: Core hooks infrastructure
- [x] Phase 2: Advanced hooks + agent simplification
- [x] Phase 3: Documentation + polish
- [ ] Phase 4: SubAgent integration (when available)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

---

## License

MIT

---

## Acknowledgments

- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) - Original inspiration
- [Gemini CLI](https://geminicli.com) - Hook system that makes v2.0 possible

---

**Hook-enforced workflows. Deterministic behavior. OMG.**
