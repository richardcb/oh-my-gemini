# Code Review: oh-my-gemini v0.30.0 Alignment (PRD 0002)

**Reviewer:** AI Code Review (Senior Engineer)
**Date:** 2026-02-27
**Technical Plan:** `docs/PRD/tasks_0002_prd_v030_alignment.md`
**Scope:** Full alignment of oh-my-gemini extension with Gemini CLI v0.30.0

---

## 1. Plan Implementation Assessment

### Correctness

The technical plan defined 22 top-level tasks across 4 phases. All phases have been addressed:

| Phase | Tasks | Status | Notes |
|-------|-------|--------|-------|
| Phase 1: Investigation & Discovery | 1.0–6.0 | Complete | Findings captured in decision records |
| Phase 2: Code Alignment | 7.0–13.0 | Complete | All code changes applied |
| Phase 3: Policy Format Alignment | 14.0–16.0 | Complete | TOML migration + new plan-mode policy |
| Phase 4: Testing & Decision Records | 17.0–22.0 | Complete | Three decision records produced |

**Verified against plan task-by-task:**

- **Task 7.0** (Manifest): Engine bumped to `>=0.30.0` (line 19), agents path corrected to `.gemini/agents` (line 25), experimental block removed. **Correct.**
- **Task 8.0** (Settings): `.gemini/settings.json` is now `{}` — all experimental flags removed. **Correct.**
- **Task 9.0** (ask_user): `phase-gate.js:147-167` implements `isAskUserAvailable()` detection, and lines 262-284 implement the three-tier gate. **Correct.**
- **Task 10.0** (Session plan): `hooks/lib/utils.js:208-235` implements `resolveSessionPlanPath()` with three candidate paths. Used by both `session-start.js:74-91` and `phase-gate.js:204-219`. **Correct.**
- **Task 11.0** (Status command): `commands/omg/status.toml:32-33` added session plan detection shell check. **Correct.**
- **Task 12.0** (Masking): All hooks (`before-agent.js`, `after-tool.js`, `session-start.js`) use dual-channel injection (`additionalContext` + `systemMessage`). **Correct.**
- **Task 13.0** (Skills): Skill files updated to document `ask_user` verification. **Correct per plan.**
- **Task 14.0** (Security TOML): All `commandPrefix` rules converted to `commandRegex`. **Correct.**
- **Task 15.0** (Plan-mode TOML): `policies/omg-plan-mode.toml` created with deny/allow rules at priority 500/600. **Correct.**
- **Task 16.0** (Tool filter): Retained per investigation findings. **Correct.**
- **Task 21.0** (Decision records): All three records produced with Context → Decision → Consequences format. **Correct.**

### Deviations

1. **Task 10.5** called for a `sessionPlanPath` override key in `config.default.json`. The key is present (line 99: `"sessionPlanPath": null`) but `resolveSessionPlanPath()` in `utils.js` does not read this config value — it only checks hardcoded candidate paths. This is a **minor gap**: the config key exists but is dead configuration.

2. **Task 10.6** called for graceful handling of empty/malformed session plan files. The current code in `phase-gate.js:208` reads the file with `fs.readFileSync` and wraps it in try/catch, which handles read errors but does not explicitly check for empty content. An empty file would produce an empty `conductor.plan` string, which would result in `parsePhases()` returning `[]`, causing the hook to exit cleanly. This is **acceptable** — the behavior is safe even if not explicitly checked.

3. **Task 17.0** (Validate v1.0 assumptions): The plan called for annotating the v1.0 plan with `✅ Verified` or `❌ Falsified` markers. There is no evidence this annotation was applied to `tasks_PRD-v1.0.md`. This is a **documentation gap**, not a code issue.

---

## 2. Code Quality & Best Practices

### Bugs & Issues

