#!/usr/bin/env node
/**
 * oh-my-gemini AfterTool Hook
 *
 * Event: AfterTool
 * Matcher: write_file|replace
 * Fires: After a matched tool executes
 *
 * Purpose:
 * - Run typecheck for TypeScript/JavaScript files
 * - Run lint for code files
 * - Inject results as context for agent
 *
 * Input: { tool_name, tool_input, tool_response, session_id, cwd, ... }
 * Output: { hookSpecificOutput: { additionalContext }, systemMessage? }
 * 
 * Cross-platform compatible (Windows/macOS/Linux)
 */

const path = require('path');
const fs = require('fs');
const {
  readInput,
  writeOutput,
  log,
  debug,
  findProjectRoot,
  runNpmCommand,
  shouldVerify,
  hasScript,
  platform
} = require('./lib/utils');
const { loadConfig, isFeatureEnabled, getConfigValue } = require('./lib/config');

// Import mode state and config for mode-aware verification
let readModeState, composeModeProfile;
try {
  const ms = require('../dist/lib/mode-state');
  readModeState = ms.readModeState;
  const mc = require('../dist/lib/mode-config');
  composeModeProfile = mc.composeModeProfile;
} catch (err) {
  debug(`Failed to load mode-state/mode-config: ${err.message}. Using config-only verification.`);
  readModeState = null;
  composeModeProfile = null;
}

/**
 * Run TypeScript type checking
 * @param {string} projectRoot - Project root directory
 * @param {string} filePath - File that was modified
 * @param {number} timeout - Timeout in milliseconds
 * @returns {object} Result with success, output
 */
