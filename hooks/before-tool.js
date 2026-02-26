#!/usr/bin/env node
/**
 * oh-my-gemini BeforeTool Hook
 *
 * Event: BeforeTool
 * Matcher: write_file|replace|edit_file|create_file|run_shell_command|shell
 * Fires: Before a matched tool executes
 *
 * Purpose:
 * - Block user-configured dangerous commands (from omg-config.json blockedCommands)
 * - Block user-configured protected paths (from omg-config.json blockedPaths)
 * - Create git checkpoints before file modifications
 *
 * Static security rules (dangerous OS commands, system path protection) are now
 * handled by the Gemini CLI policy engine via policies/omg-security.toml.
 * This hook only applies user-custom blocks and git checkpoints.
 *
 * Input: { tool_name, tool_input, mcp_context?, session_id, cwd, ... }
 * Output: { decision?: "deny", reason?, hookSpecificOutput?: { tool_input } }
 *
 * Exit Code 2: Block the tool with stderr as reason
 *
 * Cross-platform compatible (Windows/macOS/Linux)
 */

const path = require('path');
const {
  readInput,
  writeOutput,
  log,
  debug,
  findProjectRoot,
  isGitRepo,
  hasUncommittedChanges,
  createGitCheckpoint,
  platform
} = require('./lib/utils');
const { loadConfig, getConfigValue } = require('./lib/config');

/**
 * Check if command matches any user-configured blocked pattern.
 * @param {string} command - Shell command to check
 * @param {string[]} blockedPatterns - User-defined blocked command patterns from config
 * @returns {string|null} Matched pattern or null if safe
 */
function isBlockedCommand(command, blockedPatterns) {
  const cmdLower = command.toLowerCase();

  for (const pattern of blockedPatterns) {
    if (cmdLower.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }

  return null;
}

/**
 * Check if a path matches any user-configured blocked path.
 * @param {string} filePath - File path to check
 * @param {string[]} blockedPaths - User-defined blocked path patterns from config
 * @param {string} projectRoot - Project root directory
 * @returns {string|null} Matched pattern or null if allowed
 */
function isBlockedPath(filePath, blockedPaths, projectRoot) {
  const normalizedPath = path.normalize(filePath);
  const relativePath = path.relative(projectRoot, normalizedPath);

  // Convert to forward slashes for consistent comparison
  const forwardPath = normalizedPath.split(path.sep).join('/').toLowerCase();
  const forwardRelative = relativePath.split(path.sep).join('/').toLowerCase();

  for (const blocked of blockedPaths) {
    const blockedLower = blocked.toLowerCase().split(path.sep).join('/');

    if (forwardPath.includes(blockedLower)) {
      return blocked;
    }

    if (forwardRelative.startsWith(blockedLower) || forwardRelative.includes('/' + blockedLower)) {
      return blocked;
    }
  }

  return null;
}

/**
 * Main hook logic
 */
async function main() {
  try {
    const input = await readInput();
    const toolName = input.tool_name || '';
    const toolInput = input.tool_input || {};
    const cwd = input.cwd || process.cwd();

    log(`BeforeTool hook fired. Tool: ${toolName}`);
    debug(`Platform: ${platform.isWindows ? 'Windows' : 'Unix'}`);

    // Find project root
    const projectRoot = findProjectRoot(cwd);

    // Load configuration
    const config = loadConfig(projectRoot);

    const securityConfig = getConfigValue(config, 'security', {});
    const blockedCommands = securityConfig.blockedCommands || [];
    const blockedPaths = securityConfig.blockedPaths || [];

    // --- Shell Command Security (user-custom blocks only) ---
    if (toolName === 'run_shell_command' || toolName === 'execute_command' || toolName === 'shell') {
      const command = toolInput.command || toolInput.cmd || '';

      if (blockedCommands.length > 0) {
        const blockedPattern = isBlockedCommand(command, blockedCommands);
        if (blockedPattern) {
          log(`BLOCKED command matching user-configured pattern: ${blockedPattern}`);
          process.stderr.write(`Security: Command blocked by user config — matches pattern: ${blockedPattern}`);
          process.exit(2);
        }
      }
    }

    // --- File Write Security (user-custom blocks + git checkpoints) ---
    if (['write_file', 'replace', 'edit_file', 'create_file'].includes(toolName)) {
      const filePath = toolInput.path || toolInput.file_path || toolInput.target_file || '';

      if (filePath && blockedPaths.length > 0) {
        const blockedPath = isBlockedPath(filePath, blockedPaths, projectRoot);
        if (blockedPath) {
          log(`BLOCKED write to user-configured protected path: ${blockedPath}`);
          process.stderr.write(`Security: Cannot write to protected path — blocked by user config: ${blockedPath}`);
          process.exit(2);
        }
      }

      // --- Git Checkpoint ---
      if (securityConfig.gitCheckpoints && isGitRepo(projectRoot)) {
        if (hasUncommittedChanges(projectRoot)) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const checkpointName = `omg-checkpoint-${timestamp}`;

          const stashed = createGitCheckpoint(checkpointName, projectRoot);
          if (stashed) {
            log(`Created git checkpoint: ${checkpointName}`);
          }
        }
      }
    }

    // Allow the tool to proceed
    writeOutput({});
  } catch (err) {
    log(`BeforeTool hook error: ${err.message}`);
    // Don't fail the hook - allow tool to proceed
    writeOutput({});
  }
}

main();
