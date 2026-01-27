# Development Workflow: Docs-First & Interactive

*This is an example workflow from a real production project (I2N Scoring Platform).*

We follow a strict, linear "Docs-First" methodology. **Do not write code** until a PRD and Technical Plan have been generated and approved.

## Project Standards
- **Test Coverage:** Maintain a minimum of **80% code test coverage** for all new features.
- **Documentation:** Always update `docs/architecture/` and `docs/user-flows/` if changes affect system behavior.
- **Commit Frequency:** Commit changes **after each PRD/Feature implementation** is complete.
- **Task Summaries:** Use **Git Notes** to record detailed task summaries.

## Phase 1: Discovery & PRD (Interactive)
**Trigger:** User requests a new feature.
**Action:**
1. **Check for PRD:** Look in the features directory. If a PRD exists, skip to Phase 2.
2. **Clarify (CRITICAL):** If no PRD exists, **STOP** and ask clarifying questions:
   - **Problem & Goal:** What specific user pain point are we solving?
   - **User Stories:** "As a [role], I want to [action]..."
   - **Business Invariants:** Rules that must never be broken.
   - **Failure States:** What happens when things go wrong?
3. **Generate PRD:** Create a file named `[nnnn]_prd_[feature_name].md`.
   - *Must Include:* Project Overview, User Stories, Functional Requirements, Non-Goals, Data Sensitivities.

## Phase 2: Technical Planning
**Trigger:** A PRD exists but no task list exists.
**Action:**
1. **Analyze Codebase:** Review existing code to identify reuse opportunities.
2. **Generate Tech Plan:** Create `[nnnn]_tasks_[prd_name].md`.
3. **Structure Requirements:** The plan **must** include:
   - **Phase 1: Data Layer:** Database schema, migrations, shared types.
   - **Phase 2: Backend API:** Endpoints, validation, error handling.
   - **Phase 3: Frontend UI:** Components, state management, integration.
4. **AI Guardrails:** Explicitly list mitigations for "Resource Efficiency" and "Boundary Safety".

## Phase 3: Implementation Loop
**Trigger:** User approves the Tech Plan.
**Action:**
1. **Execute sequentially:** Follow the task checklist order.
   - **Data First:** Apply schema changes before writing API code.
   - **Backend Second:** Implement logic and tests.
   - **Frontend Third:** Connect UI to working APIs.
2. **Update Docs:** Mark tasks as `[x]` as you complete them.

## Phase 4: Review & Finalize
1. **Verify:** Ensure architecture docs are updated if behavior changed.
2. **Test:** Add E2E tests for critical user flows.
3. **Review:** Follow code review checklist.

## Phase Completion Verification Protocol
For each major phase, the final task must be a manual verification step.
- **Task:** Conductor - User Manual Verification '<Phase Name>'
- **Protocol:** Summarize work done, verify against PRD/Spec, ensure tests pass.
- **Commit:** Confirm with user whether to commit changes.
