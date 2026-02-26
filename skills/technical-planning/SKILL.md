---
name: technical-planning
description: |
  Transform a PRD into a detailed, phased technical implementation plan. Creates actionable
  task lists with guardrails for resource efficiency, error handling, and type safety.
  Use after PRD creation, before implementation begins.
---

# Technical Planning Skill

## Goal

Create a detailed, step-by-step technical plan in Markdown format, based on an existing Product Requirements Document (PRD). The plan must be a clear, actionable guide for implementation.

## Bundled Resources

- `scripts/generate-plan.sh` - Create plan file with proper naming
- `templates/plan-template.md` - Standard plan structure
- `references/phase-patterns.md` - Common phase patterns

## Process

### 1. Receive PRD Reference

The user provides a specific PRD file or feature name.

### 2. Load Context

```bash
# Find the PRD
find . -name "*prd*.md" | head -10

# Read project tech stack
cat conductor/tech-stack.md 2>/dev/null || cat GEMINI.md 2>/dev/null | head -50

# Check existing patterns
find src -name "*.ts" -o -name "*.js" 2>/dev/null | head -20
```

### 3. Analyze PRD & Codebase

Read the PRD's:
- Functional requirements
- User stories
- Business invariants
- Failure states

Review the codebase for:
- Architectural patterns
- Existing similar features
- Shared components to reuse
- Files that need modification

### 4. Structure the Plan

Break down into logical phases following this order:

#### Phase 1: Data Layer (Foundation)
- Database schema changes
- Migrations
- Shared TypeScript types
- **Why first:** Data structures must exist before code references them

#### Phase 2: Backend API
- API endpoints
- Validation (Zod schemas)
- Error handling
- **Why second:** Backend must work before frontend can consume it

#### Phase 3: Frontend Implementation
- React components
- State management
- UI integration
- **Why third:** Connect UI to working APIs

#### Phase 4: Review & Finalize
- Verification against PRD
- Testing (unit, integration, E2E)
- Documentation updates

### 5. Apply AI Guardrails

Every plan must include mitigations for common AI-generated issues:

#### Resource Efficiency
For any data-fetching task, include sub-tasks for:
- [ ] Batching multiple requests
- [ ] Pagination for large datasets
- [ ] Caching where appropriate
- [ ] Avoiding N+1 query patterns

#### Negative Path Mapping
For every primary functional task:
- [ ] Error/Exception handling
- [ ] Timeout handling
- [ ] Null response handling
- [ ] Invalid state handling

#### Boundary Safety
Define explicitly:
- [ ] Type assertions at module boundaries
- [ ] Null-checks where data enters/exits
- [ ] Input validation

#### Operation Sequencing
For async or multi-step logic:
- [ ] Strict order of operations
- [ ] Race condition identification
- [ ] Dependency flow documentation

### 6. Add Verification Gates

Each phase must end with a verification checkpoint. When `ask_user` is available (v0.30.0+), use it for interactive verification:
```
ask_user({ question: "Phase '[Phase Name]' is complete. Have you verified all tasks?", question_type: "yes_no" })
```

Each phase must end with:
```markdown
- [ ] Task: Conductor - User Manual Verification '[Phase Name]' (Protocol in workflow.md)
```

If `ask_user` is not available (headless mode, older CLI), the phase-gate hook handles verification via prompt-based instructions.

## Output Format

