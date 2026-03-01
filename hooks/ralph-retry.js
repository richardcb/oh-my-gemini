#!/usr/bin/env node
/**
 * oh-my-gemini Ralph Retry Hook (Persistence Mode) — v2
 *
 * Event: AfterAgent
 * Fires: When ralph/persistent mode is active
 *
 * Purpose:
 * - Detect failure indicators in response
 * - Read verification state from after-tool.js (FR-1)
 * - Deny premature "success" when verification shows errors (FR-1)
 * - Track error signatures for stuck detection (FR-2)
 * - Generate error-aware retry messages (FR-4)
 * - Force retry up to N attempts
 * - Escalate to user after max attempts
 *
 * Ralph state schema (ralph.json):
 * { attempts: number, lastTimestamp: string (ISO 8601),
 *   lastErrorSignature: string (first 100 chars),
 *   consecutiveSameError: number, stuckItems: string[] }
 *
 * Input: { prompt, prompt_response, stop_hook_active, session_id, cwd, ... }
 * Output: { decision?: "deny", reason?, systemMessage? }
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

// Import keyword registry for Ralph keyword detection (with fallback)
let detectRalphKeywordsFromRegistry;
try {
  const kr = require('../dist/lib/keyword-registry');
  detectRalphKeywordsFromRegistry = kr.detectRalphKeywords;
} catch (err) {
  debug(`Failed to load keyword-registry: ${err.message}. Using inline fallback.`);
  detectRalphKeywordsFromRegistry = null;
}

// Import mode state and config for mode-aware verification (PRD 0003)
let readModeState, composeModeProfile;
try {
  const ms = require('../dist/lib/mode-state');
  readModeState = ms.readModeState;
  const mc = require('../dist/lib/mode-config');
  composeModeProfile = mc.composeModeProfile;
} catch (err) {
  debug(`Failed to load mode-state/mode-config: ${err.message}. Defaulting to autoVerification=true.`);
  readModeState = null;
  composeModeProfile = null;
}

// Verification state staleness window (5 minutes)
const VERIFICATION_STALE_MS = 5 * 60 * 1000;

// Gemini CLI v0.30.0 circuit breaker defaults.
const DEFAULT_MAX_TURNS = 15;
const DEFAULT_MAX_TIME_MINUTES = 5;

// ===================== Session-Scoped State Management (FR-5) =====================

/**
 * Get the path to the session-scoped ralph state file
 * @param {string} sessionId - Session identifier
 * @param {string} projectRoot - Project root directory
 * @returns {string} Path to ralph.json
 */
function getSessionStatePath(sessionId, projectRoot) {
  return path.join(projectRoot, '.gemini', 'omg-state', sessionId, 'ralph.json');
}

/**
 * Default ralph state for a new session
 */
const DEFAULT_RALPH_STATE = {
  attempts: 0,
  lastTimestamp: null,
  lastErrorSignature: null,
  consecutiveSameError: 0,
  stuckItems: []
};

/**
 * Load ralph state from session-scoped file.
 * On first access, migrates from old .gemini/ralph-state.json if present.
 * @param {string} sessionId - Session identifier
 * @param {string} projectRoot - Project root directory
 * @returns {object} Ralph state (flat object)
 */
function loadRalphState(sessionId, projectRoot) {
  const statePath = getSessionStatePath(sessionId, projectRoot);

  // Try session-scoped file first
  try {
    if (fs.existsSync(statePath)) {
      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      return {
        attempts: parsed.attempts || 0,
        lastTimestamp: parsed.lastTimestamp || null,
        lastErrorSignature: parsed.lastErrorSignature || null,
        consecutiveSameError: parsed.consecutiveSameError || 0,
        stuckItems: Array.isArray(parsed.stuckItems) ? parsed.stuckItems : []
      };
    }
  } catch (err) {
    debug(`Failed to load ralph state: ${err.message}. Resetting.`);
    return { ...DEFAULT_RALPH_STATE };
  }

  // Migration: check old .gemini/ralph-state.json
  try {
    const oldPath = path.join(projectRoot, '.gemini', 'ralph-state.json');
    if (fs.existsSync(oldPath)) {
      const oldState = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
      if (oldState.sessions && oldState.sessions[sessionId]) {
        const entry = oldState.sessions[sessionId];
        const migrated = {
          attempts: entry.attempts || 0,
          lastTimestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : null,
          lastErrorSignature: null,
          consecutiveSameError: 0,
          stuckItems: []
        };
        // Write migrated state to new location
        saveRalphState(sessionId, projectRoot, migrated);
        debug(`Migrated ralph state from old format for session ${sessionId}`);
        return migrated;
      }
    }
  } catch (err) {
    debug(`Failed to migrate old ralph state: ${err.message}`);
  }

  return { ...DEFAULT_RALPH_STATE };
}

