# oh-my-gemini v1.0 — Product Requirements Document

**Author:** richardcb
**Date:** February 26, 2026
**Status:** Draft
**Target:** Gemini CLI v0.30.0+

---

## Project Overview

oh-my-gemini (OMG) v1.0 is a Gemini CLI extension that provides structured, docs-first development workflows through curated skills, opinionated policies, smart commands, and hook-enforced behavior. It transforms Gemini CLI from a general-purpose AI assistant into a disciplined software engineering partner.

v1.0 represents a strategic pivot from the original multi-agent orchestration vision to a **"batteries-included workflow layer"** that leverages Gemini CLI's maturing native primitives (plan mode, policy engine, skills, hooks) rather than fighting them. Multi-agent orchestration is deferred to a future release pending upstream subagent stabilization.

**One-line pitch:** *oh-my-zsh for Gemini CLI — install it, and your AI coding workflow instantly levels up.*

**Competitive edge:** OMG is the only extension that uses hook-enforced behavior (infrastructure-level, not prompt-level). Competitors rely on prompts the model can ignore. 

### Design Principles

1. **Install and go** — `/omg:setup` is the only required step. Everything else works automatically.
2. **Leverage native, don't replace** — Use plan mode, policy engine, and skill discovery as foundations. Add value on top.
3. **Enforce, don't suggest** — Hooks enforce behavior (security gates, auto-verification). Skills suggest workflows.
4. **Progressive complexity** — Casual users get skills + commands. Power users configure hooks and policies.

---

## User Stories

### Casual User (First-time installer)

- **US-1:** As a developer installing OMG for the first time, I want to run `/omg:setup` and have a working configuration in under 2 minutes so that I can start using enhanced workflows immediately.
- **US-2:** As a developer, I want dangerous shell commands (e.g., `rm -rf /`, `format c:`) to be blocked automatically so that I don't accidentally destroy my system when the AI makes mistakes.
- **US-3:** As a developer, I want my code to be automatically typechecked and linted after every file change so that I catch errors before they compound.

### Workflow User (Daily driver)

- **US-4:** As a developer starting a new feature, I want to use the `prd-creation` skill to convert my vague idea into a structured PRD so that I have a clear spec before writing code.
- **US-5:** As a developer with a PRD, I want to use the `technical-planning` skill to generate a phased implementation plan so that I can execute incrementally without missing steps.
- **US-6:** As a developer, I want to run `/omg:review` to trigger a structured code review so that I get consistent, checklist-based feedback on my changes.
- **US-7:** As a developer working on a long task, I want persistence mode ("Ralph") to automatically retry failed approaches so that the AI doesn't give up after one failure.
- **US-8:** As a developer, I want `/omg:status` to show me the current state of my project (active tracks, plan mode status, recent git activity) so that I can resume work across sessions.

### Power User (Configuration customizer)

- **US-9:** As a power user, I want to customize hook behavior via `omg-config.json` (e.g., disable auto-verification for a legacy project) so that OMG adapts to my project's needs.
- **US-10:** As a power user, I want to define custom security policies in TOML so that I can extend OMG's guardrails for my organization's requirements.
- **US-11:** As a power user running OMG on Windows, I want all hooks and commands to work identically to Unix so that I don't hit platform-specific failures.

---

## Functional Requirements

### Skills

1. The system must provide 13 skills discoverable via Gemini CLI's native `/skills list` command and natural language activation.
2. Each skill must bundle its own templates within the skill directory (no external template references that could fail).
3. All skill instructions must not contain references to `delegate_to_agent` or other deprecated subagent APIs.
4. The `quick-fix` skill must enable targeted code fixes without requiring a full planning workflow.
5. The `refactor` skill must provide a structured refactoring workflow that includes pre-refactor safety checks (tests pass, git clean state).

### Commands

