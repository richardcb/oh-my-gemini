/**
 * oh-my-gemini Hooks - Shared Utilities
 *
 * Common functions used across all hooks for:
 * - stdin/stdout JSON communication
 * - Project and Conductor state detection
 * - Agent mode detection
 * - Command execution
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Read JSON from stdin (blocking)
 * Gemini CLI sends hook input as JSON on stdin
 */
function readInput() {
  try {
    const chunks = [];
    const BUFSIZE = 1024;
    const buf = Buffer.alloc(BUFSIZE);
    let bytesRead;

    // Read all available data from stdin (fd 0)
    while (true) {
      try {
        bytesRead = fs.readSync(0, buf, 0, BUFSIZE);
        if (bytesRead === 0) break;
        chunks.push(Buffer.from(buf.slice(0, bytesRead)));
      } catch (e) {
        // EAGAIN means no more data available
        if (e.code === 'EAGAIN' || e.code === 'EOF') break;
        throw e;
      }
    }

    const input = Buffer.concat(chunks).toString('utf8').trim();
    if (!input) {
      return {};
    }
    return JSON.parse(input);
  } catch (err) {
    log(`Failed to read input: ${err.message}`);
    return {};
  }
}

/**
 * Write JSON to stdout
 * This is the only output Gemini CLI parses - must be valid JSON
 */
function writeOutput(obj) {
  process.stdout.write(JSON.stringify(obj));
}

/**
 * Log to stderr (visible in Gemini CLI logs but doesn't break JSON parsing)
 */
function log(message) {
  process.stderr.write(`[omg] ${message}\n`);
}

/**
 * Find project root by looking for .gemini/ or GEMINI.md
 * @param {string} startDir - Directory to start searching from
 * @returns {string} Project root path
 */
function findProjectRoot(startDir = process.cwd()) {
  let dir = startDir || process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (
      fs.existsSync(path.join(dir, '.gemini')) ||
      fs.existsSync(path.join(dir, 'GEMINI.md')) ||
      fs.existsSync(path.join(dir, 'conductor'))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return startDir || process.cwd();
}

/**
 * Load Conductor track state from filesystem
 * @param {string} projectRoot - Project root directory
 * @returns {object|null} Conductor state or null if not initialized
 */
function loadConductorState(projectRoot) {
  const tracksPath = path.join(projectRoot, 'conductor', 'tracks.md');
  const tracksDir = path.join(projectRoot, 'conductor', 'tracks');

  if (!fs.existsSync(tracksPath)) {
    return null;
  }

  try {
    const tracksContent = fs.readFileSync(tracksPath, 'utf8');

    // Find active track (marked with [ ])
    const activeMatch = tracksContent.match(/## \[ \] Track: (.+)\n*ID: ([^\*]+)\*/);

    if (!activeMatch) {
      // Check for in-progress track (marked with [~])
      const inProgressMatch = tracksContent.match(/## \[~\] Track: (.+)\n*ID: ([^\*]+)\*/);
      if (!inProgressMatch) {
        return { hasActiveTracks: false };
      }
      return loadTrackDetails(tracksDir, inProgressMatch[1].trim(), inProgressMatch[2].trim());
    }

    return loadTrackDetails(tracksDir, activeMatch[1].trim(), activeMatch[2].trim());
  } catch (err) {
    log(`Failed to load Conductor state: ${err.message}`);
    return null;
  }
}

/**
 * Load details for a specific track
 */
function loadTrackDetails(tracksDir, trackName, trackId) {
  const trackDir = path.join(tracksDir, trackId);

  let metadata = null;
  let plan = null;
  let spec = null;

  try {
    const metadataPath = path.join(trackDir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
  } catch (e) {
    // Metadata may not exist
  }

  try {
    const planPath = path.join(trackDir, 'plan.md');
    if (fs.existsSync(planPath)) {
      plan = fs.readFileSync(planPath, 'utf8');
    }
  } catch (e) {
    // Plan may not exist
  }

  try {
    const specPath = path.join(trackDir, 'spec.md');
    if (fs.existsSync(specPath)) {
      spec = fs.readFileSync(specPath, 'utf8');
    }
  } catch (e) {
    // Spec may not exist
  }

  return {
    hasActiveTracks: true,
    trackId,
    trackName,
    trackDir,
    metadata,
    plan,
    spec,
    currentPhase: metadata?.current_phase || detectPhaseFromPlan(plan),
    progress: calculateProgress(plan)
  };
}

/**
 * Detect current phase from plan content
 */
function detectPhaseFromPlan(planContent) {
  if (!planContent) return 'unknown';

  // Find the first incomplete task and determine its phase
  const lines = planContent.split('\n');
  let currentPhase = 'unknown';

  for (const line of lines) {
    // Track phase headers
    const phaseMatch = line.match(/^## Phase (\d+):/i);
    if (phaseMatch) {
      currentPhase = `phase-${phaseMatch[1]}`;
    }

    // Find first incomplete task
    if (line.match(/^- \[ \]/)) {
      return currentPhase;
    }
  }

  return 'complete';
}

/**
 * Calculate progress from plan.md task markers
 * @param {string} planContent - Content of plan.md
 * @returns {object} Progress statistics
 */
function calculateProgress(planContent) {
  if (!planContent) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  const completed = (planContent.match(/- \[x\]/gi) || []).length;
  const incomplete = (planContent.match(/- \[ \]/g) || []).length;
  const total = completed + incomplete;

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

/**
 * Find the current (first incomplete) task from plan
 */
function findCurrentTask(planContent) {
  if (!planContent) return null;

  const match = planContent.match(/- \[ \] (\d+\.\d+[^\n]+)/);
  return match ? match[1].trim() : null;
}

/**
 * Detect agent mode from prompt content and context
 * @param {string} prompt - User prompt
 * @param {string} context - Additional context
 * @returns {string} Agent mode: 'researcher' | 'architect' | 'executor' 
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
  const researchKeywords = /\b(find|search|look up|documentation|how to|best practice|example|tutorial|learn|research)\b/;
  const architectKeywords = /\b(design|architect|structure|plan|debug|why is|trace|analyze|investigate|root cause)\b/;

  if (researchKeywords.test(combined)) {
    return 'researcher';
  }
  if (architectKeywords.test(combined)) {
    return 'architect';
  }

  // Default to executor for implementation tasks
  return 'executor';
}

/**
 * Run a shell command with timeout
 * @param {string} cmd - Command to run
 * @param {object} options - Options (timeout, cwd)
 * @returns {object} Result with success, output, code
 */
function runCommand(cmd, options = {}) {
  const { timeout = 30000, cwd = process.cwd() } = options;

  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024 // 10MB
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
  if (!filepath) return false;

  const ext = path.extname(filepath).toLowerCase();
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'];
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
    if (!fs.existsSync(pkgPath)) return false;

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
  const result = runCommand('git rev-parse --git-dir', { cwd, timeout: 5000 });
  return result.success;
}

/**
 * Check if there are uncommitted changes
 * @param {string} cwd - Working directory
 * @returns {boolean} True if there are changes
 */
function hasUncommittedChanges(cwd) {
  const result = runCommand('git status --porcelain', { cwd, timeout: 5000 });
  return result.success && result.output.trim().length > 0;
}

module.exports = {
  readInput,
  writeOutput,
  log,
  findProjectRoot,
  loadConductorState,
  calculateProgress,
  findCurrentTask,
  detectAgentMode,
  runCommand,
  shouldVerify,
  hasScript,
  isGitRepo,
  hasUncommittedChanges
};
