#!/usr/bin/env node
/**
 * oh-my-gemini Session Start Hook
 *
 * Event: SessionStart
 * Fires: When a new Gemini CLI session begins
 *
 * Purpose:
 * - Detect active Conductor tracks and show progress
 * - Display welcome message with current state
 * - Initialize session context
 *
 * Input: { session_id, session_type, cwd, ... }
 * Output: { hookSpecificOutput: { additionalContext }, systemMessage? }
 * 
 * Cross-platform compatible (Windows/macOS/Linux)
 */

const path = require('path');
const {
  readInput,
  writeOutput,
  log,
  findProjectRoot,
  loadSessionOrGlobalPlan,
  isGitRepo,
  hasUncommittedChanges,
  platform
} = require('./lib/utils');
const { loadConfig, isFeatureEnabled } = require('./lib/config');

/**
 * Format progress bar
 * @param {number} percentage - Progress percentage (0-100)
 * @param {number} width - Bar width in characters
 * @returns {string} Formatted progress bar
 */
function formatProgressBar(percentage, width = 20) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
}

/**
 * Main hook logic
 */
async function main() {
  try {
    const input = await readInput();
    const cwd = input.cwd || process.cwd();
    const sessionType = input.session_type || 'start';
    const sessionId = input.session_id || null;
    
    log(`SessionStart hook fired. CWD: ${cwd}, Type: ${sessionType}`);
    log(`Platform: ${platform.isWindows ? 'Windows' : 'Unix'}`);
    
    // Find project root
    const projectRoot = findProjectRoot(cwd);
    
    // Load configuration
    const config = loadConfig(projectRoot);
    
    // Build context
    let additionalContext = '';
    let systemMessage = '';
    
    // --- Conductor State ---
    if (isFeatureEnabled(config, 'contextInjection')) {
      const conductor = loadSessionOrGlobalPlan(sessionId, projectRoot, config);

      if (conductor && conductor.active) {
        log(`Conductor active: ${conductor.trackName}`);

        const planLabel = conductor.source === 'global'
          ? 'Active (global)'
          : `Active (session ${sessionId})`;

        additionalContext += '## Conductor Status\n';
        additionalContext += `**Plan State:** ${planLabel}\n`;
        additionalContext += `**Active Track:** ${conductor.trackName}\n`;
        additionalContext += `**Progress:** ${formatProgressBar(conductor.progress.percentage)}\n`;
        additionalContext += `**Tasks:** ${conductor.progress.completed}/${conductor.progress.total} completed\n\n`;

        // Add current task if available
        const currentTask = conductor.plan ? findCurrentTaskFromPlan(conductor.plan) : null;
        if (currentTask) {
          additionalContext += `**Current Task:** ${currentTask}\n\n`;
        }

        systemMessage = `Conductor: ${conductor.trackName} (${conductor.progress.percentage}% complete)`;
      }
    }
    
    // --- Git Status ---
    if (isGitRepo(projectRoot)) {
      const hasChanges = hasUncommittedChanges(projectRoot);
      if (hasChanges) {
        additionalContext += '## ⚠️ Git Status\n';
        additionalContext += 'You have uncommitted changes. Consider committing before major changes.\n\n';
      }
    }
    
    // --- System Message based on session type ---
    switch (sessionType) {
      case 'start':
        systemMessage = systemMessage
          ? `🚀 oh-my-gemini ready | ${systemMessage}`
          : '🚀 oh-my-gemini ready';
        break;

      case 'resume':
        systemMessage = systemMessage
          ? `♻️ Session resumed | ${systemMessage}`
          : '♻️ Session resumed';
        break;

      case 'clear':
        systemMessage = systemMessage
          ? `🔄 Context cleared | ${systemMessage}`
          : '🔄 Context cleared';
        break;

      default:
        systemMessage = systemMessage || '🚀 oh-my-gemini ready';
    }

    // Build output
    const output = {};

    if (additionalContext.trim()) {
      output.hookSpecificOutput = {
        additionalContext: additionalContext.trim()
      };
    }

    if (systemMessage) {
      output.systemMessage = systemMessage;
    }

    writeOutput(output);
  } catch (err) {
    log(`SessionStart hook error: ${err.message}`);
    // Don't fail the hook - just output empty response
    writeOutput({});
  }
}

/**
 * Find the current task from plan content
 * @param {string} planContent - Plan markdown content
 * @returns {string|null} Current task or null
 */
function findCurrentTaskFromPlan(planContent) {
  if (!planContent) return null;
  
  const lines = planContent.split('\n');
  
  for (const line of lines) {
    // Match uncompleted task: - [ ] Task text
    const match = line.match(/^[\s]*-\s*\[\s\]\s*(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

main();
