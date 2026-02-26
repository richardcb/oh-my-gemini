# oh-my-gemini v1.0 — Code Review

**Reviewer:** Senior Software Engineer (AI-assisted)
**Date:** February 27, 2026
**Technical Plan:** `docs/PRD/tasks_PRD-v1.0.md`
**PRD:** `docs/PRD/PRD-v1.0.md`
**Scope:** All changes implementing v1.0 (24 tasks across 4 phases)

---

## 1. Plan Implementation Assessment

### Correctness

The technical plan specified 24 tasks across 4 phases. **Phases 1–3 (tasks 1–17) were implemented.** Phase 4 (tasks 18–22: cross-platform testing, skill discovery testing, policy engine testing, command integration testing, end-to-end validation) was deferred as manual QA requiring a live Gemini CLI environment. Tasks 23–24 (deprecation audit, documentation & launch prep) were partially completed.

**Task-by-task status:**

| Task | Status | Notes |
|------|--------|-------|
| 1.0 Update Extension Manifest | Done | `engines.gemini-cli` already `>=0.30.0`; no experimental flags to remove; `planMode.enabled` added; matchers verified |
| 2.0 Update `.gemini/settings.json` | Done | File was already clean `{}`; no experimental flags present |
| 3.0 Clean Up Agent Definitions | Done | `delegate_to_agent` removed; tool lists updated for v0.30.0; agents simplified to skill-based coordination |
| 4.0 Create `omg-plan-mode.toml` | Done | Deny rules for writes at priority 500; allow rules for reads at priority 600; below security's 700–950 range |
| 5.0 Migrate Static Rules to Policies | Done (partial) | Dynamic prompt-keyword detection retained in `tool-filter.js` with documented justification; static agent-mode restrictions could not be migrated because they depend on runtime prompt content |
| 6.0 Simplify `before-tool.js` | Done | Static dangerous-command patterns and system path blocks removed; user-custom blocks + git checkpoints retained |
| 7.0 Update `session-start.js` | Done | Resume detection implemented; fresh vs. resume context paths extracted |
| 8.0 Simplify `phase-gate.js` | Done | Three-tier logic removed; advisory-only output; `findCurrentPhase` returns proper `{index, phase}` |
| 9.0 Update `ralph-retry.js` | Done | Circuit breaker budget extraction + enforcement added; turns-remaining indicator in retry messages |
| 10.0 Audit Existing Skills | Done | 11 skills audited; activation triggers added; v2.0 refs updated; template refs fixed |
| 11.0 Create `quick-fix` Skill | Done | Proper frontmatter, activation triggers, process steps, common fix patterns table |
| 12.0 Create `refactor` Skill | Done | Safety checklist, test-generation fallback, plan mode compatibility note |
| 13.0 Create `/omg:plan` Command | Done | Injects GEMINI.md, Conductor status, tech stack, PRD files; lists all 13 skills |
| 14.0 Create `/omg:review` Command | Done | Gathers staged + unstaged diff; follows code-review skill; handles empty diff |
| 15.0 Update Existing Commands | Done | setup, status, autopilot updated; conductor-setup redirected |
| 16.0 Update `omg-security.toml` | Done | 7 Windows-specific rules added; migration note for agent modes documented |
| 17.0 Update `hooks/hooks.json` | Done | Timeouts reconciled; descriptions aligned with manifest |
| 18–22 (Testing) | Not done | Manual QA — requires live CLI environment |
| 23.0 Deprecation Audit | Done | `delegate_to_agent`, `--allowed-tools`, `tools.enableHooks`, `experimental` all cleared from active code |
| 24.0 Documentation & Launch | Partial | README updated; version bumped to 1.0.0; docs/getting-started.md updated; CONTRIBUTING.md updated. Remaining: HOOKS.md update, GitHub release, npm publish, awesome-gemini-cli submission |

### Deviations

