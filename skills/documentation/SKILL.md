---
name: documentation
description: |
  Generate documentation for implemented features. The actual code is always the source 
  of truth - document what was built, not what was planned. Creates code comments, 
  README updates, and developer guides as appropriate.
---

# Documentation Skill

## Goal

To guide an AI assistant in creating comprehensive, practical documentation for a newly implemented feature. The documentation should help users understand what the feature does, help developers maintain and extend it, and fit seamlessly into existing documentation structure.

## Core Principle

**The code is the source of truth.** Use PRD, tasks, and review documents only for context—document what was actually built, not what was planned.

## Process

1. **Receive Context:** The user indicates a feature is ready for documentation and provides:
   - The PRD file
   - The tasks/plan file
   - Optionally, the review file

2. **Understand the Implementation:**
   - Read the actual implementation code
   - Understand what was built, how it works, and how it integrates
   - Identify any deviations from the original plan

3. **Identify Documentation Needs:**
   - What does a user need to know to use this feature?
   - What does a developer need to know to maintain/extend it?
   - What patterns or conventions were established?
   - Where does this fit in existing documentation?

4. **Write Documentation:** Create or update documentation in appropriate locations

5. **Confirm Completion:** Summarize what was documented and where

## Where to Document

Determine the appropriate location(s) based on feature scope:

### 1. Code Comments (Always Required)

Add inline documentation directly in the code:

**When:**
- Complex algorithms or business logic
- Non-obvious implementation decisions
- Public APIs, functions, or classes
- Important type definitions

**Format:**
```typescript
/**
 * Brief description of what this does.
 * 
 * More detailed explanation if needed, including why
 * certain decisions were made.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws Description of when/why this throws
 * 
 * @example
 * ```ts
 * const result = myFunction('input');
 * ```
 */
```

### 2. README Files (For Significant Changes)

Update if the feature:
- Changes how to run or deploy the application
- Adds new dependencies or prerequisites
- Changes tech stack or architecture significantly
- Adds major user-facing capabilities

### 3. Developer Guides (For New Patterns or Systems)

Create a new guide if the feature:
- Introduces a new pattern that will be reused
- Implements a new system or architecture component
- Requires specific knowledge to maintain or extend
- Establishes conventions others should follow

**Guide Structure:**
```markdown
# [Feature Name] - Developer Guide

## Overview
Brief explanation of what this is and why it exists

## Architecture
How it's structured, key components

## How It Works
Step-by-step explanation of the flow

## Usage Examples
Code examples showing how to use it

## Extending the System
How to add new capabilities, customize behavior

## Common Patterns
Reusable patterns established by this feature

## Troubleshooting
Common issues and solutions
```

### 4. Architecture Documentation (For System-Level Changes)

Update architecture docs if the feature:
- Changes overall system architecture
- Adds new infrastructure components
- Modifies how major systems interact

### 5. AI Agent Context (GEMINI.md)

Update GEMINI.md if the feature:
- Introduces new commands developers/agents should use
- Adds new directories to project structure
- Establishes new coding patterns or conventions
- Changes tech stack or dependencies

## Documentation Rules

### 1. Match Project Style
- Review existing documentation before writing
- Use same tone, format, and level of detail
- Follow same heading structure and markdown conventions

### 2. Be Practical and Concise
- Focus on what developers/users need to know
- Include examples for complex concepts
- Link to relevant code files
- Don't document obvious things

### 3. Avoid Redundancy
- Don't duplicate information across files
- Link to other documentation rather than repeating
- The code itself is documentation—comment only what isn't obvious

### 4. Document What Exists
- Document the actual implementation, not the plan
- If implementation differs from PRD, document what was built
- Include any deviations or design decisions made

### 5. Keep Documentation Close to Code
- Prefer inline code comments for implementation details
- Use external docs for concepts, patterns, architecture
- Don't create separate doc files for implementation-only details

## What NOT to Document

- Tests (unless user specifically requests)
- Temporary or experimental code
- Implementation details obvious from reading code
- Internal refactoring that doesn't change behavior
- Build artifacts or generated code

## Output Format

When complete, provide a summary:

```markdown
## Documentation Complete

### Files Updated
- `path/to/file.ts` - Added JSDoc comments for new functions
- `README.md` - Added [Feature Name] to features list
- `docs/guides/new-pattern.md` - Created developer guide

### Documentation Locations
- **Code Comments:** [List key files with inline documentation]
- **User-Facing:** [List README or user guide updates]
- **Developer Guides:** [List new or updated guides]

### Notes
- [Any caveats or follow-up items]
```

## Quality Checklist

Before marking documentation complete:

- [ ] Code comments added for complex or non-obvious logic
- [ ] JSDoc added for all public functions, types, and classes
- [ ] Appropriate external documentation created or updated
- [ ] All links work and use relative paths
- [ ] Examples are accurate and tested
- [ ] Documentation matches actual implementation
- [ ] Project documentation style is matched
- [ ] No redundant documentation created

## Target Audience

Documentation is written for:
- **End users**: Who will use the feature
- **Future developers**: Who need to maintain or extend the code
- **New team members**: Who need to onboard and understand the system
- **AI Agents**: Who need clear context for future modifications
