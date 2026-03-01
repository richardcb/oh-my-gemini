# Mode System

oh-my-gemini v1.1 uses **Magic Keywords** for deterministic, zero-latency mode selection. Keywords are detected in `before-agent.js` via a compiled TypeScript keyword registry (`src/lib/keyword-registry.ts`). Mode state is persisted per-session so all downstream hooks read a single source of truth.

## How It Works

```
User prompt → resolveModeFromPrompt(prompt) → ModeState { primary, modifiers, resolvedAt, source }
                                             → persisted to .gemini/omg-state/{session}/mode.json
                                             → downstream hooks read via readModeState()
                                             → composeModeProfile() builds tool/verification/context config
```

No LLM call. No regex inference. No false positives. Mode resolution adds < 5ms.

## Architecture

| Module | Role |
|--------|------|
| `src/lib/keyword-registry.ts` | Keyword detection (pure computation) |
| `src/lib/mode-types.ts` | Shared type definitions |
| `src/lib/mode-config.ts` | Mode profiles and composition logic |
| `src/lib/mode-state.ts` | State persistence (read/write/cleanup) |

### Mode Profile Dimensions

Each mode profile configures four dimensions:

| Dimension | Description | Example |
|-----------|-------------|---------|
| **Tool Access** | Which tools are available | `"*"`, `null`, or array of tool names |
| **Skill Suggestions** | Skills suggested via systemMessage | `["research-methodology"]` |
| **Context Injection** | What context is injected | git history, conductor state, recent changes |
| **Verification** | What runs after tool execution | typecheck, lint, both, or none |

## Keyword Reference

### Primary Keywords

| Keyword(s) | Resolves To | Tool Access | Verification | Phase Gates |
|------------|-------------|-------------|--------------|-------------|
| `research:`, `@researcher` | `research` | Read + Web + MCP | Disabled | Disabled |
| `review:`, `@architect` | `review` | Read only | Lint only | Disabled |
| `implement:`, `build:`, `@executor` | `implement` | Full | Full | Enabled |
| `quickfix:`, `qf:` | `quickfix` | Full | Typecheck only | Disabled |
| `plan:`, `design:` | `plan` | Native (null) | Disabled | Disabled |

Keywords are **case-insensitive** and must be followed by a space or end-of-string (e.g., `research: topic` works, `research:nospace` does not).

### Modifier Keywords

| Keyword(s) | Effect |
|------------|--------|
| `eco:`, `eco ` (trailing space) | Eco modifier — reduces context injection to summary, disables lint. If no primary keyword, defaults to `implement + eco`. |

### Ralph Keywords (Separate from Modes)

| Keyword(s) | Effect |
|------------|--------|
| `ralph:`, `persistent:`, `@ralph` | Suggests `ralph-mode` skill for structured persistence |
| `don't give up`, `keep trying` | Same as above |

Ralph keywords don't affect mode resolution. They trigger a skill suggestion via `systemMessage`.

## No Keyword = Implement

Prompts without keywords default to `implement` mode with full tool access. This is intentional:

- Most prompts are implementation requests
- Ambiguous prompts like "find and fix the bug" should have full tools, not be restricted to read-only
- If the user wants research-only, they use the `research:` keyword

## Mode State Persistence

Mode state is written by `before-agent.js` and read by all downstream hooks:

```
before-agent.js (BeforeAgent)    → writes .gemini/omg-state/{session}/mode.json
tool-filter.js  (BeforeToolSelection) → reads mode state, applies tool allowlist
after-tool.js   (AfterTool)      → reads mode state, adjusts verification
phase-gate.js   (AfterAgent)     → reads mode state, skip if phaseGates.enabled === false
ralph-retry.js  (AfterAgent)     → reads mode state, includes mode in retry messages
```

State files are < 200 bytes. Stale sessions (> 24h) are cleaned on session start.

## Skill Composition Recipes

Keywords compose with Gemini's native `activate_skill` matching:

| Prompt | Mode | Skill Suggestion |
|--------|------|-----------------|
| `research: JWT best practices` | research | research-methodology |
| `review: check auth module` | review | code-review |
| `plan: notification system` | plan | technical-planning |
| `eco: research: find docs` | research + eco | research-methodology |
| `ralph: fix all errors` | implement | ralph-mode (persistence) |
| `eco: add a console.log` | implement + eco | (none) |

## Native Routing

Keywords complement Gemini's native subagent routing:

- **With keyword**: Mode is deterministic. Tool filtering applied. Skill suggested.
- **Without keyword**: Default to implement. Gemini may still route to a subagent based on description matching.

For native routing to work, `experimental.enableAgents: true` must be set in your Gemini CLI `settings.json`.

## Debug

Set `OMG_DEBUG=1` to see mode detection in stderr:

```
[omg:debug] Mode: research+eco (source: keyword)
[omg:debug] writeModeState: wrote .gemini/omg-state/abc123/mode.json
```

## Configuration

Mode profiles are defined in `src/lib/mode-config.ts` (DEFAULT_MODE_PROFILES). Legacy tool allowlists in `.gemini/omg-config.json` under `toolFilter.modes` are used as fallback if `dist/` is not built.

To enable/disable the mode system:

```json
{
  "modes": {
    "enabled": true,
    "default": "implement"
  }
}
```