1. **Task 5.0 — tool-filter.js retained instead of removed.** The plan anticipated possible removal (task 5.4) but also specified a fallback path (task 5.7). The hook was retained because the v0.30.0 policy engine cannot express conditional rules based on prompt content. This was the correct decision per the plan's error-handling clause. The gap is clearly documented in `omg-security.toml` lines 199–220.

2. **`hooks/hooks.json` uses nested array structure vs. flat array in manifest.** The `hooks.json` file uses `{ "matcher": "...", "hooks": [...] }` nesting, while `gemini-extension.json` uses a flat array with inline `"matcher"` fields. Both formats appear valid for Gemini CLI, but this structural difference should be verified against the v0.30.0 extension loader. See finding in Section 7.

3. **`phaseGates.strict` deprecated but retained in config.** The manifest marks it as `[Deprecated]` with an explanation. The `config.default.json` still includes the field for backward compatibility. The `phase-gate.js` code no longer reads it. This is a clean deprecation.

---

## 2. Code Quality & Best Practices

### Bugs & Issues

1. **`session-start.js:57` — `isFeatureEnabled(config, 'contextInjection')` checks for `contextInjection.enabled` but the default config has no `enabled` field on `contextInjection`.** The default config (`config.js:111–123`) defines `contextInjection.conductorState: true` but no top-level `contextInjection.enabled`. The `isFeatureEnabled` function (`config.js:273`) looks for `${feature}.enabled`, which would return `false` (the default). This means **Conductor state injection is silently disabled** unless the user explicitly sets `contextInjection.enabled: true` in their config.

   **Severity:** High — This breaks a core feature (US-8: project status on resume).
   **Fix:** Either add `enabled: true` to `contextInjection` in `DEFAULT_CONFIG` and `config.default.json`, or change session-start.js to check `getConfigValue(config, 'contextInjection.conductorState', true)` directly.

2. **`ralph-retry.js:273` — `isRalphModeActive` only checks the prompt, not the response.** If Ralph was activated in a previous turn via `@ralph` and the current prompt doesn't contain the keyword, the hook won't fire. The check should also consider session state or a persistent flag.

   **Severity:** Medium — Ralph mode may deactivate unexpectedly between turns if the user doesn't repeat the keyword.
   **Impact:** Partially mitigated because the hook fires on AfterAgent (response analysis), not BeforeAgent, so it sees the current prompt. But multi-turn persistence is affected.

### Readability & Style

Code is clean and consistent across all hook files. Each file follows the same pattern:
- JSDoc header with event type, matcher, purpose
- `require` statements from shared `lib/`
- Named helper functions with JSDoc comments
- Single `async function main()` entry point
- Top-level try/catch with graceful fallback to `writeOutput({})`
- `main()` call at the end

This pattern is well-established and consistently applied. No style issues.

### Local Idiom Compliance

All hooks correctly use the project's established idioms:
- `readInput()` / `writeOutput()` from `lib/utils.js`
- `findProjectRoot(cwd)` for project root detection
- `loadConfig(projectRoot)` for cascading config
- `platform.isWindows` for platform detection
- `log()` and `debug()` for structured logging

### Naming Consistency

- **Good:** All hook names use `omg-` prefix consistently in both `gemini-extension.json` and `hooks.json`.
- **Good:** Configuration keys use consistent camelCase: `phaseGates`, `autoVerification`, `toolFilter`, etc.
- **Minor:** `session-start.js` uses `findCurrentTaskFromPlan` while `phase-gate.js` uses `findCurrentPhase`. Both serve similar purposes but naming diverges. Acceptable given different contexts.

### Refactoring Opportunities

- **`before-tool.js` is now very lean (162 lines).** The simplification was appropriate — removing static patterns was the correct migration. No further refactoring needed.
- **`ralph-retry.js` at 387 lines is the largest hook.** The circuit breaker addition (lines 216–264) is well-isolated. The file could benefit from extracting state management functions to a separate module, but this is not urgent.

---

## 3. AI-Specific Risk Assessment

### Logic & Correctness

