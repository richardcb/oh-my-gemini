#!/usr/bin/env node
/**
 * oh-my-gemini Phase Gate Hook (Advisory Only)
 *
 * Event: AfterAgent
 * Fires: After every agent response
 *
 * Purpose:
 * - Parse active track's plan.md and detect current phase
 * - Emit an advisory systemMessage with phase progress
 * - Never blocks or denies responses (enforcement is handled by
 *   Gemini CLI's native plan-mode policies in v0.30.0+)
 *
 * Input: { prompt, prompt_response, stop_hook_active, session_id, cwd, ... }
 * Output: { systemMessage? }
 *
 * Cross-platform compatible (Windows/macOS/Linux)
 */

const path = require('path');
const {
  readInput,
  writeOutput,
  log,
  debug,
  findProjectRoot,
  loadSessionOrGlobalPlan,
  platform
} = require('./lib/utils');
const { loadConfig, isFeatureEnabled, getConfigValue } = require('./lib/config');

/**
 * Parse phases from plan content.
 * Only matches headers that explicitly contain "Phase" (e.g., "## Phase 1: Data Layer")
 * or match one of the configured phase names. Generic headers like "## Notes" are ignored.
 * @param {string} planContent - Plan markdown content
 * @param {string[]} configuredPhases - Phase names from config (e.g., ['data-layer', 'backend', ...])
 * @returns {object[]} Array of phase objects with name, tasks, completed, total
 */
function parsePhases(planContent, configuredPhases = []) {
  if (!planContent) return [];

  const phases = [];
  const lines = planContent.split('\n');

  // Build a set of lowercase configured phase names for fast lookup
  const knownPhases = new Set(configuredPhases.map(p => p.toLowerCase()));

  let currentPhase = null;

  for (const line of lines) {
    // Primary: match explicit "Phase N:" headers — e.g., "## Phase 1: Data Layer"
    const explicitMatch = line.match(/^#{2,3}\s*Phase\s*\d+[:\s]+(.+)/i);
    if (explicitMatch) {
      if (currentPhase) {
        phases.push(currentPhase);
      }
      currentPhase = {
        name: explicitMatch[1].trim(),
        tasks: [],
        completed: 0,
        total: 0
      };
      continue;
    }

    // Fallback: match H2/H3 headers whose text matches a configured phase name
    if (knownPhases.size > 0) {
      const headerMatch = line.match(/^#{2,3}\s+(.+)/);
      if (headerMatch) {
        const headerText = headerMatch[1].trim().toLowerCase();
        // Check if this header matches any configured phase name (case-insensitive, partial)
        const isKnown = [...knownPhases].some(p =>
          headerText.includes(p) || p.includes(headerText)
        );
        if (isKnown) {
          if (currentPhase) {
            phases.push(currentPhase);
          }
          currentPhase = {
            name: headerMatch[1].trim(),
            tasks: [],
            completed: 0,
            total: 0
          };
          continue;
        }
      }
    }

    // Match tasks within phase
    if (currentPhase) {
      const taskMatch = line.match(/^[\s]*-\s*\[([ xX])\]\s*(.+)$/);
      if (taskMatch) {
        const isComplete = taskMatch[1].toLowerCase() === 'x';
        currentPhase.tasks.push({
          text: taskMatch[2].trim(),
          completed: isComplete
        });
        currentPhase.total++;
        if (isComplete) {
          currentPhase.completed++;
        }
      }
    }
  }

  // Don't forget the last phase
  if (currentPhase) {
    phases.push(currentPhase);
  }

  return phases;
}

/**
 * Find the index and data of the current phase (first incomplete phase).
 * @param {object[]} phases - Array of phase objects
 * @returns {{ index: number, phase: object } | null}
 */
function findCurrentPhase(phases) {
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].completed < phases[i].total) {
      return { index: i, phase: phases[i] };
    }
  }
  // All complete -- return the last phase
  if (phases.length > 0) {
    return { index: phases.length - 1, phase: phases[phases.length - 1] };
  }
  return null;
}

/**
 * Main hook logic
 */
async function main() {
  try {
    const input = await readInput();
    const cwd = input.cwd || process.cwd();

    log('PhaseGate hook fired');
    debug(`Platform: ${platform.isWindows ? 'Windows' : 'Unix'}`);

    // Find project root
    const projectRoot = findProjectRoot(cwd);

    // Load configuration
    const config = loadConfig(projectRoot);

    // Check if phase gates are enabled
    if (!isFeatureEnabled(config, 'phaseGates')) {
      log('Phase gates are disabled');
      writeOutput({});
      return;
    }

    // Load plan state: session-specific first, then global Conductor
    const sessionId = input.session_id || null;
    let conductor;
    try {
      conductor = loadSessionOrGlobalPlan(sessionId, projectRoot, config);
    } catch (err) {
      // Corrupt/missing state -- skip silently
      log(`Conductor state unreadable, skipping: ${err.message}`);
      writeOutput({});
      return;
    }

    if (!conductor || !conductor.active || !conductor.plan) {
      log('No active Conductor track');
      writeOutput({});
      return;
    }

    // Parse phases from plan, using configured phase names for matching
    const configuredPhases = getConfigValue(config, 'phaseGates.phases', []);
    const phases = parsePhases(conductor.plan, configuredPhases);

    if (phases.length === 0) {
      log('No phases found in plan');
      writeOutput({});
      return;
    }

    // Find current phase
    const current = findCurrentPhase(phases);

    if (!current) {
      writeOutput({});
      return;
    }

    const { index, phase } = current;
    const remaining = phase.total - phase.completed;
    const phaseNumber = index + 1;
    const totalPhases = phases.length;

    log(`Current phase: ${phase.name} (${phase.completed}/${phase.total})`);

    // Advisory-only output
    const advisory = `[omg:phase-gate] Phase ${phaseNumber}/${totalPhases}: ${phase.name} — ${remaining} task${remaining !== 1 ? 's' : ''} remaining`;

    writeOutput({
      systemMessage: advisory
    });
  } catch (err) {
    log(`PhaseGate hook error: ${err.message}`);
    // Don't fail the hook
    writeOutput({});
  }
}

main();
