# SubAgent Architecture Preparation

This document tracks oh-my-gemini's preparation for Gemini CLI's upcoming SubAgent architecture.

## Upstream Status

**Documentation:** https://geminicli.com/docs/core/subagents/
**Status:** ✅ Available (Experimental) - Shipped in Gemini CLI
**Original Issue:** https://github.com/google-gemini/gemini-cli/issues/3132

### What SubAgents Enable

1. **Context Isolation**: SubAgents run in isolated history objects, keeping the main thread clean
2. **Tool Sandboxing**: Filtered tool access per agent via `tools` field in YAML frontmatter
3. **Independent Context Window**: Only final results return to main agent, saving tokens
4. **Specialized Personas**: Each agent has its own system prompt and behavior

## Current oh-my-gemini Architecture

### SubAgent Pattern (Current Implementation)

oh-my-gemini now uses the official SubAgent system. Agents are defined as markdown files in `.gemini/agents/`:

```
┌─────────────────────────────────────────────┐
│                Orchestrator                  │
│  (Coordinator, delegates via tool)          │
│            delegate_to_agent                │
├──────────┬──────────┬───────────────────────┤
│          │          │                       │
│  ┌───────▼───────┐ ┌▼────────┐ ┌──────────┐│
│  │  Researcher   │ │Architect│ │ Executor ││
│  │   SubAgent    │ │SubAgent │ │ SubAgent ││
│  │               │ │         │ │          ││
│  │  Isolated     │ │Isolated │ │ Isolated ││
│  │  Context      │ │Context  │ │ Context  ││
│  │               │ │         │ │          ││
│  │  Tools:       │ │ Tools:  │ │ Tools:   ││
│  │  - search     │ │ - read  │ │ - read   ││
│  │  - fetch      │ │ - list  │ │ - write  ││
│  │  - read       │ │ - glob  │ │ - shell  ││
│  └───────┬───────┘ └────┬────┘ └────┬─────┘│
│          │              │           │      │
│          ▼              ▼           ▼      │
│    [Research Brief] [Design Doc] [Code]   │
│                                            │
│    Only results return to Orchestrator     │
└────────────────────────────────────────────┘
```

**Benefits Achieved:**
- ✅ Clean main context (isolated agent histories)
- ✅ Tool sandboxing per agent (via YAML `tools` field)
- ✅ Specialized personas (each agent has own system prompt)
- ⏳ Parallel execution (not yet implemented in CLI)

### Agent File Format

SubAgents are markdown files with YAML frontmatter:

```markdown
---
name: researcher
description: Deep research agent powered by web search...
model: gemini-3-flash-preview
tools:
  - web_fetch
  - google_web_search
  - read_file
  - list_directory
---

You are the oh-my-gemini Researcher...
[System prompt content]
```

**Key Configuration Fields:**
- `name`: Agent identifier (used in `delegate_to_agent`)
- `description`: Helps main agent decide when to use this agent
- `tools`: Sandboxed tool list (native enforcement)
- `model`: Optional model override
- `max_turns`: Optional iteration limit

## Agent Readiness Checklist

### Orchestrator Agent
- [x] Defined tool permissions for delegation
- [x] Documented SubAgent spawn patterns
- [x] Clear handoff protocols to each agent type
- [x] Configured `can_spawn_subagents = true`
- [ ] Implement actual spawn_subagent calls (when API available)

### Researcher Agent
- [x] Defined as `isolated_context = true`
- [x] Limited tool set (read-only + web)
- [x] Clear output format (Research Brief)
- [x] Configured `history_mode = "minimal"`
- [ ] Test with actual SubAgent isolation (when available)

### Architect Agent
- [x] Defined as `isolated_context = true`
- [x] Limited tool set (read-only)
- [x] Clear output format (Design Doc / Debug Analysis)
- [x] Configured `history_mode = "minimal"`
- [ ] Test with actual SubAgent isolation (when available)

### Executor Agent
- [x] Defined as `isolated_context = true`
- [x] Sandboxed tool set (read + write + limited shell)
- [x] Shell command whitelist defined
- [x] Clear output format (Completion Status)
- [ ] Test with actual tool sandboxing (when available)

## Migration Status

### ✅ Phase 1: Pre-SubAgent (Completed)
- ~~Use mode switching pattern in Orchestrator~~
- ~~Emulate isolation through clear section breaks~~
- ~~Use persistence skill for retry logic~~
- ~~Manual context management~~

### ✅ Phase 2: SubAgent Implementation (Completed)
- [x] Created agent definitions in `.gemini/agents/*.md`
- [x] Configured tool sandboxing via YAML `tools` field
- [x] Orchestrator uses `delegate_to_agent` for delegation
- [x] Tested context isolation with SubAgents
- [x] Added supplementary hook-based filtering for dynamic mode switching

### ⏳ Phase 3: Advanced Features (Future)
When parallel execution is available:
1. Enable parallel SubAgent execution
2. Implement "Ultrapilot" mode (3-5 concurrent agents)
3. Implement "Swarm" mode (coordinated parallel work)

## API Surface (Actual)

SubAgents are exposed as tools. The main agent calls them via `delegate_to_agent`:

```
// Agent definition: .gemini/agents/researcher.md
---
name: researcher
description: Deep research agent...
tools:
  - google_web_search
  - web_fetch  
  - read_file
---
[System prompt]

// Orchestrator delegates by calling the agent as a tool:
delegate_to_agent(
  agent_name: "researcher",
  objective: "Find JWT best practices for Express.js"
)

// Only the final result returns to the orchestrator
```

**Key Points:**
- Agents are defined as markdown files, not programmatic objects
- The CLI automatically exposes agents as callable tools
- Tool sandboxing is native (via YAML frontmatter)
- Context isolation is automatic

## Tracking

### Upstream Status
- [x] #3132 - SubAgent Architecture (shipped as experimental)
- [x] #11773 - Public Roadmap item (completed)
- [x] SubAgent documentation: https://geminicli.com/docs/core/subagents/
- [x] Tool filtering: Now via `tools` field in YAML frontmatter
- [x] System prompt customization: Markdown body becomes system prompt

### oh-my-gemini Status
- [x] Implemented SubAgents in `.gemini/agents/`
- [x] Orchestrator uses `delegate_to_agent` tool
- [ ] Create GitHub issue: "Add Ultrapilot parallel mode"
- [ ] Create GitHub issue: "Add Swarm coordinated mode"

## Testing Strategy

### Unit Tests (Now)
- Test agent prompt generation
- Test output format parsing
- Test skill activation

### Integration Tests (When SubAgent Available)
- Test context isolation (main context stays clean)
- Test tool sandboxing (blocked tools actually blocked)
- Test result aggregation
- Test failure handling

### Performance Tests
- Measure token savings from isolation
- Measure latency of SubAgent spawn
- Compare reliability vs mode-switching

## Notes

### Context Window Considerations
With SubAgent isolation, we can potentially:
- Use larger context for research (it doesn't pollute main)
- Run longer debugging sessions
- Execute more complex implementations

### Security Considerations
SubAgent sandboxing enables:
- Safer code execution (executor can't access secrets)
- Controlled file system access
- Network request filtering

### Cost Considerations
SubAgent isolation may:
- Reduce overall tokens (cleaner context)
- Increase API calls (separate conversations)
- Enable smarter model routing per agent