1. **`session-start.js:79` — Redundant `require()` inside function body.** The `calculateProgress` function is already available from the top-level `require('./lib/utils')` at line 20, but the session plan loading block re-requires it on line 79:
   ```js
   const { calculateProgress } = require('./lib/utils');
   ```
   This works (Node.js caches modules), but it's inconsistent — `calculateProgress` is not destructured in the top-level import (line 20-30). The function should either be imported at the top or removed from the inline require. **Severity: Low.**

2. **`session-start.js:78` — `require('fs')` inline.** Similarly, `fs` is required inline (`require('fs').readFileSync`) instead of at the top of the file. `phase-gate.js` (which does the same session plan loading) correctly imports `fs` at the top (line 21). **Severity: Low** — functional but inconsistent.

3. **`before-tool.js:80` — Fork bomb regex mismatch.** The regex pattern `:()\{\s*:\|:&\s*\};:` uses unescaped parentheses `()` which are treated as a capture group, not literal characters. The fork bomb is `:(){ :|:& };:` and the regex should escape the parens: `:\(\)\{`. In `omg-security.toml:46` the regex is correct (`^:\\(\\)\\{\\s*:\\|:&\\s*\\};:`), but the in-hook pattern does not match correctly. **Severity: Medium** — this specific pattern is unlikely to be triggered by the hook (the TOML policy catches it first), but it's still a logic error.

4. **`ralph-retry.js:33-34` — In-memory `Map` is per-process, not per-session.** Each hook invocation spawns a new Node.js process, so `attemptTracker` is always empty. The `incrementAttempts()` function will always return 1. Ralph retry cannot actually track multiple attempts across hook invocations. **Severity: High** — this is a fundamental logic error. The attempt counter needs filesystem-based or environment-variable-based persistence.

### Readability & Style

- **Consistent across all files.** JSDoc comments on all public functions. Consistent error handling pattern (try/catch → log → `writeOutput({})`).
- **Debug/log separation** is clean: `log()` for operational messages, `debug()` for verbose trace.
- **Module structure** is well-organized: `lib/` for shared utilities, each hook in its own file.

### Local Idiom Compliance

- All hooks follow the stdin JSON → process → stdout JSON protocol correctly.
- Exit code 2 used for blocking (`before-tool.js:195, 209`). Exit code 0 (implicit) for all non-blocking paths.
- `writeOutput({})` used consistently for no-op responses.

### Naming Consistency

- `sessionId` vs `session_id`: The hook input uses `session_id` (snake_case, per CLI protocol). Internal variables use `sessionId` (camelCase). This is consistent throughout — CLI protocol in, JS convention internally. **Good.**
- `conductor` variable naming is consistent across `phase-gate.js`, `session-start.js`, and `before-agent.js`.
- `projectRoot` used consistently (never `rootDir` or `baseDir`).

### Refactoring Opportunities

1. **Session plan loading is duplicated** between `session-start.js:74-91` and `phase-gate.js:204-219`. Both blocks:
   - Check `sessionId`
   - Call `resolveSessionPlanPath()`
   - Read the file with `fs.readFileSync`
   - Build a `conductor` object with `active`, `trackName`, `plan`, `progress`
   - Fall back to `loadConductorState()`

   This could be extracted to a `loadSessionOrGlobalPlan(sessionId, projectRoot)` utility in `lib/utils.js`. **Priority: Medium** — reduces duplication and risk of divergence.

2. **Verification keyword matching** is duplicated between `hasVerificationTask()` (line 111-119) and `isVerificationComplete()` (line 127-137) in `phase-gate.js`. Both search for the same keywords. A single helper (`findVerificationTask()`) that returns the task or null would eliminate this. **Priority: Low.**

---

## 3. AI-Specific Risk Assessment

### Logic & Correctness

1. **`phase-gate.js:253-257` — Phase boundary detection logic.** The code considers all tasks complete if every task is either `completed` or contains "verification"/"conductor" in its text. This means a task like "Update verification docs" would be excluded from the completion check even if it's a real work item. This is a **moderate risk** — phase gate could trigger prematurely if a non-verification task contains the word "verification" in its description. Recommendation: tighten the keyword match to be more specific (e.g., match tasks that *start with* "Verification:" or "Conductor checkpoint").

