/**
 * oh-my-gemini Hooks - Cross-Platform Utilities
 * 
 * Provides platform detection and command normalization for Windows/Unix compatibility.
 * Windows uses cmd.exe/PowerShell while Unix uses bash - this module bridges the gap.
 */

const os = require('os');
const path = require('path');

/**
 * Platform detection
 */
const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';
const isLinux = os.platform() === 'linux';

/**
 * Get the null device for the current platform
 * @returns {string} Platform-specific null device path
 */
function getNullDevice() {
  return isWindows ? 'NUL' : '/dev/null';
}

/**
 * Get the home directory for the current platform
 * @returns {string} Home directory path
 */
function getHomeDir() {
  return os.homedir();
}

/**
 * Normalize path separators for the current platform
 * @param {string} inputPath - Path to normalize
 * @returns {string} Normalized path
 */
function normalizePath(inputPath) {
  if (!inputPath) return inputPath;
  return inputPath.split(/[/\\]/).join(path.sep);
}

/**
 * Convert a path to Unix-style (for git commands which prefer forward slashes)
 * @param {string} inputPath - Path to convert
 * @returns {string} Unix-style path
 */
function toUnixPath(inputPath) {
  if (!inputPath) return inputPath;
  return inputPath.split(path.sep).join('/');
}

/**
 * Normalize shell command for cross-platform execution
 * Converts bash-isms to Windows-compatible equivalents
 * 
 * @param {string} cmd - Shell command to normalize
 * @returns {string} Platform-appropriate command
 */
function normalizeCommand(cmd) {
  if (!isWindows) {
    return cmd;
  }

  let normalized = cmd;

  // Replace /dev/null redirections
  normalized = normalized.replace(/2>\/dev\/null/g, '2>NUL');
  normalized = normalized.replace(/&>\/dev\/null/g, '>NUL 2>&1');
  normalized = normalized.replace(/>\/dev\/null\s*2>&1/g, '>NUL 2>&1');
  normalized = normalized.replace(/>\/dev\/null/g, '>NUL');

  // Replace common Unix commands that don't exist on Windows
  // Note: These are basic replacements - complex piping may need manual handling
  
  // 'which' -> 'where' (command location)
  normalized = normalized.replace(/\bwhich\s+/g, 'where ');
  
  // 'cat' -> 'type' (file content)
  normalized = normalized.replace(/\bcat\s+/g, 'type ');
  
  // 'ls' -> 'dir' (directory listing) - but git-ls works, so be careful
  // Only replace standalone 'ls' not 'git ls-files' etc.
  normalized = normalized.replace(/^ls\s+/g, 'dir ');
  normalized = normalized.replace(/\|\s*ls\s+/g, '| dir ');
  
  // Remove 'head' and 'tail' pipes (Windows doesn't have these natively)
  // These are informational, so we can just remove the limiter
  normalized = normalized.replace(/\|\s*head\s+-n?\s*\d+/gi, '');
  normalized = normalized.replace(/\|\s*tail\s+-n?\s*\d+/gi, '');
  normalized = normalized.replace(/\|\s*head\s+-\d+/gi, '');
  normalized = normalized.replace(/\|\s*tail\s+-\d+/gi, '');
  
  // Remove 'grep' pipes with simple patterns (complex grep needs manual handling)
  // This is a lossy operation but prevents command failure
  // normalized = normalized.replace(/\|\s*grep\s+[^\|]+/gi, '');
  
  // 'rm -rf' -> 'rmdir /s /q' or 'del /f /q' depending on target
  // Note: This is dangerous - we handle this in security checks instead
  
  // 'mkdir -p' -> 'mkdir' (Windows mkdir creates parents by default in cmd)
  normalized = normalized.replace(/mkdir\s+-p\s+/g, 'mkdir ');
  
  // 'touch' -> create empty file alternative
  // No direct equivalent - leave as is, will fail but that's safer
  
  // 'cp -r' -> 'xcopy /e /i'
  normalized = normalized.replace(/cp\s+-r\s+/g, 'xcopy /e /i ');
  
  // 'mv' -> 'move'
  normalized = normalized.replace(/\bmv\s+/g, 'move ');

  return normalized;
}

/**
 * Get platform-specific shell options for execSync
 * @returns {object} Shell configuration object
 */
function getShellOptions() {
  if (isWindows) {
    return {
      shell: true,  // Use default shell (cmd.exe or PowerShell)
      windowsHide: true  // Hide console window
    };
  }
  return {
    shell: '/bin/bash'  // Explicitly use bash on Unix
  };
}

/**
 * Check if a command is a Git command (which work cross-platform)
 * @param {string} cmd - Command to check
 * @returns {boolean} True if it's a git command
 */
function isGitCommand(cmd) {
  return /^\s*git\s+/.test(cmd);
}

/**
 * Check if npm/npx is available
 * @returns {boolean} True if npm is available
 */
function hasNpm() {
  const { execSync } = require('child_process');
  try {
    execSync(isWindows ? 'where npm' : 'which npm', { 
      stdio: 'pipe',
      timeout: 5000 
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the npm command for the current platform
 * @param {string} subcommand - npm subcommand (run, exec, etc.)
 * @returns {string} Full npm command
 */
function getNpmCommand(subcommand) {
  // npm works on both platforms, but we might need .cmd on Windows
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  return `${npmCmd} ${subcommand}`;
}

/**
 * Get the npx command for the current platform
 * @param {string} args - npx arguments
 * @returns {string} Full npx command
 */
function getNpxCommand(args) {
  const npxCmd = isWindows ? 'npx.cmd' : 'npx';
  return `${npxCmd} ${args}`;
}

/**
 * Escape a string for safe use in shell commands
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeShellArg(str) {
  if (!str) return '""';
  
  if (isWindows) {
    // Windows cmd.exe escaping
    // Double quotes need to be escaped with backslash inside double quotes
    // Special chars: & | < > ^ need to be escaped with ^
    let escaped = str.replace(/"/g, '\\"');
    if (/[&|<>^%]/.test(escaped) || /\s/.test(escaped)) {
      escaped = `"${escaped}"`;
    }
    return escaped;
  } else {
    // Unix shell escaping - wrap in single quotes, escape existing single quotes
    if (!/[^a-zA-Z0-9_\-./:=]/.test(str)) {
      return str;  // No escaping needed
    }
    return `'${str.replace(/'/g, "'\\''")}'`;
  }
}

/**
 * Build a command string from parts with proper escaping
 * @param {string[]} parts - Command parts
 * @returns {string} Joined command string
 */
function buildCommand(...parts) {
  return parts.map(p => escapeShellArg(p)).join(' ');
}

/**
 * Log platform information for debugging
 * @param {Function} logger - Logging function
 */
function logPlatformInfo(logger) {
  logger(`Platform: ${os.platform()} (${os.arch()})`);
  logger(`Node: ${process.version}`);
  logger(`Home: ${getHomeDir()}`);
  logger(`PathSep: ${path.sep}`);
}

module.exports = {
  // Platform detection
  isWindows,
  isMac,
  isLinux,
  
  // Path utilities
  getNullDevice,
  getHomeDir,
  normalizePath,
  toUnixPath,
  
  // Command utilities
  normalizeCommand,
  getShellOptions,
  isGitCommand,
  escapeShellArg,
  buildCommand,
  
  // NPM utilities
  hasNpm,
  getNpmCommand,
  getNpxCommand,
  
  // Debug
  logPlatformInfo
};
