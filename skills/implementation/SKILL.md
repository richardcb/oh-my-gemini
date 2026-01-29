---
name: implementation
description: |
  Execute a technical plan task by task, following the phased structure.
  v2.0: Hooks now handle verification automatically - no manual reminders needed.
  Use when a technical plan exists and it's time to write code.
---

# Implementation Skill

## Goal

Execute a technical plan systematically, following established phases, completing tasks in order.

## v2.0 Changes

**Hooks now handle verification automatically:**
- `AfterTool` hook runs typecheck/lint after code changes
- `phase-gate` hook detects phase completion
- `ralph-retry` hook handles persistence mode

You no longer need to manually remember verification steps.

## Process

### 1. Load Plan & Context

```bash
# Find the plan file
find . -name "tasks_*.md" -o -name "plan.md" 2>/dev/null | head -5

# Load project context
cat GEMINI.md 2>/dev/null | head -50
cat conductor/tech-stack.md 2>/dev/null | head -30
```

### 2. Identify Current State

Parse the plan to find:
- Which tasks are already complete `[x]`
- Which task is next `[ ]`
- Which phase we're in

### 3. Execute Sequentially

Work through tasks in order within each phase.

## Execution Rules

### Phase Order is Mandatory
1. Complete Phase 1 (Data Layer) before Phase 2
2. Complete Phase 2 (Backend) before Phase 3
3. Complete Phase 3 (Frontend) before Phase 4
4. **Never skip ahead**

### Task Order Within Phases
- Execute tasks in numerical order (1.0, 1.1, 1.2...)
- Complete all sub-tasks before marking parent complete
- Don't start new parent task until previous is done

### Automatic Verification (via Hooks)

After you modify code files, the `AfterTool` hook automatically:
1. Runs typecheck (if TypeScript)
2. Runs lint (if configured)
3. Injects any errors into context

If errors appear, fix them before proceeding to the next task.

### Phase Gates (via Hooks)

When you complete a phase, the `phase-gate` hook:
- **Advisory mode (default):** Shows a message suggesting verification
- **Strict mode:** Requires explicit user confirmation

The hook detects phase completion from your response and handles the gate automatically.

## Implementation Standards

### Before Writing Code

```bash
# Read existing patterns
cat src/[similar-file].ts | head -100

# Check for existing utilities
grep -r "export function" src/utils/ | head -20
```

### While Writing Code

**DO:**
- Follow existing code style
- Use established patterns from codebase
- Include appropriate error handling
- Add meaningful variable/function names

**DON'T:**
- Introduce new patterns without reason
- Skip error handling
- Leave TODO comments without tracking

### After Each Task

1. The hook verifies automatically
2. If errors, fix them (errors appear in context)
3. Update task status to `[x]` in plan
4. Move to next task

## Output Formats

### After Completing Each Task

```markdown
## ✅ Completed: [Task Number] [Task Name]

### Changes Made
- `path/to/file.ts`: [What was done]
- `path/to/new-file.ts`: Created - [purpose]

### Next Task
[Task number and name]
```

### At Phase Boundaries

The `phase-gate` hook will prompt for verification. Respond with:

```markdown
## 🔍 Phase [N] Complete: [Phase Name]

### Summary
[What was accomplished in this phase]

### Files Changed
[List of files]

### Ready to proceed to Phase [N+1]?
```

### After Completing All Phases

```markdown
## 🎉 Implementation Complete: [Feature Name]

### Summary
[Overall summary of what was built]

### All Phases Completed
- [x] Phase 1: Data Layer & Types
- [x] Phase 2: Backend API
- [x] Phase 3: Frontend Implementation
- [x] Phase 4: Review & Finalize

### Next Steps
- Code review (optional)
- Documentation updates (if needed)
```

## Error Handling

### If a Task Fails

The `AfterTool` hook injects errors into context. When you see them:
1. Read the error messages
2. Identify the file and line
3. Fix the specific issue
4. Your next edit will be verified again

### If Blocked by Missing Information

1. Document what's needed
2. Check if it's in the spec/PRD
3. If not, ask the user
4. Don't proceed with assumptions on critical decisions

### Persistence Mode

If the user activates Ralph mode (includes "ralph" or "persistent" in prompt):
- The `ralph-retry` hook activates
- On failure, it suggests alternative approaches
- Keeps retrying up to configured max

## Guidelines

- **One task at a time**: Focus, complete, move on
- **Trust the hooks**: Verification happens automatically
- **Match the codebase**: New code should look like it belongs
- **Follow the plan**: Don't improvise unless blocked
- **Update status**: Keep plan.md reflecting reality