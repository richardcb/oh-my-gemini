---
name: quick-fix
description: |
  Apply a minimal, targeted fix to a specific bug or issue. Focused on speed and precision -
  locate the problem, make the smallest correct change, and verify. Not a planning workflow;
  use for small fixes, patches, and hotfixes.
---

# Quick Fix Skill

## Goal

Fix a specific bug or issue with the smallest correct change. This skill prioritizes speed and precision over comprehensive refactoring.

## Activation Triggers

- User says "quick fix", "small fix", "patch", "hotfix", or "just fix this"
- User reports a specific, isolated bug
- User wants a targeted change without broader planning
- Error messages or failing tests that need a direct fix

## When NOT to Use

This skill is explicitly **not** a planning workflow. If the fix requires:
- Changing more than 3 files
- Architectural decisions
- New features or capabilities
- Extensive refactoring

Then use the `technical-planning` or `refactor` skill instead.

## Process

### 1. Understand the Bug

Get a clear description of the problem:

**Questions to ask (if not already clear):**
- What is the expected behavior?
- What is the actual behavior?
- Can you share the error message or reproduction steps?

```bash
# Check for recent errors
git log --oneline -5 2>/dev/null

# Check test failures if applicable
npm test 2>&1 | tail -20 || echo "No test command"
```

### 2. Locate the Code

Find the relevant file(s) quickly:

```bash
# Search for error-related code
grep -rn "errorKeyword" src/ --include="*.ts" --include="*.js" | head -15

# Find the function or component
grep -rn "functionName" src/ --include="*.ts" --include="*.js" | head -10
```

Read the file and understand the immediate context around the bug.

### 3. Apply Minimal Fix

Make the smallest correct change:

**Fix principles:**
- Change only what is necessary to fix the bug
- Do not refactor surrounding code
- Do not add features
- Do not change formatting of untouched code
- Preserve existing patterns and conventions

**Common fix patterns:**

| Bug Type | Fix Pattern |
|----------|-------------|
| Null/undefined | Add null check or optional chaining |
| Type mismatch | Fix type or add type guard |
| Off-by-one | Correct boundary condition |
| Missing await | Add `await` keyword |
| Wrong condition | Fix boolean logic |
| Missing import | Add the import statement |
| Stale state | Fix dependency array or use functional update |

### 4. Verify the Fix

```bash
# Run relevant tests
npm test -- --testPathPattern="[related-test]" 2>&1 | tail -20

# Check types
npm run typecheck 2>&1 | tail -15 || tsc --noEmit 2>&1 | tail -15

# Run lint
npm run lint 2>&1 | tail -15
```

If the project has no tests for the affected code, verify manually and note
that tests should be added separately.

## Output Format

```
## Quick Fix: [Brief Description]

### Problem
[What was wrong - one or two sentences]

### Root Cause
[Why it was wrong - one sentence]

### Fix Applied
- `path/to/file.ts:line` - [What was changed]

### Verification
- [x] Fix compiles without errors
- [x] Relevant tests pass
- [ ] No tests exist for this code (consider using test-generation skill)

### Commit Suggestion
fix(scope): [brief description of what was fixed]
```

## Guidelines

- **Speed over perfection**: Get the fix in, don't gold-plate
- **Smallest change wins**: Less code changed means less risk
- **Verify before declaring done**: Always run tests/typecheck
- **One fix per session**: Don't scope-creep into other issues
- **Note follow-ups**: If you spot other issues, mention them but don't fix them