2. **`detectAgentMode()` in `utils.js:294-318` — Implicit mode detection is aggressive.** Keywords like "plan", "design", "review", and "analyze" trigger architect mode. A user prompt like "help me plan my vacation app" would engage architect mode's restricted tool set. This could silently prevent write operations when the user expects full access. **Severity: Medium** — the explicit `@researcher`/`@architect` markers are fine, but implicit keyword detection has a high false-positive risk.

3. **`ralph-retry.js:103-121` — Success detection is too broad.** Words like "done", "here is the", and "i have" are common in normal responses that may not indicate task completion. A response like "I have encountered an issue" would match "i have" and reset the retry counter. **Severity: Medium** — could cause premature success detection.

### Resource Efficiency

1. **`after-tool.js` runs tsc on every file write.** For a large TypeScript project, `tsc --noEmit` can take 10-30 seconds. With a 60-second hook timeout and potential for multiple file writes in succession, this could cause significant latency. The hook does check for `tsconfig.json` existence, but doesn't batch or debounce. **Severity: Medium** — performance impact on large projects.

2. **`before-agent.js:114` — `loadConductorState()` is called on every agent invocation.** This reads the filesystem (directory listing + file read). It's not cached between hook invocations (each is a new process). For the `BeforeAgent` event which fires frequently, this is acceptable but could be optimized with a short-lived cache file. **Severity: Low** — filesystem ops are fast for small directories.

### Control Flow Safety

- All hooks have top-level try/catch with `writeOutput({})` fallback. **Good** — no hook can crash and leave the CLI hanging.
- `readInput()` in `utils.js` has a 1-second timeout, preventing indefinite stdin blocking. **Good.**
- `resolveSessionPlanPath()` handles missing directories gracefully with try/catch around `fs.existsSync()`. **Good.**
- `isAskUserAvailable()` handles both string and object tool declarations. **Good** — defensive against schema changes.

---

## 4. Codebase-Specific Pattern Compliance

### Hook Scripts (JavaScript/Node.js)

| Check | Status | Notes |
|-------|--------|-------|
| stdin JSON → process → stdout JSON protocol | Pass | All hooks use `readInput()` → logic → `writeOutput()` |
| Exit codes (0=success, 2=block) | Pass | `before-tool.js` uses `process.exit(2)` for blocks |
| Shared utilities from `hooks/lib/` | Pass | All hooks import from `lib/utils.js` and `lib/config.js` |
| Cross-platform via `platform.js` | Pass | Platform detection and command normalization used throughout |
| Appropriate timeouts | Pass | Manifest: 5-60s range, config: 30s verification timeout |

### Command Definitions (TOML)

| Check | Status | Notes |
|-------|--------|-------|
| Shell variables use `!{shell}` syntax | Pass | `status.toml` uses `!{cat ...}`, `!{ls ...}`, etc. |
| Description present | Pass | Line 3: clear description |
| `tool_config` section | Pass | `mode = "AUTO"` specified |

**Issue in `status.toml:27`:** The command `find conductor/tracks -name "metadata.json" -exec cat {} \\;` is Unix-specific. On Windows, `find` is a completely different command (string search). The cross-platform `!{...}` shell execution relies on the CLI's shell, which may be cmd.exe on Windows. **Severity: Medium** — the command will silently fail (the `|| echo "NO_TRACKS"` fallback catches it), but the status report will show "NO_TRACKS" even when tracks exist on Windows.

### Security Policies (TOML)

| Check | Status | Notes |
|-------|--------|-------|
| Priority values appropriate (0-999) | Pass | Range: 100 (read allow) to 950 (fork bomb deny) |
| commandRegex used (not commandPrefix) | Pass | All 10 rules use `commandRegex` |
| Specificity (no false positives) | Partial | See issues below |

