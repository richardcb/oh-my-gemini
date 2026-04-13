/**
 * oh-my-gemini Mode State Manager
 *
 * Resolves, persists, and reads mode state per session.
 * State is written by before-agent.js and read by all downstream hooks.
 *
 * State path: .gemini/omg-state/{sessionId}/mode.json
 */

import * as fs from "fs";
import * as path from "path";
import { detectMagicKeywords } from "./keyword-registry";
import {
  VALID_PRIMARY_MODES,
  VALID_MODIFIERS,
} from "./mode-config";
import type { PrimaryMode, Modifier, ModeState } from "./mode-types";
import { DEFAULT_MODE_STATE } from "./mode-types";

// Re-export for hook consumers
export { DEFAULT_MODE_STATE } from "./mode-types";

// --- Constants ---

/** Stale state threshold: 24 hours in ms */
export const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// --- Debug helper ---

function debugLog(message: string): void {
  if (process.env.OMG_DEBUG === "1" || process.env.OMG_DEBUG === "true") {
    process.stderr.write(`[omg:debug] ${message}\n`);
  }
}

// --- Path helpers ---

/**
 * Get the directory for mode state files.
 */
function getStateDir(projectRoot: string): string {
  return path.join(projectRoot, ".gemini", "omg-state");
}

/**
 * Get the path to a session's mode.json.
 */
export function getStatePath(sessionId: string, projectRoot: string): string {
  return path.join(getStateDir(projectRoot), sessionId, "mode.json");
}

// --- Core API ---

/**
 * Resolve mode from user prompt via keyword detection.
 *
 * Calls detectMagicKeywords from keyword-registry, then maps the result
 * to a ModeState object. Does NOT reimplement keyword scanning.
 *
 * @param prompt - User prompt string
 * @returns ModeState with resolved primary mode, modifiers, timestamp, and source
 */
export function resolveModeFromPrompt(prompt: string): ModeState {
  const keywordResult = detectMagicKeywords(prompt);

  if (!keywordResult) {
    return {
      primary: "implement",
      modifiers: [],
      resolvedAt: new Date().toISOString(),
      source: "default",
    };
  }

  // Validate primary mode
  const primary = VALID_PRIMARY_MODES.includes(keywordResult.primary as PrimaryMode)
    ? (keywordResult.primary as PrimaryMode)
    : "implement";

  // Validate modifiers
  const modifiers = keywordResult.modifiers.filter((m): m is Modifier =>
    (VALID_MODIFIERS as readonly string[]).includes(m),
  );

  return {
    primary,
    modifiers,
    resolvedAt: new Date().toISOString(),
    source: "keyword",
  };
}

/**
 * Write mode state to disk for the given session.
 *
 * Creates directories recursively if missing. Uses write-to-temp-then-rename
 * for Windows safety (reduces file locking window).
 *
 * @param sessionId - Session identifier (or "default")
 * @param state - Mode state to persist
 * @param projectRoot - Project root directory
 */
export function writeModeState(
  sessionId: string,
  state: ModeState,
  projectRoot: string,
): void {
  const filePath = getStatePath(sessionId, projectRoot);
  const dir = path.dirname(filePath);

  try {
    fs.mkdirSync(dir, { recursive: true });

    const content = JSON.stringify(state, null, 2);
    const tmpPath = filePath + ".tmp";

    fs.writeFileSync(tmpPath, content, "utf8");

    try {
      fs.renameSync(tmpPath, filePath);
    } catch {
      // rename can fail on some Windows configs; fall back to direct write
      fs.writeFileSync(filePath, content, "utf8");
      try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup failure */ }
    }

    debugLog(`writeModeState: wrote ${filePath}`);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    const code = error.code || "";
    if (code === "EACCES" || code === "EPERM") {
      debugLog(`writeModeState: permission denied writing ${filePath}`);
    } else if (code === "ENOSPC") {
      debugLog(`writeModeState: no space left on device`);
    } else {
      debugLog(`writeModeState: failed to write ${filePath}: ${error.message}`);
    }
  }
}

