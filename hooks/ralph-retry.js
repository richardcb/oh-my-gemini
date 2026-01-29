#!/usr/bin/env node
/**
 * oh-my-gemini Ralph Retry Hook
 *
 * Event: AfterAgent
 * Fires: After every agent response
 *
 * Purpose:
 * - Detect when agent indicates it's stuck or failed
 * - Automatically retry with alternative approach suggestions
 * - Track attempt count and escalate after max retries
 *
 * Named after the "Ralph loop" technique - never give up!
 *
 * Input: { prompt, prompt_response, stop_hook_active, session_id, cwd, ... }
 * Output: { decision?: "deny", reason?, systemMessage? }
 *
 * Activation: User includes "ralph", "persistent", or "don't give up" in prompt
 */

const fs = require('fs');
const path = require('path');
const {
  readInput,
  writeOutput,
  log,
  findProjectRoot
} = require('./lib/utils');
const { loadConfig } = require('./lib/config');

/**
 * State file path for tracking retries
 */
function getStatePath(projectRoot) {
  return path.join(projectRoot, '.gemini', '.ralph-state.json');
}

/**
 * Load retry state from file
 */
function loadRetryState(projectRoot) {
  const statePath = getStatePath(projectRoot);
  
  try {
    if (fs.existsSync(statePath)) {
      const content = fs.readFileSync(statePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    // Ignore errors, return default state
  }

  return {
    attempts: 0,
    lastPrompt: '',
    lastFailure: '',
    startTime: null,
    approaches: []
  };
}

/**
 * Save retry state to file
 */
function saveRetryState(projectRoot, state) {
  const stateDir = path.join(projectRoot, '.gemini');
  const statePath = getStatePath(projectRoot);

  try {
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (err) {
    log(`Failed to save retry state: ${err.message}`);
  }
}

/**
 * Clear retry state (on success or user intervention)
 */
function clearRetryState(projectRoot) {
  const statePath = getStatePath(projectRoot);
  
  try {
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
  } catch (err) {
    // Ignore
  }
}

/**
 * Check if ralph mode is activated in the prompt
 */
function isRalphModeActive(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  
  const activationPatterns = [
    'ralph',
    'persistent',
    "don't give up",
    'dont give up',
    'keep trying',
    'never give up',
    'try until',
    'persist until',
    'ralph mode',
    'persistence mode'
  ];

  return activationPatterns.some(pattern => lowerPrompt.includes(pattern));
}

/**
 * Check if response indicates failure/stuck
 */
function detectFailure(response, triggerPatterns) {
  const lowerResponse = response.toLowerCase();
  
  return triggerPatterns.some(pattern => 
    lowerResponse.includes(pattern.toLowerCase())
  );
}

/**
 * Check if response indicates success
 */
function detectSuccess(response) {
  const successPatterns = [
    /successfully\s+(completed?|implemented|created|fixed|resolved)/i,
    /task\s+(is\s+)?(complete|done|finished)/i,
    /all\s+(tests?\s+)?pass(ing|ed)?/i,
    /working\s+(correctly|as\s+expected)/i,
    /problem\s+(is\s+)?(solved|fixed|resolved)/i,
    /accomplished/i,
    /✅/,
    /🎉/
  ];

  return successPatterns.some(pattern => pattern.test(response));
}

/**
 * Generate alternative approach suggestion based on attempt number
 */
function getAlternativeSuggestion(attemptNumber, lastFailure) {
  const approaches = [
    {
      title: 'Break it down',
      suggestion: 'Try breaking the problem into smaller, more manageable steps. What\'s the simplest first step you can take?'
    },
    {
      title: 'Check existing patterns',
      suggestion: 'Search the codebase for similar patterns or implementations. Use `grep` or `search_file_content` to find examples.'
    },
    {
      title: 'Verify prerequisites',
      suggestion: 'Check if there are missing dependencies, configurations, or prerequisites. Read relevant config files and package.json.'
    },
    {
      title: 'Simplify first',
      suggestion: 'Try implementing a minimal version first, then add complexity. Get the basic case working before handling edge cases.'
    },
    {
      title: 'Read the errors',
      suggestion: 'Carefully read any error messages. Run the failing command again and analyze the exact error output.'
    },
    {
      title: 'Check documentation',
      suggestion: 'Search for documentation or examples online. Use web search to find how others have solved similar problems.'
    },
    {
      title: 'Different approach',
      suggestion: 'Consider a fundamentally different approach. Is there another way to achieve the same goal?'
    },
    {
      title: 'Isolate the issue',
      suggestion: 'Create a minimal reproduction. Remove unrelated code to isolate exactly what\'s failing.'
    }
  ];

  const index = (attemptNumber - 1) % approaches.length;
  return approaches[index];
}

function main() {
  try {
    const input = readInput();
    const prompt = input.prompt || '';
    const promptResponse = input.prompt_response || '';
    const stopHookActive = input.stop_hook_active || false;
    const cwd = input.cwd || process.cwd();

    const projectRoot = findProjectRoot(cwd);
    const config = loadConfig(projectRoot);

    // Skip if ralph mode is disabled
    if (!config.ralph || !config.ralph.enabled) {
      writeOutput({});
      return;
    }

    // Check if ralph mode is activated in the user's prompt
    if (!isRalphModeActive(prompt)) {
      // Clear any existing state since we're not in ralph mode
      clearRetryState(projectRoot);
      writeOutput({});
      return;
    }

    // Don't re-trigger if already in a retry (stop_hook_active means we're retrying)
    if (stopHookActive) {
      log('Already in retry loop, skipping ralph hook');
      writeOutput({});
      return;
    }

    // Load current state
    const state = loadRetryState(projectRoot);
    const maxRetries = config.ralph.maxRetries || 5;
    const triggerPatterns = config.ralph.triggerPatterns || [
      "I'm stuck",
      'I cannot',
      "I'm unable",
      'failed to'
    ];

    // Check for success - reset state if successful
    if (detectSuccess(promptResponse)) {
      log('Task appears successful, clearing ralph state');
      clearRetryState(projectRoot);
      
      writeOutput({
        systemMessage: `🎉 Ralph mode: Task completed after ${state.attempts} attempt(s)!`
      });
      return;
    }

    // Check for failure indicators
    if (!detectFailure(promptResponse, triggerPatterns)) {
      // No failure detected, continue normally
      writeOutput({});
      return;
    }

    // Failure detected - increment attempts
    state.attempts++;
    state.lastPrompt = prompt;
    state.lastFailure = promptResponse.slice(0, 500); // Store truncated failure
    state.startTime = state.startTime || new Date().toISOString();

    log(`Ralph mode: Attempt ${state.attempts}/${maxRetries}`);

    // Check for max retries exceeded
    if (state.attempts >= maxRetries) {
      log('Max retries reached, escalating to user');
      
      // Clear state for next time
      clearRetryState(projectRoot);

      writeOutput({
        systemMessage: `⚠️ **Ralph mode: Max retries (${maxRetries}) reached**\n\nI've tried ${state.attempts} different approaches but couldn't complete the task. Please provide guidance or try a different approach.`
      });
      return;
    }

    // Get alternative suggestion
    const alternative = getAlternativeSuggestion(state.attempts, state.lastFailure);
    
    // Track which approaches we've suggested
    state.approaches.push(alternative.title);
    saveRetryState(projectRoot, state);

    // Build retry prompt
    const retryReason = `
🔄 **Ralph Mode: Attempt ${state.attempts}/${maxRetries}**

The previous approach didn't work. Let's try something different.

**Strategy: ${alternative.title}**
${alternative.suggestion}

**What to do:**
1. Take a step back and analyze what went wrong
2. Try the suggested approach above
3. If that doesn't work either, I'll suggest another approach

Don't give up! We'll find a way to make this work.
`.trim();

    writeOutput({
      decision: 'deny',
      reason: retryReason
    });

  } catch (err) {
    log(`Ralph retry hook error: ${err.message}`);
    // On error, don't block
    writeOutput({});
  }
}

main();
