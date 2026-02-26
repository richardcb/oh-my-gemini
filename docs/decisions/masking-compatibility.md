# Decision Record: Tool Output Masking Compatibility

**Status:** Accepted
**Date:** 2026-02-27
**Context:** v0.30.0 alignment (PRD 0002)

## Context

Gemini CLI v0.30.0 enables tool output masking by default (PR #18564). This feature masks tool outputs to reduce context window usage and improve performance. oh-my-gemini hooks inject context via `additionalContext` (in `hookSpecificOutput`) and `systemMessage` — both channels need to survive masking.

## Investigation Findings

### Channel Behavior Under Masking

| Channel | Survives Masking? | Notes |
|---------|------------------|-------|
| `systemMessage` | Yes | System messages are in a separate channel from tool outputs; masking does not affect them. |
| `additionalContext` | Partially | Hook-injected `additionalContext` may be treated as tool output in some contexts. Behavior depends on the hook event type. |

### Affected Hooks

- **`before-agent.js`**: Injects git history, recent changes, and Conductor state as `additionalContext`. If masking strips this, the agent loses context.
- **`after-tool.js`**: Injects typecheck/lint results as `additionalContext`. If masking strips this, the agent doesn't see verification errors.
- **`session-start.js`**: Injects session context as `additionalContext` with a `systemMessage` summary. The `systemMessage` survives; `additionalContext` may not.

### Sentinel Test Results

Injecting a known sentinel string (`<!-- omg-context-marker -->`) into `additionalContext` and checking in subsequent hook fires:

- Hook-injected `additionalContext` in `SessionStart` events: **survives** (session context is not subject to tool output masking).
- Hook-injected `additionalContext` in `AfterTool` events: **may be stripped** if masking is aggressive.
- `systemMessage` in all events: **always survives**.

## Decision

Adopt a **dual-channel injection** strategy:

1. **Critical context** (verification errors, phase gate warnings) is injected via `systemMessage`, which is guaranteed to survive masking.
2. **Supplementary context** (git history, recent changes, Conductor state) continues to use `additionalContext` for rich formatting, with a brief summary also in `systemMessage` as fallback.
3. **Session start context** uses both channels — already the existing pattern.

### Settings Override

If masking causes issues, users can configure `toolOutputMasking: false` in `.gemini/settings.json`. The `session-start.js` hook logs a one-time diagnostic when masking may be affecting context injection.

## Consequences

- No breaking changes to existing behavior.
- Critical verification information always reaches the model via `systemMessage`.
- Rich supplementary context may be lost under aggressive masking, but the `systemMessage` fallback provides a summary.
- Documentation updated in `hooks/README.md` with a "Tool Output Masking" section.
