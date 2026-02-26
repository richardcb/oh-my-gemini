# Decision Record: Tool Filter Migration to Policy Engine

**Status:** Accepted (Retained)
**Date:** 2026-02-27
**Context:** v0.30.0 alignment (PRD 0002)

## Context

`hooks/tool-filter.js` currently handles agent-mode tool filtering via `BeforeToolSelection` hook. It detects `@researcher`/`@architect`/`@executor` keywords and restricts tool access. v0.30.0 introduces conditional policy rules (PR #18882) which could potentially replace this hook with TOML-based policy rules.

## Investigation Findings

### Conditional Policy Rules (PR #18882)

v0.30.0 policy engine supports conditional rules for **plan mode** context. The `plan_mode` condition variable is available in the policy evaluation context. However:

- **Agent-mode conditions are not directly supported.** There is no `active_agent` or `agent_name` condition variable in the policy schema.
- **Prompt-based conditions are not supported.** The policy engine cannot evaluate whether `@researcher` appears in the user prompt.
- **Plan-mode conditions work correctly.** Rules like "deny `write_file` when `plan_mode` is active" can be expressed.

### Migration Assessment

| Feature | Migratable to Policy? | Notes |
|---------|----------------------|-------|
| Plan-mode write blocking | Yes | → `omg-plan-mode.toml` |
| Researcher tool restriction | No | Requires prompt keyword detection |
| Architect tool restriction | No | Requires prompt keyword detection |
| Executor (full access) | N/A | Default behavior |

## Decision

**Retain `tool-filter.js`** for agent-mode filtering. The hook is the only mechanism that can dynamically detect agent mode from prompt keywords and restrict tools accordingly.

**Create `omg-plan-mode.toml`** as a separate static policy for plan-mode write restrictions. This policy can be loaded via `--policy` flag or automatically when plan mode is detected.

### Future Consideration

If a future CLI version exposes agent identity as a policy condition variable, `tool-filter.js` agent-mode logic can be migrated to TOML rules. The hook's `detectAgentMode()` logic would become unnecessary.

## Consequences

- `tool-filter.js` remains in the extension and continues to function as before.
- `omg-plan-mode.toml` created as new static policy for plan-mode restrictions.
- No functionality gap — all current restrictions are preserved.
- Hook validated against v0.30.0 tool names to ensure compatibility.
