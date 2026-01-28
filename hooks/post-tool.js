/**
 * oh-my-gemini Post-Tool Hook
 * 
 * Runs verification after tool execution to catch issues early.
 * 
 * Usage: Place in .gemini/hooks/post-tool.js
 */

const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  // Enable/disable post-tool verification
  enabled: true,
  
  // Tools that trigger verification
  verifyAfterTools: ['write_file', 'edit_file', 'run_shell_command'],
  
  // File extensions that trigger type checking
  typecheckExtensions: ['.ts', '.tsx'],
  
  // File extensions that trigger lint
  lintExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  
  // Maximum verification time (ms)
  timeout: 30000,
};

/**
 * Run a command with timeout
 */
function runWithTimeout(cmd, timeout = CONFIG.timeout) {
  try {
    return execSync(cmd, { 
      encoding: 'utf8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    return { error: err.message, stderr: err.stderr };
  }
}

/**
 * Check if a command exists
 */
function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if package.json has a script
 */
function hasScript(scriptName) {
  try {
    const pkg = require(process.cwd() + '/package.json');
    return !!pkg.scripts?.[scriptName];
  } catch {
    return false;
  }
}

/**
 * Run TypeScript type checking
 */
function runTypeCheck() {
  if (hasScript('typecheck')) {
    return runWithTimeout('npm run typecheck 2>&1 | tail -20');
  } else if (commandExists('tsc')) {
    return runWithTimeout('tsc --noEmit 2>&1 | tail -20');
  }
  return null;
}

/**
 * Run linting
 */
function runLint() {
  if (hasScript('lint')) {
    return runWithTimeout('npm run lint 2>&1 | tail -20');
  }
  return null;
}

/**
 * Check for common errors in output
 */
function analyzeOutput(output) {
  const issues = [];
  
  if (typeof output === 'object' && output.error) {
    issues.push({ type: 'error', message: output.error });
    return issues;
  }
  
  if (!output) return issues;
  
  // TypeScript errors
  if (output.includes('error TS')) {
    const matches = output.match(/error TS\d+:.*/g) || [];
    matches.slice(0, 5).forEach(m => {
      issues.push({ type: 'typescript', message: m });
    });
  }
  
  // ESLint errors
  if (output.includes('error') && output.includes('eslint')) {
    issues.push({ type: 'lint', message: 'ESLint errors detected' });
  }
  
  // Build failures
  if (output.includes('Build failed') || output.includes('ELIFECYCLE')) {
    issues.push({ type: 'build', message: 'Build failed' });
  }
  
  return issues;
}

/**
 * Main hook function
 */
async function postToolHook(context) {
  // Skip if disabled
  if (!CONFIG.enabled) return;
  
  // Skip non-verified tools
  if (!CONFIG.verifyAfterTools.includes(context.tool)) return;
  
  const filepath = context.args?.path || context.args?.filepath;
  const result = context.result;
  
  // Skip if tool failed
  if (result?.error) {
    console.log('[omg-hook] Tool failed, skipping verification');
    return;
  }
  
  const issues = [];
  
  // Run type checking for TypeScript files
  if (filepath && CONFIG.typecheckExtensions.some(ext => filepath.endsWith(ext))) {
    console.log('[omg-hook] Running type check...');
    const typeResult = runTypeCheck();
    issues.push(...analyzeOutput(typeResult));
  }
  
  // Run lint for JS/TS files
  if (filepath && CONFIG.lintExtensions.some(ext => filepath.endsWith(ext))) {
    console.log('[omg-hook] Running lint...');
    const lintResult = runLint();
    issues.push(...analyzeOutput(lintResult));
  }
  
  // Report issues
  if (issues.length > 0) {
    console.log('\n[omg-hook] ⚠️  Verification found issues:');
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.type}] ${issue.message}`);
    });
    console.log('\n[omg-hook] Consider fixing these before proceeding.\n');
    
    // Return issues for the agent to see
    return {
      verification: {
        passed: false,
        issues: issues.map(i => `[${i.type}] ${i.message}`),
      }
    };
  } else {
    console.log('[omg-hook] ✓ Verification passed');
    return {
      verification: {
        passed: true,
        issues: [],
      }
    };
  }
}

module.exports = postToolHook;
