#!/usr/bin/env node
/**
 * oh-my-gemini BeforeTool Hook
 *
 * Event: BeforeTool
 * Matcher: write_file|replace|edit_file|run_shell_command
 * Fires: Before a matched tool executes
 *
 * Purpose:
 * - Block dangerous shell commands (rm -rf, format, etc.)
 * - Block writes to protected paths (node_modules, .git, etc.)
 * - Create git checkpoints before file modifications
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
  runGitCommand,
  isGitRepo,
  hasUncommittedChanges,
  createGitCheckpoint,
  platform
} = require('./lib/utils');
const { loadConfig, getConfigValue } = require('./lib/config');

/**
 * Check if command matches any blocked pattern
 * @param {string} command - Shell command to check
 * @param {string[]} blockedPatterns - List of blocked command patterns
 * @returns {string|null} Matched pattern or null if safe
 */
function isBlockedCommand(command, blockedPatterns) {
  const cmdLower = command.toLowerCase();
  
  // Check explicit blocked patterns
  for (const pattern of blockedPatterns) {
    if (cmdLower.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }

  // Platform-specific dangerous pattern checks
  const dangerousPatterns = platform.isWindows
    ? [
        // Windows dangerous patterns
        /format\s+[a-z]:/i,                           // format drive
        /rd\s+\/s\s+(\/q\s+)?[a-z]:\\/i,              // recursive delete drive root
        /rmdir\s+\/s\s+(\/q\s+)?[a-z]:\\/i,           // recursive delete drive root
        /del\s+\/[fqs]+\s+[a-z]:\\/i,                 // delete drive files
        /del\s+\/[fqs]+\s+%\w+%/i,                    // delete env var paths
        /reg\s+delete\s+hk/i,                          // registry deletion
        /bcdedit/i,                                     // boot config
        /diskpart/i,                                    // disk partitioning
        /cipher\s+\/w/i,                               // secure wipe
        /sfc\s+\/scannow/i,                            // system file checker
        /net\s+user\s+\w+\s+\/delete/i,               // delete user
        /shutdown\s+\/[rsf]/i,                         // shutdown/restart
        /taskkill\s+\/f\s+\/im\s+(explorer|csrss|winlogon|services)/i  // kill system processes
      ]
    : [
        // Unix dangerous patterns
        /rm\s+(-[rf]+\s+)*[\/~]/,                     // rm with absolute paths
        />\s*\/dev\/[sh]d[a-z]/,                      // overwrite disk devices
        /mkfs\./,                                      // format filesystem
        /dd\s+if=.*of=\/dev/,                         // dd to device
        /chmod\s+(-R\s+)?777\s+\//,                   // chmod 777 on root paths
        /curl.*\|\s*(ba)?sh/,                         // pipe curl to shell
        /wget.*\|\s*(ba)?sh/,                         // pipe wget to shell
        /:()\{\s*:\|:&\s*\};:/,                       // fork bomb
        />\s*\/etc\//,                                 // overwrite system config
        /rm\s+-rf\s+--no-preserve-root/,              // explicit no-preserve-root
        /sudo\s+rm\s+-rf/,                            // sudo rm -rf
        /chown\s+-R\s+\w+:\w+\s+\//                   // chown root
      ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return pattern.toString();
    }
  }

  return null;
}

/**
 * Check if a path is protected
 * @param {string} filePath - File path to check
 * @param {string[]} blockedPaths - List of blocked path patterns
 * @param {string} projectRoot - Project root directory
 * @returns {string|null} Matched pattern or null if allowed
 */
function isBlockedPath(filePath, blockedPaths, projectRoot) {
  // Normalize the path for comparison
  const normalizedPath = path.normalize(filePath);
  const relativePath = path.relative(projectRoot, normalizedPath);
  
  // Convert to forward slashes for consistent comparison
  const forwardPath = normalizedPath.split(path.sep).join('/').toLowerCase();
  const forwardRelative = relativePath.split(path.sep).join('/').toLowerCase();
  
  for (const blocked of blockedPaths) {
    const blockedLower = blocked.toLowerCase().split(path.sep).join('/');
    
    // Check absolute path match
    if (forwardPath.includes(blockedLower)) {
      return blocked;
    }
    
    // Check relative path match
    if (forwardRelative.startsWith(blockedLower) || forwardRelative.includes('/' + blockedLower)) {
      return blocked;
    }
  }
  
  // Additional checks for system paths
  if (platform.isWindows) {
    // Block Windows system directories
    const windowsSystemPaths = [
      /^[a-z]:\\windows/i,
      /^[a-z]:\\program files/i,
      /^[a-z]:\\users\\[^\\]+\\appdata\\local\\microsoft/i
    ];
    
    for (const pattern of windowsSystemPaths) {
      if (pattern.test(normalizedPath)) {
        return 'Windows system directory';
      }
    }
  } else {
    // Block Unix system directories
    const unixSystemPaths = [
      /^\/etc\//,
      /^\/usr\//,
      /^\/bin\//,
      /^\/sbin\//,
      /^\/var\//,
      /^\/root\//,
      /^\/boot\//
    ];
    
    for (const pattern of unixSystemPaths) {
      if (pattern.test(normalizedPath)) {
        return 'Unix system directory';
      }
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
    
    // --- Shell Command Security ---
    if (toolName === 'run_shell_command' || toolName === 'execute_command') {
      const command = toolInput.command || toolInput.cmd || '';
      
      const blockedPattern = isBlockedCommand(command, blockedCommands);
      if (blockedPattern) {
        log(`BLOCKED dangerous command matching: ${blockedPattern}`);
        
        // Exit with code 2 to block the tool
        process.stderr.write(`🛑 Security: Command blocked - matches dangerous pattern: ${blockedPattern}`);
        process.exit(2);
      }
    }
    
    // --- File Write Security ---
    if (['write_file', 'replace', 'edit_file', 'create_file'].includes(toolName)) {
      const filePath = toolInput.path || toolInput.file_path || toolInput.target_file || '';
      
      if (filePath) {
        const blockedPath = isBlockedPath(filePath, blockedPaths, projectRoot);
        if (blockedPath) {
          log(`BLOCKED write to protected path: ${blockedPath}`);
          
          // Exit with code 2 to block the tool
          process.stderr.write(`🛑 Security: Cannot write to protected path: ${blockedPath}`);
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
