---
name: code-review
description: |
  Perform thorough code review of implemented features. Compares implementation against
  the technical plan, checks for AI-specific risks, and provides actionable feedback.
  v1.0: Auto-verification handled by hooks - focus on higher-level review.
---

# Code Review Skill

## Goal

Perform a thorough code review of newly implemented features, comparing against the technical plan, checking for AI-specific risks, and providing actionable feedback.

## Hook Integration

The `after-tool` hook now handles automatic verification (typecheck, lint) after every code change. This skill focuses on **higher-level review**:
- Architecture alignment
- AI-specific risk patterns
- Business logic correctness
- Code quality beyond what linters catch

## Process

### 1. Load Context

```bash
# Find the technical plan
find . -name "tasks_*.md" -o -name "plan.md" 2>/dev/null | head -3

# Find the PRD
find . -name "*prd*.md" 2>/dev/null | head -3

# Get list of changed files
git diff --name-only HEAD~10 2>/dev/null | head -30

# Get diff statistics
git diff --stat HEAD~10 2>/dev/null | tail -10
```

### 2. Analyze Code vs Plan

For each file changed:
- Was it in the plan?
- Does it match the planned approach?
- Are there deviations?

### 3. Perform Deep Review

Check each area systematically.

## Review Areas

### 1. Plan Implementation Assessment

**Questions:**
- Was the technical plan implemented correctly and completely?
- Were there deviations? If so, were they justified?
- Are all tasks marked complete actually complete?

### 2. Code Quality & Best Practices

**Note:** Basic linting is handled by the `after-tool` hook. Focus on:

- **Readability:** Is the code clean and understandable?
- **Naming:** Are names meaningful and consistent?
- **Complexity:** Is complexity appropriate for the problem?
- **Patterns:** Does code follow existing codebase patterns?

### 3. AI-Specific Risk Assessment

**CRITICAL: AI-generated code has specific risk patterns.**

#### Logic & Correctness
- Deep-dive into algorithms
- Check business logic against PRD invariants
- Verify edge cases are handled

```bash
# Look for common AI mistakes
grep -rn "TODO\|FIXME\|XXX" src/ | head -20
grep -rn "any" --include="*.ts" src/ | head -20
```

#### Resource Efficiency
Check for "Naïve Resource Usage":
- [ ] Excessive I/O operations
- [ ] Unbatched database queries
- [ ] Repeated network calls
- [ ] N+1 query patterns

```bash
# Find potential N+1 patterns
grep -rn "forEach.*await\|map.*await" src/ | head -10
```

#### Control Flow Safety
- [ ] Null checks present
- [ ] Short-circuit conditions exist
- [ ] Error boundaries defined

### 4. Cross-Cutting Concerns

**Type Safety:**
```bash
# Check for 'any' types
grep -rn ": any" --include="*.ts" src/ | head -10

# Check for type assertions
grep -rn "as any\|as unknown" --include="*.ts" src/ | head -10
```

**Error Handling:**
```bash
# Check for try-catch usage
grep -rn "try {" --include="*.ts" src/ | wc -l
grep -rn "catch" --include="*.ts" src/ | wc -l
```

**Note:** The `after-tool` hook reports TypeScript errors automatically. This review looks for patterns the type system doesn't catch.

### 5. Testing Assessment

```bash
# Find test files
find . -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | head -20

# Check test coverage
npm test -- --coverage 2>&1 | tail -30
```

**Questions:**
- Were tests added for new functionality?
- Do tests cover edge cases?
- Are tests reliable (not flaky)?

### 6. Security & Performance

**Security Checks:**
- [ ] Input validation on user data
- [ ] No SQL injection risks
- [ ] No XSS vulnerabilities
- [ ] Proper auth checks
- [ ] No secrets in code

```bash
# Check for potential secrets
grep -rn "password\|secret\|api_key\|apikey" --include="*.ts" src/ | head -10
```

**Performance Checks:**
- [ ] No N+1 queries
- [ ] Efficient algorithms
- [ ] No unnecessary re-renders
- [ ] Reasonable bundle size

## Output Format

```markdown
# Code Review: [Feature Name]

## Summary
[2-3 sentence overview of the review findings]

## Verification Status
The `after-tool` hook has been running automatic verification.
- TypeScript: [✅ Passing / ⚠️ Issues found]
- Lint: [✅ Passing / ⚠️ Issues found]

## Plan Implementation: [✅ Complete / ⚠️ Partial / ❌ Incomplete]

### Deviations from Plan
| Planned | Actual | Justified? |
|---------|--------|------------|
| [Item] | [What was done] | [Yes/No + reason] |

## Code Quality: [⭐⭐⭐⭐⭐ / ⭐⭐⭐⭐ / ⭐⭐⭐ / ⭐⭐ / ⭐]

### Strengths
- [Good thing 1]
- [Good thing 2]

### Areas for Improvement
- [Issue 1]
- [Issue 2]

## AI-Specific Risks

### Logic Correctness: [✅ / ⚠️ / ❌]
[Findings from logic review]

### Resource Efficiency: [✅ / ⚠️ / ❌]
[Findings from efficiency review]

### Control Flow Safety: [✅ / ⚠️ / ❌]
[Findings from safety review]

## Testing: [Adequate / Needs Work / Missing]

### Coverage
- Statements: [X%]
- Branches: [X%]

### Missing Tests
- [Area needing tests]

## Security & Performance

### Security: [✅ / ⚠️ / ❌]
[Findings]

### Performance: [✅ / ⚠️ / ❌]
[Findings]

---

## Overall Assessment: [Excellent / Good / Needs Changes / Major Rework]

### Business Impact
[Plain language: what works, what risks exist]

---

## Action Items

### 🔴 Critical (Must Fix Before Merge)
1. **[Issue]**
   - Impact: [What could go wrong]
   - Fix: [Specific guidance]
   - File: `path/to/file.ts:line`

### 🟠 High Priority (Should Fix)
1. **[Issue]**

### 🟡 Medium Priority (Fix Soon)
1. **[Issue]**

### 🟢 Low Priority (Nice to Have)
1. **[Issue]**

---

## Approval Status

- [ ] **Approved** - Ready to merge
- [ ] **Approved with Comments** - Can merge after addressing feedback
- [ ] **Request Changes** - Must address critical/high items first
```

## Verification Checkpoints

When the review is complete and requires developer confirmation, use `ask_user` (v0.30.0+) for interactive verification:
```
ask_user({ question: "Code review complete. Do you want to proceed with the recommended changes?", question_type: "yes_no" })
```

For detailed feedback that requires free-text response:
```
ask_user({ question: "Review found issues. Which items should be addressed before merge?", question_type: "free_text" })
```

If `ask_user` is not available (headless mode, older CLI), present the review summary and wait for user input.

## Guidelines

- **Focus on what hooks don't catch:** Logic errors, architecture issues, AI patterns
- **Be objective and constructive:** Point out issues clearly but helpfully
- **Explain "why":** Don't just say something is wrong, explain the impact
- **Prioritize clearly:** Not all issues are equally important
- **Trust the hooks:** Basic verification is automatic, focus on deeper review
