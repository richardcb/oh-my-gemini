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

// Max age for stale session entries (24 hours in ms)
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Gemini CLI v0.30.0 circuit breaker defaults.
// If the CLI exposes these values via hook input, we use those instead.
const DEFAULT_MAX_TURNS = 15;
const DEFAULT_MAX_TIME_MINUTES = 5;

/**
 * Get the path to the ralph state file
 * @param {string} projectRoot - Project root directory
 * @returns {string} Path to ralph-state.json
 */
function getStateFilePath(projectRoot) {
  return path.join(projectRoot, '.gemini', 'ralph-state.json');
}

/**
 * Load ralph state from disk
 * @param {string} projectRoot - Project root directory
 * @returns {object} State object with sessions map
 */
function loadState(projectRoot) {
  const stateFile = getStateFilePath(projectRoot);
  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }
  } catch (err) {
    debug(`Failed to load ralph state: ${err.message}`);
  }
  return { sessions: {} };
}

/**
 * Save ralph state to disk
 * @param {string} projectRoot - Project root directory
 * @param {object} state - State object to persist
 */
function saveState(projectRoot, state) {
  const stateFile = getStateFilePath(projectRoot);
  try {
    const dir = path.dirname(stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    debug(`Failed to save ralph state: ${err.message}`);
  }
}

/**
 * Clean stale session entries older than STALE_THRESHOLD_MS
 * @param {object} state - State object
 * @returns {object} Cleaned state
 */
function cleanStaleEntries(state) {
  const now = Date.now();
  for (const [sid, entry] of Object.entries(state.sessions)) {
    if (now - (entry.timestamp || 0) > STALE_THRESHOLD_MS) {
      delete state.sessions[sid];
    }
  }
  return state;
}

/**
 * Get session-specific attempt count
 * @param {string} sessionId - Session identifier
 * @param {string} projectRoot - Project root directory
 * @returns {number} Current attempt count
 */
function getAttemptCount(sessionId, projectRoot) {
  const state = loadState(projectRoot);
  return (state.sessions[sessionId] && state.sessions[sessionId].attempts) || 0;
}

/**
 * Increment attempt count for session (persisted to disk)
 * @param {string} sessionId - Session identifier
 * @param {string} projectRoot - Project root directory
 * @returns {number} New attempt count
 */
function incrementAttempts(sessionId, projectRoot) {
  const state = cleanStaleEntries(loadState(projectRoot));
  const current = (state.sessions[sessionId] && state.sessions[sessionId].attempts) || 0;
  const newCount = current + 1;
  state.sessions[sessionId] = { attempts: newCount, timestamp: Date.now() };
  saveState(projectRoot, state);
  return newCount;
}

/**
 * Reset attempt count for session (persisted to disk)
 * @param {string} sessionId - Session identifier
 * @param {string} projectRoot - Project root directory
 */
function resetAttempts(sessionId, projectRoot) {
  const state = loadState(projectRoot);
  delete state.sessions[sessionId];
  saveState(projectRoot, state);
}

/**
 * Negation words that, when found before a match, indicate the match is not a true positive.
 */
const NEGATION_WORDS = [
  'not', 'no', "didn't", "doesn't", "haven't", "hasn't", "can't",
  'cannot', 'unable', 'failed to'
];

/**
 * Positive context phrases that, when found before a failure word, indicate it is not a true failure.
 */
const POSITIVE_CONTEXT_PHRASES = [
  'fixed the', 'resolved the', 'no more', 'eliminated the'
];

/**
 * Check whether a match at the given index in text is preceded (within ~30 chars) by any of the
 * provided context phrases/words.
 * @param {string} text - Lowercased full response text
 * @param {number} matchIndex - Index where the keyword match starts
 * @param {string[]} contextPhrases - Phrases to look for before the match
 * @returns {boolean} True if a context phrase is found within 30 chars before the match
 */
function isPrecededBy(text, matchIndex, contextPhrases) {
  const windowStart = Math.max(0, matchIndex - 30);
  const window = text.slice(windowStart, matchIndex);
  return contextPhrases.some(phrase => window.includes(phrase));
}

/**
 * Check if response indicates failure/giving up
 * @param {string} response - Agent response text
 * @param {string[]} patterns - Failure patterns to match
 * @returns {boolean} True if response indicates failure
 */
function detectsFailure(response, patterns) {
  const responseLower = response.toLowerCase();
  let matchCount = 0;

  const allPatterns = [
    ...patterns.map(p => p.toLowerCase()),
    'apologize',
    "can't help",
    'cannot assist',
    'not able to',
    'beyond my capabilities',
    'outside my scope',
    "don't have access",
    "doesn't work",
    "won't work",
    'impossible to',
    'no way to'
  ];

  for (const pattern of allPatterns) {
    let searchFrom = 0;
    while (true) {
      const idx = responseLower.indexOf(pattern, searchFrom);
      if (idx === -1) break;
      // Skip if preceded by positive context (e.g. "fixed the error")
      if (!isPrecededBy(responseLower, idx, POSITIVE_CONTEXT_PHRASES)) {
        matchCount++;
      }
      searchFrom = idx + 1;
    }
  }

  return matchCount > 0;
}

/**
 * Count distinct pattern matches in text, skipping negated occurrences.
 * @param {string} text - Lowercased response text
 * @param {string[]} patterns - Patterns to search for
 * @returns {number} Number of non-negated matches found
 */
function countSuccessMatches(text, patterns) {
  let count = 0;
  for (const pattern of patterns) {
    let searchFrom = 0;
    while (true) {
      const idx = text.indexOf(pattern, searchFrom);
      if (idx === -1) break;
      // Skip if preceded by a negation word
      if (!isPrecededBy(text, idx, NEGATION_WORDS)) {
        count++;
      }
      searchFrom = idx + 1;
    }
  }
  return count;
}

/**
 * Count distinct failure pattern matches in text, skipping positively-contextualised occurrences.
 * @param {string} text - Lowercased response text
 * @param {string[]} patterns - Failure patterns from config
 * @returns {number} Number of genuine failure matches
 */
function countFailureMatches(text, patterns) {
  let count = 0;
  const allPatterns = [
    ...patterns.map(p => p.toLowerCase()),
    'apologize',
    "can't help",
    'cannot assist',
    'not able to',
    'beyond my capabilities',
    'outside my scope',
    "don't have access",
    "doesn't work",
    "won't work",
    'impossible to',
    'no way to'
  ];
  for (const pattern of allPatterns) {
    let searchFrom = 0;
    while (true) {
      const idx = text.indexOf(pattern, searchFrom);
      if (idx === -1) break;
      if (!isPrecededBy(text, idx, POSITIVE_CONTEXT_PHRASES)) {
        count++;
      }
      searchFrom = idx + 1;
    }
  }
  return count;
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
    'all done',
    'task done',
    'is done',
    'i have completed',
    'i have finished',
    'i have successfully',
    'i have fixed',
    'i have implemented',
    'i have resolved',
    'here is the updated',
    'here is the fixed',
    'here is the implementation',
    'here is the solution',
    "here's the updated",
    "here's the fixed",
    "here's the implementation",
    "here's the solution",
    'successfully completed',
    'task completed',
    'completed the',
    'completed all',
    'finished',
    'created',
    'implemented',
    'fixed the',
    'resolved',
    'all tests pass'
  ];

  return countSuccessMatches(responseLower, successIndicators) > 0;
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
 * Extract circuit breaker budget from hook input.
 * Gemini CLI v0.30.0+ may provide turn_count, max_turns, session_start_time,
 * or max_time_minutes. Falls back to hardcoded defaults.
 * @param {object} input - Raw hook input
 * @returns {{ turnsUsed: number, maxTurns: number, maxTimeMinutes: number, sessionStartTime: number|null }}
 */
function getCircuitBreakerBudget(input) {
  const turnsUsed = input.turn_count || input.turns_used || 0;
  const maxTurns = input.max_turns || DEFAULT_MAX_TURNS;
  const maxTimeMinutes = input.max_time_minutes || DEFAULT_MAX_TIME_MINUTES;
  const sessionStartTime = input.session_start_time
    ? new Date(input.session_start_time).getTime()
    : null;

  return { turnsUsed, maxTurns, maxTimeMinutes, sessionStartTime };
}

/**
 * Check if the circuit breaker would be exceeded by another retry.
 * @param {object} budget - Circuit breaker budget from getCircuitBreakerBudget
 * @returns {{ exceeded: boolean, reason: string|null, turnsRemaining: number }}
 */
function checkCircuitBreaker(budget) {
  const turnsRemaining = budget.maxTurns - budget.turnsUsed;

  // Check turn limit (need at least 1 turn remaining for a retry to be useful)
  if (turnsRemaining <= 1) {
    return {
      exceeded: true,
      reason: `Circuit breaker: ${budget.turnsUsed}/${budget.maxTurns} turns used`,
      turnsRemaining: Math.max(0, turnsRemaining)
    };
  }

  // Check time limit if session start time is available
  if (budget.sessionStartTime) {
    const elapsedMinutes = (Date.now() - budget.sessionStartTime) / 60000;
    if (elapsedMinutes >= budget.maxTimeMinutes) {
      return {
        exceeded: true,
        reason: `Circuit breaker: ${Math.round(elapsedMinutes)}min elapsed (limit: ${budget.maxTimeMinutes}min)`,
        turnsRemaining: Math.max(0, turnsRemaining)
      };
    }
  }

  return { exceeded: false, reason: null, turnsRemaining: Math.max(0, turnsRemaining) };
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
    
    // Check if response indicates success or failure, with tiebreaker
    const responseLower = promptResponse.toLowerCase();
    const successIndicators = [
      'successfully',
      'all done',
      'task done',
      'is done',
      'i have completed',
      'i have finished',
      'i have successfully',
      'i have fixed',
      'i have implemented',
      'i have resolved',
      'here is the updated',
      'here is the fixed',
      'here is the implementation',
      'here is the solution',
      "here's the updated",
      "here's the fixed",
      "here's the implementation",
      "here's the solution",
      'successfully completed',
      'task completed',
      'completed the',
      'completed all',
      'finished',
      'created',
      'implemented',
      'fixed the',
      'resolved',
      'all tests pass'
    ];
    const successMatches = countSuccessMatches(responseLower, successIndicators);
    const failureMatches = countFailureMatches(responseLower, triggerPatterns);

    // If both detected, only call it success if success strictly outnumbers failure
    const hasSuccess = successMatches > 0 && successMatches > failureMatches;
    const hasFailure = failureMatches > 0 && failureMatches >= successMatches;

    if (hasSuccess) {
      log(`Response indicates success (${successMatches} success vs ${failureMatches} failure matches), resetting attempts`);
      resetAttempts(sessionId, projectRoot);
      writeOutput({});
      return;
    }

    // Check if response indicates failure
    if (!hasFailure) {
      log('Response does not indicate failure');
      writeOutput({});
      return;
    }

    // Check circuit breaker budget before attempting retry
    const budget = getCircuitBreakerBudget(input);
    const cbCheck = checkCircuitBreaker(budget);

    if (cbCheck.exceeded) {
      log(`Circuit breaker exceeded: ${cbCheck.reason}`);
      resetAttempts(sessionId, projectRoot);
      writeOutput({
        systemMessage: `Ralph Mode: Stopping retries - ${cbCheck.reason}. The task may need human intervention.`
      });
      return;
    }

    // Increment attempt count
    const attempts = incrementAttempts(sessionId, projectRoot);
    log(`Failure detected. Attempt ${attempts}/${maxRetries}`);

    if (attempts >= maxRetries) {
      // Max retries reached - escalate to user
      log('Max retries reached, escalating to user');
      resetAttempts(sessionId, projectRoot);

      writeOutput({
        systemMessage: `Ralph Mode: Reached ${maxRetries} attempts. The task may need human intervention or a different approach. Here's what was tried - please provide guidance.`
      });
      return;
    }

    // Generate retry prompt with remaining budget indicator
    const suggestion = generateSuggestion(attempts);
    const budgetNote = `${cbCheck.turnsRemaining} turn${cbCheck.turnsRemaining !== 1 ? 's' : ''} remaining before circuit breaker`;
    const retryReason = `Ralph Mode (Attempt ${attempts}/${maxRetries}): Retrying — ${budgetNote}. ${suggestion} Please try again with a different approach.`;

    log(`Forcing retry: ${suggestion} (${budgetNote})`);

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
