# Development Workflow

We follow a strict, linear "Docs-First" methodology. **Do not write code** until a PRD and Technical Plan have been generated and approved.

## Workflow Phases

### Phase 1: Discovery & PRD (Interactive)
**Trigger:** User requests a new feature.

**Action:**
1. **Check for existing PRD:** Look in the features directory. If a PRD exists, skip to Phase 2.
2. **Clarify (CRITICAL):** If no PRD exists, **STOP** and ask clarifying questions:
   - Problem & Goal: What specific user pain point are we solving?
   - User Stories: "As a [role], I want to [action]..."
   - Business Invariants: Rules that must never be broken
   - Failure States: What happens when things go wrong?
3. **Generate PRD:** Create the PRD using the `prd-creation` skill.

### Phase 2: Technical Planning
**Trigger:** A PRD exists but no task list exists.

**Action:**
1. **Analyze Codebase:** Review existing code to identify patterns and reuse opportunities.
2. **Generate Technical Plan:** Use the `technical-planning` skill.
3. **Structure Requirements:** The plan **must** include:
   - Phase 1: Data Layer (database, types)
   - Phase 2: Backend API (endpoints, validation)
   - Phase 3: Frontend UI (components, state)
   - Phase 4: Review & Finalize (tests, docs)

### Phase 3: Implementation Loop
**Trigger:** User approves the Technical Plan.

**Action:**
1. **Execute sequentially:** Follow the plan checklist in order.
   - Data First → Backend Second → Frontend Third
2. **Update status:** Mark tasks as `[x]` as you complete them.
3. **Pause at verification gates:** Each phase ends with manual verification.

### Phase 4: Review & Finalize
**Trigger:** Implementation is complete.

**Action:**
1. **Code Review:** Use the `code-review` skill.
2. **Documentation:** Use the `documentation` skill.
3. **Final verification:** Ensure all tests pass.

---

## Phase Completion Protocol

For each major phase in a plan, the final task must be a manual verification step.

**Task:** `Conductor - User Manual Verification '[Phase Name]'`

**Protocol:**
1. Summarize the work done in the phase
2. Verify against the PRD/Spec requirements
3. Ensure all tests pass
4. Ask user: "Would you like to commit these changes?"
5. Wait for confirmation before proceeding to next phase

---

## Commit Strategy

### Commit Messages
Follow conventional commits:
```
feat: add user authentication
fix: handle null response from API
docs: update README with new feature
refactor: extract validation logic
test: add unit tests for auth module
```

### Commit Frequency
- Commit after each completed phase (at verification gates)
- Commit before switching context
- Never commit broken code to main

---

## Agent Guidelines

### When to Use Each Agent
- **@researcher**: Before starting unfamiliar work, need external documentation
- **@architect**: When design decisions are needed, complex bugs
- **@executor**: When spec is clear and it's time to code

### Context Handoff
When delegating between agents:
1. Summarize relevant context
2. Link to specific files/sections
3. State expected output clearly

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
