#!/usr/bin/env node
/**
 * oh-my-gemini Ralph Retry Hook (Persistence Mode)
 *
 * Event: AfterAgent
 * Fires: When ralph/persistent mode is active
 *
 * Purpose:
 * - Detect failure indicators in response
 * - Track attempt count
 * - Generate alternative approach suggestions
 * - Force retry up to N attempts
 * - Escalate to user after max attempts
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
  platform
} = require('./lib/utils');
const { loadConfig, isFeatureEnabled, getConfigValue } = require('./lib/config');

// In-memory attempt tracking (resets on new session)
const attemptTracker = new Map();

/**
 * Get session-specific attempt count
 * @param {string} sessionId - Session identifier
 * @returns {number} Current attempt count
 */
function getAttemptCount(sessionId) {
  return attemptTracker.get(sessionId) || 0;
}

/**
 * Increment attempt count for session
 * @param {string} sessionId - Session identifier
 * @returns {number} New attempt count
 */
function incrementAttempts(sessionId) {
  const current = getAttemptCount(sessionId);
  const newCount = current + 1;
  attemptTracker.set(sessionId, newCount);
  return newCount;
}

/**
 * Reset attempt count for session
 * @param {string} sessionId - Session identifier
 */
function resetAttempts(sessionId) {
  attemptTracker.delete(sessionId);
}

/**
 * Check if response indicates failure/giving up
 * @param {string} response - Agent response text
 * @param {string[]} patterns - Failure patterns to match
 * @returns {boolean} True if response indicates failure
 */
function detectsFailure(response, patterns) {
  const responseLower = response.toLowerCase();
  
  for (const pattern of patterns) {
    if (responseLower.includes(pattern.toLowerCase())) {
      return true;
    }
  }
  
  // Additional failure indicators
  const additionalPatterns = [
    'apologize',
    "can't help",
    "cannot assist",
    'not able to',
    'beyond my capabilities',
    'outside my scope',
    "don't have access",
    "doesn't work",
    "won't work",
    'impossible to',
    'no way to'
  ];
  
  return additionalPatterns.some(p => responseLower.includes(p));
}

/**
 * Check if response indicates success/completion
 * @param {string} response - Agent response text
 * @returns {boolean} True if response indicates success
 */
function detectsSuccess(response) {
  const responseLower = response.toLowerCase();
  
  const successIndicators = [
    'successfully',
    'completed',
    'done',
    'finished',
    'created',
    'implemented',
    'fixed',
    'resolved',
    'here is the',
    "here's the",
    'i have'
  ];
  
  return successIndicators.some(p => responseLower.includes(p));
}

/**
 * Generate alternative approach suggestions
 * @param {number} attemptNumber - Current attempt number
 * @returns {string} Suggestion text
 */
function generateSuggestion(attemptNumber) {
  const suggestions = [
    'Try breaking the problem into smaller steps.',
    'Consider if there are any prerequisites or dependencies missing.',
    'Try a different approach or algorithm.',
    'Check if the environment or configuration needs adjustment.',
    'Look for related examples or documentation that might help.',
    'Consider if the problem might be in a different file or location.',
    'Try searching for similar issues and their solutions.',
    'Break down what works and what fails to isolate the issue.'
  ];
  
  // Cycle through suggestions based on attempt number
  return suggestions[(attemptNumber - 1) % suggestions.length];
}

/**
 * Check if ralph mode is active
 * @param {string} prompt - User prompt
 * @param {object} context - Additional context
 * @returns {boolean} True if ralph mode is active
 */
function isRalphModeActive(prompt, context = {}) {
  const combined = `${prompt} ${JSON.stringify(context)}`.toLowerCase();
  
  return combined.includes('@ralph') ||
         combined.includes('persistent:') ||
         combined.includes('persist:') ||
         combined.includes("don't give up") ||
         combined.includes('keep trying');
}

/**
 * Main hook logic
 */
async function main() {
  try {
    const input = await readInput();
    const prompt = input.prompt || '';
    const promptResponse = input.prompt_response || '';
    const sessionId = input.session_id || 'default';
    const cwd = input.cwd || process.cwd();
    
    log('RalphRetry hook fired');
    debug(`Platform: ${platform.isWindows ? 'Windows' : 'Unix'}`);
    
    // Find project root
    const projectRoot = findProjectRoot(cwd);
    
    // Load configuration
    const config = loadConfig(projectRoot);
    
    // Check if ralph mode is enabled in config
    if (!isFeatureEnabled(config, 'ralph')) {
      log('Ralph mode is disabled in config');
      writeOutput({});
      return;
    }
    
    // Check if ralph mode is active for this prompt
    if (!isRalphModeActive(prompt)) {
      log('Ralph mode not active for this prompt');
      writeOutput({});
      return;
    }
    
    const ralphConfig = getConfigValue(config, 'ralph', {});
    const maxRetries = ralphConfig.maxRetries || 5;
    const triggerPatterns = ralphConfig.triggerPatterns || [
      "I'm stuck",
      'I cannot',
      "I'm unable",
      'not possible',
      'failed to'
    ];
    
    // Check if response indicates success
    if (detectsSuccess(promptResponse)) {
      log('Response indicates success, resetting attempts');
      resetAttempts(sessionId);
      writeOutput({});
      return;
    }
    
    // Check if response indicates failure
    if (!detectsFailure(promptResponse, triggerPatterns)) {
      log('Response does not indicate failure');
      writeOutput({});
      return;
    }
    
    // Increment attempt count
    const attempts = incrementAttempts(sessionId);
    log(`Failure detected. Attempt ${attempts}/${maxRetries}`);
    
    if (attempts >= maxRetries) {
      // Max retries reached - escalate to user
      log('Max retries reached, escalating to user');
      resetAttempts(sessionId);
      
      writeOutput({
        systemMessage: `🛑 Ralph Mode: Reached ${maxRetries} attempts. The task may need human intervention or a different approach. Here's what was tried - please provide guidance.`
      });
      return;
    }
    
    // Generate retry prompt
    const suggestion = generateSuggestion(attempts);
    const retryReason = `🔄 Ralph Mode (Attempt ${attempts}/${maxRetries}): Don't give up! ${suggestion} Please try again with a different approach.`;
    
    log(`Forcing retry: ${suggestion}`);
    
    writeOutput({
      decision: 'deny',
      reason: retryReason
    });
  } catch (err) {
    log(`RalphRetry hook error: ${err.message}`);
    // Don't fail the hook
    writeOutput({});
  }
}

main();
