/**
 * oh-my-gemini Hooks - Shared Utilities
 * 
 * Provides common functions for all hooks:
 * - Cross-platform command execution
 * - Input/output handling for Gemini CLI hooks
 * - Conductor state management
 * - Project detection and configuration
 * 
 * Updated for Windows/Unix cross-platform compatibility.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const platform = require('./platform');

// Debug mode flag - set via OMG_DEBUG=1 environment variable
const DEBUG = process.env.OMG_DEBUG === '1' || process.env.OMG_DEBUG === 'true';

/**
 * Read JSON input from stdin (Gemini CLI hook protocol)
 * @returns {Promise<object>} Parsed input object
 */
function readInput() {
  return new Promise((resolve, reject) => {
    let data = '';
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (err) {
        reject(new Error(`Failed to parse hook input: ${err.message}`));
      }
    });
    process.stdin.on('error', reject);
    
    // Timeout for stdin read (10 seconds)
    setTimeout(() => {
      if (!data) {
        resolve({});
      }
    }, 10000);
  });
}

/**
 * Write JSON output to stdout (Gemini CLI hook protocol)
 * @param {object} output - Output object to send
 */
function writeOutput(output) {
  try {
    process.stdout.write(JSON.stringify(output || {}));
  } catch (err) {
    log(`Failed to write output: ${err.message}`);
    process.stdout.write('{}');
  }
}

/**
 * Log a message to stderr (visible in debug mode)
 * @param {string} message - Message to log
 */
function log(message) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    process.stderr.write(`[omg ${timestamp}] ${message}\n`);
  }
}

/**
 * Log verbose debug info
 * @param {string} message - Message to log
 */
function debug(message) {
  if (DEBUG) {
    process.stderr.write(`[omg:debug] ${message}\n`);
  }
}

/**
 * Find the project root by looking for common markers
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} Project root path or null
 */
function findProjectRoot(startDir) {
  const markers = [
    'package.json',
    '.git',
    'GEMINI.md',
    '.gemini',
    'pyproject.toml',
    'Cargo.toml',
    'go.mod',
    'pom.xml',
    'build.gradle'
  ];
  
  let dir = path.resolve(startDir || process.cwd());
  const root = path.parse(dir).root;
  
  while (dir !== root) {
    for (const marker of markers) {
      const markerPath = path.join(dir, marker);
      try {
        if (fs.existsSync(markerPath)) {
          return dir;
        }
      } catch {
        // Ignore access errors
      }
    }
    dir = path.dirname(dir);
  }
  
  // Fallback to start directory
  return startDir || process.cwd();
}

/**
 * Load Conductor state from the project
 * @param {string} projectRoot - Project root directory
 * @returns {object|null} Conductor state or null if not using Conductor
 */
function loadConductorState(projectRoot) {
  const conductorDir = path.join(projectRoot, 'conductor');
  
  // Check if Conductor is being used
  if (!fs.existsSync(conductorDir)) {
    return null;
  }
  
  try {
    const state = {
      active: false,
      trackName: null,
      plan: null,
      progress: { completed: 0, total: 0, percentage: 0 }
    };
    
    // Look for active track
    const tracksDir = path.join(conductorDir, 'tracks');
    if (fs.existsSync(tracksDir)) {
      const tracks = fs.readdirSync(tracksDir).filter(f => {
        const trackPath = path.join(tracksDir, f);
        return fs.statSync(trackPath).isDirectory();
      });
      
      // Find most recent track with a plan.md
      for (const track of tracks.reverse()) {
        const planPath = path.join(tracksDir, track, 'plan.md');
        if (fs.existsSync(planPath)) {
          state.active = true;
          state.trackName = track;
          state.plan = fs.readFileSync(planPath, 'utf8');
          state.progress = calculateProgress(state.plan);
          break;
        }
      }
    }
    
    return state;
  } catch (err) {
    log(`Error loading Conductor state: ${err.message}`);
    return null;
  }
}

/**
 * Calculate progress from a plan.md file
 * @param {string} planContent - Content of plan.md
 * @returns {object} Progress object with completed, total, percentage
 */
