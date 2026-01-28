---
name: debug-assistant
description: |
  Systematic debugging assistant that helps identify and fix bugs through
  structured analysis, hypothesis testing, and root cause identification.
  Use when facing errors, unexpected behavior, or mysterious bugs.
---

# Debug Assistant Skill

## Goal

Provide systematic debugging support through structured analysis, hypothesis generation, and methodical testing to identify and fix bugs efficiently.

## Activation Triggers

- User reports an error or bug
- User says "debug", "fix this error", "why isn't this working"
- Test failures need investigation
- Unexpected behavior reported

## Debugging Framework

### 1. Gather Information

```bash
# Get error context
echo "=== Recent Error Logs ==="
tail -50 *.log 2>/dev/null || echo "No log files"

# Check test output
echo "=== Test Failures ==="
npm test 2>&1 | tail -50 || echo "No test command"

# Check TypeScript errors
echo "=== Type Errors ==="
npm run typecheck 2>&1 | tail -30 || tsc --noEmit 2>&1 | tail -30 || echo "No typecheck"

# Check runtime errors
echo "=== Console Errors ==="
# User needs to provide these
```

### 2. Reproduce the Bug

**Questions to ask:**
1. What is the expected behavior?
2. What is the actual behavior?
3. What are the exact steps to reproduce?
4. When did this start happening?
5. What changed recently?

**Reproduction checklist:**
```bash
# Check recent changes
git log --oneline -10

# Check what files changed
git diff HEAD~5 --name-only

# Check if it reproduces in a fresh state
npm ci && npm run build && npm test
```

### 3. Form Hypotheses

Based on the error, generate possible causes:

| Symptom | Possible Causes |
|---------|-----------------|
| `TypeError: undefined` | Missing null check, async timing, wrong import |
| `Network error` | API down, wrong URL, CORS, auth expired |
| `Test timeout` | Infinite loop, missing async/await, slow DB |
| `Build failure` | Type mismatch, missing dependency, syntax error |
| `Runtime crash` | Memory leak, stack overflow, unhandled promise |

### 4. Investigate Systematically

#### For Each Hypothesis:

**A. Identify relevant code**
```bash
# Find files related to the error
grep -rn "errorKeyword" src/ --include="*.ts" | head -20

# Find function definitions
grep -rn "functionName" src/ --include="*.ts" | head -10
```

**B. Trace the execution path**
```bash
# Find callers of the function
grep -rn "functionName(" src/ --include="*.ts" | head -20

# Find imports
grep -rn "from.*module" src/ --include="*.ts" | head -10
```

**C. Check the data flow**
- What inputs does this code receive?
- What state does it depend on?
- What outputs does it produce?

**D. Add diagnostic logging (temporarily)**
```typescript
console.log('[DEBUG] Input:', JSON.stringify(input, null, 2));
console.log('[DEBUG] State:', JSON.stringify(state, null, 2));
console.log('[DEBUG] Output:', JSON.stringify(output, null, 2));
```

### 5. Isolate the Bug

**Binary Search Method:**
1. Find a known working state (git bisect or manual)
2. Find the breaking point
3. Narrow down to the specific change

```bash
# Git bisect for regression hunting
git bisect start
git bisect bad HEAD
git bisect good <known-good-commit>
# Then test at each step
```

**Minimal Reproduction:**
1. Remove unrelated code
2. Simplify inputs
3. Isolate the failing case

### 6. Fix the Bug

**Fix Categories:**

| Bug Type | Fix Pattern |
|----------|-------------|
| Null/undefined | Add null check, optional chaining |
| Type mismatch | Fix types, add type guards |
| Race condition | Add await, use mutex, fix ordering |
| Logic error | Fix conditional, fix algorithm |
| Missing error handling | Add try/catch, handle edge case |

**Fix Verification:**
```bash
# Run specific test
npm test -- --testPathPattern="related-test"

# Run all tests
npm test

# Check types
npm run typecheck

# Manual verification
# [describe steps to manually verify]
```

### 7. Prevent Regression

After fixing:
1. Add a test that would have caught this bug
2. Consider if similar bugs exist elsewhere
3. Update documentation if behavior was unclear
4. Add comments explaining the fix

## Debug Output Format

```
🔍 Debug Session: [Bug Description]

### 1. Symptoms
- Error: [Exact error message]
- Location: [File:line]
- Frequency: [Always/Sometimes/Rare]

### 2. Reproduction
```bash
[Steps to reproduce]
```

### 3. Hypotheses
| # | Hypothesis | Likelihood | Evidence |
|---|------------|------------|----------|
| 1 | [Cause] | High/Med/Low | [Why] |
| 2 | [Cause] | High/Med/Low | [Why] |

### 4. Investigation

**Testing Hypothesis 1:**
[Investigation steps and findings]

**Result:** [Confirmed/Ruled out]

### 5. Root Cause
[Detailed explanation of what's actually wrong]

### 6. Fix
```typescript
// Before
[problematic code]

// After
[fixed code]
```

### 7. Verification
- [x] Fix compiles
- [x] Existing tests pass
- [x] New test added for this case
- [x] Manual verification complete

### 8. Prevention
- [x] Added test: `[test name]`
- [x] Updated docs: `[doc location]`
```

## Common Bug Patterns

### JavaScript/TypeScript

**Async/Await Issues**
```typescript
// Bug: Not awaiting
const data = fetchData(); // Returns Promise, not data

// Fix:
const data = await fetchData();
```

**Closure Issues**
```typescript
// Bug: Closure captures loop variable
for (var i = 0; i < 10; i++) {
  setTimeout(() => console.log(i), 100); // Always logs 10
}

// Fix: Use let or capture value
for (let i = 0; i < 10; i++) {
  setTimeout(() => console.log(i), 100);
}
```

**This Binding**
```typescript
// Bug: Wrong 'this'
class Foo {
  handleClick() { console.log(this.value); }
}
button.onClick = foo.handleClick; // 'this' is undefined

// Fix: Bind or arrow function
button.onClick = foo.handleClick.bind(foo);
// or
handleClick = () => { console.log(this.value); }
```

### React Specific

**Stale Closure in useEffect**
```typescript
// Bug:
useEffect(() => {
  const interval = setInterval(() => {
    setCount(count + 1); // Always uses initial count
  }, 1000);
  return () => clearInterval(interval);
}, []); // Empty deps but uses count

// Fix:
useEffect(() => {
  const interval = setInterval(() => {
    setCount(c => c + 1); // Functional update
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

## Integration with Persistence Skill

When persistence skill is active:
1. Keep investigating until root cause found
2. Keep fixing until tests pass
3. Keep refining until fix is clean
4. Don't give up on mysterious bugs
