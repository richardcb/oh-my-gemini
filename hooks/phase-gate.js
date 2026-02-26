#!/usr/bin/env node
/**
 * oh-my-gemini Phase Gate Hook
 *
 * Event: AfterAgent
 * Fires: After every agent response
 *
 * Purpose:
 * - Parse active track's plan.md
 * - Detect if phase boundary was crossed
 * - Force verification pause at phase gates
 * - Reject response if agent skips verification
 *
 * Input: { prompt, prompt_response, stop_hook_active, session_id, cwd, ... }
 * Output: { decision?: "deny", reason? }
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
 * Parse phases from plan content
 * @param {string} planContent - Plan markdown content
 * @returns {object[]} Array of phase objects with name, tasks, completed
 */
function parsePhases(planContent) {
  if (!planContent) return [];
  
  const phases = [];
  const lines = planContent.split('\n');
  
  let currentPhase = null;
  
  for (const line of lines) {
    // Match phase headers: ## Phase 1: Data Layer or ### Data Layer
    const phaseMatch = line.match(/^#{2,3}\s*(?:Phase\s*\d+[:\s]*)?(.+)/i);
    
    if (phaseMatch) {
      // Save previous phase
      if (currentPhase) {
        phases.push(currentPhase);
      }
      
      currentPhase = {
        name: phaseMatch[1].trim(),
        tasks: [],
        completed: 0,
        total: 0
      };
      continue;
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
 * Find the current phase (first incomplete phase)
 * @param {object[]} phases - Array of phase objects
 * @returns {object|null} Current phase or null
 */
function findCurrentPhase(phases) {
  for (const phase of phases) {
    if (phase.completed < phase.total) {
      return phase;
    }
  }
  return phases[phases.length - 1] || null;
}

/**
 * Check if a verification task exists for a phase
 * @param {object} phase - Phase object
 * @returns {boolean} True if phase has verification task
 */
function hasVerificationTask(phase) {
  if (!phase || !phase.tasks) return false;
  
  return phase.tasks.some(task => 
    task.text.toLowerCase().includes('verification') ||
    task.text.toLowerCase().includes('conductor') ||
    task.text.toLowerCase().includes('manual verification') ||
    task.text.toLowerCase().includes('checkpoint')
  );
}

/**
 * Check if phase verification is complete
 * @param {object} phase - Phase object
 * @returns {boolean} True if verification task is marked complete
 */
function isVerificationComplete(phase) {
  if (!phase || !phase.tasks) return true;
  
  const verificationTask = phase.tasks.find(task => 
    task.text.toLowerCase().includes('verification') ||
    task.text.toLowerCase().includes('conductor') ||
    task.text.toLowerCase().includes('manual verification') ||
    task.text.toLowerCase().includes('checkpoint')
  );
  
  return verificationTask ? verificationTask.completed : true;
}

/**
 * Detect whether ask_user is available in the current hook input.
 * Gemini CLI v0.30.0+ may expose available tools via `available_tools`
 * or `tool_declarations` fields on the hook input object.
 * @param {object} input - Raw hook input
 * @returns {boolean} True if ask_user tool is listed
 */
function isAskUserAvailable(input) {
  // Check available_tools array (preferred field name)
  if (Array.isArray(input.available_tools)) {
    return input.available_tools.some(t => {
      if (typeof t === 'string') return t === 'ask_user';
      if (t && typeof t === 'object') return t.name === 'ask_user';
      return false;
    });
  }

  // Check tool_declarations array (alternate field name)
  if (Array.isArray(input.tool_declarations)) {
    return input.tool_declarations.some(t => {
      if (typeof t === 'string') return t === 'ask_user';
      if (t && typeof t === 'object') return t.name === 'ask_user';
      return false;
    });
  }

  return false;
}

/**
 * Main hook logic
 */
async function main() {
  try {
    const input = await readInput();
    const promptResponse = input.prompt_response || '';
    const cwd = input.cwd || process.cwd();

    log('PhaseGate hook fired');
    debug(`Platform: ${platform.isWindows ? 'Windows' : 'Unix'}`);

    // Detect ask_user availability (v0.30.0 alignment)
    const askUserAvailable = isAskUserAvailable(input);

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

    const phaseGateConfig = getConfigValue(config, 'phaseGates', {});
    const strictMode = phaseGateConfig.strict || false;

    // Load plan state: session-specific first, then global Conductor
    const sessionId = input.session_id || null;
    const conductor = loadSessionOrGlobalPlan(sessionId, projectRoot, config);

    if (!conductor || !conductor.active || !conductor.plan) {
      log('No active Conductor track');
      writeOutput({});
      return;
    }

    // Parse phases from plan
    const phases = parsePhases(conductor.plan);

    if (phases.length === 0) {
      log('No phases found in plan');
      writeOutput({});
      return;
    }

    // Find current phase
    const currentPhase = findCurrentPhase(phases);

    if (!currentPhase) {
      log('All phases complete');
      writeOutput({});
      return;
    }

    log(`Current phase: ${currentPhase.name} (${currentPhase.completed}/${currentPhase.total})`);

    // Check if we're at a phase boundary
    const allTasksComplete = currentPhase.tasks.every(t =>
      t.completed ||
      t.text.toLowerCase().includes('verification') ||
      t.text.toLowerCase().includes('conductor')
    );

    if (allTasksComplete && !isVerificationComplete(currentPhase)) {
      // Three-tier gate logic: ask_user > strict deny > advisory systemMessage

      if (askUserAvailable) {
        // Tier 1: native ask_user verification (v0.30.0+)
        log(`[omg:phase-gate] ask_user available — using native verification`);
        const question = `Phase '${currentPhase.name}' is complete. Have you verified all tasks? (yes/no)`;
        writeOutput({
          systemMessage: `Use the ask_user tool to verify the phase gate before continuing. Call ask_user with: { "question": ${JSON.stringify(question)}, "question_type": "yes_no" }`
        });
      } else if (strictMode) {
        // Tier 2: strict deny (blocks the response)
        log(`[omg:phase-gate] ask_user not available — using prompt-based verification`);
        log(`BLOCKING: Phase "${currentPhase.name}" needs verification`);
        writeOutput({
          decision: 'deny',
          reason: `Phase Gate: "${currentPhase.name}" tasks complete. Please verify and mark the verification task as complete before proceeding.`
        });
      } else {
        // Tier 3: advisory systemMessage
        log(`[omg:phase-gate] ask_user not available — using prompt-based verification`);
        log(`ADVISORY: Phase "${currentPhase.name}" needs verification`);
        writeOutput({
          systemMessage: `Phase Gate (Advisory): "${currentPhase.name}" tasks appear complete. Consider verifying before proceeding to the next phase.`
        });
      }
      return;
    }

    // No gate triggered
    writeOutput({});
  } catch (err) {
    log(`PhaseGate hook error: ${err.message}`);
    // Don't fail the hook
    writeOutput({});
  }
}

main();