function runTypeCheck(projectRoot, filePath, timeout = 30000) {
  // Check for TypeScript config
  const hasTsConfig = fs.existsSync(path.join(projectRoot, 'tsconfig.json'));
  
  if (!hasTsConfig) {
    debug('No tsconfig.json found, skipping typecheck');
    return { success: true, output: '', skipped: true };
  }
  
  // Check if project has a typecheck script
  if (hasScript('typecheck', projectRoot)) {
    debug('Running npm run typecheck');
    return runNpmCommand('run', 'typecheck', { cwd: projectRoot, timeout });
  }
  
  if (hasScript('type-check', projectRoot)) {
    debug('Running npm run type-check');
    return runNpmCommand('run', 'type-check', { cwd: projectRoot, timeout });
  }
  
  // Fall back to tsc --noEmit
  // Check if tsc is available
  const tscPath = path.join(projectRoot, 'node_modules', '.bin', platform.isWindows ? 'tsc.cmd' : 'tsc');
  
  if (fs.existsSync(tscPath)) {
    debug('Running tsc --noEmit');
    const { execFileSync } = require('child_process');

    try {
      const output = execFileSync(tscPath, ['--noEmit'], {
        encoding: 'utf8',
        timeout,
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { success: true, output: output || '' };
    } catch (err) {
      return {
        success: false,
        output: err.stdout || err.stderr || err.message || ''
      };
    }
  }
  
  debug('TypeScript compiler not found');
  return { success: true, output: '', skipped: true };
}

/**
 * Run ESLint
 * @param {string} projectRoot - Project root directory
 * @param {string} filePath - File that was modified
 * @param {number} timeout - Timeout in milliseconds
 * @returns {object} Result with success, output
 */
function runLint(projectRoot, filePath, timeout = 30000) {
  // Check for ESLint config
  const eslintConfigs = [
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml',
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs'
  ];
  
  const hasEslintConfig = eslintConfigs.some(config => 
    fs.existsSync(path.join(projectRoot, config))
  );
  
  // Also check package.json for eslintConfig
  let hasEslintInPackage = false;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    hasEslintInPackage = !!pkg.eslintConfig;
  } catch {
    // Ignore
  }
  
  if (!hasEslintConfig && !hasEslintInPackage) {
    debug('No ESLint config found, skipping lint');
    return { success: true, output: '', skipped: true };
  }
  
  // Check if project has a lint script
  if (hasScript('lint', projectRoot)) {
    debug('Running npm run lint');
    // Use execFileSync with argument array to avoid shell injection from filePath
    const { execFileSync } = require('child_process');
    const npmCmd = platform.isWindows ? 'npm.cmd' : 'npm';
    try {
      const output = execFileSync(npmCmd, ['run', 'lint', '--', filePath], {
        encoding: 'utf8',
        timeout,
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { success: true, output: output || '' };
    } catch (err) {
      return {
        success: err.status === 1,
        output: err.stdout || err.stderr || err.message || '',
        hasLintErrors: true
      };
    }
  }
  
  // Fall back to direct eslint
  const eslintPath = path.join(projectRoot, 'node_modules', '.bin', platform.isWindows ? 'eslint.cmd' : 'eslint');
  
  if (fs.existsSync(eslintPath)) {
    debug(`Running eslint on ${filePath}`);
    const { execFileSync } = require('child_process');

    try {
      const output = execFileSync(eslintPath, [filePath], {
        encoding: 'utf8',
        timeout,
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { success: true, output: output || '' };
    } catch (err) {
      // ESLint exits with code 1 for lint errors
      return {
        success: err.status === 1,  // Lint errors are "expected" failures
        output: err.stdout || err.stderr || err.message || '',
        hasLintErrors: true
      };
    }
  }
  
  debug('ESLint not found');
  return { success: true, output: '', skipped: true };
}

/**
 * Write verification state to session-scoped state directory.
 * Schema: { lastRun: string (ISO 8601), typecheck: { passed, errorCount, summary },
 *           lint: { passed, errorCount, summary }, timestamp: number (epoch ms) }
 * Uses temp-file + rename for atomic writes (Windows/Unix safe).
 * @param {string} projectRoot - Project root directory
 * @param {string} sessionId - Session identifier
 * @param {object|null} typecheckResult - Result from runTypeCheck, or null if skipped
 * @param {object|null} lintResult - Result from runLint, or null if skipped
 */
function writeVerificationState(projectRoot, sessionId, typecheckResult, lintResult) {
  try {
    const dir = path.join(projectRoot, '.gemini', 'omg-state', sessionId);
    fs.mkdirSync(dir, { recursive: true });

    const extractSummary = (result) => {
      if (!result || result.skipped) return { passed: true, errorCount: 0, summary: '' };
      const passed = result.success && !result.hasLintErrors;
      const output = (result.output || '').trim();
      const summary = output.substring(0, 500);
      const errorCount = passed ? 0 : Math.max(1, output.split('\n').filter(l => l.trim()).length);
      return { passed, errorCount, summary };
    };

    const state = {
      lastRun: new Date().toISOString(),
      typecheck: extractSummary(typecheckResult),
      lint: extractSummary(lintResult),
      timestamp: Date.now()
    };

    const json = JSON.stringify(state, null, 2);
    const tmpPath = path.join(dir, 'verification.tmp.json');
    const finalPath = path.join(dir, 'verification.json');

    fs.writeFileSync(tmpPath, json);
    try {
      fs.renameSync(tmpPath, finalPath);
    } catch (renameErr) {
      // Fallback: direct write if rename fails (e.g., cross-device on some Windows configs)
      fs.writeFileSync(finalPath, json);
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
    debug(`writeVerificationState: wrote ${finalPath}`);
  } catch (err) {
    debug(`writeVerificationState failed: ${err.message}`);
    // Non-fatal — Ralph will fall back to heuristics
  }
}

/**
 * Format verification results for context injection
 * @param {string} checkType - Type of check (typecheck, lint)
 * @param {object} result - Result from verification
 * @returns {string} Formatted message
 */
function formatResult(checkType, result) {
  if (result.skipped) {
    return '';
  }
  
  if (result.success && !result.output) {
    return `✅ ${checkType}: passed\n`;
  }
  
  if (!result.success || result.hasLintErrors) {
    const icon = checkType === 'typecheck' ? '❌' : '⚠️';
    const lines = result.output.trim().split('\n').slice(0, 10);  // Limit output
    return `${icon} ${checkType} issues:\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`;
  }
  
  return `✅ ${checkType}: passed\n`;
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
    
    log(`AfterTool hook fired. Tool: ${toolName}`);
    debug(`Platform: ${platform.isWindows ? 'Windows' : 'Unix'}`);
    
    // Get the file that was modified
    const filePath = toolInput.path || toolInput.file_path || toolInput.target_file || '';
    
    if (!filePath) {
      log('No file path found in tool input');
      writeOutput({});
      return;
    }
    
    // Check if this file type should be verified
    if (!shouldVerify(filePath)) {
      log(`Skipping verification for non-code file: ${filePath}`);
      writeOutput({});
      return;
    }
    
    // Find project root
    const projectRoot = findProjectRoot(cwd);
    
    // Load configuration
    const config = loadConfig(projectRoot);
    
    if (!isFeatureEnabled(config, 'autoVerification')) {
      log('Auto-verification is disabled');
      writeOutput({});
      return;
    }

    // --- Mode-aware verification intensity ---
    const sessionId = input.session_id || 'default';
    let verifyTypecheck = true;
    let verifyLint = true;

    if (readModeState && composeModeProfile) {
      const modeState = readModeState(sessionId, projectRoot);
      const profile = composeModeProfile(modeState.primary, modeState.modifiers);

      if (profile.autoVerification) {
        if (profile.autoVerification.enabled === false) {
          log(`Mode ${modeState.primary}: verification disabled, skipping`);
          writeOutput({});
          return;
        }
        verifyTypecheck = profile.autoVerification.typecheck !== false;
        verifyLint = profile.autoVerification.lint !== false;
        debug(`Mode ${modeState.primary}: typecheck=${verifyTypecheck}, lint=${verifyLint}`);
      }
    }

    const verificationConfig = getConfigValue(config, 'autoVerification', {});
    const timeout = verificationConfig.timeout || 30000;

    let additionalContext = '';
    let hasErrors = false;
    let typecheckResult = null;
    let lintResult = null;

    // --- Run TypeCheck ---
    if (verifyTypecheck && verificationConfig.typecheck !== false) {
      log(`Running typecheck for ${filePath}`);
      typecheckResult = runTypeCheck(projectRoot, filePath, timeout);

      const formattedResult = formatResult('TypeCheck', typecheckResult);
      if (formattedResult) {
        additionalContext += formattedResult;
      }

      if (!typecheckResult.success && !typecheckResult.skipped) {
        hasErrors = true;
      }
    }

    // --- Run Lint ---
    if (verifyLint && verificationConfig.lint !== false) {
      log(`Running lint for ${filePath}`);
      lintResult = runLint(projectRoot, filePath, timeout);

      const formattedResult = formatResult('Lint', lintResult);
      if (formattedResult) {
        additionalContext += formattedResult;
      }

      if (lintResult.hasLintErrors) {
        // Lint errors are warnings, not blockers
        additionalContext += '\n_Consider fixing lint warnings before proceeding._\n';
      }
    }

    // --- Write verification state for Ralph (FR-1) ---
    // Only write if at least one check was not skipped
    const hasActualResults = (typecheckResult && !typecheckResult.skipped) ||
                             (lintResult && !lintResult.skipped);
    if (hasActualResults) {
      writeVerificationState(projectRoot, sessionId, typecheckResult, lintResult);
    }

    // --- Build Output (dual-channel for masking compatibility) ---
    const output = {};

    if (additionalContext.trim()) {
      output.hookSpecificOutput = {
        additionalContext: `## Auto-Verification Results\n${additionalContext.trim()}`
      };
    }

    // Critical errors always go via systemMessage (survives masking)
    if (hasErrors) {
      output.systemMessage = 'Verification found type errors — review before continuing';
    }

    writeOutput(output);
  } catch (err) {
    log(`AfterTool hook error: ${err.message}`);
    // Don't fail the hook
    writeOutput({});
  }
}

main();
