#!/usr/bin/env node
/**
 * oh-my-gemini AfterTool Hook
 *
 * Event: AfterTool
 * Matcher: write_file|replace|edit_file
 * Fires: After a matched tool executes
 *
 * Purpose:
 * - Run typecheck after TypeScript/JavaScript file modifications
 * - Run lint after code file modifications
 * - Inject verification results as context for the agent
 *
 * Input: { tool_name, tool_input, tool_response, mcp_context?, session_id, cwd, ... }
 * Output: { hookSpecificOutput?: { additionalContext }, systemMessage?, decision?, reason? }
 */

const path = require('path');
const {
  readInput,
  writeOutput,
  log,
  findProjectRoot,
  runCommand,
  shouldVerify,
  hasScript
} = require('./lib/utils');
const { loadConfig } = require('./lib/config');

/**
 * Run typecheck and return results
 */
function runTypecheck(projectRoot, timeout) {
  // Try different typecheck commands in order of preference
  const commands = [
    { check: () => hasScript('typecheck', projectRoot), cmd: 'npm run typecheck' },
    { check: () => hasScript('type-check', projectRoot), cmd: 'npm run type-check' },
    { check: () => hasScript('tsc', projectRoot), cmd: 'npm run tsc' },
    { check: () => true, cmd: 'npx tsc --noEmit' } // Fallback
  ];

  for (const { check, cmd } of commands) {
    if (check()) {
      const result = runCommand(`${cmd} 2>&1`, { cwd: projectRoot, timeout });
      return {
        ran: true,
        command: cmd,
        success: result.success,
        output: result.output
      };
    }
  }

  return { ran: false };
}

/**
 * Run lint and return results
 */
function runLint(projectRoot, timeout) {
  if (!hasScript('lint', projectRoot)) {
    return { ran: false };
  }

  const result = runCommand('npm run lint 2>&1', { cwd: projectRoot, timeout });
  return {
    ran: true,
    command: 'npm run lint',
    success: result.success,
    output: result.output
  };
}

/**
 * Truncate output to a reasonable size for context injection
 */
function truncateOutput(output, maxLines = 30) {
  if (!output) return '';
  
  const lines = output.split('\n');
  if (lines.length <= maxLines) {
    return output;
  }

  const half = Math.floor(maxLines / 2);
  const truncated = [
    ...lines.slice(0, half),
    `\n... (${lines.length - maxLines} lines truncated) ...\n`,
    ...lines.slice(-half)
  ];
  
  return truncated.join('\n');
}

function main() {
  try {
    const input = readInput();
    const toolName = input.tool_name || '';
    const toolInput = input.tool_input || {};
    const toolResponse = input.tool_response || {};
    const cwd = input.cwd || process.cwd();

    // Skip if tool failed
    if (toolResponse.error) {
      log('Tool failed, skipping verification');
      writeOutput({});
      return;
    }

    // Get the file path that was modified
    const filepath = toolInput.path || toolInput.file_path || toolInput.filepath || '';

    // Skip non-code files
    if (!shouldVerify(filepath)) {
      log(`Skipping verification for non-code file: ${filepath}`);
      writeOutput({});
      return;
    }

    const projectRoot = findProjectRoot(cwd);
    const config = loadConfig(projectRoot);

    // Skip if verification is disabled
    if (!config.autoVerification.enabled) {
      writeOutput({});
      return;
    }

    const timeout = config.autoVerification.timeout || 30000;
    let additionalContext = '';
    let hasIssues = false;
    const issues = [];

    // --- Run Typecheck ---
    if (config.autoVerification.typecheck) {
      const typecheckResult = runTypecheck(projectRoot, timeout);

      if (typecheckResult.ran && !typecheckResult.success) {
        hasIssues = true;
        issues.push('TypeScript errors');
        
        const truncatedOutput = truncateOutput(typecheckResult.output, 25);
        additionalContext += `\n## ⚠️ TypeScript Errors\n\n`;
        additionalContext += `Command: 	estecheckResult.command}

`;
        additionalContext += `
${truncatedOutput}

`;
      }
    }

    // --- Run Lint ---
    if (config.autoVerification.lint) {
      const lintResult = runLint(projectRoot, timeout);

      if (lintResult.ran && !lintResult.success) {
        hasIssues = true;
        issues.push('Lint errors');
        
        const truncatedOutput = truncateOutput(lintResult.output, 25);
        additionalContext += `\n## ⚠️ Lint Errors\n\n`;
        additionalContext += `Command: 	esteResult.command}

`;
        additionalContext += `
${truncatedOutput}

`;
      }
    }

    // --- Build Output ---
    const output = {};

    if (hasIssues) {
      additionalContext += `\n---\n**Please fix these issues before proceeding to the next task.**\n`;
      
      output.hookSpecificOutput = {
        additionalContext: additionalContext.trim()
      };
      output.systemMessage = `⚠️ Verification found issues: ${issues.join(', ')}`;
      
      log(`Verification found issues: ${issues.join(', ')}`);
    } else {
      output.systemMessage = '✓ Verification passed';
      log('Verification passed');
    }

    writeOutput(output);

  } catch (err) {
    log(`AfterTool hook error: ${err.message}`);
    // On error, don't block - just skip verification
    writeOutput({});
  }
}

main();