1. **`ralph-retry.js` — Success detection is overly broad.** `detectsSuccess` (line 175) triggers on common words like "done", "created", "i have". An agent response like "I have tried but failed" would match "i have" and incorrectly reset attempts. The success check runs before the failure check (line 327), so a response containing both success and failure indicators would be treated as success.

   **Severity:** Medium — Could silently reset retry counter when the task isn't actually complete.
   **Fix:** Check for failure first, or require success indicators to not co-occur with failure indicators.

2. **`phase-gate.js:47` — Phase header regex is overly broad.** The pattern `/^#{2,3}\s*(?:Phase\s*\d+[:\s]*)?(.+)/i` matches any `##` or `###` header. In a plan.md with non-phase headers (e.g., `## Dependencies`, `## Notes`), these would be parsed as phases. This inflates the phase count and produces incorrect advisory messages.

   **Severity:** Low — Advisory-only, so no blocking behavior, but produces misleading status.
   **Fix:** Make the regex stricter, e.g., require "Phase" keyword or the configured phase names from `config.phaseGates.phases`.

### Resource Efficiency

- **`ralph-retry.js` reads and writes `ralph-state.json` on every AfterAgent hook invocation** (even when ralph is not active, due to `loadState` in `getAttemptCount`). However, the `isRalphModeActive` check (line 310) short-circuits before any file I/O, so this is not actually a problem. No unnecessary I/O detected.
- **`session-start.js` on fresh sessions loads Conductor plan from disk.** This is a single file read per session start — appropriate.
- **`before-tool.js` loads config on every matched tool call.** Config is loaded from up to 3 JSON files (extension defaults, user config, project config) per invocation. For hot paths (many file writes in sequence), this could be optimized with a config cache. However, given hook process isolation (each invocation is a new Node.js process), caching is not possible without IPC.

   **Severity:** Low — Each config load is ~3ms max, well within the 15s timeout.

### Control Flow Safety

- **All hooks have top-level try/catch** with `writeOutput({})` fallback. This ensures no unhandled exceptions crash the hook.
- **`before-tool.js:139` — `isGitRepo` and `hasUncommittedChanges` are called without try/catch.** These functions (from `lib/utils.js`) execute `git` commands via `execSync`. If `git` is not installed, `execSync` would throw, but the top-level catch handles this. Still, a more explicit check or documented assumption would be helpful.
- **`phase-gate.js:133–139` — Inner try/catch around `loadSessionOrGlobalPlan` is good practice.** Corrupt Conductor state won't crash the hook.
- **Null checks are present throughout.** `input.tool_name || ''`, `input.cwd || process.cwd()`, `toolInput.path || toolInput.file_path || toolInput.target_file || ''` — all defensive.

---

## 4. Codebase-Specific Pattern Compliance

### Hook Scripts (JavaScript/Node.js)

- **Protocol:** All hooks follow stdin JSON → process → stdout JSON. Verified in all 7 hook files.
- **Exit Codes:** `before-tool.js` correctly uses `process.exit(2)` for blocking decisions. Other hooks use `writeOutput()` with `decision: "deny"` in JSON. Both patterns are valid.
- **Shared Utilities:** All hooks consistently use `readInput`, `writeOutput`, `log`, `debug`, `findProjectRoot`, `platform` from `lib/utils.js`. Config loaded via `lib/config.js`.
- **Cross-Platform:** `platform.isWindows` is logged but path handling in `before-tool.js:70` uses `path.sep` and `path.join` correctly. Forward-slash normalization is applied for comparisons.
- **Timeouts:** Timeout values in `gemini-extension.json` and `hooks.json` are now aligned:
  - session-start: 5000ms (appropriate — config load + optional git check)
  - before-agent: 10000ms (appropriate — keyword detection + context injection)
  - before-tool: 15000ms (appropriate — git checkpoint can take time)
  - after-tool: 60000ms (appropriate — tsc + eslint can be slow)
  - tool-filter: 5000ms (appropriate — lightweight keyword detection)
  - phase-gate: 10000ms (appropriate — plan file parsing)
  - ralph-retry: 5000ms (appropriate — state file I/O + pattern matching)

