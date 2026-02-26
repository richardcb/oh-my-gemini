# oh-my-gemini v1.0 — Technical Plan

**Source PRD:** `docs/PRD/PRD-v1.0.md`
**Date:** February 26, 2026

---

## Relevant Files

- `gemini-extension.json` - Extension manifest; declares hooks, skills, commands, policies, and engine version. Must be updated for v0.30.0.
- `package.json` - npm package metadata; version bump to 1.0.0 on release.
- `.gemini/settings.json` - Gemini CLI settings; currently enables experimental flags that need removal.
- `.gemini/agents/orchestrator.md` - Orchestrator agent definition; contains deprecated `delegate_to_agent` references.
- `.gemini/agents/researcher.md` - Researcher agent definition; read-only + web tools.
- `.gemini/agents/architect.md` - Architect agent definition; read-only tools.
- `.gemini/agents/executor.md` - Executor agent definition; full tool access.
- `hooks/hooks.json` - Hook registration; event types, matchers, and timeouts.
- `hooks/session-start.js` - SessionStart hook; loads project state on startup.
- `hooks/before-agent.js` - BeforeAgent hook; injects git history and task context.
- `hooks/before-tool.js` - BeforeTool hook; security gates + git checkpoints. Currently contains static rules that should move to policies.
- `hooks/after-tool.js` - AfterTool hook; auto-verification (tsc, eslint) after file changes.
- `hooks/tool-filter.js` - BeforeToolSelection hook; agent-mode tool sandboxing. Candidate for removal if policy engine covers all cases.
- `hooks/phase-gate.js` - AfterAgent hook; Conductor phase verification. Needs simplification to advisory-only.
- `hooks/ralph-retry.js` - AfterAgent hook; persistence mode retry logic.
- `hooks/lib/utils.js` - Shared hook utilities (~14KB); git commands, I/O, verification helpers.
- `hooks/lib/platform.js` - Cross-platform utilities (~7KB); command normalization, path handling.
- `hooks/lib/config.js` - Configuration loader (~7KB); project → user → defaults priority.
- `hooks/config.default.json` - Default hook configuration; phaseGates, autoVerification, security, ralph settings.
- `policies/omg-security.toml` - Security policy; blocked commands, protected paths, safe operations.
- `commands/omg/setup.toml` - `/omg:setup` command definition.
- `commands/omg/autopilot.toml` - `/omg:autopilot` command definition.
- `commands/omg/implement.toml` - `/omg:implement` command definition.
- `commands/omg/track.toml` - `/omg:track` command definition.
- `commands/omg/conductor-setup.toml` - `/omg:conductor-setup` command definition; to be folded into setup.
- `commands/omg/status.toml` - `/omg:status` command definition.
- `skills/prd-creation/SKILL.md` - PRD creation skill definition.
- `skills/technical-planning/SKILL.md` - Technical planning skill definition.
- `skills/implementation/SKILL.md` - Implementation execution skill definition.
- `skills/code-review/SKILL.md` - Code review skill definition.
- `skills/documentation/SKILL.md` - Documentation generation skill definition.
- `skills/test-generation/SKILL.md` - Test generation skill definition.
- `skills/git-commit/SKILL.md` - Commit message generation skill definition.
- `skills/debug-assistant/SKILL.md` - Debugging workflow skill definition.
- `skills/persistence/SKILL.md` - Ralph mode / persistence skill definition.
- `skills/conductor-setup/SKILL.md` - Conductor initialization skill definition.
- `skills/track-creation/SKILL.md` - Feature track creation skill definition.

---

## Key Algorithms

### 1. Static-to-Policy Migration (tool-filter.js → omg-security.toml)

