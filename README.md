# oh-my-gemini

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Batteries-included workflow layer for Gemini CLI. Zero learning curve, maximum power.**

*Inspired by [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode), reimagined for the Gemini ecosystem with deterministic workflow enforcement.*

---

## Why oh-my-gemini?

AI agents in large codebases face two problems: they don't follow rules reliably, and they lose context across sessions. oh-my-gemini solves both — **hook-based enforcement** makes behavior deterministic, and **Conductor** gives agents persistent, structured context so they know what to build, how to build it, and where they left off.

| Feature | Without OMG | With OMG |
|---------|-------------|----------|
| Tool sandboxing | "Don't use write tools" | `tool-filter` hook blocks them |
| Security gates | "Avoid dangerous commands" | `before-tool` hook + policy engine reject them |
| Auto-verification | "Remember to typecheck" | `after-tool` hook runs it |
| Phase gates | "Wait for confirmation" | `phase-gate` hook advises you |
| Context management | "Here's our project..." (every session) | Conductor persists specs, plans, and project knowledge |
| Cross-session memory | Manual recap every session | Conductor memory + on-demand retrieval (`omg_memory_*`) |
| Persistence | Manual retry prompts | `ralph-retry` hook forces retries |

---

## Quick Start

**Step 1: Install**

```bash
gemini extensions install https://github.com/richardcb/oh-my-gemini
```

**Step 2: Set Up Your Project**

```
/omg:setup
```

**Step 3: Build Something**

```
/omg:autopilot build a dashboard that shows how much mass I've gained since I started coding with AI
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

### 📋 Conductor — Codified Context

Agents working on large codebases need more than instructions — they need *project knowledge*. Research on codified context infrastructure shows that structured context files are associated with [29% faster agent runtime and 17% fewer tokens](https://arxiv.org/abs/2602.20478). Conductor implements this pattern as a three-layer context system:

| Layer | Contents | Purpose |
|-------|----------|---------|
| **Project knowledge** | `product.md`, `tech-stack.md`, `workflow.md` | Persistent conventions, stack decisions, and process — loaded every session |
| **Feature specs** | Per-track `spec.md` with requirements, UX flows, invariants | What to build, scoped to a single feature |
| **Phased plans** | Per-track `plan.md` with task checklists and verification gates | How to build it, with hook-enforced phase progression |

The `before-agent` hook automatically injects the active track's context into every prompt. The `phase-gate` hook parses `plan.md` after each response, tracking task completion and advising the agent on current phase progress. No manual context management needed.

```bash
/omg:setup              # Initialize project (includes Conductor option)
/omg:track "feature"    # Start a new feature track
/omg:plan               # Plan with native plan mode
/omg:implement          # Execute the plan
/omg:review             # Review your changes
/omg:status             # Check progress
```

**Workflow:** PRD → Technical Plan → Implementation → Review

### 🔄 Persistence Mode (Ralph)

Never give up until the task is complete:

```
ralph: fix all TypeScript errors in this project
```

The `ralph-retry` hook automatically:
- Reads verification state from `after-tool.js` to validate success claims
- Denies premature "success" when typecheck/lint is actually failing
- Tracks error signatures — detects when the agent is stuck on the same error
- Generates error-aware retry messages with actual error details
- Forces retries (up to configurable max), then escalates to user
- Suggests the `ralph-mode` skill for structured persistence guidance

### 🧠 Conductor Memory (v2.0)

Track-aware memory captures key observations at phase and verification boundaries, then exposes query tools via the `omg-memory` server:

- `omg_memory_search` for compact indexed retrieval
- `omg_memory_get` for full observation hydration
- `omg_memory_timeline` for chronological context
- `omg_memory_drift` for checksum + git-based drift checks
- `omg_memory_status` for quick track summaries

Manual commands:

- `/omg:remember`
- `/omg:memory-status`
- `/omg:memory-prune`

---

## Commands

| Command | Description |
|---------|-------------|
| `/omg:setup` | Initialize oh-my-gemini in your project |
| `/omg:status` | Show current orchestration state |
| `/omg:plan` | Activate plan mode with OMG context |
| `/omg:autopilot` | Autonomous task execution |
| `/omg:review` | Trigger structured code review |
| `/omg:track` | Start a new feature track |
| `/omg:implement` | Execute the current plan |
| `/omg:remember` | Record a manual decision to memory |
| `/omg:memory-status` | Show memory health for current track |
| `/omg:memory-prune` | Prune older memory observations |

---

## Magic Keywords

Prefix your prompts with keywords for deterministic mode selection (< 1ms, no LLM call):

| Keyword | Mode | Type | Effect |
|---------|------|------|--------|
| `research:`, `@researcher` | research | Primary | Research mode (read + web tools) |
| `review:`, `@architect` | review | Primary | Review mode (read-only tools) |
| `implement:`, `build:`, `@executor` | implement | Primary | Implement mode (full tools) |
| `quickfix:`, `qf:` | quickfix | Primary | Quick fix mode (full tools) |
| `plan:`, `design:` | plan | Primary | Plan mode (read + web tools) |
| `eco:`, `eco ` | eco | Modifier | Eco modifier (defaults to implement if no primary) |
| `ralph:`, `persistent:`, `@ralph` | N/A | Ralph | Suggests persistence skill |
| `don't give up`, `keep trying` | N/A | Ralph | Suggests persistence skill |