### Skill Definitions (Markdown + YAML)

- **Frontmatter:** Both new skills (`quick-fix`, `refactor`) have proper YAML frontmatter with `name` and `description` fields. Descriptions use multiline YAML syntax (`|`).
- **Process Section:** Both skills have clear, numbered process steps with code examples.
- **Templates:** Neither new skill bundles templates, which is correct — they don't need them. The plan's task 10.2 (template verification for existing skills) was addressed during the audit.
- **Activation:** Triggers are clearly listed and match the plan's specifications:
  - quick-fix: "quick fix", "small fix", "patch", "hotfix", "just fix this"
  - refactor: "refactor", "restructure", "clean up", "reorganize", "simplify"

### Command Definitions (TOML)

- **Variables:** `plan.toml` and `review.toml` use `!{shell command}` syntax correctly for dynamic context injection. Multiple `!{...}` blocks are used for different data sources.
- **Description:** Both commands have clear `description` fields suitable for `/commands` listing.
- **Prompt Alignment:** `review.toml` explicitly references the `code-review` skill methodology. `plan.toml` bridges to `technical-planning` skill when a PRD exists.
- **`[tool_config]`:** Both new commands include `mode = "AUTO"`, which is correct for v0.30.0.
- **Note:** `conductor-setup.toml` redirect is clean — no shell commands, just informational text.

### Agent Definitions (Markdown)

- **Frontmatter:** All 4 agents have proper YAML frontmatter with `name`, `description`, `model`, and `tools` fields.
- **Access Control:**
  - researcher: limited to `web_fetch`, `google_web_search`, `read_file`, `list_directory`, `glob` — correctly read-only + web
  - architect: limited to `read_file`, `list_directory`, `glob`, `search_file_content` — correctly read-only
  - executor: full tool access — correct
  - orchestrator: full tool access — correct (coordinator role)
- **System Prompt:** Each agent has a clear role description. Removed delegation references are clean — no orphaned instructions.
- **Minor Note:** `researcher.md:21` says "enforced by policies" but tool filtering is actually enforced by the `tool-filter.js` hook (dynamic) not TOML policies. Technically inaccurate but not functionally harmful since both systems work together.

### Security Policies (TOML)

- **Priority:** Values are well-structured: security denies at 800–950, plan mode at 500–600, safe operations at 100–200. No priority conflicts.
- **Rules:** Windows-specific rules use `(?i)` for case-insensitive regex — correct for Windows command-line which is case-insensitive.
- **Specificity:** Most patterns are anchored with `^` to avoid false positives. The Unix `rm -rf` pattern (`"^rm\\s+-rf\\s+[/~.]"`) correctly requires the command to start with `rm`. The Windows `del` pattern is less anchored (`"(?i)^del\\s+/f\\s+.*([a-z]:\\\\windows|%systemroot%|%programfiles%)"`) but still reasonable.
- **`commandRegex` on write tools:** The `node_modules` and `.git` path protection rules use `commandRegex` on write tool names (`write_file`, `replace`, etc.). This assumes the policy engine applies `commandRegex` against the tool's input (file path argument). If `commandRegex` only matches shell commands, these rules would never fire. **This needs verification against the v0.30.0 policy engine documentation.**

   **Severity:** Medium — If `commandRegex` doesn't apply to file tool paths, the node_modules and .git write protections in TOML are inactive, though the user-custom blocked paths in `before-tool.js` via `omg-config.json` defaults still cover them.

### Configuration (JSON)

- **Extension Manifest:** `gemini-extension.json` is valid JSON. All referenced paths exist:
  - `commands/omg` — directory exists with 8 TOML files
  - `.gemini/agents` — directory exists with 4 .md files
  - `skills` — directory exists with 13 subdirectories
  - `policies` — directory exists with 2 .toml files
  - All 7 hook commands reference existing JS files