6. `/omg:setup` must detect the project type from the filesystem (e.g., presence of `package.json`, `Cargo.toml`, `pyproject.toml`) and generate an appropriate `GEMINI.md`.
7. `/omg:plan` must activate Gemini CLI's native plan mode while injecting OMG skill context (available skills, active Conductor tracks).
8. `/omg:review` must trigger the `code-review` skill with the current git diff as context.
9. `/omg:status` must display: GEMINI.md state, active Conductor tracks, plan mode status, recent git activity, and next suggested action.
10. `/omg:autopilot` must use native plan mode for task decomposition before execution.

### Hooks

11. The `before-tool.js` hook must create a git checkpoint (stash or commit) before any file-modifying tool call, providing rollback capability.
12. The `after-tool.js` hook must run TypeScript type-checking and ESLint (when detected in the project) after every file-modifying tool call, injecting errors into the agent's context.
13. The `before-agent.js` hook must inject relevant context (git history for bug-fix prompts, recently changed files for continuation prompts, active Conductor task info).
14. The `ralph-retry.js` hook must suggest alternative approaches on failure and respect v0.30.0 circuit breaker limits (`MAX_TURNS=15`, `MAX_TIME_MINUTES=5`).
15. All hooks must complete within their configured timeout or fail gracefully (no hang, no crash, no orphan processes).

### Policies

16. `omg-security.toml` must block dangerous commands and protect system paths using the native Policy Engine format.
17. Static tool restrictions currently in `tool-filter.js` must be migrated to TOML policies; the hook must only retain dynamic, context-aware filtering.
18. `omg-plan-mode.toml` must define tool restrictions appropriate for plan mode (read-only tools allowed, write tools blocked).

### Extension Manifest

19. `gemini-extension.json` must declare `engines.gemini-cli` as `>=0.30.0`.
20. The manifest must not contain `experimental` flags for stable features (skills, hooks).
21. Hook matchers must reference v0.30.0 centralized tool names.

### Cross-Platform

