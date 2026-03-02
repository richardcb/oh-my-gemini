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
  parsePhases,
  findCurrentPhase,
  platform
} = require('./lib/utils');
const { loadConfig, isFeatureEnabled, getConfigValue } = require('./lib/config');

// Import mode state for mode-aware phase gates
let readModeState, composeModeProfile;
try {
  const ms = require('../dist/lib/mode-state');
  readModeState = ms.readModeState;
  const mc = require('../dist/lib/mode-config');
  composeModeProfile = mc.composeModeProfile;
} catch (err) {
  debug(`Failed to load mode-state/mode-config: ${err.message}. Using config-only phase gates.`);
  readModeState = null;
  composeModeProfile = null;
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

    // Mode-aware: only fire for modes with phaseGates.enabled (implement by default)
    if (readModeState && composeModeProfile) {
      const sessionId = input.session_id || 'default';
      const modeState = readModeState(sessionId, projectRoot);
      const profile = composeModeProfile(modeState.primary, modeState.modifiers);

      if (profile.phaseGates && profile.phaseGates.enabled === false) {
        log(`Mode ${modeState.primary}: phase gates disabled, skipping`);
        writeOutput({});
        return;
      }
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