- **Hook Matchers:** Matchers reference valid v0.30.0 tool names: `write_file`, `replace`, `edit_file`, `create_file`, `run_shell_command`, `shell`.
- **Defaults:** Default config values in `config.default.json` and `DEFAULT_CONFIG` are sensible. However, see Bug #1 about `contextInjection.enabled` missing.
- **Version:** Consistently `1.0.0` across `package.json`, `gemini-extension.json`, `config.default.json`, and `hooks/lib/config.js`.

---

## 5. Testing Assessment

### Manual Validation

Not yet performed. Phase 4 (tasks 18–22) covers:
- Cross-platform hook testing (Unix + Windows)
- Skill discovery testing (`/skills list` + natural language activation)
- Policy engine integration testing
- Command integration testing
- End-to-end workflow validation

**Recommendation:** Execute Phase 4 before any release or documentation step.

### Hook Testing

All 10 JS files passed `node -c` syntax validation. Runtime testing against actual Gemini CLI hook protocol has not been performed.

### Cross-Platform

Code uses `path.join()`, `path.sep`, and `path.normalize()` consistently. `platform.isWindows` is available but is mostly used for logging. The `before-tool.js` path comparison (lines 70–71) correctly normalizes to forward slashes for cross-platform comparison. Windows-specific security rules were added to `omg-security.toml`.

### Edge Cases

- **Missing configs:** Handled by `loadConfigFile` returning `null` and `deepMerge` falling back to defaults.
- **Empty state files:** `ralph-retry.js:56-64` handles missing/corrupt state by returning `{ sessions: {} }`.
- **Malformed input:** All hooks use `|| ''` and `|| {}` default values on input fields.
- **Git not available:** `before-tool.js` only calls git functions inside `isGitRepo(projectRoot)` check. If git is not installed, `isGitRepo` would throw from `execSync`, caught by the outer try/catch.

### Regression

Not yet validated. The hook simplification (removing static patterns from `before-tool.js`) changes behavior — dangerous commands that were previously caught by the hook are now only caught by the policy engine. If the policy engine has different behavior (e.g., different regex engine, different matching scope), previously blocked commands could slip through.

---

## 6. Security & Performance

### Security

- **Hook timeout safety:** All hooks have configured timeouts in both `gemini-extension.json` and `hooks.json`. No internal timers are set to exit before the configured timeout, but the process isolation model (Gemini CLI kills the process on timeout) means this is handled externally.

- **stdin/stdout buffer handling:** `readInput()` (from `lib/utils.js`) reads all of stdin before parsing. If Gemini CLI sends extremely large inputs (e.g., a very long prompt response for ralph-retry), the hook would buffer the entire input in memory. This is a theoretical concern — in practice, hook inputs are bounded by Gemini CLI.

- **Shell command injection:** `before-tool.js` does not construct or execute shell commands from user input. It only reads `toolInput.command` for pattern matching. The git checkpoint uses `createGitCheckpoint` from `lib/utils.js`, which constructs the checkpoint name from a timestamp (`Date.toISOString()`), not user input. **No injection risk.**

- **File path traversal:** `before-tool.js:67` uses `path.relative(projectRoot, normalizedPath)` to scope path checks. An attacker could potentially craft a path like `../../etc/passwd`, but this would be caught by:
  1. The TOML policy engine (if `commandRegex` applies to file paths)
  2. The user-configured blocked paths in `omg-config.json`

  The hook itself doesn't construct file paths — it only validates them.

- **JSON parsing safety:** `readInput()` uses `JSON.parse()` which throws on malformed input. The top-level try/catch in each hook catches this and falls through to `writeOutput({})`. Safe.

- **Data leakage:** Error messages use generic descriptions (`"Security: Command blocked by user config"`) and don't leak file contents. `log()` and `debug()` output goes to stderr, not stdout (which is the hook response channel). Debug logging is gated behind `OMG_DEBUG` environment variable.

