---
name: refactor
description: |
  Safely restructure code while preserving behavior. Follows a strict safety protocol:
  verify clean git state, ensure tests pass before and after, verify types throughout.
  Use when code needs reorganization, cleanup, or structural improvement.
---

# Refactor Skill

## Goal

Restructure existing code to improve quality, readability, or maintainability without changing external behavior. Every refactor must be provably safe through tests and type checks.

## Activation Triggers

- User says "refactor", "restructure", "clean up", "reorganize", or "simplify"
- Code review identified structural issues
- Technical debt needs to be addressed
- Code duplication needs to be consolidated

## Safety Checklist (Pre-Flight)

Before making any changes, verify all of these:

### 1. Git State is Clean

```bash
# Ensure no uncommitted changes
git status --short 2>/dev/null
```

If there are uncommitted changes, ask the user to commit or stash them first.
Refactoring on a dirty working tree makes rollback difficult.

### 2. Tests Exist and Pass

```bash
# Run full test suite
npm test 2>&1 | tail -30

# Check exit code
echo "Exit code: $?"
```

**If no tests exist:** Stop and suggest using the `test-generation` skill first.
Refactoring without tests is risky - you cannot verify behavior is preserved.

### 3. Types Check Clean

```bash
# Verify no type errors
npm run typecheck 2>&1 | tail -20 || tsc --noEmit 2>&1 | tail -20
```

## Process

### 1. Define Scope

Clearly identify what is being refactored and why:

**Questions to answer:**
- What specific code needs restructuring?
- Why does it need to change? (readability, performance, maintainability)
- What is explicitly NOT being changed?
- What is the expected outcome?

```bash
# Understand the code to refactor
cat [target-file] | head -100

# Find all usages/callers
grep -rn "functionOrClassName" src/ --include="*.ts" --include="*.js" | head -20

# Check test coverage for this code
find . -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | xargs grep -l "functionOrClassName" 2>/dev/null
```

### 2. Verify Tests Pass (Before)

```bash
# Run tests - record baseline
npm test 2>&1 | tail -30

# Run typecheck - record baseline
npm run typecheck 2>&1 | tail -20 || tsc --noEmit 2>&1 | tail -20
```

**Record the results.** These are your "before" baseline. After refactoring,
the same tests must pass with the same results.

### 3. Refactor

Apply the structural changes. Common refactoring patterns:

| Pattern | When to Use |
|---------|-------------|
| Extract function | Long function with identifiable sub-operations |
| Inline function | Single-use wrapper that adds no clarity |
| Rename | Name doesn't reflect purpose |
| Move to module | Code belongs in a different file/module |
| Replace conditional with polymorphism | Complex switch/if chains on type |
| Consolidate duplicates | Same logic in multiple places |
| Simplify conditionals | Nested or complex boolean expressions |
| Extract type/interface | Inline types used in multiple places |

**Rules during refactoring:**
- Make one logical change at a time
- Run tests after each change (hooks do this automatically)
- If a change breaks tests, revert and try a different approach
- Do not change behavior - only structure
- Do not add features during a refactor

### 4. Verify Tests Pass (After)

```bash
# Run the same tests
npm test 2>&1 | tail -30

# Verify types
npm run typecheck 2>&1 | tail -20 || tsc --noEmit 2>&1 | tail -20

# Run lint
npm run lint 2>&1 | tail -15
```

**Compare with the "before" baseline:**
- Same tests pass
- No new type errors
- No new lint warnings

### 5. Verify No Behavior Change

```bash
# Check what changed
git diff --stat

# Review the actual changes
git diff
```

Verify that:
- No public API signatures changed (unless that was the goal)
- No exported types changed shape
- No test expectations needed updating (behavior change signal)

## Output Format

```
## Refactor Complete: [Description]

### Scope
[What was refactored and why]

### Changes Made
- `path/to/file.ts` - [What structural change was made]

### Safety Verification
- [x] Git was clean before starting
- [x] Tests passed before refactor
- [x] Tests pass after refactor
- [x] Types check clean
- [x] Lint passes
- [x] No behavior changes detected

### Before/After Comparison
**Before:** [Brief description of old structure]
**After:** [Brief description of new structure]

### Commit Suggestion
refactor(scope): [brief description of structural change]
```

## If Tests Don't Exist

If the target code has no test coverage:

1. **Stop the refactor**
2. **Suggest the `test-generation` skill** to create tests first
3. **Explain why:** Refactoring without tests means you cannot verify behavior is preserved
4. Only proceed if the user explicitly accepts the risk

## Plan Mode Compatibility

For large refactors that span multiple files, consider using plan mode (`/omg:plan`)
to decompose the work into safe, incremental steps before starting.

## Guidelines

- **Tests are non-negotiable**: No tests = no safe refactor
- **One thing at a time**: Don't combine refactoring with feature work
- **Preserve behavior**: If tests need updating, you're changing behavior
- **Small steps**: Prefer many small, verifiable changes over one large change
- **Revert freely**: If something breaks, revert and try differently
