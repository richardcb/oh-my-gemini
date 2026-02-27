#!/usr/bin/env node
/**
 * oh-my-gemini Tool Filter Hook
 *
 * Event: BeforeToolSelection
 * Fires: Before tool selection for agent
 *
 * Purpose:
 * - Detect current agent mode from prompt keywords (@researcher, @architect, etc.)
 * - Filter available tools based on the detected mode
 *
 * WHY THIS HOOK EXISTS ALONGSIDE POLICIES:
 * The Gemini CLI v0.30.0 policy engine only supports static TOML rules.
 * Agent mode detection is dynamic — it reads the user's prompt at runtime to
 * detect keywords like @researcher, @architect, @executor, research:, design:,
 * debug:, implement:, build:, etc. This context-dependent logic cannot be
 * expressed in static TOML policies. The per-mode tool allowlists are defined
 * in omg-config.json (toolFilter.modes), not hardcoded here.
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
  detectAgentMode,
  platform
} = require('./lib/utils');
const { loadConfig, isFeatureEnabled, getConfigValue } = require('./lib/config');

/**
 * Main hook logic
 */
async function main() {
  try {
    const input = await readInput();
    const llmRequest = input.llm_request || {};
    const cwd = input.cwd || process.cwd();

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

    // Extract prompt from LLM request
    const messages = llmRequest.messages || [];
    const lastUserMessage = messages
      .filter(m => m.role === 'user')
      .pop();

    const prompt = lastUserMessage?.content || '';

    // Detect agent mode dynamically from prompt keywords
    const mode = detectAgentMode(prompt);
    log(`Detected mode: ${mode}`);

    // Get tool configuration for this mode from config
    const toolFilterConfig = getConfigValue(config, 'toolFilter', {});
    const modeConfig = toolFilterConfig.modes?.[mode];

    if (!modeConfig) {
      log(`No tool config for mode: ${mode}`);
      writeOutput({});
      return;
    }

    // Build output
    // Gemini API toolConfig.mode must be AUTO, ANY, or NONE.
    // - ANY forces tool calls on every turn (no text responses), causing loops.
    // - allowedFunctionNames is only valid with ANY mode.
    // Therefore we always use AUTO and log the detected mode for informational
    // purposes. Tool restriction via allowedFunctionNames is not feasible with
    // the current Gemini API without causing infinite tool-call loops.
    const output = {
      hookSpecificOutput: {
        toolConfig: {
          mode: 'AUTO'
        }
      }
    };

    log(`Agent mode: ${mode} (tools: ${modeConfig.allowed === '*' ? 'all' : modeConfig.allowed.join(', ')})`);

    writeOutput(output);
  } catch (err) {
    log(`ToolFilter hook error: ${err.message}`);
    // Don't fail the hook
    writeOutput({});
  }
}

main();
