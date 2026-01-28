# Development Workflow

We follow a strict, linear "Docs-First" methodology. **Do not write code** until a PRD and Technical Plan have been generated and approved.

## Workflow Phases

### Phase 1: Discovery & PRD
**Trigger:** User requests a new feature.

**Action:**
1. Check for existing PRD in features directory
2. If no PRD exists, ask clarifying questions:
   - Problem & Goal
   - User Stories
   - Business Invariants
   - Failure States
3. Generate PRD using `prd-creation` skill

### Phase 2: Technical Planning
**Trigger:** PRD exists but no task list.

**Action:**
1. Analyze codebase for patterns
2. Generate Technical Plan using `technical-planning` skill
3. Structure as phases: Data → Backend → Frontend → Review

### Phase 3: Implementation
**Trigger:** User approves the Technical Plan.

**Action:**
1. Execute tasks sequentially within each phase
2. Update task status as work completes
3. Pause at verification gates for user confirmation

### Phase 4: Review & Finalize
**Trigger:** Implementation complete.

**Action:**
1. Code review using `code-review` skill
2. Documentation using `documentation` skill
3. Final verification

---

## Phase Completion Protocol

Each phase ends with: `Conductor - User Manual Verification '[Phase Name]'`

**Protocol:**
1. Summarize work done
2. Verify against PRD requirements
3. Run tests and show results
4. Ask: "Commit these changes?"
5. Wait for confirmation

---

## Commit Strategy

### Commit Messages
Follow conventional commits:
```
feat(scope): description
fix(scope): description
docs(scope): description
refactor(scope): description
test(scope): description
```

### Commit Frequency
- After each completed phase
- Before switching context
- Never commit broken code

---

## Quality Standards

### Code
- Match existing codebase style
- Handle errors gracefully
- Include appropriate types

### Testing
- Add tests for new functionality
- Cover edge cases
- Maintain existing coverage

### Documentation
- Keep accurate and up-to-date
- Include examples
- Explain "why" not just "what"
