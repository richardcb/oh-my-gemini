---
name: code-review
description: |
  Perform thorough code review of implemented features. Compares implementation against
  the technical plan, checks for AI-specific risks (logic errors, resource inefficiency),
  and provides actionable feedback prioritized by business impact.
---

# Code Review Skill

## Goal

To guide an AI assistant, acting as a **Senior Software Engineer**, in performing a thorough code review of a newly implemented feature. The review must be comprehensive, objective, and provide actionable feedback that is understandable to both technical and non-technical stakeholders.

## Process

1. **Receive Context:** The user indicates a feature is ready for review and provides the technical plan that was used for implementation.
2. **Analyze Code & Plan:** Perform a deep analysis comparing the final implementation against the technical plan. Review any new or modified tests.
3. **Generate Review Document:** Using the structure below, generate a detailed code review.
4. **Save Review:** Save as a review document in the features directory.

## Review Structure

### 1. Plan Implementation Assessment
- **Correctness**: Was the technical plan implemented correctly and completely?
- **Deviations**: Were there any logical deviations from the plan? If so, were they justified and well-executed?

### 2. Code Quality & Best Practices
- **Bugs & Issues**: Are there obvious bugs, logic errors, or potential runtime issues?
- **Readability & Style**: Is the code clean, readable, and consistent with existing codebase conventions?
- **Local Idiom Compliance**: Does the code follow local conventions or use generic patterns inappropriately?
- **Naming Consistency**: Check for generic identifiers or mismatched terminology
- **Refactoring Opportunities**: Any over-engineering, code duplication, or files too large?

### 3. AI-Specific Risk Assessment

**Critical: AI-generated code has specific risk patterns. Check for these explicitly.**

- **Logic & Correctness**: Deep-dive into algorithms. AI is more likely to make business logic errors. Does the logic hold for project-specific invariants?
- **Resource Efficiency**: Check for "Naïve Resource Usage" - excessive I/O, unbatched database queries, repeated network calls
- **Control Flow Safety**: Ensure essential safeguards like null checks and short-circuit conditions are present. AI code often looks structurally correct but omits safety paths.

### 4. Cross-Cutting Concerns
- **Type Safety**: Is TypeScript used correctly? Any `any` types that should be specific?
- **Error Handling**: Are errors properly caught and displayed meaningfully?
- **Loading States**: Are loading states handled appropriately in UI?
- **Input Validation**: Is request data validated before use?

### 5. Testing Assessment
- **Test Existence**: Were new tests added for new functionality?
- **Test Coverage**: Do tests cover critical logic paths, including edge cases?
- **Test Quality**: Are tests well-written, clear, and non-brittle?

### 6. Security & Performance
- **Security**: Input validation, injection risks, XSS vulnerabilities, proper auth checks, data leakage in error messages
- **Performance**: N+1 queries, inefficient algorithms, unnecessary re-renders, bundle size

### 7. Final Assessment & Recommendations

#### Overall Quality
Rate using one of:
- **Excellent**: Production-ready, minor or no issues
- **Good with minor issues**: Ready with small fixes needed
- **Needs changes**: Significant issues to address
- **Needs major rework**: Fundamental issues requiring substantial changes

#### Business Impact Summary
Explain in plain language:
- What works well and can be relied upon
- What risks exist if issues aren't fixed
- What would happen if this shipped as-is

#### AI-Aware Verification Checklist
- [ ] **Negative Paths**: Are exception and error paths tested, or only the "happy path"?
- [ ] **Concurrency**: Are concurrency primitives used correctly?
- [ ] **Security Defaults**: Are sensitive items handled via approved patterns?
- [ ] **Data Drift**: Does the code use outdated patterns from older training data?

#### Actionable Feedback

**Critical (Must Fix):**
- Issues causing data loss, security vulnerabilities, or broken functionality

**High Priority (Should Fix):**
- Issues affecting user experience or maintainability significantly

**Medium Priority (Fix Soon):**
- Code quality improvements, minor bugs, technical debt

**Low Priority (Nice to Have):**
- Minor refactoring, style improvements, optimizations

For each item, explain:
1. What the issue is (plain language)
2. Why it matters (business/user impact)
3. How to fix it (specific, actionable guidance)

## Output Format

```markdown
# Code Review: [Feature Name]

## Summary
[2-3 sentence overview of the review findings]

## Plan Implementation: [✅ Complete / ⚠️ Partial / ❌ Incomplete]
[Assessment of whether plan was followed]

## Code Quality: [Rating]
[Key observations]

## AI-Specific Risks
[Findings from AI risk assessment]

## Testing: [Adequate / Needs Work / Missing]
[Test coverage assessment]

## Security & Performance
[Key findings]

---

## Overall Assessment: [Excellent / Good / Needs Changes / Major Rework]

### Business Impact
[Plain language explanation of what this means]

### Verification Checklist
- [x/] Negative paths tested
- [x/] Concurrency handled correctly
- [x/] Security defaults used
- [x/] No outdated patterns

---

## Action Items

### Critical
1. [Issue]: [Impact] → [Fix]

### High Priority
1. [Issue]: [Impact] → [Fix]

### Medium Priority
1. [Issue]: [Impact] → [Fix]

### Low Priority
1. [Issue]: [Impact] → [Fix]
```

## Target Audience

The review is written for:
- **Non-technical stakeholders**: Who need to understand what works and what doesn't
- **The implementing developer**: Who needs clear, actionable guidance
- **Future maintainers**: Who need to understand decisions and patterns

## Tone & Style

- **Be objective and constructive**: Point out issues clearly but without being harsh
- **Explain "why"**: Don't just say something is wrong, explain the impact
- **Use plain language**: Avoid unnecessary jargon; explain technical terms when needed
- **Be specific**: Give concrete examples and line numbers where relevant
- **Prioritize clearly**: Not all issues are equally important
