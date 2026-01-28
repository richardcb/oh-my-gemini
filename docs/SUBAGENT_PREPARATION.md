# SubAgent Architecture Preparation

This document tracks oh-my-gemini's preparation for Gemini CLI's upcoming SubAgent architecture.

## Upstream Status

**Issue:** https://github.com/google-gemini/gemini-cli/issues/3132
**Status:** In Design (as of January 2026)
**Assigned:** @allenhutchison, @abhipatel12

### What SubAgent Will Enable

1. **Context Isolation**: SubAgents run in isolated history objects, keeping the main thread clean
2. **Tool Sandboxing**: Filtered tool access per agent
3. **Agentic Scopes**: Run tools in isolated mode with only results returning
4. **Self-Healing Tools**: Tools can iteratively solve problems they encounter

## Current oh-my-gemini Architecture

### Pre-SubAgent Pattern (Now)

```
┌─────────────────────────────────────────────┐
│                Orchestrator                  │
│  (Single agent, mode switching)             │
├─────────────────────────────────────────────┤
│                                             │
│  ## @researcher mode                        │
│  [Research, then return to orchestrator]    │
│                                             │
│  ## @architect mode                         │
│  [Design, then return to orchestrator]      │
│                                             │
│  ## @executor mode                          │
│  [Implement, then return to orchestrator]   │
│                                             │
└─────────────────────────────────────────────┘
```

**Limitations:**
- All work happens in single context (history rot)
- No parallel execution
- No true context isolation
- Tool permissions can't be filtered

### Post-SubAgent Pattern (Future)

```
┌─────────────────────────────────────────────┐
│                Orchestrator                  │
│  (Coordinator, spawns SubAgents)            │
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
│  │  - fetch      │ │ - grep  │ │ - write  ││
│  │  - read       │ │ - glob  │ │ - shell  ││
│  └───────┬───────┘ └────┬────┘ └────┬─────┘│
│          │              │           │      │
│          ▼              ▼           ▼      │
│    [Research Brief] [Design Doc] [Code]   │
│                                            │
│    Only results return to Orchestrator     │
└────────────────────────────────────────────┘
```

**Benefits:**
- Clean main context (no research/debug noise)
- True parallel execution possible
- Tool sandboxing per agent
- Better reliability and performance

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

## Migration Plan

### Phase 1: Current (Pre-SubAgent)
- Use mode switching pattern in Orchestrator
- Emulate isolation through clear section breaks
- Use persistence skill for retry logic
- Manual context management

### Phase 2: SubAgent Beta
When SubAgent ships in preview:
1. Update `gemini-extension.json` to require SubAgent support
2. Add feature detection for SubAgent availability
3. Implement spawn_subagent wrapper function
4. Test each agent in isolated mode
5. Measure context savings and reliability improvements

### Phase 3: Full SubAgent
When SubAgent is stable:
1. Remove mode-switching fallback code
2. Enable parallel SubAgent execution
3. Implement "Ultrapilot" mode (3-5 concurrent agents)
4. Implement "Swarm" mode (coordinated parallel work)

## API Surface (Anticipated)

Based on upstream issue discussion, expected API:

```javascript
// Spawn a SubAgent with isolated context
const result = await spawnSubAgent({
  agent: "researcher",
  task: "Find JWT best practices for Express.js",
  tools: ["web_fetch", "google_web_search"],
  systemPrompt: researcherPrompt,
  maxIterations: 5,
  returnFormat: "markdown"
});

// Result contains only the final output
console.log(result.output); // Research Brief markdown
console.log(result.tokensUsed);
console.log(result.status); // "complete" | "blocked" | "failed"
```

## Tracking

### Upstream Issues to Watch
- [x] #3132 - SubAgent Architecture (main issue)
- [x] #11773 - Public Roadmap item
- [ ] SubAgent API documentation (not yet published)
- [ ] SubAgent tool filtering (sub-issue)
- [ ] SubAgent system prompt customization (sub-issue)

### oh-my-gemini Issues
- [ ] Create GitHub issue: "Implement SubAgent when available"
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
