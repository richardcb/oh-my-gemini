#!/usr/bin/env node
/**
 * oh-my-gemini BeforeTool Hook
 *
 * Event: BeforeTool
 * Matcher: write_file|replace|edit_file|run_shell_command
 * Fires: Before a matched tool executes
 *
 * Purpose:
 * - Block dangerous shell commands (rm -rf, sudo, etc.)
 * - Block writes to protected paths (node_modules, .git, etc.)
 * - Create git checkpoints before file modifications
 *
 * Input: { tool_name, tool_input, mcp_context?, session_id, cwd, ... }
 * Output: { decision?: "deny", reason?, hookSpecificOutput?: { tool_input } }
 *
 * Exit Code 2: Block the tool with stderr as reason
 */

const path = require('path');
const {
  readInput,
  writeOutput,
  log,
  findProjectRoot,
  runCommand,
  isGitRepo,
  hasUncommittedChanges
} = require('./lib/utils');
const { loadConfig } = require('./lib/config');

/**
 * Check if command matches any blocked pattern
 */
function isBlockedCommand(command, blockedPatterns) {
  const cmdLower = command.toLowerCase();
  
  for (const pattern of blockedPatterns) {
    // Direct substring match
    if (cmdLower.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }

  // Additional dangerous pattern checks
  const dangerousPatterns = [
    /rm\s+(-[rf]+\s+)*[\/~]/,           // rm with absolute paths
    />\s*\/dev\/[sh]d[a-z]/,            // Overwrite disk devices
    /mkfs\./,                            // Format filesystem
    /dd\s+if=.*of=\/dev/,               // dd to device
    /chmod\s+(-R\s+)?777\s+\//,         // chmod 777 on root paths
    /curl.*\|\s*(ba)?sh/,               // Pipe curl to shell
    /wget.*\|\s*(ba)?sh/,               // Pipe wget to shell
  ];

  for (const regex of dangerousPatterns) {
    if (regex.test(command)) {
      return command.match(regex)[0];
    }
  }

  return null;
}

/**
 * Check if path matches any blocked path pattern
 */
function isBlockedPath(filepath, blockedPaths) {
  if (!filepath) return null;

  const normalizedPath = path.normalize(filepath);
  const parts = normalizedPath.split(path.sep);

  for (const blocked of blockedPaths) {
    // Check if any path segment matches
    if (parts.includes(blocked)) {
      return blocked;
    }
    // Check if path starts with blocked path
    if (normalizedPath.startsWith(blocked)) {
      return blocked;
    }
  }

  return null;
}

/**
 * Create a git checkpoint before file modification
 */
function createGitCheckpoint(projectRoot, toolName, filepath) {
  if (!isGitRepo(projectRoot)) {
    return false;
  }

  if (!hasUncommittedChanges(projectRoot)) {
    return false;
  }

  const filename = filepath ? path.basename(filepath) : 'files';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const message = `[omg-checkpoint] Before ${toolName} on ${filename} at ${timestamp}`;

  const result = runCommand(
    `git add -A && git commit -m "${message}" --no-verify`,
    { cwd: projectRoot, timeout: 10000 }
  );

  if (result.success) {
    log(`Created git checkpoint: ${message}`);
    return true;
  }

  return false;
}

function main() {
  try {
    const input = readInput();
    const toolName = input.tool_name || '';
    const toolInput = input.tool_input || {};
    const cwd = input.cwd || process.cwd();

    const projectRoot = findProjectRoot(cwd);
    const config = loadConfig(projectRoot);

    // --- Security Check: Shell Commands ---
    if (toolName === 'run_shell_command' || toolName === 'shell') {
      const command = toolInput.command || toolInput.cmd || '';
      
      const blockedPattern = isBlockedCommand(command, config.security.blockedCommands);
      if (blockedPattern) {
        log(`Blocked dangerous command: ${blockedPattern}`);
        writeOutput({
          decision: 'deny',
          reason: `🛑 **Security: Blocked dangerous command**\n\nThe command contains a blocked pattern: 
${blockedPattern}
\nThis operation is not allowed for safety reasons. If you believe this is a false positive, you can modify the blockedCommands in your .gemini/omg-config.json.`
        });
        return;
      }
    }

    // --- Security Check: File Writes ---
    if (['write_file', 'replace', 'edit_file', 'create_file'].includes(toolName)) {
      const filepath = toolInput.path || toolInput.file_path || toolInput.filepath || '';
      
      const blockedPath = isBlockedPath(filepath, config.security.blockedPaths);
      if (blockedPath) {
        log(`Blocked write to protected path: ${blockedPath}`);
        writeOutput({
          decision: 'deny',
          reason: `🛑 **Security: Protected path**\n\nCannot write to path containing 
${blockedPath}
\nThis directory is protected to prevent accidental damage. If you need to modify files here, do so manually.`
        });
        return;
      }
    }

    // --- Git Checkpoint ---
    if (config.security.gitCheckpoints) {
      const fileModifyTools = ['write_file', 'replace', 'edit_file', 'create_file'];
      
      if (fileModifyTools.includes(toolName)) {
        const filepath = toolInput.path || toolInput.file_path || toolInput.filepath || '';
        createGitCheckpoint(projectRoot, toolName, filepath);
      }
    }

    // --- Allow Tool ---
    // No issues found, allow the tool to proceed
    writeOutput({});

  } catch (err) {
    log(`BeforeTool hook error: ${err.message}`);
    // On error, allow the tool to proceed (fail open for usability)
    writeOutput({});
  }
}

main();
