# Conductor Memory System

`oh-my-gemini` v2.0 adds a track-aware memory layer for cross-session continuity.

## Overview

The memory system stores typed observations in a local SQLite database:

- Location: `~/.oh-my-gemini/memory.db`
- Scope: current project's Conductor tracks
- Access pattern: write from hooks, read on-demand via `omg_memory_*` tools

The design is intentionally **pull-based**: hooks write compact observations, and agents query only what they need.

## SQLite Runtime Compatibility

Memory uses a driver fallback chain:

1. `node:sqlite` (preferred)
2. `better-sqlite3` (fallback)

If neither driver is available, memory writes/reads are skipped (fail-open hook behavior) and the error is logged.

## Observation Writers

These hooks write observations when `memory.enabled` is true:

- `phase-gate.js` → `phase_complete`
- `after-tool.js` → `verification_failure` (with consecutive-signature merge)
- `ralph-retry.js` → `retry_attempt`, `stuck_escalation`
- `session-start.js` → `session_start` (includes file checksums)
- `/omg:remember` → `decision` (manual, user-driven)

Writes are fail-open: hook behavior continues even if memory I/O fails.

## Retrieval Tools

`hooks/omg-memory-server.js` exposes:

- `omg_memory_search`
- `omg_memory_timeline`
- `omg_memory_get`
- `omg_memory_drift`
- `omg_memory_status`

Health endpoint: `GET /health`.

## Drift Detection

`session-start` writes file checksums for tracked files. `omg_memory_drift`:

1. Loads latest `session_start`
2. Recomputes checksums for tracked files
3. Reports modified/deleted/new files
4. Includes `git log` entries since last session

## Configuration

Add/override in `.gemini/omg-config.json`:

```json
{
  "memory": {
    "enabled": true,
    "dbPath": "~/.oh-my-gemini/memory.db",
    "mcpPort": 37888,
    "maxObservationsPerTrack": 500,
    "checksumFiles": "auto",
    "autoStart": true
  }
}
```

## Commands

- `/omg:remember`
- `/omg:memory-status`
- `/omg:memory-prune`