```markdown
# Technical Plan: [Feature Name]

## Overview
[Brief summary of what will be built and the technical approach]

## PRD Reference
- File: `[path/to/prd.md]`
- Feature: [Feature name from PRD]

## Relevant Files

### Files to Modify
- `path/to/file1.ts` - [Why this file needs changes]

### Files to Create
- `path/to/new-file.ts` - [Purpose of new file]

### Reference Files (Patterns to Follow)
- `path/to/similar.ts` - [Pattern to follow]

## Key Algorithms

### 1. [Algorithm Name]
**Purpose:** [What this accomplishes]
**Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Edge Cases:**
- [Edge case and handling]

## AI Guardrails Applied

### Resource Efficiency
- [ ] [Specific mitigation for this feature]

### Error Handling
- [ ] [Specific error scenario and handling]

### Type Safety
- [ ] [Boundary definition]

---

## Phase 1: Data Layer & Types

[Description of what this phase accomplishes]

### Tasks

- [ ] 1.0 **[Parent Task Title]**
  - [ ] 1.1 [Sub-task with specific file and action]
  - [ ] 1.2 [Sub-task]
  - [ ] 1.3 Add error types for [feature]

- [ ] 2.0 **[Parent Task Title]**
  - [ ] 2.1 [Sub-task]

### Verification Criteria
- [ ] Types compile without errors
- [ ] Schema migration runs successfully
- [ ] No circular dependencies

- [ ] Task: Conductor - User Manual Verification 'Data Layer & Types'

---

## Phase 2: Backend API

[Description of what this phase accomplishes]

### Tasks

- [ ] 3.0 **Create [endpoint] endpoint**
  - [ ] 3.1 Create route handler in `src/routes/[name].ts`
  - [ ] 3.2 Add Zod validation schema
  - [ ] 3.3 Implement business logic
  - [ ] 3.4 Add error handling for: [list cases]
  - [ ] 3.5 Add request logging

- [ ] 4.0 **Add [middleware/service]**
  - [ ] 4.1 [Sub-task]

### Verification Criteria
- [ ] Endpoints respond correctly to valid requests
- [ ] Endpoints return proper errors for invalid requests
- [ ] All edge cases handled

- [ ] Task: Conductor - User Manual Verification 'Backend API'

---

## Phase 3: Frontend Implementation

[Description of what this phase accomplishes]

### Tasks

- [ ] 5.0 **Create [Component] component**
  - [ ] 5.1 Create component file
  - [ ] 5.2 Add TypeScript props interface
  - [ ] 5.3 Implement UI following design
  - [ ] 5.4 Add loading state
  - [ ] 5.5 Add error state
  - [ ] 5.6 Connect to API

- [ ] 6.0 **Integrate into [page/flow]**
  - [ ] 6.1 [Sub-task]

### Verification Criteria
- [ ] Component renders correctly
- [ ] Loading states display properly
- [ ] Error states display properly
- [ ] User flow works end-to-end

- [ ] Task: Conductor - User Manual Verification 'Frontend Implementation'

---

## Phase 4: Review & Finalize

### Tasks

- [ ] 7.0 **Testing**
  - [ ] 7.1 Add unit tests for [critical logic]
  - [ ] 7.2 Add integration tests for [API endpoints]
  - [ ] 7.3 Add E2E test for [user flow]

- [ ] 8.0 **Documentation**
  - [ ] 8.1 Update API documentation
  - [ ] 8.2 Add JSDoc comments to public functions
  - [ ] 8.3 Update README if needed

- [ ] 9.0 **Final Verification**
  - [ ] 9.1 Verify against all PRD requirements
  - [ ] 9.2 Check performance metrics
  - [ ] 9.3 Security review

- [ ] Task: Conductor - User Manual Verification 'Review & Finalize'

---

## Dependencies

### External Packages
- [package@version] - [purpose]

### Internal Modules
- [module] - [what it provides]

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk description] | High/Med/Low | High/Med/Low | [Mitigation strategy] |

## Open Questions

- [ ] [Question that needs resolution during implementation]

## Estimated Effort

| Phase | Estimated Time | Complexity |
|-------|----------------|------------|
| Phase 1 | [time] | [Low/Med/High] |
| Phase 2 | [time] | [Low/Med/High] |
| Phase 3 | [time] | [Low/Med/High] |
| Phase 4 | [time] | [Low/Med/High] |
| **Total** | **[time]** | |
```

## Output Location

- **Format:** Markdown (`.md`)
- **Location:** Same directory as the PRD
- **Filename:** `tasks_[prd_file_name].md`

## Verification

After creating:
```bash
# Verify file exists
ls -la [plan_file]

# Check structure
grep -c "^## Phase" [plan_file]

# Check tasks exist
grep -c "\- \[ \]" [plan_file]
```
