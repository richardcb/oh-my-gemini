# SQLite backend decision (PRD 0007)

## Decision

Use a fallback chain for memory SQLite access:

1. `node:sqlite` (preferred)
2. `better-sqlite3` (fallback)

## Rationale

- Keeps the zero-install path for modern Node runtimes via `node:sqlite`.
- Improves compatibility when `node:sqlite` is unavailable.
- Preserves the existing synchronous memory API used by hooks and MCP server.
- Both drivers support the required SQLite/WAL/FTS5 model.

## Risk and fallback

- If neither `node:sqlite` nor `better-sqlite3` is available, memory initialization fails with a clear error and hooks remain fail-open (normal behavior continues without memory writes).
- `better-sqlite3` is a native module and may require platform-compatible binaries or a build toolchain.

## Operational guidance

- Recommended runtime: Node version with built-in `node:sqlite`.
- Alternate runtime: install `better-sqlite3` in environments lacking `node:sqlite`.