function calculateProgress(planContent) {
  if (!planContent) {
    return { completed: 0, total: 0, percentage: 0 };
  }
  
  // Match task lines: - [ ] or - [x] or - [X]
  const taskPattern = /^[\s]*-\s*\[([ xX])\]/gm;
  let match;
  let total = 0;
  let completed = 0;
  
  while ((match = taskPattern.exec(planContent)) !== null) {
    total++;
    if (match[1].toLowerCase() === 'x') {
      completed++;
    }
  }
  
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

/**
 * Find the current (first uncompleted) task in a plan
 * @param {string} planContent - Content of plan.md
 * @returns {string|null} Current task text or null
 */
function findCurrentTask(planContent) {
  if (!planContent) return null;
  
  const lines = planContent.split('\n');
  
  for (const line of lines) {
    // Match uncompleted task: - [ ] Task text
    const match = line.match(/^[\s]*-\s*\[\s\]\s*(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Detect agent mode from prompt content
 * @param {string} prompt - User prompt
 * @param {string} context - Additional context
 * @returns {string} Agent mode: 'researcher', 'architect', or 'executor'
 */
function detectAgentMode(prompt, context = '') {
  const combined = `${prompt} ${context}`.toLowerCase();
  
  // Explicit mode markers (highest priority)
  if (combined.includes('@researcher') || combined.includes('research:')) {
    return 'researcher';
  }
  if (combined.includes('@architect') || combined.includes('design:') || combined.includes('debug:')) {
    return 'architect';
  }
  if (combined.includes('@executor') || combined.includes('implement:') || combined.includes('build:')) {
    return 'executor';
  }
  
  // Implicit detection from task keywords
  if (/\b(find|search|look\s*up|documentation|how\s+to|best\s+practice|research|investigate)\b/.test(combined)) {
    return 'researcher';
  }
  if (/\b(design|architect|structure|plan|debug|why\s+is|trace|analyze|review)\b/.test(combined)) {
    return 'architect';
  }
  
  // Default to executor for implementation tasks
  return 'executor';
}

/**
 * Run a shell command with timeout and cross-platform support
 * @param {string} cmd - Command to run
 * @param {object} options - Options: timeout, cwd
 * @returns {object} Result with success, output, code
 */
function runCommand(cmd, options = {}) {
  const { timeout = 30000, cwd = process.cwd() } = options;
  
  // Normalize command for Windows if needed
  // Git commands work cross-platform, so don't modify them
  let normalizedCmd = cmd;
  if (!platform.isGitCommand(cmd)) {
    normalizedCmd = platform.normalizeCommand(cmd);
  }
  
  debug(`Running command: ${normalizedCmd}`);
  debug(`  CWD: ${cwd}`);
  
  try {
    const output = execSync(normalizedCmd, {
      encoding: 'utf8',
      timeout,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,  // 10MB buffer
      ...platform.getShellOptions()
    });
    
    return {
      success: true,
      output: output || '',
      code: 0
    };
  } catch (err) {
    debug(`Command failed: ${err.message}`);
    return {
      success: false,
      output: err.stderr || err.stdout || err.message || '',
      code: err.status || 1
    };
  }
}

/**
 * Run a git command (cross-platform, no normalization needed)
 * @param {string} args - Git command arguments
 * @param {object} options - Options: timeout, cwd
 * @returns {object} Result with success, output, code
 */
function runGitCommand(args, options = {}) {
  const { timeout = 30000, cwd = process.cwd() } = options;
  
  // Git commands work the same on Windows and Unix
  const cmd = `git ${args}`;
  
  debug(`Running git command: ${cmd}`);
  
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024
    });
    
    return {
      success: true,
      output: output || '',
      code: 0
    };
  } catch (err) {
    // Don't log as error - git commands often fail expectedly (no repo, etc.)
    return {
      success: false,
      output: err.stderr || err.stdout || err.message || '',
      code: err.status || 1
    };
  }
}

/**
 * Run npm/npx command cross-platform
 * @param {string} subcommand - npm subcommand (run, exec, etc.)
 * @param {string} args - Additional arguments
 * @param {object} options - Options: timeout, cwd
 * @returns {object} Result with success, output, code
 */
function runNpmCommand(subcommand, args = '', options = {}) {
  const { timeout = 60000, cwd = process.cwd() } = options;
  
  // Use platform-specific npm command
  const npmCmd = platform.isWindows ? 'npm.cmd' : 'npm';
  const cmd = args ? `${npmCmd} ${subcommand} ${args}` : `${npmCmd} ${subcommand}`;
  
  debug(`Running npm command: ${cmd}`);
  
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024
    });
    
    return {
      success: true,
      output: output || '',
      code: 0
    };
  } catch (err) {
    return {
      success: false,
      output: err.stderr || err.stdout || err.message || '',
      code: err.status || 1
    };
  }
}