**Policy regex issues:**

1. **`omg-security.toml:30` — `sudo\\s+rm` lacks `^` anchor.** This matches `sudo rm` anywhere in a command string, which is correct for security (catches piped commands), but also matches comments or echo statements containing the literal text. Low risk of false positive since these are shell commands.

2. **`omg-security.toml:106` — Protected path regex uses JSON format.** The regex `"path":\\s*"/(etc|usr|...)/"` assumes the tool input is a JSON string containing a `"path"` field. This is fragile — if the CLI sends tool input in a different format, or the field name changes, this rule will not match. **Severity: Medium** — the `before-tool.js` hook has its own path checking as a backup, but the policy rule's effectiveness depends on tool input format.

3. **`omg-plan-mode.toml` — Blanket deny on `run_shell_command` may be too broad.** Read-only shell commands like `git log`, `cat`, `ls` are blocked. While the plan-mode allow rules grant `read_file`/`list_dir`/`glob`, users who rely on shell commands for read operations will be blocked. The plan acknowledges this is a "static policy that must be manually loaded/unloaded" which mitigates the concern. **Severity: Low.**

### Configuration (JSON)

| Check | Status | Notes |
|-------|--------|-------|
| `gemini-extension.json` valid and consistent | Pass | All hook names, matchers, and paths are consistent |
| Hook matchers reference correct tool names | Pass | `write_file|replace|edit_file|create_file|run_shell_command|shell` |
| Default config values sensible | Pass | Verification timeout 30s, max retries 5, etc. |

**Minor inconsistency:** `gemini-extension.json` version is `2.0.1` (line 3) but `package.json` version is `0.0.1` (line 3). These should be synchronized. **Severity: Low** — `package.json` is not the canonical version source for Gemini CLI extensions, but it could confuse contributors.

---

## 5. Testing Assessment

| Check | Status | Notes |
|-------|--------|-------|
| Manual CLI validation | Unclear | No test artifacts or logs found |
| Hook JSON output correctness | Assumed | Hooks follow established patterns |
| Cross-platform testing | Partial | Platform.js is comprehensive; actual testing evidence absent |
| Edge cases (missing configs, empty state) | Good | All hooks handle missing/empty state gracefully |
| Regression on related features | Unclear | No regression test evidence |

**Key testing gaps:**