- **Credential exposure:** `before-agent.js` injects git diffs into context. The PRD notes this could include accidentally committed secrets. The current implementation does not filter for credential patterns. **This is a known gap per PRD Data Sensitivities table, not a regression from v1.0 changes.**

### Performance

- **Config loading on hot paths:** `before-tool.js` loads config from disk on every file write. This involves reading up to 3 JSON files (extension defaults, user config, project config). Each is <1KB. Total overhead: ~3–5ms. Acceptable given the 15s timeout.

- **Synchronous operations:** `isGitRepo()`, `hasUncommittedChanges()`, and `createGitCheckpoint()` use `execSync`. These could block for 100–500ms on large repos. Still well within the 15s timeout. The git checkpoint (stash push) is the most expensive operation.

- **`tool-filter.js` runs on every LLM request** (BeforeToolSelection). It loads config, scans the prompt for keywords, and builds a tool filter response. Total overhead: ~5–10ms. Appropriate for the 5s timeout.

- **No performance regressions** from v1.0 changes. The removal of static patterns from `before-tool.js` actually improves performance slightly (fewer regex matches).

---

## 7. Data Alignment

### JSON Schema Consistency

- **`gemini-extension.json` vs `hooks.json`:** The two files use different structures for hook registration:
  - `gemini-extension.json`: Flat array with inline `matcher` field on each hook
  - `hooks.json`: Nested `{ "matcher": "...", "hooks": [...] }` structure

  Both are valid, but they must be kept in sync manually. Currently they are aligned on names, commands, timeouts, descriptions, and matchers. **Risk:** Future edits to one file may not be reflected in the other. The manifest (`gemini-extension.json`) should be the source of truth.

- **`config.default.json` vs `DEFAULT_CONFIG` in `config.js`:** These are mostly aligned but have minor differences:
  - `config.default.json` has `"sessionPlanPath": null` (line 99) — not present in `DEFAULT_CONFIG`
  - `config.default.json` has additional trigger patterns in `ralph.triggerPatterns`: "can't figure out" and "doesn't work" — `DEFAULT_CONFIG` only has 5 patterns
  - `config.default.json` includes `bcdedit`, `diskpart`, `shutdown` in blockedCommands — `DEFAULT_CONFIG` does not

  These differences are intentional by design (config.default.json extends DEFAULT_CONFIG via deepMerge), but they could confuse developers who expect them to be identical.

### YAML Frontmatter

All agents and skills use consistent YAML frontmatter:
- Agents: `name`, `description`, `model`, `tools`
- Skills: `name`, `description`

No naming convention issues detected.

### TOML Key Conventions

- `omg-security.toml` uses: `toolName`, `commandRegex`, `decision`, `priority`, `deny_message`
- `omg-plan-mode.toml` uses the same field names
- Both are consistent and presumably aligned with v0.30.0 policy engine schema

### Hook Input/Output Contract

- **SessionStart:** Input `{ session_id, session_type, cwd }` → Output `{ hookSpecificOutput?, systemMessage? }` — correct
- **BeforeAgent:** Input `{ llm_request, session_id, cwd }` → Output `{ systemMessage?, hookSpecificOutput? }` — correct
- **BeforeTool:** Input `{ tool_name, tool_input, cwd }` → Output `{}` (allow) or exit code 2 + stderr (deny) — correct
- **AfterTool:** Input `{ tool_name, tool_output, cwd }` → Output `{ systemMessage? }` — correct
- **BeforeToolSelection:** Input `{ llm_request, session_id, cwd }` → Output `{ hookSpecificOutput: { toolConfig } }` — correct
- **AfterAgent:** Input `{ prompt, prompt_response, session_id, cwd }` → Output `{ systemMessage? }` (phase-gate) or `{ decision: "deny", reason }` (ralph-retry) — correct

### Null/Undefined Handling