22. All hooks must produce identical behavior on Unix (macOS, Linux) and Windows.
23. Shell commands in hooks must use `hooks/lib/platform.js` for platform-aware execution.
24. Path handling must use `path.sep` or `path.join()` — no hardcoded `/` or `\` separators.

---

## AI Guardrails: Domain Context & Invariants

### Business Invariants

These rules must **never** be violated:

1. **Hook timeout enforcement** — No hook may block Gemini CLI for longer than its configured timeout. If a hook exceeds its timeout, it must exit with a non-blocking failure (warning, not crash).
2. **Read-only skill discovery** — Skills must never modify files during discovery/listing. Side effects are only permitted during explicit skill invocation.
3. **Git checkpoint before write** — The `before-tool.js` hook must always create a git checkpoint before file modifications. If git is unavailable or the checkpoint fails, the hook must warn but not block the tool call.
4. **No credential exposure** — Hooks must never log, emit, or inject file contents that match credential patterns (API keys, tokens, passwords) into agent context.
5. **Policy engine precedence** — When a TOML policy and a hook conflict on tool access, the TOML policy wins (native enforcement is authoritative).

### Data Sensitivities

| Data Type | Handling Requirement |
|-----------|---------------------|
| Git diffs injected by `before-agent.js` | May contain secrets committed by accident — hook should filter lines matching common secret patterns before injection |
| Session state (Conductor tracks, plan progress) | Stored in project-local markdown files — no remote transmission, no PII |
| `omg-config.json` user preferences | May contain org-specific policy paths — must not be committed to extension repo |
| Hook stderr/stdout | May contain file paths with usernames — should not be persisted beyond the session |

### Failure State Definitions

| Failure Scenario | Expected Behavior |
|------------------|-------------------|
| **Hook crashes (unhandled exception)** | Gemini CLI skips the hook and continues. Hook must use try/catch at top level to prevent unhandled rejections. |
| **Hook times out** | Gemini CLI kills the hook process. The tool call proceeds without hook intervention. Hooks should use internal timers shorter than the configured timeout to exit cleanly. |
| **Skill template missing** | Skill must detect the missing template and provide inline fallback content rather than referencing a nonexistent file path. |
| **Policy engine rejects a tool call** | The rejection is surfaced to the user as a Gemini CLI error. OMG hooks are not invoked for rejected calls. |
| **`tsc` or `eslint` not installed** | `after-tool.js` must detect the absence and skip verification silently (no error injection). |
| **Git not available** | `before-tool.js` skips checkpoint creation and logs a warning. `before-agent.js` skips git history injection. |
| **`omg-config.json` malformed** | `hooks/lib/config.js` must fall back to `config.default.json` and log a warning. |

---

## Non-Goals (v1.0)

- Multi-agent orchestration / swarm mode
- A2A (Agent-to-Agent) integration
- TypeScript runtime layer
- Parallel execution
- MCP server bundling (keep as optional config)
- SDK-based programmatic API (watch for official SDK maturity)
- Custom UI/UX beyond CLI output (no TUI, no web dashboard)
- Replacing the official Conductor extension (OMG complements it)

---

## Technical & Design Considerations

### Tech Stack

- **Runtime:** Node.js (hooks are `.js` files executed by Gemini CLI's hook runner)
- **Configuration:** TOML (policies, commands), Markdown with YAML frontmatter (skills, agents), JSON (extension manifest, hook config)
- **Platform layer:** `hooks/lib/platform.js` for cross-platform shell/path normalization
- **No external dependencies:** All hooks and skills are self-contained; no `node_modules` at runtime

### Extension Architecture

```
gemini-extension.json          ← Entry point; declares all extension points
├── commands/omg/*.toml        ← User-facing commands (8 total)
├── skills/*/SKILL.md          ← Skill definitions with bundled templates (13 total)
├── hooks/*.js + hooks/lib/    ← Hook scripts + shared libraries (7 hooks, 3 libs)
├── policies/*.toml            ← Security and plan-mode policies (2 total)
└── .gemini/agents/*.md        ← Agent definitions (4, de-emphasized in v1.0)
```

### CLI UX Considerations

- Command names follow `omg:<verb>` convention (e.g., `/omg:setup`, `/omg:plan`, `/omg:review`)
- Hook output uses concise, single-line status messages (no multi-line banners that clutter the terminal)
- Error messages from hooks include the hook name and a suggested fix (e.g., `[omg:after-tool] tsc not found — skipping type check. Install TypeScript to enable.`)
- `/omg:status` output is formatted as a readable summary, not raw JSON

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Install-to-first-command | < 2 minutes |
| `/omg:setup` works on fresh project | 100% — creates GEMINI.md, detects project type |
| All skills activate on v0.30.0 | 100% — tested against skill discovery tiers |
| Hooks pass on Unix + Windows | 100% — CI validated |
| No deprecated API usage | 0 — no `--allowed-tools`, no `delegate_to_agent`, no `tools.enableHooks` |
| GitHub stars within 30 days of launch | 25+ |
| Listed on awesome-gemini-cli | Yes |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| v0.30.0 hook format changes break existing hooks | Medium | High | Test early in Phase 1; pin to stable hook API |
| Native 5-phase plan mode makes phase-gate hook redundant | High | Medium | Simplify to advisory-only; focus on Conductor track awareness instead |
| Policy engine doesn't support all tool-filter use cases | Low | Medium | Keep tool-filter hook as fallback for dynamic cases |
| Competitor ships before us | Medium | Low | We have npm names + differentiated hook approach |
| Official SDK matures and obsoletes extension approach | Low (not v1.0 timeframe) | High | Monitor SDK PRs; plan v2.0 around SDK if it stabilizes |

---

## Future Considerations (v2.0+)

- **Multi-agent orchestration** when subagents stabilize
- **SDK integration** when official Gemini CLI SDK matures
- **Steering hints** integration (experimental in v0.30.0, "1 of 3")
- **A2A remote agents** for distributed workflows
- **Custom reasoning models** support (v0.30.0 added `--model` flexibility)
- **Memory system** integration (v0.30.0 added autoconfigure memory settings)

---

*Hook-enforced workflows. Deterministic behavior. OMG.*
