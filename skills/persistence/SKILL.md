---
name: persistence
description: |
  Continue working on a task until completion with automatic retry, self-verification,
  and alternative approaches. Activates "ralph mode" - never give up until the goal
  is achieved or explicitly impossible. Use when tasks require tenacity and iteration.
---

# Persistence Skill

## Goal

Enable Claude/Gemini to work persistently on a task until it's truly complete, with automatic verification, retry logic, and alternative approaches when blocked.

## Activation Triggers

This skill should be activated when:
- User includes "ralph", "persistent", or "don't give up" in their request
- A task has failed and needs retry with a different approach
- Complex multi-step work requires sustained focus

## Core Behavior

### Never Give Up Philosophy

When this skill is active, you must:
1. **Set a clear, measurable goal** from the user's request
2. **Work iteratively** toward that goal
3. **Verify progress** after each significant action
4. **Try alternatives** when an approach fails
5. **Only stop** when: goal achieved, user interrupts, or truly impossible

### Retry Protocol

On failure:
1. **Analyze the failure** - What specifically went wrong?
2. **Identify alternatives** - What other approaches exist?
3. **Try the next approach** - Don't repeat the same mistake
4. **Track attempts** - After 5 consecutive failures on the same sub-problem, escalate

### Verification Protocol

After each significant action, verify:

**For code changes:**
```bash
# Check syntax/compilation
npm run typecheck 2>&1 | tail -20 || tsc --noEmit 2>&1 | tail -20

# Check tests
npm test 2>&1 | tail -30

# Check lint
npm run lint 2>&1 | tail -20
```

**For file creation:**
```bash
# Verify file exists and has content
ls -la [filepath] && wc -l [filepath]

# Check file can be parsed (for JSON, etc.)
cat [filepath] | head -20
```

**For features:**
```bash
# If there's a dev server, check it's running
curl -s http://localhost:3000/health 2>/dev/null || echo "Server not running"

# Check for runtime errors in logs
tail -20 *.log 2>/dev/null || echo "No logs"
```

## State Tracking

Maintain mental state during persistence:

```
## Persistence State

### Goal
[Clear statement of what success looks like]

### Progress
- [x] Step 1: [Description] ✓
- [x] Step 2: [Description] ✓
- [ ] Step 3: [Current step]
- [ ] Step 4: [Remaining]

### Attempts on Current Step
1. [Approach 1] - Failed: [reason]
2. [Approach 2] - In progress...

### Blockers
- [Any identified blockers]

### Alternative Approaches Available
1. [Alternative 1]
2. [Alternative 2]
```

## Recovery Strategies

### When Code Doesn't Compile
1. Read the exact error message
2. Find the referenced file and line
3. Understand what the error means
4. Fix the specific issue
5. Re-run compilation
6. If still failing, try a simpler implementation

### When Tests Fail
1. Read which test failed and why
2. Check if it's the code or the test that's wrong
3. If code: fix the code
4. If test: update the test expectation
5. Re-run just that test first
6. Then run full suite

### When Approach Is Wrong
1. Acknowledge the approach isn't working
2. Step back and reconsider the problem
3. Look for existing patterns in the codebase:
   ```bash
   grep -r "similar_pattern" src/ | head -10
   ```
4. Try a fundamentally different approach
5. If stuck, ask user for guidance on approach preference

### When External Dependencies Fail
1. Check network connectivity
2. Verify API keys/credentials
3. Try alternative endpoints
4. Consider mocking for development
5. Document the external dependency issue

## Output Format

### During Persistence

```
🔄 Persistence Active: [Goal]

### Attempt [N]
**Approach:** [What I'm trying]
**Action:** [Specific action taken]
**Result:** [Success/Failure]
**Verification:** [What I checked]

[If failed]
**Analysis:** [Why it failed]
**Next:** [What I'll try next]
```

### On Success

```
✅ Goal Achieved: [Goal]

### Summary
[Brief description of what was accomplished]

### Attempts Required
- Total attempts: [N]
- Successful approach: [Description]

### Verification
- [x] [Verification 1]
- [x] [Verification 2]

### Files Changed
- `path/to/file`: [Change description]
```

### On True Failure

```
❌ Goal Not Achievable: [Goal]

### Summary
[Why this cannot be completed]

### Attempts Made
1. [Approach 1]: [Why it failed]
2. [Approach 2]: [Why it failed]
...

### Blockers (Unresolvable)
- [Blocker 1]: [Why it can't be resolved]

### Recommendations
- [What the user could do differently]
- [Alternative goals that might be achievable]
```

## Escalation Criteria

Escalate to user (don't keep trying) when:
- 5+ consecutive failures on the same sub-problem
- Requires credentials/access you don't have
- Requires decisions outside your authority
- Circular dependency detected (same error recurring)
- User explicitly says to stop

## Integration with Other Skills

This skill enhances other skills:
- **implementation**: Adds retry logic to task execution
- **debug-assistant**: Adds persistence to debugging sessions
- **test-generation**: Keeps trying until tests pass

## Example Session

```
User: "ralph: fix all the TypeScript errors in this project"

Agent: 🔄 Persistence Active: Fix all TypeScript errors

### Attempt 1
**Action:** Running typecheck to identify errors
```bash
npm run typecheck 2>&1
```
**Result:** Found 12 errors in 5 files

### Working on Error 1/12
**File:** src/utils/helpers.ts:45
**Error:** Property 'name' does not exist on type 'User'
**Fix:** Adding 'name' to User interface
**Verification:** Re-running typecheck...
**Result:** Error resolved. 11 remaining.

[... continues until all 12 errors fixed ...]

✅ Goal Achieved: Fix all TypeScript errors

### Summary
Fixed 12 TypeScript errors across 5 files

### Attempts Required
- Total attempts: 15 (3 errors required multiple approaches)
- All errors now resolved

### Verification
- [x] `npm run typecheck` exits with 0
- [x] `npm run build` succeeds
- [x] `npm test` still passes
```
