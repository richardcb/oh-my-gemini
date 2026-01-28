/**
 * oh-my-gemini Pre-Tool Hook
 * 
 * Automatically creates git checkpoints before risky file operations.
 * This hook runs before write_file and edit_file tools execute.
 * 
 * Usage: Place in .gemini/hooks/pre-tool.js
 */

const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  // Enable/disable auto-checkpoint
  enabled: true,
  
  // Only checkpoint for these tools
  riskyTools: ['write_file', 'edit_file'],
  
  // Paths that trigger checkpoint (glob patterns)
  protectedPaths: [
    'src/**',
    'lib/**',
    'app/**',
    'components/**',
    'pages/**',
    'api/**',
  ],
  
  // Paths to never checkpoint (even if in protectedPaths)
  excludePaths: [
    '*.log',
    '*.tmp',
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
  ],
  
  // Commit message prefix
  commitPrefix: '[omg-auto]',
  
  // Max checkpoints to keep
  maxCheckpoints: 50,
};

/**
 * Check if path matches any pattern in list
 */
function matchesPattern(filepath, patterns) {
  const path = require('path');
  
  for (const pattern of patterns) {
    // Simple glob matching
    if (pattern.includes('**')) {
      const prefix = pattern.split('**')[0];
      if (filepath.startsWith(prefix)) return true;
    } else if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(filepath) || regex.test(path.basename(filepath))) return true;
    } else if (filepath === pattern || filepath.startsWith(pattern + '/')) {
      return true;
    }
  }
  return false;
}

/**
 * Check if we're in a git repository
 */
function isGitRepo() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if there are uncommitted changes
 */
function hasChanges() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Create a checkpoint commit
 */
function createCheckpoint(filepath, tool) {
  try {
    // Stage all changes
    execSync('git add -A', { stdio: 'ignore' });
    
    // Create commit
    const message = `${CONFIG.commitPrefix} Checkpoint before ${tool} on ${filepath}`;
    execSync(`git commit -m "${message}" --no-verify`, { stdio: 'ignore' });
    
    console.log(`[omg-hook] Created checkpoint: ${message}`);
    return true;
  } catch (err) {
    console.warn(`[omg-hook] Failed to create checkpoint: ${err.message}`);
    return false;
  }
}

/**
 * Clean up old checkpoints
 */
function cleanupOldCheckpoints() {
  try {
    // Count auto checkpoints
    const log = execSync(
      `git log --oneline --grep="${CONFIG.commitPrefix}" | wc -l`,
      { encoding: 'utf8' }
    );
    const count = parseInt(log.trim(), 10);
    
    if (count > CONFIG.maxCheckpoints) {
      console.log(`[omg-hook] ${count} checkpoints exist, cleanup recommended`);
      // Note: Actual cleanup would require interactive rebase, skipping for safety
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Main hook function
 */
async function preToolHook(context) {
  // Skip if disabled
  if (!CONFIG.enabled) return;
  
  // Skip non-risky tools
  if (!CONFIG.riskyTools.includes(context.tool)) return;
  
  // Skip if no filepath
  const filepath = context.args?.path || context.args?.filepath;
  if (!filepath) return;
  
  // Skip excluded paths
  if (matchesPattern(filepath, CONFIG.excludePaths)) return;
  
  // Skip if not a protected path
  if (!matchesPattern(filepath, CONFIG.protectedPaths)) return;
  
  // Skip if not a git repo
  if (!isGitRepo()) {
    console.log('[omg-hook] Not a git repository, skipping checkpoint');
    return;
  }
  
  // Create checkpoint if there are changes
  if (hasChanges()) {
    createCheckpoint(filepath, context.tool);
    cleanupOldCheckpoints();
  } else {
    console.log('[omg-hook] No changes to checkpoint');
  }
}

module.exports = preToolHook;
