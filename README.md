# oh-my-gemini

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Multi-agent orchestration for Gemini CLI. Zero learning curve.**

*Inspired by [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) and [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode), reimagined for the Gemini ecosystem.*

---

## Quick Start

**Step 1: Install**

```bash
gemini extensions install https://github.com/richardcb/oh-my-gemini
```

**Step 2: Setup**

```bash
/omg:setup
```

**Step 3: Build something**

```
autopilot: build a REST API for managing tasks
```

That's it. Everything else is automatic.

---

## Why oh-my-gemini?

- **Leverage Gemini's strengths** - 2M token context window means your agents see the whole picture
- **Docs-First Development** - Plan before you build with Conductor workflow
- **Persistence Mode (Ralph)** - Never give up until the task is complete
- **Specialized Agents** - Researcher, Architect, Executor - the right expert for each task
- **SubAgent-Ready** - Prepared for Gemini CLI's upcoming parallel execution
- **Auto-Verification** - Hooks verify your code after every change

---

## Features

### Execution Modes

| Mode | Description | Command |
|------|-------------|---------|
| **Autopilot** | Autonomous task execution with smart agent routing | `/omg:autopilot` |
| **Conductor** | Full planning workflow: Context → Spec → Plan → Implement | `/omg:conductor-setup` |
| **Persistent** | Don't give up mode - retry until success | Use `ralph:` prefix |

### Specialized Agents (Pre-SubAgent)

| Agent | Purpose | Use When |
|-------|---------|----------|
| **Orchestrator** | Task coordination and routing | Automatic - manages workflow |
| **Researcher** | Deep research, web search | Need external context or documentation |
| **Architect** | System design, complex debugging | Architecture decisions, tricky bugs |
| **Executor** | Focused implementation | Writing code from a clear spec |

### Skills Library

| Skill | Purpose |
|-------|---------|
| **prd-creation** | Generate PRDs through structured questions |
| **technical-planning** | Transform PRDs into phased plans |
| **implementation** | Execute plans with verification gates |
| **code-review** | Review code for quality and AI-specific risks |
| **documentation** | Document what was built |
| **persistence** | Retry logic and alternative approaches |
| **git-commit** | Intelligent conventional commits |
| **test-generation** | Generate comprehensive tests |
| **debug-assistant** | Systematic debugging methodology |

### Magic Keywords

| Keyword | Effect | Example |
|---------|--------|---------|
| `autopilot:` | Full autonomous execution | `autopilot: build a todo app` |
| `ralph:` | Persistence mode - never give up | `ralph: fix all TypeScript errors` |
| `plan:` | Planning interview before coding | `plan: user authentication` |
| `eco:` | Token-efficient execution | `eco: refactor this file` |

---

## Conductor Mode (Recommended)

oh-my-gemini includes an enhanced version of [Conductor](https://github.com/gemini-cli-extensions/conductor) for Docs-First Development.

```bash
# Initialize Conductor in your project
/omg:conductor-setup

# Start a new feature track
/omg:track "Add user authentication with OAuth"

# Implement the planned tasks
/omg:implement

# Check progress
/omg:status
```

**Workflow:**
1. **Context** → Define your product, tech stack, and workflow preferences
2. **Spec** → Generate detailed requirements for the feature
3. **Plan** → Break the spec into phases and tasks with verification gates
4. **Implement** → Execute the plan, updating status as you go
5. **Review** → Code review against the plan
6. **Document** → Generate documentation for what was built

---

## Hooks & Auto-Verification

oh-my-gemini includes hooks that run automatically:

### Pre-Tool Hook
- Creates git checkpoints before risky file changes
- Ensures you can always rollback

### Post-Tool Hook  
- Runs typecheck after TypeScript changes
- Runs lint after code changes
- Reports issues immediately

Configure in your project:
```bash
cp oh-my-gemini/hooks/* .gemini/hooks/
```

---

## SubAgent Architecture (Coming Soon)

oh-my-gemini is prepared for Gemini CLI's upcoming SubAgent architecture ([Issue #3132](https://github.com/google-gemini/gemini-cli/issues/3132)).

When SubAgent ships, you'll get:
- **True parallel execution** - Multiple agents working simultaneously
- **Context isolation** - Clean main thread, no history rot
- **Tool sandboxing** - Each agent has filtered tool access
- **Ultrapilot mode** - 3-5x faster with coordinated agents

All agent definitions are already SubAgent-ready with:
- `isolated_context` configuration
- `tool_permissions` per agent
- `shell_whitelist` for safe execution

---

## MCP Integrations

oh-my-gemini supports these MCP servers:

| Server | Purpose | Setup |
|--------|---------|-------|
| **GitHub** | Repository access, PR creation | Requires PAT |
| **Exa** | Deep web research for agents | Requires API key |
| **Context7** | Documentation lookup | Requires API key |

Configure during `/omg:setup` or manually in your MCP settings.

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `/omg:setup` | Initialize oh-my-gemini in your project |
| `/omg:status` | Show current orchestration state |
| `/omg:autopilot` | Autonomous task execution |
| `/omg:conductor-setup` | Initialize Conductor workflow |
| `/omg:track` | Start a new feature track |
| `/omg:implement` | Execute the current plan |

---

## Examples

The `examples/` directory contains real-world configurations:

- **`examples/scoring-app/`** - A complete Conductor setup for a web application with React/Hono/Drizzle stack

---

## Project Structure

```
oh-my-gemini/
├── gemini-extension.json    # Extension manifest
├── commands/omg/            # Slash commands (/omg:*)
├── agents/                  # Agent definitions (SubAgent-ready)
├── skills/                  # Skill definitions
├── hooks/                   # Pre/post tool hooks
├── conductor/templates/     # Conductor workflow templates
├── mcp/                     # MCP server configurations
├── templates/               # Project templates
├── docs/                    # Documentation
│   └── SUBAGENT_PREPARATION.md
└── examples/                # Real-world examples
```

---

## Requirements

- [Gemini CLI](https://geminicli.com) v0.25.0+
- Google AI API key or Vertex AI credentials
- Enable experimental features:
  ```json
  {
    "experimental": {
      "enableAgents": true,
      "skills": true
    }
  }
  ```

---

## Roadmap

- [x] Phase 0: Project scaffolding
- [x] Phase 1: Core skills and Conductor integration
- [x] Phase 1.5: Persistence mode, hooks, verification
- [ ] Phase 2: SubAgent integration (when available)
- [ ] Phase 3: Ultrapilot parallel mode
- [ ] Phase 4: Swarm coordinated execution

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

---

## License

MIT

---

## Acknowledgments

- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) - Original inspiration
- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) - Cross-platform vision
- [Conductor](https://github.com/gemini-cli-extensions/conductor) - Workflow foundation

---

**Zero learning curve. Maximum power. OMG.**
