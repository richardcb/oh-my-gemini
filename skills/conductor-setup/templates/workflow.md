# Development Workflow

We follow a strict, linear "Docs-First" methodology. **Do not write code** until a PRD and Technical Plan have been generated and approved.

## Hook-Enforced Workflow

oh-my-gemini uses hooks to enforce workflow rules automatically:

| Hook | What It Enforces |
|------|------------------|
| `phase-gate` | Phase boundaries - advisory or strict mode |
| `after-tool` | Auto-verification after code changes |
| `ralph-retry` | Persistence mode retry on failure |

You don't need to remember verification steps - they happen automatically.

---

## Workflow Phases

### Phase 1: Discovery & PRD (Interactive)
**Trigger:** User requests a new feature.

**Action:**
1. **Check for existing PRD:** Look in the features directory
2. **Clarify (CRITICAL):** If no PRD exists, **STOP** and ask clarifying questions:
   - Problem & Goal: What specific user pain point are we solving?
   - User Stories: "As a [role], I want to [action]..."
   - Business Invariants: Rules that must never be broken
   - Failure States: What happens when things go wrong?
3. **Generate PRD:** Use the `prd-creation` skill

### Phase 2: Technical Planning
**Trigger:** A PRD exists but no task list exists.

**Action:**
1. **Analyze Codebase:** Review existing code to identify patterns and reuse opportunities
2. **Generate Technical Plan:** Use the `technical-planning` skill
3. **Structure Requirements:** The plan **must** include:
   - Phase 1: Data Layer (database, types)
   - Phase 2: Backend API (endpoints, validation)
   - Phase 3: Frontend UI (components, state)
   - Phase 4: Review & Finalize (tests, docs)

### Phase 3: Implementation Loop
**Trigger:** User approves the Technical Plan.

**Action:**
1. **Execute sequentially:** Follow the plan checklist in order
   - Data First → Backend Second → Frontend Third
2. **Hooks handle verification:** The `after-tool` hook runs typecheck/lint automatically
3. **Phase gates:** The `phase-gate` hook detects phase completion

### Phase 4: Review & Finalize
**Trigger:** Implementation is complete.

**Action:**
1. **Code Review:** Use the `code-review` skill
2. **Documentation:** Use the `documentation` skill
3. **Final verification:** Ensure all tests pass

---

## Phase Gate Behavior

The `phase-gate` hook activates when you complete a phase.

### Advisory Mode (Default)
- Shows a message suggesting verification
- Allows continuation if appropriate
- Good for experienced users and simple tasks

### Strict Mode
- Requires explicit user confirmation
- Shows verification checklist
- Better for complex projects or teams

**Configure in `.gemini/omg-config.json`:**
```json
{
  "phaseGates": {
    "strict": true
  }
}
```

---

## Auto-Verification

The `after-tool` hook automatically runs after code file modifications:

| File Type | Verification |
|-----------|--------------|
| `.ts`, `.tsx` | TypeScript typecheck |
| `.js`, `.jsx` | Lint (if configured) |

If errors are found, they're injected into context so you can fix them immediately.

**Configure in `.gemini/omg-config.json`:**
```json
{
  "autoVerification": {
    "enabled": true,
    "typecheck": true,
    "lint": true
  }
}
```

---

## Persistence Mode (Ralph)

Include "ralph" or "persistent" in your prompt to enable persistence mode.

The `ralph-retry` hook will:
1. Detect failure indicators ("I'm stuck", "failed to", etc.)
2. Suggest alternative approaches
3. Force retries (up to configured max)
4. Escalate to user after max attempts

**Example:**
```
ralph: fix all TypeScript errors in this project
```

**Configure in `.gemini/omg-config.json`:**
```json
{
  "ralph": {
    "enabled": true,
    "maxRetries": 5
  }
}
```

---

## Commit Strategy

### Commit Messages
Follow conventional commits:
```
feat(scope): add user authentication
fix(scope): handle null response from API
docs(scope): update README with new feature
refactor(scope): extract validation logic
test(scope): add unit tests for auth module
```

### Commit Frequency
- Commit after each completed phase (at verification gates)
- Commit before switching context
- Never commit broken code to main
- Use the `git-commit` skill for intelligent messages

### Git Checkpoints (Automatic)
The `before-tool` hook creates automatic git checkpoints before file modifications.

**Configure in `.gemini/omg-config.json`:**
```json
{
  "security": {
    "gitCheckpoints": true
  }
}
```

---

## Agent Mode Switching

Switch between agent modes for different tasks:

| Mode | Activate With | Tool Access |
|------|---------------|-------------|
| @researcher | Include "@researcher" in prompt | Read + Web only |
| @architect | Include "@architect" in prompt | Read only |
| @executor | Include "@executor" in prompt | Full access |

The `tool-filter` hook enforces tool restrictions automatically.

---

## Quality Standards

### Code
- Match existing codebase style
- Handle errors gracefully
- Include appropriate types
- Avoid premature optimization

### Documentation
- Keep it accurate and up-to-date
- Include examples
- Explain "why" not just "what"

### Testing
- Add tests for new functionality
- Cover edge cases and error paths
- Maintain existing test coverage

---

## Hooks Summary

| Hook | When | What |
|------|------|------|
| `session-start` | CLI starts | Loads Conductor state |
| `before-agent` | After prompt | Injects context |
| `tool-filter` | Before tool selection | Filters by agent mode |
| `before-tool` | Before file/shell ops | Security + checkpoints |
| `after-tool` | After file ops | Auto-verification |
| `phase-gate` | After response | Phase enforcement |
| `ralph-retry` | After response | Persistence retry |

These hooks work together to enforce the workflow automatically.