All hooks defensively handle missing fields with `||` defaults. `loadConfigFile` returns `null` on failure. `deepMerge` handles `null` source objects via the `result[key] || {}` fallback in `config.js:143`.

---

## 8. Documentation Readiness

### Code Comments

- **All hook files have comprehensive JSDoc headers** documenting event type, matcher, purpose, input/output format, and cross-platform compatibility.
- **All exported functions have JSDoc comments** with `@param` and `@returns` annotations.
- **`tool-filter.js` lines 12–18** have an important architectural comment explaining why the hook coexists with TOML policies. This is excellent documentation for future maintainers.
- **`omg-security.toml` lines 199–220** document the agent mode migration gap clearly.

### Function/API Documentation

All public functions in hook files and `lib/config.js` have JSDoc comments. Coverage is good.

### Clarity

The codebase is largely self-documenting. Variable names are descriptive (`blockedCommands`, `circuitBreakerBudget`, `turnsRemaining`). The code reads well without excessive inline comments.

### Documentation Needs for Step 4

The following documentation tasks remain:

1. **`docs/HOOKS.md`** — Needs update to reflect:
   - Simplified `before-tool.js` (static rules moved to policy)
   - Advisory-only `phase-gate.js`
   - Circuit breaker awareness in `ralph-retry.js`
   - `tool-filter.js` retained with dynamic-only role

2. **Configuration reference** — The full set of `omg-config.json` options should be documented, including the `contextInjection`, `ralph`, `toolFilter`, and `debug` sections.

3. **Policy reference** — Document the two TOML policy files, their priority ranges, and how they interact with hooks.

4. **Migration guide** — For users upgrading from pre-v1.0, document what changed (e.g., `phaseGates.strict` deprecated, `conductor-setup` redirected).

---

## 9. Final Assessment & Recommendations

### Overall Quality

**Good with minor issues** — The implementation is solid, well-structured, and closely follows the technical plan. One high-severity bug (contextInjection.enabled missing) and a few medium-severity logic issues need attention before documentation. The codebase is clean, consistently patterned, and well-documented.

### Business Impact Summary

**What works well:**
- Hook-enforced security gates (both static via TOML and dynamic via hooks) provide defense-in-depth
- The skill system is well-organized with clear activation triggers and process steps
- New commands (`/omg:plan`, `/omg:review`) provide immediate user value
- Circuit breaker awareness in Ralph mode prevents runaway retries
- Cross-platform path handling is robust
- The advisory-only phase gate simplification removes user friction while preserving visibility

**What risks exist:**
- The `contextInjection.enabled` bug means Conductor state is not injected on session start by default. Users would not see project status on fresh sessions — a core value proposition of US-8.
- The ralph success/failure detection ordering could cause premature retry resets, leading to the AI appearing to give up earlier than expected.
- If `commandRegex` in TOML policies doesn't apply to file tool paths, the node_modules/.git write protections are only enforced through the config-based blocked paths, not the policy engine.

