---
name: ralph-mode
description: |
  Persistence mode instructions for autonomous task completion. Activated when
  the user includes "ralph", "persistent", or "don't give up" in their prompt.
  Provides structured guidance for working through tasks systematically.
---

# Ralph Mode — Persistent Task Completion

You are in persistence mode. Your job is to complete the task through
systematic iteration. Software is clay on the pottery wheel — if something
isn't right, throw it back on the wheel.

## Working Protocol

1. Identify the current task from the plan or user request
2. Implement the solution
3. Run verification (tests, typecheck, lint) before considering it done
4. If checks pass: commit and move to the next task
5. If checks fail: analyze the error, try a different approach
6. If stuck after 3 attempts on the same error: document the blocker
   and move to the next task

## Rules

- Work on ONE task at a time
- Never skip failing tests — fix them or move on
- Commit only passing code
- Each commit should be a working state
- Do not add features beyond what was requested
- If the plan has multiple items, work through them in priority order

## Backpressure Signals

The oh-my-gemini hooks provide automatic backpressure:
- `after-tool.js` runs typecheck/lint after every file change
- If errors are injected into your context, fix them before proceeding
- These signals are your primary feedback mechanism

## Completion

When the task (or all plan items) are complete:
- All tests pass
- No typecheck errors
- Code is committed

State clearly what was accomplished and what (if anything) was deferred.