**No keyword = implement mode.** Prompts without keywords default to full tool access. See [docs/MODES.md](docs/MODES.md) for details.

---

## Configuration

Customize hook behavior via `.gemini/omg-config.json`:

```json
{
  "phaseGates": {
    "enabled": true
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
    "maxRetries": 5,
    "stuckThreshold": 3
  },
  "modes": {
    "enabled": true,
    "default": "implement"
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
│   ├── ralph-mode/          # Persistence mode skill
│   ├── research-methodology/# Research mode skill
│   ├── code-review/         # Review mode skill
│   └── ...
├── src/lib/                 # TypeScript source modules
│   ├── keyword-registry.ts  # Magic keyword detection
│   ├── mode-state.ts        # Mode state persistence
│   ├── mode-config.ts       # Mode profile definitions
│   └── mode-types.ts        # Shared type definitions
├── dist/lib/                # Compiled JS (built via esbuild)
├── hooks/                   # Hook scripts
│   ├── hooks.json           # Hook definitions (documentation-only)
│   ├── lib/                 # Shared utilities
│   ├── session-start.js
│   ├── before-agent.js
│   ├── tool-filter.js
│   ├── before-tool.js
│   ├── after-tool.js
│   ├── phase-gate.js
│   └── ralph-retry.js
├── policies/                # TOML policy files
├── conductor/templates/     # Conductor workflow templates
├── mcp/                     # MCP server configurations
├── templates/               # Project templates
├── docs/                    # Documentation
└── examples/                # Real-world examples
```

---

## Requirements

- [Gemini CLI](https://geminicli.com) v0.31.0+
- Google AI API key or Vertex AI credentials
- Node.js (for hook execution; Node versions with built-in `node:sqlite` are recommended for memory features)
- If your Node runtime lacks `node:sqlite`, install `better-sqlite3` to enable memory fallback

---

## Documentation

- [Getting Started](docs/getting-started.md)
- [Mode System](docs/MODES.md)
- [Hooks Reference](docs/HOOKS.md)
- [Memory System](docs/MEMORY.md)
- [Conductor Workflow](conductor/README.md)
- [Contributing](CONTRIBUTING.md)

---

## Roadmap

- [x] v0.x: Core hooks infrastructure + agent simplification
- [x] v1.0: Skills, policies, plan mode integration, v0.30.0 alignment
- [x] v1.1: Mode system, keyword registry, enhanced Ralph v2
- [ ] v2.0: Multi-agent orchestration (when subagents stabilize)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

---

## License

MIT

---

## Acknowledgments

- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) - Original inspiration
- [Gemini CLI](https://geminicli.com) - Hook system that makes OMG possible
- ["Codified Context"](https://arxiv.org/abs/2602.20478) - Research validating the structured context approach

---

**Hook-enforced workflows. Codified context. OMG.**