- **Step 1:** Audit `tool-filter.js` to extract all static tool restrictions per agent mode (researcher: `[read_file, list_directory, web_fetch, google_web_search]`, architect: `[read_file, list_directory, glob, search_file_content]`).
- **Step 2:** Express each restriction set as a TOML policy rule with appropriate priority levels. Researcher and architect restrictions become `deny` rules for write/shell tools.
- **Step 3:** Identify any *dynamic* restrictions in `tool-filter.js` that depend on runtime context (e.g., prompt keyword detection for `@researcher`/`@architect` mode switching). These cannot be expressed as static TOML and must remain in the hook.
- **Step 4:** If all restrictions are expressible as TOML policies, remove `tool-filter.js` entirely and delete its entry from `hooks/hooks.json`. If dynamic restrictions remain, simplify the hook to only the dynamic cases.
- **Error handling:** If `tool-filter.js` references tool names that changed in v0.30.0, update them in both the hook (if retained) and the new TOML policy.

### 2. Git Checkpoint Creation (before-tool.js)

- **Step 1:** Check if the current directory is a git repository (`git rev-parse --is-inside-work-tree`).
- **Step 2:** If not a git repo, log a warning and return without blocking the tool call.
- **Step 3:** Check for uncommitted changes (`git status --porcelain`).
- **Step 4:** If changes exist, create a lightweight stash (`git stash push -m "omg-checkpoint-{timestamp}"`) or a WIP commit on a detached branch, depending on config.
- **Step 5:** Record the checkpoint reference in process memory for potential rollback.
- **Error handling:** If `git stash` fails (e.g., untracked files conflict), fall back to `git stash push --include-untracked`. If that also fails, log a warning and proceed without checkpoint. Never block the tool call due to checkpoint failure.

### 3. Auto-Verification Pipeline (after-tool.js)

