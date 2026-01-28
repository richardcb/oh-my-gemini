---
name: documentation
description: |
  Generate documentation for implemented features. The actual code is always the source 
  of truth - document what was built, not what was planned. Creates code comments, 
  README updates, and developer guides as appropriate.
---

# Documentation Skill

## Goal

Create comprehensive, practical documentation for newly implemented features. Help users understand what the feature does and help developers maintain and extend it.

## Core Principle

**The code is the source of truth.** Use PRD and plan for context only—document what was actually built, not what was planned.

## Process

### 1. Understand the Implementation

```bash
# Find changed files
git diff --name-only HEAD~10 2>/dev/null

# Get summary of changes
git log --oneline -10 2>/dev/null

# Find the feature's main files
find src -name "*.ts" -newer [plan_file] 2>/dev/null | head -20
```

### 2. Identify Documentation Needs

**Questions:**
- What does a user need to know to use this feature?
- What does a developer need to know to maintain/extend it?
- What patterns or conventions were established?
- Where does this fit in existing documentation?

### 3. Determine Documentation Locations

Based on feature scope:

#### Code Comments (Always Required)
Add inline documentation for:
- Complex algorithms or business logic
- Non-obvious implementation decisions
- Public APIs, functions, or classes
- Important type definitions

#### README Files (For Significant Changes)
Update if the feature:
- Changes how to run or deploy
- Adds new dependencies
- Changes architecture significantly
- Adds major user-facing capabilities

#### Developer Guides (For New Patterns)
Create if the feature:
- Introduces new patterns to reuse
- Implements a new system component
- Requires specific knowledge to maintain
- Establishes conventions for others

#### GEMINI.md (For AI Context)
Update if the feature:
- Introduces new commands
- Adds new directories
- Establishes new patterns
- Changes tech stack

## Documentation Standards

### Code Comments

Use JSDoc format for TypeScript/JavaScript:

```typescript
/**
 * Brief description of what this does.
 * 
 * More detailed explanation if needed, including why
 * certain decisions were made.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} Description of when/why this throws
 * 
 * @example
 * ```ts
 * const result = myFunction('input');
 * // result: { success: true }
 * ```
 */
export function myFunction(paramName: string): Result {
  // Implementation
}
```

### README Updates

Structure for feature additions:

```markdown
## [Feature Name]

Brief description of what this feature does.

### Usage

```bash
# Command or code example
```

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `option` | `string` | `"default"` | What it does |

### Examples

[Practical examples of usage]
```

### Developer Guides

Structure for new guides:

```markdown
# [Feature Name] - Developer Guide

## Overview
Brief explanation of what this is and why it exists.

## Architecture
How it's structured, key components.

```
[Diagram or component list]
```

## How It Works
Step-by-step explanation of the flow.

1. [Step 1]
2. [Step 2]

## Usage Examples

### Basic Usage
```typescript
[code example]
```

### Advanced Usage
```typescript
[code example]
```

## Extending the System
How to add new capabilities, customize behavior.

### Adding a New [Thing]
1. [Step 1]
2. [Step 2]

## Common Patterns
Reusable patterns established by this feature.

## Troubleshooting

### Issue: [Problem]
**Cause:** [Why it happens]
**Solution:** [How to fix]

## API Reference
[If applicable, detailed API docs]
```

## Output Format

```markdown
## Documentation Complete: [Feature Name]

### Files Updated

#### Code Comments Added
- `src/utils/auth.ts` - Added JSDoc to all exported functions
- `src/components/Login.tsx` - Documented props interface

#### Documentation Files
- `README.md` - Added Authentication section
- `docs/guides/auth.md` - Created new developer guide
- `GEMINI.md` - Updated with new patterns

### Documentation Summary

#### For Users
[Summary of what users need to know]

#### For Developers  
[Summary of what developers need to know]

### Verification
```bash
# Check all public exports have JSDoc
grep -rn "export function\|export const\|export class" src/ | wc -l
grep -rn "@param\|@returns" src/ | wc -l
```

### Follow-up Items
- [ ] [Any documentation that needs more detail]
```

## Quality Checklist

Before marking documentation complete:

- [ ] Code comments added for complex/non-obvious logic
- [ ] JSDoc added for all public functions, types, and classes
- [ ] Appropriate external documentation created or updated
- [ ] All links work and use relative paths
- [ ] Examples are accurate and tested
- [ ] Documentation matches actual implementation
- [ ] Project documentation style is matched
- [ ] No redundant documentation created

## What NOT to Document

- Tests (unless user specifically requests)
- Temporary or experimental code
- Implementation details obvious from reading code
- Internal refactoring that doesn't change behavior
- Build artifacts or generated code

## Integration with Other Skills

After documentation:
- Suggest running `git-commit` skill to commit docs
- Suggest code-review if docs reveal issues
- Update GEMINI.md if significant patterns added
