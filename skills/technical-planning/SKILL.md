---
name: technical-planning
description: |
  Transform a PRD into a detailed, phased technical implementation plan. Creates actionable
  task lists with guardrails for resource efficiency, error handling, and type safety.
  Use after PRD creation, before implementation begins.
---

# Technical Planning Skill

## Goal

To guide an AI assistant in creating a detailed, step-by-step technical plan in Markdown format, based on an existing Product Requirements Document (PRD). The plan must be a clear, actionable guide for implementation.

## Process

1. **Receive PRD Reference:** The user provides a specific PRD file.
2. **Analyze PRD & Codebase:** Read the PRD's functional requirements and user stories. Review the existing codebase to understand architectural patterns, conventions, and identify existing files or components that can be leveraged or need modification.
3. **Structure the Plan:** Break down into logical phases (see required structure below).
4. **Detail Key Algorithms:** For any complex logic, provide a clear, step-by-step explanation.
5. **Generate Actionable Tasks:** Break down each phase into a checklist of parent tasks and granular sub-tasks.
6. **Add Verification Gates:** Each phase must end with a manual verification task.
7. **Generate Final Output:** Save the document.

## AI Guardrails: Resource & Safety Planning

The technical plan must include specific mitigations for common AI-generated inefficiencies and logic gaps:

### 1. Resource Efficiency
Any data-fetching task must explicitly include sub-tasks for:
- Batching multiple requests
- Pagination for large datasets
- Caching where appropriate
- Avoiding N+1 query patterns

### 2. Negative Path Mapping
For every primary functional task, there must be a corresponding sub-task for:
- Error/Exception handling
- Timeouts
- Null responses
- Invalid states

### 3. Boundary Safety
Explicitly define:
- Type assertions at module boundaries
- Null-checks where data enters or leaves the feature logic
- Input validation

### 4. Operation Sequencing
For async or multi-step logic:
- Define the strict order of operations
- Identify potential race conditions
- Document dependency flow

## Required Plan Structure

### Phase Structure
Plans **must** be broken down into these phases:

1. **Phase 1: Data Layer (The Foundation)**
   - Database schema changes
   - Migrations
   - Shared TypeScript types
   - *Rationale: Data structures must exist before code references them*

2. **Phase 2: Backend API**
   - API endpoints
   - Validation (Zod or similar)
   - Error handling
   - *Rationale: Backend must work before frontend can consume it*

3. **Phase 3: Frontend Implementation**
   - React components
   - State management
   - UI integration
   - *Rationale: Connect UI to working APIs*

4. **Phase 4: Review & Finalize**
   - Verification against PRD
   - Testing (unit, integration, E2E)
   - Documentation updates

### Verification Gates
Each phase **must** end with:
```markdown
- [ ] Task: Conductor - User Manual Verification '[Phase Name]' (Protocol in workflow.md)
```

## Output Format

```markdown
# Technical Plan: [Feature Name]

## Overview
[Brief summary of what will be built and the technical approach]

## Relevant Files

- `path/to/file1.ts` - Brief description of why this file is relevant
- `path/to/file1.test.ts` - Unit tests for file1.ts
- `path/to/api/route.ts` - API route handler

## Key Algorithms

### 1. [Algorithm Name]
- **Step 1:** [Description]
- **Step 2:** [Description]
- **Step 3:** [Description]

## AI Guardrails Applied

### Resource Efficiency
- [Specific mitigations for this feature]

### Error Handling
- [Specific error scenarios and handling]

### Type Safety
- [Boundary definitions]

---

## Phase 1: Data Layer & Types
[Description of what this phase accomplishes]

- [ ] 1.0 Parent Task Title
    - [ ] 1.1 Sub-task description
    - [ ] 1.2 Sub-task description
- [ ] 2.0 Parent Task Title
    - [ ] 2.1 Sub-task description

- [ ] Task: Conductor - User Manual Verification 'Data Layer & Types' (Protocol in workflow.md)

---

## Phase 2: Backend API
[Description of what this phase accomplishes]

- [ ] 3.0 Parent Task Title
    - [ ] 3.1 Sub-task description
    - [ ] 3.2 Sub-task description

- [ ] Task: Conductor - User Manual Verification 'Backend API' (Protocol in workflow.md)

---

## Phase 3: Frontend Implementation
[Description of what this phase accomplishes]

- [ ] 4.0 Parent Task Title
    - [ ] 4.1 Sub-task description
    - [ ] 4.2 Sub-task description

- [ ] Task: Conductor - User Manual Verification 'Frontend Implementation' (Protocol in workflow.md)

---

## Phase 4: Review & Finalize

- [ ] 5.0 Verify against PRD requirements
- [ ] 5.1 Add/update tests
- [ ] 5.2 Update documentation

- [ ] Task: Conductor - User Manual Verification 'Review & Finalize' (Protocol in workflow.md)

---

## Dependencies
- [External dependencies to install]
- [Internal modules to import]

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk] | High/Med/Low | High/Med/Low | [Mitigation] |

## Open Questions
- [Questions to resolve during implementation]
```

## Output

- **Format:** Markdown (`.md`)
- **Location:** Same directory as the PRD
- **Filename:** `tasks_[prd_file_name].md` (e.g., `tasks_0001_prd_user_profile.md`)

## Guidelines

- **Be specific**: Vague tasks lead to vague implementations
- **Right-size tasks**: Each task should be completable in one focused session
- **Order matters**: Dependencies should be clear, earlier tasks enable later ones
- **Include verification**: Each phase must have clear "done" criteria
- **Anticipate issues**: The guardrails section prevents common mistakes
- **Reference existing code**: Always check for patterns to follow