/**
 * Check if a file extension should trigger verification
 * @param {string} filepath - File path to check
 * @returns {boolean} True if file should be verified
 */
function shouldVerify(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  return codeExtensions.includes(ext);
}

/**
 * Check if package.json has a specific script
 * @param {string} scriptName - Script name to check
 * @param {string} projectRoot - Project root directory
 * @returns {boolean} True if script exists
 */
function hasScript(scriptName, projectRoot) {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return false;
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return !!(pkg.scripts && pkg.scripts[scriptName]);
  } catch {
    return false;
  }
}

/**
 * Check if we're in a git repository
 * @param {string} cwd - Working directory
 * @returns {boolean} True if in git repo
 */
function isGitRepo(cwd) {
  const result = runGitCommand('rev-parse --git-dir', { cwd, timeout: 5000 });
  return result.success;
}

/**
 * Check if there are uncommitted changes
 * @param {string} cwd - Working directory
 * @returns {boolean} True if there are uncommitted changes
 */
function hasUncommittedChanges(cwd) {
  const result = runGitCommand('status --porcelain', { cwd, timeout: 5000 });
  return result.success && result.output.trim().length > 0;
}

/**
 * Get recent git commits
 * @param {number} count - Number of commits to get
 * @param {string} cwd - Working directory
 * @returns {string} Commit log or empty string
 */
function getRecentCommits(count, cwd) {
  const result = runGitCommand(`log --oneline -${count}`, { cwd, timeout: 10000 });
  return result.success ? result.output.trim() : '';
}

/**
 * Get recently changed files
 * @param {number} commitCount - Number of commits to look back
 * @param {string} cwd - Working directory
 * @returns {string[]} List of changed file paths
 */
function getRecentlyChangedFiles(commitCount, cwd) {
  const result = runGitCommand(`diff --name-only HEAD~${commitCount}`, { cwd, timeout: 10000 });
  if (!result.success) return [];
  
  return result.output
    .trim()
    .split('\n')
    .filter(f => f.length > 0);
}

/**
 * Create a git stash checkpoint
 * @param {string} message - Stash message
 * @param {string} cwd - Working directory
 * @returns {boolean} True if stash was created
 */
function createGitCheckpoint(message, cwd) {
  if (!hasUncommittedChanges(cwd)) {
    return false;  // Nothing to checkpoint
  }
  
  const result = runGitCommand(`stash push -m "${message}"`, { cwd, timeout: 30000 });
  return result.success;
}

module.exports = {
  // I/O
  readInput,
  writeOutput,
  log,
  debug,
  
  // Project detection
  findProjectRoot,
  
  // Conductor
  loadConductorState,
  calculateProgress,
  findCurrentTask,
  
  // Agent detection
  detectAgentMode,
  
  // Command execution (cross-platform)
  runCommand,
  runGitCommand,
  runNpmCommand,
  
  // Verification
  shouldVerify,
  hasScript,
  
  // Git utilities
  isGitRepo,
  hasUncommittedChanges,
  getRecentCommits,
  getRecentlyChangedFiles,
  createGitCheckpoint,
  
  // Re-export platform utilities
  platform
};
