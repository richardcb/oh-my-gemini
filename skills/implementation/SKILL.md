---
name: implementation
description: |
  Execute a technical plan task by task, following the phased structure and verification gates.
  Updates task status as work progresses. Works with Conductor's plan.md format.
  Use when a technical plan exists and it's time to write code.
---

# Implementation Skill

## Goal

To guide an AI assistant in executing a technical plan systematically, following the established phases, completing tasks in order, and maintaining accurate status tracking.

## Process

1. **Receive Plan Reference:** The user indicates which plan to implement.
2. **Load Context:** Read the plan file, associated spec/PRD, and project context (GEMINI.md, tech-stack.md).
3. **Identify Current State:** Check which tasks are already complete (marked `[x]`).
4. **Execute Sequentially:** Work through tasks in order within each phase.
5. **Update Status:** Mark tasks complete as you finish them.
6. **Pause at Verification Gates:** Stop at each "Conductor - User Manual Verification" task for user confirmation.

## Execution Rules

### Phase Order is Mandatory
- Complete Phase 1 (Data Layer) before Phase 2 (Backend)
- Complete Phase 2 (Backend) before Phase 3 (Frontend)
- Never skip ahead

### Task Order Within Phases
- Execute tasks in numerical order
- Complete all sub-tasks before marking parent task complete
- Don't start a new parent task until the previous one is done

### Verification Gates
When you reach a verification task:
1. **Stop execution**
2. **Summarize** what was accomplished in the phase
3. **Verify** against the spec/PRD requirements
4. **Report** any issues or deviations
5. **Ask** if the user wants to commit changes
6. **Wait** for user confirmation before proceeding to next phase

## Implementation Standards

### Before Writing Code
1. Read the relevant existing files
2. Check GEMINI.md for project conventions
3. Look at similar existing code for patterns
4. Understand the data flow

### While Writing Code
```
✓ Follow existing code style
✓ Use established patterns from codebase
✓ Include appropriate error handling
✓ Add meaningful variable/function names
✓ Include comments for complex logic
✓ Handle null/undefined cases
✓ Validate inputs at boundaries
```

### After Each Task
1. Verify the task acceptance criteria are met
2. Run relevant tests if they exist
3. Check for linting/type errors
4. Update the task status to `[x]` in plan.md

## Output Format

### After completing each task:
```markdown
## ✅ Completed: [Task Number] [Task Name]

### Changes Made
- `path/to/file.ts`: [What was done]
- `path/to/new-file.ts`: Created - [purpose]

### Acceptance Criteria
- [x] [Criterion from plan]
- [x] [Criterion from plan]

### Next Task
[Task number and name]
```

### At verification gates:
```markdown
## 🔍 Phase [N] Verification: [Phase Name]

### Summary
[What was accomplished in this phase]

### Files Changed
- [List all files modified/created in this phase]

### Verification Against Spec
- [x] [Requirement from spec]: [How it was met]
- [x] [Requirement from spec]: [How it was met]

### Tests
- [Test status - passed/added/skipped with reason]

### Issues or Deviations
- [Any problems encountered or deviations from plan]

### Ready for Next Phase?
Awaiting your confirmation to proceed to Phase [N+1].

**Would you like to commit these changes before continuing?**
```

### After completing all phases:
```markdown
## 🎉 Implementation Complete: [Feature Name]

### Summary
[Overall summary of what was built]

### All Phases Completed
- [x] Phase 1: Data Layer & Types
- [x] Phase 2: Backend API
- [x] Phase 3: Frontend Implementation
- [x] Phase 4: Review & Finalize

### Files Changed (Total)
- [Complete list]

### Next Steps
- [ ] Final review
- [ ] Documentation (use documentation skill)
- [ ] Merge/deploy
```

## Error Handling

### If a task fails:
1. Document what went wrong
2. Identify the root cause
3. Propose a fix
4. Ask user whether to:
   - Attempt the fix
   - Skip and note for later
   - Abort implementation

### If blocked by missing information:
1. Document what's needed
2. Check if it's in the spec/PRD
3. If not, ask the user
4. Don't proceed with assumptions on critical decisions

## Guidelines

- **One task at a time**: Focus, complete, verify, move on
- **Match the codebase**: New code should look like it belongs
- **Follow the plan**: Don't improvise unless you hit a blocker
- **Flag blockers early**: If you can't proceed, say why
- **Keep status updated**: The plan should always reflect reality
- **Respect verification gates**: These are checkpoints, not suggestions
