#!/usr/bin/env node
/**
 * oh-my-gemini Tool Filter Hook
 *
 * Event: BeforeToolSelection
 * Fires: Before tool selection for agent
 *
 * Purpose:
 * - Detect current agent mode from context
 * - Filter available tools based on mode
 * - researcher: read + search only
 * - architect: read only
 * - executor: full access (with BeforeTool safety)
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
    
    // Detect agent mode
    const mode = detectAgentMode(prompt);
    log(`Detected mode: ${mode}`);
    
    // Get tool configuration for this mode
    const toolFilterConfig = getConfigValue(config, 'toolFilter', {});
    const modeConfig = toolFilterConfig.modes?.[mode];
    
    if (!modeConfig) {
      log(`No tool config for mode: ${mode}`);
      writeOutput({});
      return;
    }
    
    // Build output
    const output = {
      hookSpecificOutput: {
        toolConfig: {
          mode: mode
        }
      }
    };
    
    // If mode has specific allowed tools (not '*'), set them
    if (modeConfig.allowed && modeConfig.allowed !== '*') {
      output.hookSpecificOutput.toolConfig.allowedFunctionNames = modeConfig.allowed;
      log(`Filtering tools for ${mode}: ${modeConfig.allowed.join(', ')}`);
    }
    
    writeOutput(output);
  } catch (err) {
    log(`ToolFilter hook error: ${err.message}`);
    // Don't fail the hook
    writeOutput({});
  }
}

main();