/**
 * Save ralph state to session-scoped file
 * @param {string} sessionId - Session identifier
 * @param {string} projectRoot - Project root directory
 * @param {object} state - Ralph state object
 */
function saveRalphState(sessionId, projectRoot, state) {
  const statePath = getSessionStatePath(sessionId, projectRoot);
  try {
    const dir = path.dirname(statePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (err) {
    debug(`Failed to save ralph state: ${err.message}`);
  }
}

// ===================== Verification State Reading (FR-1) =====================

/**
 * Read verification state written by after-tool.js.
 * Returns { available, allPassed?, errorSummary?, errorCount? }
 * @param {string} projectRoot - Project root directory
 * @param {string} sessionId - Session identifier
 * @returns {object} Verification state
 */
function readVerificationState(projectRoot, sessionId) {
  try {
    const filePath = path.join(projectRoot, '.gemini', 'omg-state', sessionId, 'verification.json');
    if (!fs.existsSync(filePath)) {
      return { available: false };
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Staleness check (5-minute window)
    if (parsed.timestamp && (Date.now() - parsed.timestamp > VERIFICATION_STALE_MS)) {
      debug('Verification state is stale (> 5 min), ignoring');
      return { available: false };
    }

    const tcPassed = parsed?.typecheck?.passed !== false;
    const lintPassed = parsed?.lint?.passed !== false;
    const allPassed = tcPassed && lintPassed;

    // Build error summary from first failing check
    let errorSummary = '';
    let errorCount = 0;
    if (!tcPassed) {
      errorSummary = `typecheck failing -- ${(parsed.typecheck.summary || 'unknown error').substring(0, 500)}`;
      errorCount += parsed.typecheck.errorCount || 1;
    }
    if (!lintPassed) {
      const lintMsg = `lint failing -- ${(parsed.lint.summary || 'unknown error').substring(0, 500)}`;
      errorSummary = errorSummary ? `${errorSummary}; ${lintMsg}` : lintMsg;
      errorCount += parsed.lint.errorCount || 1;
    }

    return { available: true, allPassed, errorSummary, errorCount };
  } catch (err) {
    debug(`readVerificationState failed: ${err.message}`);
    return { available: false };
  }
}

// ===================== Stuck Protocol (FR-2) =====================

/**
 * Check if the agent is stuck on the same error.
 * Pure computation, no I/O.
 * @param {object} state - Current ralph state
 * @param {string} currentErrorSignature - Error signature (first 100 chars)
 * @param {number} stuckThreshold - Consecutive same-error threshold
 * @returns {{ isStuck: boolean, updatedState: object }}
 */
function checkStuckProtocol(state, currentErrorSignature, stuckThreshold) {
  const updatedState = { ...state };
  const sig = (currentErrorSignature || '').substring(0, 100).trim();

  // Empty signatures are treated as unique (prevent false stuck detection)
  if (!sig) {
    updatedState.consecutiveSameError = 1;
    updatedState.lastErrorSignature = null;
    return { isStuck: false, updatedState };
  }

  if (sig === state.lastErrorSignature) {
    updatedState.consecutiveSameError = (state.consecutiveSameError || 0) + 1;
  } else {
    updatedState.consecutiveSameError = 1;
    updatedState.lastErrorSignature = sig;
  }

  if (updatedState.consecutiveSameError >= stuckThreshold) {
    // Stuck detected — add to stuckItems, reset counter
    const stuckItems = [...(state.stuckItems || [])];
    stuckItems.push(sig.substring(0, 200));
    // Cap stuckItems at 10 entries to prevent context bloat
    if (stuckItems.length > 10) {
      stuckItems.splice(0, stuckItems.length - 10);
    }
    updatedState.stuckItems = stuckItems;
    updatedState.consecutiveSameError = 0;
    return { isStuck: true, updatedState };
  }

  return { isStuck: false, updatedState };
}

// ===================== Heuristic Detection (unchanged from v1.0) =====================

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
 * Generate alternative approach suggestions (fallback for non-verification retries)
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

  return suggestions[(attemptNumber - 1) % suggestions.length];
}

// ===================== Circuit Breaker (unchanged from v1.0) =====================

/**
 * Extract circuit breaker budget from hook input.
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

  if (turnsRemaining <= 1) {
    return {
      exceeded: true,
      reason: `Circuit breaker: ${budget.turnsUsed}/${budget.maxTurns} turns used`,
      turnsRemaining: Math.max(0, turnsRemaining)
    };
  }

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

// ===================== Keyword Detection (unchanged from v1.0) =====================

/**
 * Check if ralph mode is active.
 * Uses keyword-registry as primary, falls back to inline detection if dist/ unavailable.
 * @param {string} prompt - User prompt
 * @param {object} context - Additional context
 * @returns {boolean} True if ralph mode is active
 */
function isRalphModeActive(prompt, context = {}) {
  if (detectRalphKeywordsFromRegistry) {
    return detectRalphKeywordsFromRegistry(prompt);
  }

  // Fallback: used only if dist/lib/keyword-registry.js is unavailable
  const combined = `${prompt} ${JSON.stringify(context)}`.toLowerCase();

  return combined.includes('@ralph') ||
         combined.includes('persistent:') ||
         combined.includes('persist:') ||
         combined.includes("don't give up") ||
         combined.includes('keep trying');
}

// ===================== Main Hook Logic =====================

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
    const stuckThreshold = ralphConfig.stuckThreshold || 3;
    const triggerPatterns = ralphConfig.triggerPatterns || [
      "I'm stuck",
      'I cannot',
      "I'm unable",
      'not possible',
      'failed to'
    ];

    // --- Determine if verification is active for this mode (FR-6) ---
    let autoVerificationEnabled = true;
    if (readModeState && composeModeProfile) {
      const modeState = readModeState(sessionId, projectRoot);
      const profile = composeModeProfile(modeState.primary, modeState.modifiers);
      autoVerificationEnabled = profile.autoVerification?.enabled !== false;
      debug(`Mode ${modeState.primary}: autoVerification=${autoVerificationEnabled}`);
    }

    // --- Success/Failure Detection ---
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
      // --- Verification check on success claim (FR-1) ---
      if (autoVerificationEnabled) {
        const vState = readVerificationState(projectRoot, sessionId);
        if (vState.available && !vState.allPassed) {
          // Agent claims success but verification shows errors — deny completion
          log(`Agent claims success but verification shows errors (${vState.errorCount} errors)`);
          const ralphState = loadRalphState(sessionId, projectRoot);
          ralphState.attempts = (ralphState.attempts || 0) + 1;
          ralphState.lastTimestamp = new Date().toISOString();

          // Stuck protocol check (FR-2)
          const errorSig = vState.errorSummary || '';
          const stuckCheck = checkStuckProtocol(ralphState, errorSig, stuckThreshold);
          Object.assign(ralphState, stuckCheck.updatedState);
          saveRalphState(sessionId, projectRoot, ralphState);

          if (stuckCheck.isStuck) {
            log('Stuck protocol triggered on verification-denied success claim');
            const stuckItemsNote = ralphState.stuckItems.length > 0
              ? `\nPreviously stuck on: ${ralphState.stuckItems.slice(-10).join(', ')}`
              : '';
            writeOutput({
              systemMessage: `Ralph Mode: Stuck detected — same error after ${stuckThreshold} attempts.\n\nSTUCK PROTOCOL:\n1. Document the blocker in a comment or TODO\n2. Move to the next task in the plan\n3. Come back to this later with fresh context\n\nDo not continue retrying the same approach.${stuckItemsNote}`
            });
            return;
          }

          // Check max retries
          if (ralphState.attempts >= maxRetries) {
            log('Max retries reached (verification-denied), escalating to user');
            ralphState.attempts = 0;
            saveRalphState(sessionId, projectRoot, ralphState);
            writeOutput({
              systemMessage: `Ralph Mode: Reached ${maxRetries} attempts. The task may need human intervention or a different approach. Here's what was tried - please provide guidance.`
            });
            return;
          }

          // Check circuit breaker
          const budget = getCircuitBreakerBudget(input);
          const cbCheck = checkCircuitBreaker(budget);
          if (cbCheck.exceeded) {
            log(`Circuit breaker exceeded: ${cbCheck.reason}`);
            ralphState.attempts = 0;
            saveRalphState(sessionId, projectRoot, ralphState);
            writeOutput({
              systemMessage: `Ralph Mode: Stopping retries - ${cbCheck.reason}. The task may need human intervention.`
            });
            return;
          }

          // Error-aware deny (FR-4)
          const budgetNote = `${cbCheck.turnsRemaining} turn${cbCheck.turnsRemaining !== 1 ? 's' : ''} remaining`;
          const stuckItemsContext = ralphState.stuckItems.length > 0
            ? ` Previously stuck on: ${ralphState.stuckItems.slice(-10).join(', ')}.`
            : '';
          const retryReason = `Ralph Mode (Attempt ${ralphState.attempts}/${maxRetries}): Verification shows ${vState.errorSummary.substring(0, 500)}. Try a different approach. ${budgetNote}.${stuckItemsContext}`;
          log(`Verification-denied success: ${vState.errorCount} errors`);
          writeOutput({
            decision: 'deny',
            reason: retryReason
          });
          return;
        }
      }

      // Genuine success (verification passed or unavailable)
      log(`Response indicates success (${successMatches} success vs ${failureMatches} failure matches), resetting attempts`);
      const ralphState = loadRalphState(sessionId, projectRoot);
      ralphState.attempts = 0;
      ralphState.consecutiveSameError = 0;
      ralphState.lastErrorSignature = null;
      saveRalphState(sessionId, projectRoot, ralphState);
      writeOutput({});
      return;
    }

    // Check if response indicates failure
    if (!hasFailure) {
      log('Response does not indicate failure');
      writeOutput({});
      return;
    }

    // --- Failure-detected retry path ---

    // Check circuit breaker budget before attempting retry
    const budget = getCircuitBreakerBudget(input);
    const cbCheck = checkCircuitBreaker(budget);

    if (cbCheck.exceeded) {
      log(`Circuit breaker exceeded: ${cbCheck.reason}`);
      const ralphState = loadRalphState(sessionId, projectRoot);
      ralphState.attempts = 0;
      saveRalphState(sessionId, projectRoot, ralphState);
      writeOutput({
        systemMessage: `Ralph Mode: Stopping retries - ${cbCheck.reason}. The task may need human intervention.`
      });
      return;
    }

    // Load and increment state
    const ralphState = loadRalphState(sessionId, projectRoot);
    ralphState.attempts = (ralphState.attempts || 0) + 1;
    ralphState.lastTimestamp = new Date().toISOString();

    log(`Failure detected. Attempt ${ralphState.attempts}/${maxRetries}`);

    if (ralphState.attempts >= maxRetries) {
      // Max retries reached - escalate to user
      log('Max retries reached, escalating to user');
      ralphState.attempts = 0;
      saveRalphState(sessionId, projectRoot, ralphState);

      writeOutput({
        systemMessage: `Ralph Mode: Reached ${maxRetries} attempts. The task may need human intervention or a different approach. Here's what was tried - please provide guidance.`
      });
      return;
    }

    // --- Determine error signature for stuck detection ---
    let currentErrorSignature = '';
    let errorAwareMessage = '';

    if (autoVerificationEnabled) {
      const vState = readVerificationState(projectRoot, sessionId);
      if (vState.available && !vState.allPassed) {
        currentErrorSignature = vState.errorSummary || '';
        errorAwareMessage = `Verification shows ${vState.errorSummary.substring(0, 500)}.`;
      }
    }

    // If no verification error, use the first trigger pattern match as signature
    if (!currentErrorSignature) {
      for (const pattern of triggerPatterns) {
        if (responseLower.includes(pattern.toLowerCase())) {
          currentErrorSignature = pattern;
          break;
        }
      }
    }

    // Stuck protocol check (FR-2)
    const stuckCheck = checkStuckProtocol(ralphState, currentErrorSignature, stuckThreshold);
    Object.assign(ralphState, stuckCheck.updatedState);
    saveRalphState(sessionId, projectRoot, ralphState);

    if (stuckCheck.isStuck) {
      log('Stuck protocol triggered');
      const stuckItemsNote = ralphState.stuckItems.length > 0
        ? `\nPreviously stuck on: ${ralphState.stuckItems.slice(-10).join(', ')}`
        : '';
      writeOutput({
        systemMessage: `Ralph Mode: Stuck detected — same error after ${stuckThreshold} attempts.\n\nSTUCK PROTOCOL:\n1. Document the blocker in a comment or TODO\n2. Move to the next task in the plan\n3. Come back to this later with fresh context\n\nDo not continue retrying the same approach.${stuckItemsNote}`
      });
      return;
    }

    // --- Generate retry message (FR-4) ---
    const budgetNote = `${cbCheck.turnsRemaining} turn${cbCheck.turnsRemaining !== 1 ? 's' : ''} remaining before circuit breaker`;
    const stuckItemsContext = ralphState.stuckItems.length > 0
      ? ` Previously stuck on: ${ralphState.stuckItems.slice(-10).join(', ')}.`
      : '';

    let retryReason;
    if (errorAwareMessage) {
      // Error-aware retry with verification info
      retryReason = `Ralph Mode (Attempt ${ralphState.attempts}/${maxRetries}): ${errorAwareMessage} Try a different approach. ${budgetNote}.${stuckItemsContext}`;
    } else {
      // Fallback to generic suggestion (v1.0 behavior)
      const suggestion = generateSuggestion(ralphState.attempts);
      let modeNote = '';
      if (readModeState) {
        const modeState = readModeState(sessionId, projectRoot);
        modeNote = `, mode: ${modeState.primary}`;
      }
      retryReason = `Ralph Mode (Attempt ${ralphState.attempts}/${maxRetries}${modeNote}): Retrying — ${budgetNote}. ${suggestion} Please try again with a different approach.${stuckItemsContext}`;
    }

    log(`Forcing retry: attempt ${ralphState.attempts}/${maxRetries} (${budgetNote})`);

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
