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

## Process

1. **Receive Initial Prompt:** The user provides a brief description or request for a new feature.
2. **Ask Clarifying Questions:** Before writing the PRD, you **must** ask clarifying questions to gather sufficient detail. The goal is to understand the "what" and "why" of the feature. Provide options in numbered or lettered lists so the user can respond easily with their selections.
3. **Generate PRD:** Based on the user's answers, generate a PRD using the structure outlined below.
4. **Save PRD:** Save the generated document as `[n]_prd_[feature_name].md` inside the features directory (e.g., `0001_prd_user_authentication.md`).

## AI Guardrails: Domain Context & Invariants

To prevent logic errors, the PRD must explicitly define the "Project-Specific Invariants" that the AI might not infer from generic training data:

1. **Business Invariants**: List rules that must *never* be violated (e.g., "A user cannot have two active sessions simultaneously").
2. **Data Sensitivities**: Explicitly state which fields require specific handling (PII, credentials, or internal identifiers).
3. **Failure State Definitions**: Define what "failure" looks like for this feature so the agent can plan for more than just the "happy path."

## Clarifying Questions

Adapt questions based on the prompt, but explore these areas:

### Problem & Goal
- "What is the core problem this feature solves for the user?"
- "What is the main goal we want to achieve?"
- "Why is this important now?"

### Target User
- "Who is the primary user of this feature?"
- "Are there secondary users or stakeholders?"

### Core Functionality
- "What are the key actions a user must be able to perform?"
- "What does success look like for this feature?"

### User Stories
- "Could you provide a few user stories? (e.g., As a [user], I want to [action] so that [benefit].)"

### Scope Boundaries
- "To keep this focused, are there any specific things this feature **should not** do (non-goals)?"
- "What's explicitly out of scope for this version?"

### Data & Design
- "What data does this feature need to show or use?"
- "Are there any existing design mockups or UI guidelines to follow?"
- "Are there existing patterns in the codebase we should follow?"

### Edge Cases & Failures
- "What happens when things go wrong?"
- "Are there any business rules that must never be violated?"

## PRD Structure

The generated PRD must include the following sections:

```markdown
# PRD: [Feature Name]

## 1. Project Overview

[A concise, high-level summary of the feature, the problem it solves, and its primary goal. This section provides context for all stakeholders.]

## 2. Problem Statement

[What specific problem does this solve? Why does it matter? What happens if we don't build this?]

## 3. Goals

- [Goal 1]
- [Goal 2]

## 4. Non-Goals (Out of Scope)

- [Explicitly what this feature will NOT include]
- [Scope boundaries to manage expectations]

## 5. User Stories

As a [user type], I want to [action] so that [benefit].

## 6. Functional Requirements

### Must Have (P0)
- [ ] [Requirement with clear, unambiguous language]
- [ ] [Requirement]

### Should Have (P1)
- [ ] [Requirement]

### Nice to Have (P2)
- [ ] [Requirement]

## 7. Business Invariants

[Rules that must NEVER be violated]

- [Invariant 1]
- [Invariant 2]

## 8. Data Sensitivities

[Fields requiring special handling]

- [PII fields]
- [Credential handling]
- [Internal identifiers]

## 9. Failure States

[What does failure look like? How should the system behave?]

| Failure Scenario | Expected Behavior |
|------------------|-------------------|
| [Scenario] | [Behavior] |

## 10. Technical Considerations

- **Tech Stack:** [Brief mention of relevant tech/architecture]
- **Existing Patterns:** [Reference to existing code patterns to follow]
- **Dependencies:** [External dependencies or integrations]

## 11. UX/Design Considerations

[Link to mockups or describe UI/UX requirements]

## 12. Success Metrics

[How will we measure success?]

- [Metric 1]
- [Metric 2]

## 13. Open Questions

[Any unresolved questions to address during implementation]

- [ ] [Question 1]
- [ ] [Question 2]
```

## Target Audience

Assume the primary readers are:
- **Stakeholders:** Who need a quick, high-level understanding of the project.
- **Developers:** Who need an explicit and unambiguous guide for implementation.
- **AI Agents:** Who need clear context and constraints to avoid logic errors.

## Output

- **Format:** Markdown (`.md`)
- **Location:** Project's features directory
- **Filename:** `[n]_prd_[feature_name].md`

## Guidelines

- **Be thorough but efficient**: Don't ask unnecessary questions, but do explore all relevant areas
- **Group related questions**: Don't overwhelm with one question at a time
- **Provide examples**: Help the user understand what you're asking
- **Capture decisions**: Document choices made during the conversation
- **Flag assumptions**: Make implicit assumptions explicit
- **Number everything**: Makes it easy for users to respond with selections
