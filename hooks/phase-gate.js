#!/usr/bin/env node
/**
 * oh-my-gemini Phase Gate Hook
 *
 * Event: AfterAgent
 * Fires: After every agent response
 *
 * Purpose:
 * - Detect when agent completes a Conductor phase
 * - Enforce verification gates (advisory or strict mode)
 * - Prompt user confirmation before proceeding to next phase
 *
 * Input: { prompt, prompt_response, stop_hook_active, session_id, cwd, ... }
 * Output: { decision?: "deny", reason?, systemMessage? }
 *
 * Modes:
 * - Advisory (default): Shows message but allows continuation
 * - Strict: Blocks progression until user explicitly confirms
 */

const fs = require('fs');
const path = require('path');
const {
  readInput,
  writeOutput,
  log,
  findProjectRoot,
  loadConductorState,
  calculateProgress
} = require('./lib/utils');
const { loadConfig } = require('./lib/config');

/**
 * Patterns that indicate phase completion
 */
const PHASE_COMPLETION_PATTERNS = [
  /phase\s+\d+\s+(is\s+)?complete/i,
  /completed?\s+phase\s+\d+/i,
  /finished?\s+phase\s+\d+/i,
  /moving\s+to\s+phase\s+\d+/i,
  /proceed(ing)?\s+to\s+(the\s+)?next\s+phase/i,
  /all\s+tasks?\s+(in\s+)?(this\s+)?phase\s+(are\s+)?(complete|done|finished)/i,
  /phase\s+\d+\s+tasks?\s+(are\s+)?(all\s+)?(complete|done|finished)/i,
  /verification\s+gate/i,
  /ready\s+for\s+(phase\s+)?\d+/i,
  /starting\s+phase\s+\d+/i
];

/**
 * Patterns that indicate the agent is asking for verification
 * (don't trigger gate if agent is already asking)
 */
const ALREADY_ASKING_PATTERNS = [
  /ready\s+to\s+proceed\??/i,
  /shall\s+(i|we)\s+(continue|proceed)/i,
  /would\s+you\s+like\s+(me\s+)?to\s+(continue|proceed)/i,
  /confirm(ation)?\s+(before|to)\s+(proceed|continue)/i,
  /waiting\s+for\s+(your\s+)?(confirmation|approval)/i,
  /please\s+(confirm|approve)/i
];

/**
 * Check if response indicates phase completion
 */
function detectsPhaseCompletion(response) {
  return PHASE_COMPLETION_PATTERNS.some(pattern => pattern.test(response));
}

/**
 * Check if agent is already asking for confirmation
 */
function isAlreadyAskingForConfirmation(response) {
  return ALREADY_ASKING_PATTERNS.some(pattern => pattern.test(response));
}

/**
 * Find phase gate markers in plan.md
 */
function findPhaseGate(planContent) {
  if (!planContent) return null;

  // Look for incomplete phase gate tasks
  const patterns = [
    /- \[ \] Task: (?:Phase Gate|Conductor - User Manual Verification)[- ]['"]([^'"]+)['"]/i,
    /- \[ \] (?:Phase Gate|Verification):\s*['"]?([^'"\n]+)['"]?/i,
    /- \[ \] Task:.*Verification.*['"]([^'"]+)['"]/i
  ];

  for (const pattern of patterns) {
    const match = planContent.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Detect which phase was just completed based on response
 */
function detectCompletedPhase(response) {
  const phaseMatch = response.match(/phase\s+(\d+)/i);
  return phaseMatch ? parseInt(phaseMatch[1], 10) : null;
}

/**
 * Get summary of completed work for the phase
 */
function getPhaseCompletionSummary(conductor, phaseNumber) {
  if (!conductor || !conductor.plan) return '';

  const lines = conductor.plan.split('\n');
  let inTargetPhase = false;
  let completedTasks = [];
  let currentPhaseNum = 0;

  for (const line of lines) {
    const phaseMatch = line.match(/^##\s*Phase\s*(\d+)/i);
    if (phaseMatch) {
      currentPhaseNum = parseInt(phaseMatch[1], 10);
      inTargetPhase = phaseNumber ? currentPhaseNum === phaseNumber : true;
    }

    if (inTargetPhase && line.match(/^- \[x\]/i)) {
      const taskMatch = line.match(/^- \[x\]\s*(.+)/i);
      if (taskMatch) {
        completedTasks.push(taskMatch[1].trim());
      }
    }
  }

  return completedTasks.slice(-5).map(t => `  ✓ ${t}`).join('\n');
}

function main() {
  try {
    const input = readInput();
    const promptResponse = input.prompt_response || '';
    const stopHookActive = input.stop_hook_active || false;
    const cwd = input.cwd || process.cwd();

    // Don't re-trigger if already in a retry loop
    if (stopHookActive) {
      writeOutput({});
      return;
    }

    const projectRoot = findProjectRoot(cwd);
    const config = loadConfig(projectRoot);

    // Skip if phase gates are disabled
    if (!config.phaseGates || !config.phaseGates.enabled) {
      writeOutput({});
      return;
    }

    // Load Conductor state
    const conductor = loadConductorState(projectRoot);

    // Skip if no active Conductor track
    if (!conductor || !conductor.hasActiveTracks) {
      writeOutput({});
      return;
    }

    // Check if response indicates phase completion
    if (!detectsPhaseCompletion(promptResponse)) {
      writeOutput({});
      return;
    }

    // Skip if agent is already asking for confirmation
    if (isAlreadyAskingForConfirmation(promptResponse)) {
      log('Agent already asking for confirmation, skipping phase gate');
      writeOutput({});
      return;
    }

    // Find the phase gate marker in the plan
    const phaseGateName = findPhaseGate(conductor.plan);
    const completedPhase = detectCompletedPhase(promptResponse);
    const phaseName = phaseGateName || (completedPhase ? `Phase ${completedPhase}` : 'Current Phase');

    // Get summary of completed work
    const completedWork = getPhaseCompletionSummary(conductor, completedPhase);
    const progress = calculateProgress(conductor.plan);

    log(`Phase gate triggered: ${phaseName} (strict: ${config.phaseGates.strict})`);

    if (config.phaseGates.strict) {
      // Strict mode: Force a retry with verification request
      const reason = `
🔍 **Phase Gate: ${phaseName}**

Before proceeding to the next phase, please:

1. **Summarize** what was accomplished:
${completedWork || '   (List the completed tasks)'}

2. **Verify** all requirements are met:
   - All tasks marked [x] complete
   - Code compiles without errors
   - Tests pass (if applicable)

3. **Update** the plan.md file:
   - Mark completed tasks with [x]
   - Update metadata.json if needed

4. **Wait for user confirmation** before starting the next phase.

**Progress:** ${progress.completed}/${progress.total} tasks (${progress.percentage}%)

Do not proceed until the user explicitly confirms.
`.trim();

      writeOutput({
        decision: 'deny',
        reason: reason
      });
    } else {
      // Advisory mode: Show message but continue
      const message = `📋 Phase Gate: ${phaseName} complete (${progress.percentage}%). Consider verifying before proceeding.`;
      
      writeOutput({
        systemMessage: message
      });
    }

  } catch (err) {
    log(`Phase gate hook error: ${err.message}`);
    // On error, don't block - just continue
    writeOutput({});
  }
}

main();
