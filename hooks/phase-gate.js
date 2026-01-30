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
const fs = require('fs');
const {
  readInput,
  writeOutput,
  log,
  debug,
  findProjectRoot,
  loadConductorState,
  calculateProgress,
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
 * Main hook logic
 */
async function main() {
  try {
    const input = await readInput();
    const promptResponse = input.prompt_response || '';
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
    
    const phaseGateConfig = getConfigValue(config, 'phaseGates', {});
    const strictMode = phaseGateConfig.strict || false;
    
    // Load Conductor state
    const conductor = loadConductorState(projectRoot);
    
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
      // Phase work is done but verification isn't marked
      const message = strictMode
        ? `🚫 Phase Gate: "${currentPhase.name}" tasks complete. Please verify and mark the verification task as complete before proceeding.`
        : `⚠️ Phase Gate (Advisory): "${currentPhase.name}" tasks appear complete. Consider verifying before proceeding to the next phase.`;
      
      if (strictMode) {
        log(`BLOCKING: Phase "${currentPhase.name}" needs verification`);
        // In strict mode, block the response
        writeOutput({
          decision: 'deny',
          reason: message
        });
      } else {
        // In advisory mode, just add a system message
        log(`ADVISORY: Phase "${currentPhase.name}" needs verification`);
        writeOutput({
          systemMessage: message
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
