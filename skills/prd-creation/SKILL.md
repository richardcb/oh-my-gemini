---
name: prd-creation
description: |
  Generate comprehensive Product Requirements Documents (PRDs) through structured 
  clarifying questions. Use when starting a new feature and need to define requirements
  before technical planning. Enforces "docs-first" methodology - no code until PRD exists.
---

# PRD Creation Skill

## Goal

To guide an AI assistant in creating a single, comprehensive Product Requirements Document (PRD) in Markdown format. This document will serve as both a high-level brief for project context and a detailed, actionable guide for implementation.

## Activation Triggers

- User asks to "create a PRD", "write requirements", or "define a feature"
- Starting a new feature that needs requirements definition
- User says "docs first" or "requirements first"

## Bundled Resources

This skill includes:
- `scripts/generate-prd.sh` - Shell script to create PRD file with proper naming
- `templates/prd-template.md` - Standard PRD template

## Process

### 1. Receive Initial Prompt
The user provides a brief description or request for a new feature.

### 2. Detect Existing PRDs
Check if PRDs already exist:
```bash
ls -la features/*prd*.md 2>/dev/null || ls -la docs/prds/*.md 2>/dev/null || echo "NO_EXISTING_PRDS"
```

### 3. Ask Clarifying Questions
Before writing the PRD, you **must** ask clarifying questions to gather sufficient detail. Group related questions and provide numbered options for easy responses.

#### Problem & Goal
- "What is the core problem this feature solves for the user?"
- "What is the main goal we want to achieve?"
- "Why is this important now?"

#### Target User
- "Who is the primary user of this feature?"
- "Are there secondary users or stakeholders?"

#### Core Functionality
- "What are the key actions a user must be able to perform?"
- "What does success look like for this feature?"

#### User Stories
- "Could you provide a few user stories? (e.g., As a [user], I want to [action] so that [benefit].)"

#### Scope Boundaries
- "What's explicitly out of scope for this version?"

#### Edge Cases & Failures
- "What happens when things go wrong?"
- "Are there any business rules that must never be violated?"

### 4. Generate PRD

Use the template structure to create the PRD:

```bash
# Generate next PRD number
NEXT_NUM=$(ls features/*prd*.md 2>/dev/null | wc -l)
NEXT_NUM=$((NEXT_NUM + 1))
PADDED_NUM=$(printf "%04d" $NEXT_NUM)
```

### 5. Save PRD
Save as `[n]_prd_[feature_name].md` in the features directory.

## PRD Structure

```markdown
# PRD: [Feature Name]

## 1. Project Overview
[A concise, high-level summary of the feature, the problem it solves, and its primary goal.]

## 2. Problem Statement
[What specific problem does this solve? Why does it matter?]

## 3. Goals
- [Goal 1]
- [Goal 2]

## 4. Non-Goals (Out of Scope)
- [Explicitly what this feature will NOT include]

## 5. User Stories
As a [user type], I want to [action] so that [benefit].

## 6. Functional Requirements

### Must Have (P0)
- [ ] [Requirement]

### Should Have (P1)
- [ ] [Requirement]

### Nice to Have (P2)
- [ ] [Requirement]

## 7. Business Invariants
[Rules that must NEVER be violated]
- [Invariant 1]

## 8. Data Sensitivities
[Fields requiring special handling]
- [PII fields]

## 9. Failure States
| Failure Scenario | Expected Behavior |
|------------------|-------------------|
| [Scenario] | [Behavior] |

## 10. Technical Considerations
- **Tech Stack:** [Relevant tech]
- **Dependencies:** [External dependencies]

## 11. UX/Design Considerations
[Link to mockups or describe UI/UX requirements]

## 12. Success Metrics
- [Metric 1]

## 13. Open Questions
- [ ] [Question 1]
```

## AI Guardrails

The PRD must explicitly define:

### Business Invariants
Rules that must NEVER be violated:
- Example: "A user cannot have two active sessions simultaneously"
- Example: "Payment must complete before order is confirmed"

### Data Sensitivities
Fields requiring specific handling:
- PII fields (name, email, phone)
- Credentials (passwords, API keys)
- Internal identifiers (user IDs, session tokens)

### Failure State Definitions
What "failure" looks like for this feature:
- Network errors
- Invalid input
- Concurrent access conflicts
- External service unavailability

## Output

- **Format:** Markdown (`.md`)
- **Location:** `features/` or `docs/prds/` directory
- **Filename:** `[nnnn]_prd_[feature_name].md`

## Verification

After creating, verify:
```bash
# Check file exists
ls -la features/[filename] || ls -la docs/prds/[filename]

# Check content
wc -l features/[filename]
head -20 features/[filename]
```