/**
 * Read mode state from disk for the given session.
 *
 * Returns DEFAULT_MODE_STATE on any failure (missing file, bad JSON,
 * unrecognized mode, stale state).
 *
 * @param sessionId - Session identifier (or "default")
 * @param projectRoot - Project root directory
 * @returns Validated ModeState
 */
export function readModeState(
  sessionId: string,
  projectRoot: string,
): ModeState {
  const filePath = getStatePath(sessionId, projectRoot);

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);

    // Validate primary
    if (!parsed.primary || !VALID_PRIMARY_MODES.includes(parsed.primary)) {
      debugLog(`readModeState: unrecognized primary "${parsed.primary}", using default`);
      return { ...DEFAULT_MODE_STATE, resolvedAt: new Date().toISOString() };
    }

    // Validate modifiers
    const modifiers = Array.isArray(parsed.modifiers)
      ? parsed.modifiers.filter((m: string) =>
          (VALID_MODIFIERS as readonly string[]).includes(m),
        )
      : [];

    // Check staleness
    if (parsed.resolvedAt) {
      const resolvedTime = new Date(parsed.resolvedAt).getTime();
      if (!isNaN(resolvedTime) && Date.now() - resolvedTime > STALE_THRESHOLD_MS) {
        debugLog(`readModeState: state is stale (>${STALE_THRESHOLD_MS}ms old)`);
        return { ...DEFAULT_MODE_STATE, resolvedAt: new Date().toISOString() };
      }
    }

    return {
      primary: parsed.primary as PrimaryMode,
      modifiers: modifiers as Modifier[],
      resolvedAt: parsed.resolvedAt || "",
      source: parsed.source === "keyword" ? "keyword" : "default",
      baseline: typeof parsed.baseline === "number" ? parsed.baseline : null,
      bestMetric: typeof parsed.bestMetric === "number" ? parsed.bestMetric : null,
    };
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code !== "ENOENT") {
      debugLog(`readModeState: failed to read ${filePath}: ${error.message}`);
    }
    return { ...DEFAULT_MODE_STATE, resolvedAt: new Date().toISOString() };
  }
}

/**
 * Clean stale session state directories.
 *
 * Removes session directories under .gemini/omg-state/ where mode.json
 * is older than STALE_THRESHOLD_MS or unreadable.
 *
 * @param projectRoot - Project root directory
 * @returns Number of cleaned directories
 */
export function cleanStaleState(projectRoot: string): number {
  const stateDir = getStateDir(projectRoot);
  let cleaned = 0;

  try {
    if (!fs.existsSync(stateDir)) {
      return 0;
    }

    const entries = fs.readdirSync(stateDir);
    const now = Date.now();

    for (const entry of entries) {
      const sessionDir = path.join(stateDir, entry);

      try {
        const stat = fs.statSync(sessionDir);
        if (!stat.isDirectory()) continue;

        const modePath = path.join(sessionDir, "mode.json");
        let shouldClean = false;

        try {
          const content = fs.readFileSync(modePath, "utf8");
          const parsed = JSON.parse(content);
          const resolvedTime = new Date(parsed.resolvedAt).getTime();
          shouldClean = isNaN(resolvedTime) || now - resolvedTime > STALE_THRESHOLD_MS;
        } catch {
          // Can't read or parse — treat as stale
          shouldClean = true;
        }

        if (shouldClean) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          cleaned++;
        }
      } catch {
        // Skip entries we can't stat
      }
    }

    if (cleaned > 0) {
      debugLog(`cleanStaleState: removed ${cleaned} stale session(s)`);
    }
  } catch (err: unknown) {
    const error = err as Error;
    debugLog(`cleanStaleState: failed to scan ${stateDir}: ${error.message}`);
  }

  return cleaned;
}
