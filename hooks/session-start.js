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
 * Build full context for fresh sessions (start/clear).
 * Loads Conductor state, git status, and builds detailed additionalContext.
 * @param {string} sessionId - Session identifier
 * @param {string} projectRoot - Project root directory
 * @param {object} config - Loaded configuration
 * @returns {{ additionalContext: string, conductorSummary: string }}
 */
function buildFullContext(sessionId, projectRoot, config) {
  let additionalContext = '';
  let conductorSummary = '';

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

      const currentTask = conductor.plan ? findCurrentTaskFromPlan(conductor.plan) : null;
      if (currentTask) {
        additionalContext += `**Current Task:** ${currentTask}\n\n`;
      }

      conductorSummary = `Conductor: ${conductor.trackName} (${conductor.progress.percentage}% complete)`;
    }
  }

  // --- Git Status ---
  if (isGitRepo(projectRoot)) {
    const hasChanges = hasUncommittedChanges(projectRoot);
    if (hasChanges) {
      additionalContext += '## Git Status\n';
      additionalContext += 'You have uncommitted changes. Consider committing before major changes.\n\n';
    }
  }

  return { additionalContext, conductorSummary };
}

/**
 * Build concise context for resumed sessions.
 * Skips full Conductor state load since the session already has context.
 * Only provides a brief status line.
 * @param {string} sessionId - Session identifier
 * @param {string} projectRoot - Project root directory
 * @param {object} config - Loaded configuration
 * @returns {{ conductorSummary: string }}
 */
function buildResumeContext(sessionId, projectRoot, config) {
  let conductorSummary = '';

  // Only load a lightweight Conductor summary for the status line
  if (isFeatureEnabled(config, 'contextInjection')) {
    try {
      const conductor = loadSessionOrGlobalPlan(sessionId, projectRoot, config);
      if (conductor && conductor.active) {
        conductorSummary = `Conductor: ${conductor.trackName} (${conductor.progress.percentage}% complete)`;
      }
    } catch (err) {
      // Don't fail resumed sessions for Conductor read errors
      log(`Resume context: Conductor read skipped: ${err.message}`);
    }
  }

  return { conductorSummary };
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

    // Build context based on session type
    const output = {};
    let systemMessage = '';

    if (sessionType === 'resume') {
      // Resumed sessions: skip full state load, show concise message
      const { conductorSummary } = buildResumeContext(sessionId, projectRoot, config);
      systemMessage = conductorSummary
        ? `Session resumed | ${conductorSummary}`
        : 'Session resumed';
    } else {
      // Fresh sessions (start/clear): load full context
      const { additionalContext, conductorSummary } = buildFullContext(sessionId, projectRoot, config);

      if (additionalContext.trim()) {
        output.hookSpecificOutput = {
          additionalContext: additionalContext.trim()
        };
      }

      if (sessionType === 'clear') {
        systemMessage = conductorSummary
          ? `Context cleared | ${conductorSummary}`
          : 'Context cleared';
      } else {
        systemMessage = conductorSummary
          ? `oh-my-gemini ready | ${conductorSummary}`
          : 'oh-my-gemini ready';
      }
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