**What would happen if this shipped as-is:**
- Most features would work correctly for the majority of users
- Conductor integration would appear broken on fresh sessions (Bug #1)
- Ralph mode would occasionally reset its retry counter prematurely (false success detection)
- The extension would be functional but would not deliver the "install and go" promise for the Conductor workflow without fixing Bug #1

### AI-Aware Verification Checklist

- [x] **Negative Paths**: All hooks have top-level try/catch with graceful fallback. Missing config, corrupt state, and absent git are handled. Error paths tested via code review.
- [x] **Concurrency**: No shared mutable state between hooks (each is a separate Node.js process). Ralph state file uses simple read-modify-write (not concurrent-safe, but hooks don't run concurrently for the same event).
- [x] **Security Defaults**: Credential patterns not filtered from git diff injection (known gap from PRD). No PII handling. Security policies use well-defined patterns.
- [x] **Data Drift**: Code uses Node.js built-in `path`, `fs`, `child_process` — no deprecated APIs. TOML policy format aligned with v0.30.0 documentation.

### Actionable Feedback

**Critical (Must Fix Before Documentation):**

1. **`contextInjection.enabled` missing from default config**
   - **What:** `session-start.js` calls `isFeatureEnabled(config, 'contextInjection')` which checks for `contextInjection.enabled`, but the default config doesn't define this field. Result: Conductor state injection is silently disabled.
   - **Why it matters:** Users won't see project status on session start — a core feature (US-8). This makes the "install and go" experience incomplete.
   - **How to fix:** Add `enabled: true` to the `contextInjection` section in both `DEFAULT_CONFIG` in `hooks/lib/config.js` and `hooks/config.default.json`.

**High Priority (Should Fix Before Documentation):**

2. **Ralph success/failure detection ordering**
   - **What:** `detectsSuccess` runs before `detectsFailure` in `ralph-retry.js:327-339`. Responses containing both success ("i have") and failure indicators could be incorrectly classified as success.
   - **Why it matters:** Ralph mode is a key differentiator (US-7). Premature retry resets make it less reliable.
   - **How to fix:** Either (a) check failure first and only check success if no failure detected, or (b) use a scoring approach where both are checked and the stronger signal wins.

3. **Verify `commandRegex` applicability to file tool paths**
   - **What:** `omg-security.toml` applies `commandRegex` patterns (e.g., `node_modules`, `.git`) to file write tools. If the policy engine only evaluates `commandRegex` against shell commands, these rules are inactive.
   - **Why it matters:** Protected path enforcement for node_modules and .git depends on this. If TOML rules don't fire, the only protection is the `omg-config.json` blocked paths in `before-tool.js`.
   - **How to fix:** Test against a live v0.30.0 Gemini CLI. If `commandRegex` doesn't apply to file tools, either use a different field (if available) or rely on the hook-based protection and remove the misleading TOML rules.

**Medium Priority (Should Fix Soon):**

4. **`researcher.md` says "enforced by policies" but enforcement is by hook**
   - **What:** Agent descriptions say tool restrictions are "enforced by policies", but the actual enforcement mechanism is the `tool-filter.js` hook using dynamic prompt-keyword detection.
   - **Why it matters:** Misleading documentation could confuse maintainers trying to understand how agent sandboxing works.
   - **How to fix:** Change to "enforced by hooks and policies" or "enforced by tool-filter hook".

5. **Phase-gate regex matches all `##`/`###` headers**
   - **What:** `parsePhases` in `phase-gate.js:47` treats any H2/H3 header as a phase, even non-phase headers like "## Notes" or "## Dependencies".
   - **Why it matters:** Phase count and advisory messages could be inaccurate.
   - **How to fix:** Require "Phase" keyword in the header, or filter against the configured phase names from `config.phaseGates.phases`.

6. **Dual hook registration files require manual sync**
   - **What:** `gemini-extension.json` and `hooks/hooks.json` both define hook registrations with different JSON structures but must stay aligned.
   - **Why it matters:** Future edits to one file may create silent inconsistencies.
   - **How to fix:** Add a validation step (e.g., a simple node script) that verifies both files are in sync. Or document which file is authoritative.

**Low Priority (Nice to Have):**

7. **`config.default.json` and `DEFAULT_CONFIG` differences**
   - **What:** Minor differences in blocked commands list and ralph trigger patterns between the two config sources.
   - **Why it matters:** Developer confusion when comparing sources.
   - **How to fix:** Add a comment in `config.js` noting that `config.default.json` extends `DEFAULT_CONFIG` via deepMerge.

8. **Ralph multi-turn persistence**
   - **What:** Ralph mode requires the `@ralph` keyword in each prompt to stay active.
   - **Why it matters:** Users may expect Ralph to persist across turns without repeating the keyword.
   - **How to fix (future):** Store Ralph activation state in `ralph-state.json` alongside attempts, and check it on each turn.

---

*Review generated following the code review process defined in `docs/command_steps/3_code_review.md`.*