- **Step 1:** Determine project type by checking for `tsconfig.json` (TypeScript), `.eslintrc.*` or `eslint.config.*` (ESLint), `package.json` scripts (`lint`, `typecheck`).
- **Step 2:** If TypeScript is detected, run `npx tsc --noEmit` (or the project's `typecheck` script). Capture stderr.
- **Step 3:** If ESLint is detected, run `npx eslint --no-warn {changed-files}`. Capture stderr.
- **Step 4:** Parse errors from both tools. Format as a concise summary: `"[omg:after-tool] 3 type errors, 1 lint error found. Fix before continuing."`.
- **Step 5:** Inject the error summary into the agent's context as a system message.
- **Error handling:** If `tsc` or `eslint` binaries are not found, skip silently (the project doesn't use them). If verification times out (approaching the 60s hook timeout), kill the subprocess at 55s and inject a partial result with a timeout warning.

### 4. Context Injection (before-agent.js)

- **Step 1:** Read the user's prompt from stdin.
- **Step 2:** Detect keywords: `fix`/`bug` → inject recent git log + diff; continuation keywords → inject recently changed files; active Conductor track → inject current task from `plan.md`.
- **Step 3:** Build a context block as a structured markdown snippet (max 2000 chars to avoid bloating context).
- **Step 4:** Output the context block to stdout for Gemini CLI to prepend to the agent's system prompt.
- **Error handling:** If git commands fail (not a repo, binary not found), skip that context source. If Conductor files are missing/malformed, skip track injection. Never fail the hook — always return valid output (empty string is acceptable).

---

## Implementation Plan

### Phase 1: Configuration & Types

- [ ] 1.0 Update Extension Manifest for v0.30.0
    - [ ] 1.1 Bump `engines.gemini-cli` from `>=0.26.0` to `>=0.30.0` in `gemini-extension.json`
    - [ ] 1.2 Remove `experimental` flags for skills and hooks (now stable in v0.30.0)
    - [ ] 1.3 Add `policies/omg-plan-mode.toml` to the `policies` array
    - [ ] 1.4 Update hook matchers to reference v0.30.0 centralized tool names (check against #18944, #18991 changes)
    - [ ] 1.5 Add `configuration` entries for any new settings (e.g., plan mode integration toggles)
    - [ ] 1.6 Validate manifest against Gemini CLI's extension schema (run `gemini extensions validate`)
    - [ ] 1.7 Error handling: If v0.30.0 tool names differ from current matchers, document the mapping in a comment within the manifest
- [ ] 2.0 Update `.gemini/settings.json`
    - [ ] 2.1 Remove `experimental.enableAgents`, `experimental.skills`, `experimental.hooks` flags that are now stable
    - [ ] 2.2 Verify Gemini CLI still loads agents/skills/hooks without experimental flags
    - [ ] 2.3 Error handling: If removal breaks loading, re-add with a TODO comment and file upstream issue
- [ ] 3.0 Clean Up Agent Definitions
    - [ ] 3.1 Remove all `delegate_to_agent` references from `orchestrator.md` (dead since v0.28.0)
    - [ ] 3.2 Update orchestrator's tool list to match v0.30.0 available tools
    - [ ] 3.3 Verify `researcher.md`, `architect.md`, `executor.md` tool lists match v0.30.0 names
    - [ ] 3.4 Remove any TOML agent definitions if they exist (Markdown is the canonical format)
    - [ ] 3.5 Error handling: If agent tool names changed in v0.30.0, update all four agent files consistently
- [ ] 4.0 Create `omg-plan-mode.toml` Policy
    - [ ] 4.1 Define read-only tool allowlist for plan mode: `read_file`, `list_directory`, `glob`, `search_file_content`, `web_fetch`, `google_web_search`
    - [ ] 4.2 Define deny rules for write tools in plan mode: `write_file`, `replace`, `edit_file`, `create_file`, `run_shell_command`
    - [ ] 4.3 Set appropriate priority levels (lower than `omg-security.toml` so security rules always win)
    - [ ] 4.4 Test policy activation via Gemini CLI's policy engine
    - [ ] 4.5 Error handling: If policy engine rejects the TOML syntax, validate against Gemini CLI's policy schema documentation

### Phase 2: Core Implementation

- [ ] 5.0 Migrate Static Rules from `tool-filter.js` to Policies
    - [ ] 5.1 Extract researcher mode tool restrictions from `tool-filter.js` into `omg-security.toml` rules
    - [ ] 5.2 Extract architect mode tool restrictions into `omg-security.toml` rules
    - [ ] 5.3 Identify and preserve dynamic restrictions (prompt keyword detection: `@researcher`, `@architect`, `debug:`) in the hook
    - [ ] 5.4 If all restrictions are now in TOML, remove `tool-filter.js` and its entry from `hooks/hooks.json`
    - [ ] 5.5 If dynamic restrictions remain, simplify `tool-filter.js` to only the dynamic keyword-detection logic
    - [ ] 5.6 Test that policy engine correctly blocks tools for each agent mode
    - [ ] 5.7 Error handling: If policy engine cannot express conditional restrictions (e.g., "block write_file only when prompt contains @researcher"), keep the hook as fallback and document the gap
- [ ] 6.0 Simplify `before-tool.js`
    - [ ] 6.1 Remove static dangerous-command patterns that are now covered by `omg-security.toml` (e.g., `rm -rf /`, `format c:`, `chmod 777`)
    - [ ] 6.2 Remove static protected-path checks that are now in `omg-security.toml`
    - [ ] 6.3 Retain the git checkpoint logic (Algorithm 2 — unique value, no policy equivalent)
    - [ ] 6.4 Retain any dynamic security checks that depend on runtime context
    - [ ] 6.5 Update the hook matcher in `hooks/hooks.json` if the tool names changed in v0.30.0
    - [ ] 6.6 Test that removed rules are still enforced by the policy engine
    - [ ] 6.7 Error handling: Before removing any rule from the hook, verify the exact same pattern exists in `omg-security.toml`; log a warning at hook startup if expected policy rules are missing
- [ ] 7.0 Update `session-start.js` for v0.30.0
    - [ ] 7.1 Detect whether Gemini CLI's 30-day session retention is active (check for session metadata)
    - [ ] 7.2 If session is being resumed (not fresh), skip the full project state load and show a concise "Resuming session" message
    - [ ] 7.3 If session is fresh, load Conductor state and show full project status
    - [ ] 7.4 Update timeout handling for v0.30.0 (currently 15000ms — verify this is sufficient)
    - [ ] 7.5 Error handling: If session metadata format is undocumented, fall back to always loading full state (safe default)
- [ ] 8.0 Simplify `phase-gate.js` to Advisory-Only
    - [ ] 8.1 Remove strict-mode blocking behavior (native 5-phase plan mode handles enforcement)
    - [ ] 8.2 Retain advisory messages that inform the user about Conductor phase status
    - [ ] 8.3 If native plan mode is active, defer to its phase tracking and only add Conductor-specific context
    - [ ] 8.4 Update advisory message format: single line, non-blocking (e.g., `[omg:phase-gate] Phase 2/4: Backend API — 3 tasks remaining`)
    - [ ] 8.5 Error handling: If Conductor state is missing/corrupt, skip advisory silently rather than blocking
- [ ] 9.0 Update `ralph-retry.js` for v0.30.0 Circuit Breakers
    - [ ] 9.1 Read Gemini CLI's native circuit breaker limits (`MAX_TURNS=15`, `MAX_TIME_MINUTES=5`)
    - [ ] 9.2 Ensure ralph-retry respects these limits (do not suggest retries that would exceed them)
    - [ ] 9.3 Add a remaining-budget indicator to retry suggestions (e.g., "Retrying — 8 turns remaining before circuit breaker")
    - [ ] 9.4 Error handling: If circuit breaker values are not accessible, use hardcoded defaults matching v0.30.0 documented values
- [ ] 10.0 Audit and Polish Existing Skills (11 skills)
    - [ ] 10.1 Verify all 11 SKILL.md files conform to v0.30.0 skill discovery format (frontmatter, activation triggers)
    - [ ] 10.2 Ensure each skill's `templates/` directory contains all referenced templates (stitching gap fix)
    - [ ] 10.3 Remove any `delegate_to_agent` or subagent references from skill instructions
    - [ ] 10.4 Test each skill activates via `/skills list` output
    - [ ] 10.5 Test each skill activates via natural language trigger (e.g., "help me write a PRD" → `prd-creation`)
    - [ ] 10.6 Verify skills work when plan mode is active (v0.30.0 enabled skills in plan mode via #18817)
    - [ ] 10.7 Error handling: If a skill's template directory is missing, add inline fallback content to the SKILL.md
- [ ] 11.0 Create `quick-fix` Skill
    - [ ] 11.1 Create `skills/quick-fix/SKILL.md` with frontmatter (name, description, activation triggers)
    - [ ] 11.2 Define the workflow: describe bug → locate code → apply minimal fix → verify
    - [ ] 11.3 Activation triggers: "quick fix", "small fix", "patch", "hotfix"
    - [ ] 11.4 Explicitly state the skill does NOT create a plan or PRD (differentiator from `implementation` skill)
    - [ ] 11.5 Error handling: Instruct the AI to verify the fix compiles/passes lint before declaring success
- [ ] 12.0 Create `refactor` Skill
    - [ ] 12.1 Create `skills/refactor/SKILL.md` with frontmatter
    - [ ] 12.2 Define the workflow: identify scope → verify tests pass (pre-refactor baseline) → apply refactoring → verify tests still pass → verify no type errors
    - [ ] 12.3 Activation triggers: "refactor", "restructure", "clean up", "reorganize"
    - [ ] 12.4 Include safety checklist: git clean state required, tests must pass before and after
    - [ ] 12.5 Error handling: If tests don't exist, warn the user and suggest creating tests first (link to `test-generation` skill)

### Phase 3: Integration & Policies

- [ ] 13.0 Create `/omg:plan` Command
    - [ ] 13.1 Create `commands/omg/plan.toml` with command definition
    - [ ] 13.2 Command must activate native plan mode (`plan_mode: true` or equivalent v0.30.0 mechanism)
    - [ ] 13.3 Inject OMG context: list available skills, active Conductor tracks, project type from GEMINI.md
    - [ ] 13.4 Bridge to `technical-planning` skill when user has a PRD reference
    - [ ] 13.5 Error handling: If plan mode is not available (older Gemini CLI), show error with minimum version requirement
- [ ] 14.0 Create `/omg:review` Command
    - [ ] 14.1 Create `commands/omg/review.toml` with command definition
    - [ ] 14.2 Command must gather current git diff (staged + unstaged) as context
    - [ ] 14.3 Invoke the `code-review` skill with the diff
    - [ ] 14.4 Error handling: If no changes detected in git diff, inform the user "Nothing to review — no changes detected"
- [ ] 15.0 Update Existing Commands
    - [ ] 15.1 Update `/omg:setup` to focus on GEMINI.md creation + project type detection; fold conductor-setup choice into setup flow
    - [ ] 15.2 Update `/omg:status` to include plan mode awareness (show current phase if plan mode active)
    - [ ] 15.3 Update `/omg:autopilot` to use native plan mode for task decomposition before executor engagement
    - [ ] 15.4 Remove or redirect `/omg:conductor-setup` to `/omg:setup` (breaking change — document in changelog)
    - [ ] 15.5 Test all commands reload correctly via `/commands reload` (#19078)
    - [ ] 15.6 Error handling: If project detection fails (no recognizable project file), default to a generic GEMINI.md template
- [ ] 16.0 Update `omg-security.toml` for v0.30.0 Policy Engine
    - [ ] 16.1 Verify TOML syntax matches v0.30.0 policy engine schema (field names, priority ranges, rule format)
    - [ ] 16.2 Add any new dangerous patterns identified during v0.30.0 testing
    - [ ] 16.3 Add the migrated static rules from `tool-filter.js` (Phase 2, task 5.0)
    - [ ] 16.4 Test policy loading via Gemini CLI's policy engine debug output
    - [ ] 16.5 Error handling: If policy schema changed in v0.30.0, rewrite rules to match new schema (check Gemini CLI release notes)
- [ ] 17.0 Update `hooks/hooks.json` Registration
    - [ ] 17.1 Update tool matchers to v0.30.0 centralized tool names
    - [ ] 17.2 Remove `tool-filter.js` entry if fully migrated to policies (depends on task 5.4)
    - [ ] 17.3 Verify timeout values are appropriate for each hook (especially `after-tool.js` at 60s)
    - [ ] 17.4 Error handling: If any hook entry references a deleted file, Gemini CLI will fail to start — validate all paths exist

### Phase 4: Testing & Verification

- [ ] 18.0 Cross-Platform Hook Testing
    - [ ] 18.1 Test all hooks on macOS/Linux: `session-start.js`, `before-agent.js`, `before-tool.js`, `after-tool.js`, `phase-gate.js`, `ralph-retry.js` (and `tool-filter.js` if retained)
    - [ ] 18.2 Test all hooks on Windows: same set, verifying `hooks/lib/platform.js` correctly normalizes commands
    - [ ] 18.3 Verify `before-tool.js` blocks Windows-specific dangerous commands (`format c:`, `rd /s /q c:\`, `del /f /q %systemroot%`)
    - [ ] 18.4 Verify git checkpoint creation works on both platforms (path separators, stash naming)
    - [ ] 18.5 Error handling: Document any platform-specific behavior differences in `hooks/README.md`
- [ ] 19.0 Skill Discovery Testing
    - [ ] 19.1 Run `/skills list` and verify all 13 skills (11 existing + `quick-fix` + `refactor`) appear
    - [ ] 19.2 Test natural language activation for each skill (one prompt per skill)
    - [ ] 19.3 Verify skill templates are accessible from within skill invocation (no "file not found" errors)
    - [ ] 19.4 Test skills in plan mode context (v0.30.0 #18817)
    - [ ] 19.5 Error handling: If a skill fails discovery, check frontmatter format against v0.30.0 skill schema
- [ ] 20.0 Policy Engine Integration Testing
    - [ ] 20.1 Verify `omg-security.toml` blocks all listed dangerous commands when invoked via `run_shell_command`
    - [ ] 20.2 Verify `omg-security.toml` blocks writes to protected paths
    - [ ] 20.3 Verify `omg-plan-mode.toml` restricts tools correctly in plan mode
    - [ ] 20.4 Verify policy + hook interaction: confirm hooks are not invoked for policy-rejected tool calls
    - [ ] 20.5 Error handling: If policy engine doesn't block an expected command, check priority levels and rule ordering
- [ ] 21.0 Command Integration Testing
    - [ ] 21.1 Test `/omg:setup` on a fresh Node.js project, a Python project, and a Rust project
    - [ ] 21.2 Test `/omg:plan` activates plan mode and shows OMG context
    - [ ] 21.3 Test `/omg:review` with staged changes, unstaged changes, and no changes
    - [ ] 21.4 Test `/omg:status` displays accurate state (plan mode active/inactive, Conductor tracks, git info)
    - [ ] 21.5 Test `/omg:autopilot` decomposes a task using plan mode before execution
    - [ ] 21.6 Error handling: Document any command that requires specific project structure (e.g., `/omg:implement` needs an active Conductor track)
- [ ] 22.0 End-to-End Workflow Validation
    - [ ] 22.1 Run the full workflow: `/omg:setup` → `prd-creation` skill → `technical-planning` skill → `/omg:implement` → `/omg:review`
    - [ ] 22.2 Verify hooks fire at each stage (session-start on launch, before-agent on prompts, before-tool on file writes, after-tool on verification)
    - [ ] 22.3 Verify persistence mode (Ralph) retries on a deliberately failing task
    - [ ] 22.4 Verify the workflow works identically on Unix and Windows
    - [ ] 22.5 Error handling: If any step fails, identify whether the failure is in the skill, command, hook, or policy layer
- [ ] 23.0 Deprecation Audit
    - [ ] 23.1 Search all files for `delegate_to_agent` — must return 0 results
    - [ ] 23.2 Search all files for `--allowed-tools` — must return 0 results
    - [ ] 23.3 Search all files for `tools.enableHooks` — must return 0 results
    - [ ] 23.4 Search all files for `experimental` in settings/manifest — must return 0 results (unless legitimately experimental features)
    - [ ] 23.5 Error handling: If deprecated references are found in skills or agent definitions, update them as part of this task (don't defer)
- [ ] 24.0 Documentation & Launch Prep
    - [ ] 24.1 Rewrite `README.md` — focus on "install and go" value proposition, show `/omg:setup` in first 10 lines
    - [ ] 24.2 Update `docs/getting-started.md` for v1.0 commands and v0.30.0 requirements
    - [ ] 24.3 Update `docs/HOOKS.md` to reflect simplified hook set and policy migration
    - [ ] 24.4 Update `package.json` version to `1.0.0`
    - [ ] 24.5 Create GitHub release with changelog summarizing all v1.0 changes
    - [ ] 24.6 Publish `oh-my-gemini@1.0.0` to npm
    - [ ] 24.7 Update `oh-my-gemini-cli` npm package to redirect to main package
    - [ ] 24.8 Submit to awesome-gemini-cli list
    - [ ] 24.9 Error handling: If npm publish fails, verify `package.json` `name` and `version` fields, check npm auth
