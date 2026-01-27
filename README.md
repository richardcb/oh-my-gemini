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
- **Context-Driven Development** - Optional Conductor workflow ensures you plan before you build
- **Specialized agents** - Researcher, Architect, Executor - the right expert for each task
- **Deep research** - Exa AI integration for agents that can search beyond your codebase
- **Battle-tested workflow** - PRD → Technical Plan → Implementation → Review → Documentation

---

## Features

### Execution Modes

| Mode | Description | Command |
|------|-------------|---------|
| **Autopilot** | Autonomous task execution with smart agent routing | `/omg:autopilot` |
| **Conductor** | Full planning workflow: Context → Spec → Plan → Implement | `/omg:conductor-setup` |

### Specialized Agents

| Agent | Purpose | Use When |
|-------|---------|----------|
| **Orchestrator** | Task coordination and routing | Automatic - manages workflow |
| **Researcher** | Deep research, Exa-powered web search | Need external context or documentation |
| **Architect** | System design, complex debugging | Architecture decisions, tricky bugs |
| **Executor** | Focused implementation | Writing code from a clear spec |

### Skills Library

Reusable expertise patterns that agents can activate:

- **PRD Creation** - Generate product requirements through structured clarifying questions
- **Technical Planning** - Transform PRDs into phased, actionable implementation plans
- **Implementation** - Execute plans with guardrails and verification gates
- **Documentation** - Document what was built (code is source of truth)

---

## Conductor Mode (Recommended)

oh-my-gemini includes an enhanced version of [Conductor](https://github.com/gemini-cli-extensions/conductor) for Context-Driven Development.

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
4. **Implement** → Agents execute the plan, updating status as they go
5. **Document** → Generate documentation for what was built

---

## MCP Integrations

oh-my-gemini supports these MCP servers out of the box:

| Server | Purpose | Setup |
|--------|---------|-------|
| **GitHub** | Repository access, PR creation | Requires PAT |
| **Exa** | Deep web research for agents | Requires API key |
| **Context7** | Documentation lookup | Requires API key |

Configure during `/omg:setup` or manually in your MCP settings.

---

## Examples

The `examples/` directory contains real-world configurations:

- **`examples/scoring-app/`** - A complete Conductor setup for a web application with React/Hono/Drizzle stack

These demonstrate what a mature oh-my-gemini setup looks like in practice.

---

## Requirements

- [Gemini CLI](https://geminicli.com) v0.25.0+
- Google AI API key or Vertex AI credentials

---

## Roadmap

- [x] Phase 0: Project scaffolding
- [ ] Phase 1: Core agents and Conductor integration
- [ ] Phase 2: Skills library
- [ ] Phase 3: Autopilot mode
- [ ] Phase 4: Parallel execution (Swarm mode)

---

## License

MIT

---

**Zero learning curve. Maximum power. OMG.**
