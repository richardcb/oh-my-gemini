---
name: implementation
description: |
  Execute a technical plan task by task, following the phased structure and verification gates.
  Updates task status as work progresses. Works with Conductor's plan.md format.
  Use when a technical plan exists and it's time to write code.
---

# Implementation Skill

## Goal

Execute a technical plan systematically, following established phases, completing tasks in order, and maintaining accurate status tracking.

## Process

### 1. Load Plan & Context

```bash
# Find the plan file
find . -name "tasks_*.md" -o -name "plan.md" 2>/dev/null | head -5

# Load project context
cat GEMINI.md 2>/dev/null | head -50
cat conductor/tech-stack.md 2>/dev/null | head -30

# Check git status
git status --short 2>/dev/null | head -10
```

### 2. Identify Current State

Parse the plan to find:
- Which tasks are already complete `[x]`
- Which task is next `[ ]`
- Which phase we're in

```bash
# Count completed vs remaining
grep -c "\[x\]" [plan_file] && grep -c "\[ \]" [plan_file]
```

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

### Verification Gates
When you reach a "Conductor - User Manual Verification" task:

1. **STOP execution**
2. **Summarize** what was accomplished
3. **Verify** against the spec/PRD requirements
4. **Report** any issues or deviations
5. **Ask** if user wants to commit changes
6. **Wait** for confirmation before next phase

## Implementation Standards

### Before Writing Code

```bash
# Read existing patterns
cat src/[similar-file].ts | head -100

# Check for existing utilities
grep -r "export function" src/utils/ | head -20

# Understand the data flow
grep -r "import.*from" src/[target-area]/ | head -20
```

### While Writing Code

**DO:**
- [x] Follow existing code style
- [x] Use established patterns from codebase
- [x] Include appropriate error handling
- [x] Add meaningful variable/function names
- [x] Include comments for complex logic
- [x] Handle null/undefined cases
- [x] Validate inputs at boundaries

**DON'T:**
- [ ] Introduce new patterns without reason
- [ ] Skip error handling
- [ ] Leave TODO comments without tracking
- [ ] Ignore TypeScript errors

### After Each Task

1. Verify acceptance criteria are met
2. Run relevant tests:
   ```bash
   npm test -- --testPathPattern="[relevant]" 2>&1 | tail -20
   ```
3. Check for linting/type errors:
   ```bash
   npm run typecheck 2>&1 | tail -10
   npm run lint 2>&1 | tail -10
   ```
4. Update task status to `[x]` in plan

## Output Formats

### After Completing Each Task

```markdown
## ✅ Completed: [Task Number] [Task Name]

### Changes Made
- `path/to/file.ts`: [What was done]
- `path/to/new-file.ts`: Created - [purpose]

### Acceptance Criteria
- [x] [Criterion from plan]
- [x] [Criterion from plan]

### Verification
```bash
[Command run and result]
```

### Next Task
[Task number and name]
```

### At Verification Gates

```markdown
## 🔍 Phase [N] Verification: [Phase Name]

### Summary
[What was accomplished in this phase]

### Files Changed
```bash
git diff --name-only HEAD~[N] 2>/dev/null
```
[List of files]

### Verification Against Spec
- [x] [Requirement from spec]: [How it was met]
- [x] [Requirement from spec]: [How it was met]

### Tests
```bash
npm test 2>&1 | tail -20
```
[Test results summary]

### Issues or Deviations
- [Any problems encountered or deviations from plan]
- [Or "None - implementation matches plan"]

### Commit Recommendation
```bash
git add -A
git commit -m "feat([scope]): complete Phase [N] - [description]"
```

---

**Ready for Next Phase?**
Awaiting your confirmation to proceed to Phase [N+1].

Would you like to:
1. [C]ommit and continue
2. [R]eview changes first
3. [F]ix an issue
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

### Files Changed (Total)
[Complete list]

### Test Coverage
```bash
npm test -- --coverage 2>&1 | tail -20
```

### Next Steps
- [ ] Code review (run `/omg:review`)
- [ ] Documentation (run `/omg:docs`)
- [ ] Deploy/merge
```

## Error Handling

### If a Task Fails

1. Document what went wrong
2. Identify root cause:
   ```bash
   # Type errors
   npm run typecheck 2>&1 | grep "error TS"
   
   # Runtime errors
   npm test 2>&1 | grep -A5 "FAIL\|Error"
   ```
3. Propose a fix
4. Ask user: attempt fix, skip, or abort?

### If Blocked by Missing Information

1. Document what's needed
2. Check if it's in the spec/PRD
3. If not, ask the user
4. Don't proceed with assumptions on critical decisions

### If Tests Keep Failing

1. Check if test is correct
2. Check if implementation matches spec
3. If implementation is wrong, fix it
4. If test is wrong, update test with justification
5. Re-run and verify

## Integration with Persistence Skill

When persistence skill is active:
- Don't give up on failed tasks
- Try alternative approaches
- Keep iterating until task passes
- Track attempt count
- Escalate after 5 consecutive failures

## Guidelines

- **One task at a time**: Focus, complete, verify, move on
- **Match the codebase**: New code should look like it belongs
- **Follow the plan**: Don't improvise unless blocked
- **Flag blockers early**: If you can't proceed, say why
- **Keep status updated**: Plan should always reflect reality
- **Respect verification gates**: These are checkpoints, not suggestions
