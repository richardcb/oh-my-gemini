#!/usr/bin/env node
/**
 * oh-my-gemini Tool Filter Hook
 *
 * Event: BeforeToolSelection
 * Fires: Before LLM selects which tools to use
 *
 * Purpose:
 * - Detect current agent mode (researcher, architect, executor)
 * - Filter available tools based on mode
 * - Enforce tool sandboxing for safety
 *
 * Modes:
 * - researcher: Read-only + web search (no writes, no shell)
 * - architect: Read-only (analysis and design, no writes)
 * - executor: Full access (with BeforeTool security gates)
 *
 * Input: { llm_request: { model, messages, config, toolConfig }, ... }
 * Output: { hookSpecificOutput: { toolConfig: { mode?, allowedFunctionNames? } } }
 *
 * Note: This hook cannot use decision/continue/systemMessage - only toolConfig
 */

const {
  readInput,
  writeOutput,
  log,
  findProjectRoot,
  detectAgentMode,
  loadConductorState
} = require('./lib/utils');
const { loadConfig } = require('./lib/config');

/**
 * Extract recent conversation content for mode detection
 */
function extractRecentContent(messages, count = 5) {
  if (!messages || !Array.isArray(messages)) {
    return '';
  }

  return messages
    .slice(-count)
    .map(m => {
      if (typeof m.content === 'string') {
        return m.content;
      }
      if (Array.isArray(m.content)) {
        return m.content
          .filter(p => typeof p === 'string' || p.type === 'text')
          .map(p => (typeof p === 'string' ? p : p.text || ''))
          .join(' ');
      }
      return '';
    })
    .join('\n');
}

/**
 * Detect mode from Conductor phase
 * Earlier phases (data/backend) might need different tools than later (frontend)
 */
function detectModeFromConductorPhase(conductor) {
  if (!conductor || !conductor.currentPhase) {
    return null;
  }

  const phase = conductor.currentPhase.toLowerCase();

  // Research/planning phases
  if (phase.includes('discovery') || phase.includes('research') || phase.includes('planning')) {
    return 'researcher';
  }

  // Design phases
  if (phase.includes('design') || phase.includes('architect')) {
    return 'architect';
  }

  // Implementation phases - full access
  return null; // Let content-based detection decide
}

/**
 * Get allowed tools for a mode from config
 */
function getAllowedTools(config, mode) {
  const modeConfig = config.toolFilter?.modes?.[mode];
  
  if (!modeConfig) {
    return null; // No filtering
  }

  if (modeConfig.allowed === '*') {
    return null; // All tools allowed
  }

  if (Array.isArray(modeConfig.allowed)) {
    return modeConfig.allowed;
  }

  return null;
}

/**
 * Default tool sets if not configured
 */
const DEFAULT_TOOL_SETS = {
  researcher: [
    'google_web_search',
    'web_fetch',
    'read_file',
    'read_many_files',
    'list_dir',
    'glob',
    'search_file_content',
    'grep'
  ],
  architect: [
    'read_file',
    'read_many_files',
    'list_dir',
    'glob',
    'search_file_content',
    'grep',
    'find_by_name'
  ],
  executor: null // All tools
};

function main() {
  try {
    const input = readInput();
    const llmRequest = input.llm_request || {};
    const messages = llmRequest.messages || [];
    const cwd = input.cwd || process.cwd();

    const projectRoot = findProjectRoot(cwd);
    const config = loadConfig(projectRoot);

    // Skip if tool filtering is disabled
    if (!config.toolFilter || !config.toolFilter.enabled) {
      writeOutput({});
      return;
    }

    // Extract recent conversation for mode detection
    const recentContent = extractRecentContent(messages);

    // Try to detect mode from Conductor phase first
    const conductor = loadConductorState(projectRoot);
    let mode = detectModeFromConductorPhase(conductor);

    // Fall back to content-based detection
    if (!mode) {
      mode = detectAgentMode(recentContent);
    }

    log(`Detected agent mode: ${mode}`);

    // Get allowed tools for this mode
    let allowedTools = getAllowedTools(config, mode);

    // Fall back to defaults if not configured
    if (!allowedTools && DEFAULT_TOOL_SETS[mode]) {
      allowedTools = DEFAULT_TOOL_SETS[mode];
    }

    // No filtering needed
    if (!allowedTools) {
      writeOutput({});
      return;
    }

    log(`Filtering tools for ${mode} mode: ${allowedTools.length} tools allowed`);

    writeOutput({
      hookSpecificOutput: {
        toolConfig: {
          allowedFunctionNames: allowedTools
        }
      }
    });

  } catch (err) {
    log(`Tool filter hook error: ${err.message}`);
    // On error, don't filter - allow all tools
    writeOutput({});
  }
}

main();