1. **`ralph-retry.js` attempt tracking is broken** (see Bug #4 above). This was likely not tested beyond a single invocation.
2. **`status.toml` `find` command** was likely not tested on Windows.
3. **`omg-security.toml` regex rules** — no evidence of regex validation against test strings as called for in plan task 14.3.

---

## 6. Security & Performance

### Security

| Check | Status | Notes |
|-------|--------|-------|
| Hook timeout safety | Pass | All hooks have configurable timeouts (5-60s) |
| stdin/stdout buffer handling | Pass | 10MB `maxBuffer` on execSync; 1s stdin timeout |
| Shell command injection | Good | `escapeShellArg()` in platform.js handles quoting |
| File path traversal | Good | `isBlockedPath()` normalizes and checks against blocklist |
| JSON parsing safety | Pass | `readInput()` wraps `JSON.parse` in try/catch |
| Data leakage in errors | Pass | Error messages logged to stderr only (debug mode) |

**Potential concern:** `before-tool.js:187` checks for tool names `run_shell_command` and `execute_command`. If v0.30.0 introduces a new tool name for shell execution (e.g., `shell`), the security gate could be bypassed. The manifest matcher includes `shell` but the JS code does not. **Severity: Medium** — add `'shell'` to the if-condition on line 186.

### Performance

| Check | Status | Notes |
|-------|--------|-------|
| Repeated file I/O | Acceptable | Each hook invocation is a separate process; no cross-invocation caching possible |
| Synchronous operations | Acceptable | `execSync` used for git/npm — hooks are synchronous by nature |
| Hot path overhead | Low | `BeforeToolSelection` fires every turn but `tool-filter.js` is lightweight |

**Performance note:** The `AfterTool` hook running full `tsc --noEmit` on every file write is the most significant performance concern. For a project with hundreds of TypeScript files, this adds 5-30 seconds per write. Consider adding a debounce mechanism (e.g., only run typecheck if N seconds have passed since last check).

---

## 7. Data Alignment

### JSON Schema Consistency

| Config File | Version | Notes |
|-------------|---------|-------|
| `gemini-extension.json` | 2.0.1 | Canonical version |
| `config.default.json` | 2.0.1 | Matches |
| `hooks/lib/config.js` DEFAULT_CONFIG | 2.0.1 | Matches |
| `package.json` | 0.0.1 | **Mismatch** |

### Hook Input/Output Contract

All hooks follow the same I/O pattern:
- **Input:** JSON from stdin with `cwd`, `session_id`, and event-specific fields
- **Output:** JSON to stdout with optional `decision`, `reason`, `systemMessage`, `hookSpecificOutput`

The `hookSpecificOutput` structure varies by hook event type:
- `BeforeToolSelection`: `{ toolConfig: { mode, allowedFunctionNames } }`
- `BeforeAgent`/`AfterTool`: `{ additionalContext: string }`
- `SessionStart`: `{ additionalContext: string }`

These are consistent with the Gemini CLI hook protocol as documented.

### Null/Undefined Handling

- `resolveSessionPlanPath()` returns `{ path: null, source: null }` when no session plan found — callers check `sessionPlan.path` before using. **Good.**
- `loadConductorState()` returns `null` when no conductor directory exists — callers check for null. **Good.**
- `calculateProgress()` returns `{ completed: 0, total: 0, percentage: 0 }` for null/empty input. **Good.**

---

## 8. Documentation Readiness

### Code Comments

- All public functions have JSDoc with `@param` and `@returns` tags. **Good.**
- File-level comments describe event, purpose, input/output format. **Good.**
- No comments needed for straightforward logic — the code is largely self-documenting.

### Decision Records

All three decision records follow the prescribed format:
- `ask-user-verification.md`: Context → Decision → Limitations → Consequences
- `tool-filter-migration.md`: Context → Investigation Findings → Decision → Consequences
- `masking-compatibility.md`: Context → Investigation Findings → Decision → Consequences

### Documentation Needs for Step 4

1. **README.md update** needed to document the v0.30.0 minimum requirement and what it means for users upgrading.
2. **CHANGELOG** entry for the v2.0.1 alignment release.
3. **`sessionPlanPath` config key** in `config.default.json` is undocumented in `hooks/README.md`.
4. **Ralph retry broken state** should be documented as a known issue until fixed.

---

## 9. Final Assessment & Recommendations

### Overall Quality

**Good with minor issues.** The implementation is thorough, well-structured, and correctly addresses all 22 tasks in the technical plan. Code quality is high with consistent patterns, comprehensive error handling, and thoughtful cross-platform support. The issues identified are fixable without architectural changes.

### Business Impact Summary

**What works well:**
- The extension is properly aligned with Gemini CLI v0.30.0 — engine requirement, policy format, hook protocol, and feature flags are all updated.
- The three-tier `ask_user` verification provides a smooth upgrade path: users on v0.30.0 get native interactive verification, while older CLI versions gracefully fall back.
- Dual-channel context injection (additionalContext + systemMessage) is a smart approach to the masking compatibility challenge.
- Security policies are comprehensive with proper priority ordering.
- Cross-platform support is genuinely production-quality.

**Risks if issues aren't fixed:**
- **Ralph retry is non-functional** — the in-memory `Map` resets on every hook invocation. Users who depend on persistence mode will find it never retries more than once. This is a user-experience issue, not a data-loss risk.
- **Shell tool name gap in `before-tool.js`** — if the CLI sends `shell` instead of `run_shell_command`, the JS security gate is bypassed (the TOML policy still catches most dangerous commands, but the hook's path protection and git checkpoints won't fire).
- **Implicit agent mode detection** could silently restrict tools when users don't expect it — leading to confusion when write operations appear to fail for no reason.

**If this shipped as-is:**
- The extension would work correctly for the majority of use cases. Security policies, phase gates, context injection, and tool filtering would all function. The primary user-facing issue is Ralph retry not persisting across invocations, and occasional false-positive tool filtering from implicit keyword detection.

### AI-Aware Verification Checklist

- [x] **Negative Paths**: All hooks have try/catch with graceful empty-object fallback. Missing config, missing files, and malformed JSON are handled.
- [ ] **Concurrency**: Not applicable — each hook is a single-threaded Node.js process.
- [x] **Security Defaults**: Security handled via both TOML policies (authoritative) and JS hooks (defense in depth). No credentials or PII handling.
- [ ] **Data Drift**: `commandPrefix` has been fully migrated to `commandRegex`. No deprecated patterns remain in the TOML files. However, the `hooks.json` legacy format is maintained for backward compatibility — this should be monitored for schema drift.

### Actionable Feedback

**Critical (Must Fix Before Documentation):**

1. **Ralph retry attempt tracking is broken** (`ralph-retry.js:33-34`)
   - **What:** The `attemptTracker` Map is in-memory. Each hook invocation is a new process, so the Map is always empty. Retry count never exceeds 1.
   - **Why:** Users who activate Ralph/persistence mode expect it to retry up to `maxRetries` times. Currently it retries at most once, then resets.
   - **Fix:** Persist attempt count to a file (e.g., `.gemini/ralph-state.json`) or use a process-environment-based mechanism. The state file should include session ID and timestamp for cleanup.

2. **`before-tool.js:186` — Missing `shell` tool name check**
   - **What:** The security gate checks for `run_shell_command` and `execute_command` but the manifest matcher also includes `shell`. If the CLI sends a tool call with name `shell`, the hook's command-blocking and path-protection logic is bypassed.
   - **Why:** Security bypass — dangerous commands could execute without the hook's defense-in-depth checks. The TOML policy provides a first line of defense, but the hook's regex patterns and git checkpoints won't fire.
   - **Fix:** Add `|| toolName === 'shell'` to the condition on line 186.

**High Priority (Should Fix Before Documentation):**

3. **Session plan loading duplication** (`session-start.js:74-91` vs `phase-gate.js:204-219`)
   - **What:** The session-plan-loading logic (check sessionId → resolveSessionPlanPath → readFileSync → build conductor object → fallback to loadConductorState) is copy-pasted between two hooks.
   - **Why:** If the loading logic needs to change (e.g., new candidate path, different fallback behavior), it must be updated in two places. This is a maintenance risk.
   - **Fix:** Extract to `loadSessionOrGlobalPlan(sessionId, projectRoot)` in `lib/utils.js`. Both hooks call the shared function.

4. **`session-start.js` — Inline requires for `fs` and `calculateProgress`** (lines 78-79)
   - **What:** `fs` and `calculateProgress` are required inline instead of at the top of the file, unlike every other hook.
   - **Why:** Inconsistent code style; `calculateProgress` is already available from the top-level import chain but not destructured.
   - **Fix:** Add `fs` and `calculateProgress` to the top-level imports.

5. **`sessionPlanPath` config key is dead** (`config.default.json:99`)
   - **What:** The `sessionPlanPath: null` key exists in config but `resolveSessionPlanPath()` never reads it. Plan task 10.5 specified this as a user override.
   - **Why:** Users who set this config value expect it to work. Dead config is confusing.
   - **Fix:** In `resolveSessionPlanPath()`, check the config's `sessionPlanPath` value first (if non-null, check that path before the hardcoded candidates). Or remove the key from `config.default.json` if the feature is deferred.

**Medium Priority (Should Fix Soon):**

6. **Implicit agent-mode detection has high false-positive risk** (`utils.js:308-315`)
   - **What:** Keywords like "plan", "design", "review", "analyze" trigger restricted tool access (architect mode) even in normal prompts.
   - **Why:** A user saying "help me design a button" would get restricted to read-only tools, silently preventing implementation.
   - **Fix:** Consider requiring explicit `@researcher`/`@architect` prefixes for tool restriction, or adding a confirmation mechanism. At minimum, add a log/systemMessage when implicit mode is detected so users understand why tools are restricted.

7. **`status.toml:27` — `find` command is Unix-only**
   - **What:** `find conductor/tracks -name "metadata.json" -exec cat {} \\;` doesn't work on Windows (Windows `find` searches file contents, not names).
   - **Why:** The status command will report "NO_TRACKS" on Windows even when tracks exist.
   - **Fix:** Use a platform-agnostic approach, e.g., `ls conductor/tracks/*/metadata.json 2>/dev/null` or add a Windows-specific `dir` fallback.

8. **`omg-security.toml:106` — Protected path regex is fragile**
   - **What:** The regex `"path":\\s*"/(etc|usr|...)/"` assumes JSON tool input format with a `"path"` field.
   - **Why:** If the CLI changes tool input serialization or field names, this rule silently stops matching.
   - **Fix:** Since `before-tool.js` already has robust path checking, consider removing this TOML rule (it's redundant) or simplifying it to match just the path string without JSON structure assumptions.

9. **`phase-gate.js:253-257` — Verification task keyword matching is too broad**
   - **What:** Any task containing "verification" or "conductor" is excluded from the completion check, even if it's a real work task.
   - **Why:** A task like "Update verification docs" or "Fix conductor integration" would be excluded, causing the phase gate to trigger prematurely.
   - **Fix:** Tighten the match — require the task to start with "Verification:" or "Conductor checkpoint", or use a dedicated `[v]` marker instead of keyword scanning.

**Low Priority (Nice to Have):**

10. **`before-tool.js:80` — Fork bomb regex has unescaped parentheses**
    - **What:** The regex `:()\{\s*:\|:&\s*\};:` treats `()` as a capture group, not literal characters.
    - **Why:** The pattern won't match the actual fork bomb string `:(){ :|:& };:`. The TOML policy catches this first, so impact is minimal.
    - **Fix:** Change to `:\(\)\{\s*:\|:&\s*\};:` (escape the parentheses).

11. **Version mismatch between `gemini-extension.json` and `package.json`**
    - **What:** Extension manifest says `2.0.1`, package.json says `0.0.1`.
    - **Why:** Could confuse contributors or tooling that reads `package.json`.
    - **Fix:** Synchronize `package.json` version to `2.0.1`.

12. **`hooks.json` timeout discrepancies with manifest**
    - **What:** `hooks.json` SessionStart timeout is 15000ms; manifest is 5000ms. `hooks.json` BeforeToolSelection timeout is 10000ms; manifest is 5000ms.
    - **Why:** If the CLI reads `hooks.json` instead of the manifest, hooks get different timeouts.
    - **Fix:** Synchronize timeouts between the two files, or add a comment noting which is canonical.

13. **`after-tool.js` — No debounce for typecheck on rapid file writes**
    - **What:** Every file write triggers a full `tsc --noEmit` run.
    - **Why:** Performance degradation on large TypeScript projects with rapid sequential writes.
    - **Fix:** Consider a timestamp-based debounce (e.g., skip if last typecheck was < 10 seconds ago) stored in a temp file.

---

*Review complete. The implementation is solid and well-aligned with the v0.30.0 technical plan. Address the two critical issues (Ralph retry persistence and `shell` tool name gap) before proceeding to documentation.*
