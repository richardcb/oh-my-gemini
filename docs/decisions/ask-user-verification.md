# Decision Record: ask_user Verification Integration

**Status:** Accepted
**Date:** 2026-02-27
**Context:** v0.30.0 alignment (PRD 0002)

## Context

Gemini CLI v0.30.0 introduces the `ask_user` tool (PR #18959) that allows agents to pause and ask the user a question. oh-my-gemini phase gates currently use `decision: "deny"` (strict) or `systemMessage` (advisory) to enforce verification checkpoints. The `ask_user` tool provides a more natural verification flow.

## Decision

Implement a three-tier verification approach in `hooks/phase-gate.js`:

1. **`ask_user` available:** Construct a `systemMessage` instructing the model to call `ask_user` with the verification question and `question_type: "yes_no"`.
2. **`ask_user` not available, strict mode:** Use `decision: "deny"` to block progression.
3. **`ask_user` not available, advisory mode:** Use `systemMessage` advisory.

Detection is based on checking the hook input payload for `available_tools` or `tool_declarations` fields. If neither field exists, fall back to prompt-based verification.

### Limitations

- Hooks cannot directly invoke tools — they can only instruct the model via `systemMessage`. The model may ignore the instruction.
- In headless/non-interactive mode (PR #18855, #18976), `ask_user` may be absent. The fallback path handles this.
- `question_type` field supports `"yes_no"` and `"free_text"` per PR #18959.
- Multi-line text answers supported per PR #18741.

## Consequences

- Phase gates become more interactive and user-friendly when `ask_user` is available.
- No breaking changes — existing strict/advisory behavior is preserved as fallback.
- Skills documentation updated to recommend `ask_user` for verification checkpoints.
- Requires v0.30.0 CLI — older CLI versions will always use the fallback path.
