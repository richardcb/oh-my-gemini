#!/usr/bin/env node
/**
 * oh-my-gemini AfterTool Hook
 *
 * Event: AfterTool
 * Matcher: write_file|replace|edit_file
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
    const { execSync } = require('child_process');
    
    try {
      const output = execSync(`"${tscPath}" --noEmit`, {
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
    // Only lint the specific file if possible
    return runNpmCommand('run', `lint -- "${filePath}"`, { cwd: projectRoot, timeout });
  }
  
  // Fall back to direct eslint
  const eslintPath = path.join(projectRoot, 'node_modules', '.bin', platform.isWindows ? 'eslint.cmd' : 'eslint');
  
  if (fs.existsSync(eslintPath)) {
    debug(`Running eslint on ${filePath}`);
    const { execSync } = require('child_process');
    
    try {
      const output = execSync(`"${eslintPath}" "${filePath}"`, {
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
    
    const verificationConfig = getConfigValue(config, 'autoVerification', {});
    const timeout = verificationConfig.timeout || 30000;
    
    let additionalContext = '';
    let hasErrors = false;
    
    // --- Run TypeCheck ---
    if (verificationConfig.typecheck !== false) {
      log(`Running typecheck for ${filePath}`);
      const typecheckResult = runTypeCheck(projectRoot, filePath, timeout);
      
      const formattedResult = formatResult('TypeCheck', typecheckResult);
      if (formattedResult) {
        additionalContext += formattedResult;
      }
      
      if (!typecheckResult.success && !typecheckResult.skipped) {
        hasErrors = true;
      }
    }
    
    // --- Run Lint ---
    if (verificationConfig.lint !== false) {
      log(`Running lint for ${filePath}`);
      const lintResult = runLint(projectRoot, filePath, timeout);
      
      const formattedResult = formatResult('Lint', lintResult);
      if (formattedResult) {
        additionalContext += formattedResult;
      }
      
      if (lintResult.hasLintErrors) {
        // Lint errors are warnings, not blockers
        additionalContext += '\n_Consider fixing lint warnings before proceeding._\n';
      }
    }
    
    // --- Build Output ---
    const output = {};
    
    if (additionalContext.trim()) {
      output.hookSpecificOutput = {
        additionalContext: `## 🔍 Auto-Verification Results\n${additionalContext.trim()}`
      };
    }
    
    if (hasErrors) {
      output.systemMessage = '⚠️ Verification found type errors - review before continuing';
    }
    
    writeOutput(output);
  } catch (err) {
    log(`AfterTool hook error: ${err.message}`);
    // Don't fail the hook
    writeOutput({});
  }
}

main();
