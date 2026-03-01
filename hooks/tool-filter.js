#!/usr/bin/env node
/**
 * oh-my-gemini Tool Filter Hook
 *
 * Event: BeforeToolSelection
 * Fires: Before tool selection for agent
 *
 * Purpose:
 * - Read persisted mode state (written by before-agent.js)
 * - Filter available tools based on the composed mode profile
 * - Support MCP tool passthrough for modes that allow it
 *
 * LIMITATION: BeforeToolSelection hooks use UNION aggregation. If multiple
 * extensions contribute hooks, their allowedFunctionNames are merged (not
 * intersected). OMG's tool restrictions can be bypassed by another extension.
 * Subagent `tools` fields in .gemini/agents/*.md are the only reliable
 * enforcement mechanism (not subject to union aggregation).
 *
 * WHY THIS HOOK EXISTS ALONGSIDE POLICIES:
 * Agent mode detection is dynamic — it reads the user's prompt at runtime to
 * detect keywords. This context-dependent logic cannot be expressed in static
 * TOML policies. The per-mode tool allowlists are defined in mode profiles
 * (mode-config.ts) with fallback to omg-config.json (toolFilter.modes).
 *
 * Input: { llm_request, session_id, cwd, ... }
 * Output: { hookSpecificOutput: { toolConfig: { mode?, allowedFunctionNames? } } }
 *
 * Cross-platform compatible (Windows/macOS/Linux)
 */

const {
  readInput,
  writeOutput,
  log,
  debug,
  findProjectRoot,
  platform
} = require('./lib/utils');
const { loadConfig, isFeatureEnabled, getConfigValue } = require('./lib/config');

// Import mode state and config from compiled TypeScript (with fallback)
let readModeState, composeModeProfile, getMetaTools;
try {
  const ms = require('../dist/lib/mode-state');
  readModeState = ms.readModeState;
  const mc = require('../dist/lib/mode-config');
  composeModeProfile = mc.composeModeProfile;
  getMetaTools = mc.getMetaTools;
} catch (err) {
  debug(`Failed to load mode-state/mode-config: ${err.message}. Falling back to config-only mode.`);
  readModeState = null;
  composeModeProfile = null;
  getMetaTools = null;
}

/**
 * Detect MCP tools from the tools list by the __ separator pattern.
 * @param {object[]} tools - Array of tool declarations from LLM request
 * @returns {string[]} Array of MCP tool names
 */
function detectMcpTools(tools) {
  if (!Array.isArray(tools)) return [];
  return tools
    .map(t => t.name || (t.functionDeclarations && t.functionDeclarations[0] && t.functionDeclarations[0].name) || '')
    .filter(name => name.includes('__'));
}

/**
 * Main hook logic
 */
async function main() {
  try {
    const input = await readInput();
    const llmRequest = input.llm_request || {};
    const cwd = input.cwd || process.cwd();
    const sessionId = input.session_id || 'default';

    log('ToolFilter hook fired');
    debug(`Platform: ${platform.isWindows ? 'Windows' : 'Unix'}`);

    // Find project root
    const projectRoot = findProjectRoot(cwd);

    // Load configuration
    const config = loadConfig(projectRoot);

    // Check if tool filtering is enabled
    if (!isFeatureEnabled(config, 'toolFilter')) {
      log('Tool filtering is disabled');
      writeOutput({});
      return;
    }

    // --- Read mode state (written by before-agent.js) ---
    let mode = 'implement';
    let modifiers = [];
    let profile = null;

    if (readModeState && composeModeProfile) {
      const modeState = readModeState(sessionId, projectRoot);
      mode = modeState.primary;
      modifiers = modeState.modifiers;
      profile = composeModeProfile(mode, modifiers);
      log(`Mode from state: ${mode}${modifiers.length ? '+' + modifiers.join('+') : ''}`);
    } else {
      // Fallback: use legacy config lookup
      log('Mode state unavailable, using legacy config lookup');
    }

    // --- Determine tool access from profile or config ---
    let tools = null;

    if (profile) {
      tools = profile.tools;
    } else {
      // Legacy: look up mode in toolFilter.modes config
      const toolFilterConfig = getConfigValue(config, 'toolFilter', {});
      const modeConfig = toolFilterConfig.modes?.[mode];
      if (modeConfig) {
        tools = modeConfig.allowed;
      }
    }

    // If tools is "*" or null, no filtering needed
    if (tools === '*' || tools === null) {
      log(`Mode: ${mode} — no tool filtering (tools: ${tools === null ? 'null/native' : '"*"'})`);
      writeOutput({
        hookSpecificOutput: {
          toolConfig: { mode: 'AUTO' }
        }
      });
      return;
    }

    // If tools is an array, build allowedFunctionNames
    if (Array.isArray(tools)) {
      const allowed = [...tools];

      // Always include meta-tools
      const metaTools = getMetaTools ? getMetaTools() : [
        'delegate_to_agent', 'ask_user', 'activate_skill',
        'save_memory', 'write_todos', 'get_internal_docs'
      ];
      for (const mt of metaTools) {
        if (!allowed.includes(mt)) allowed.push(mt);
      }

      // MCP passthrough: if enabled, detect and include MCP tools
      if (profile && profile.mcpPassthrough) {
        const allTools = llmRequest.tools || llmRequest.function_declarations || [];
        const mcpTools = detectMcpTools(allTools);
        for (const mcp of mcpTools) {
          if (!allowed.includes(mcp)) allowed.push(mcp);
        }
        if (mcpTools.length > 0) {
          debug(`MCP passthrough: added ${mcpTools.length} MCP tool(s)`);
        }
      }

      log(`Mode: ${mode} — filtering tools: ${allowed.join(', ')}`);

      // Note: Gemini API's toolConfig.mode AUTO with allowedFunctionNames
      // uses UNION aggregation across hooks. We set it for advisory purposes.
      writeOutput({
        hookSpecificOutput: {
          toolConfig: {
            mode: 'AUTO',
            allowedFunctionNames: allowed
          }
        }
      });
      return;
    }

    // Invalid tools type — log and skip filtering
    log(`Mode: ${mode} — unexpected tools type: ${typeof tools}, skipping filter`);
    writeOutput({});
  } catch (err) {
    log(`ToolFilter hook error: ${err.message}`);
    // Don't fail the hook
    writeOutput({});
  }
}

main();
