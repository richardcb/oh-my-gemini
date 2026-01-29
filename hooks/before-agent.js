#!/usr/bin/env node
/**
 * oh-my-gemini BeforeAgent Hook
 *
 * Event: BeforeAgent
 * Fires: After user submits prompt, before agent planning
 *
 * Purpose:
 * - Inject relevant context based on task type
 * - Add git history for bug fixes
 * - Add recent file changes for continuation tasks
 * - Add current Conductor task context
 *
 * Input: { prompt, session_id, cwd, ... }
 * Output: { hookSpecificOutput: { additionalContext }, decision?, reason? }
 */

const {
  readInput,
  writeOutput,
  log,
  findProjectRoot,
  loadConductorState,
  findCurrentTask,
  runCommand
} = require('./lib/utils');
const { loadConfig } = require('./lib/config');

/**
 * Check if prompt contains any of the keywords
 */
function containsKeywords(text, keywords) {
  const lowerText = text.toLowerCase();
  return keywords.some(kw => lowerText.includes(kw.toLowerCase()));
}

function main() {
  try {
    const input = readInput();
    const prompt = input.prompt || '';
    const cwd = input.cwd || process.cwd();

    const projectRoot = findProjectRoot(cwd);
    const config = loadConfig(projectRoot);

    const promptLower = prompt.toLowerCase();
    let additionalContext = '';

    // --- Git History Injection ---
    // Inject recent commits when user is working on bugs/issues
    if (config.contextInjection.gitHistory.enabled) {
      const keywords = config.contextInjection.gitHistory.onKeywords || [];
      
      if (containsKeywords(prompt, keywords)) {
        const result = runCommand(
          `git log --oneline -${config.contextInjection.gitHistory.commitCount || 5}`,
          { cwd: projectRoot, timeout: 5000 }
        );

        if (result.success && result.output.trim()) {
          additionalContext += `\n## 📜 Recent Git History\n`;
          additionalContext += `

${result.output.trim()}

`;
        }
      }
    }

    // --- Recent Changes Injection ---
    // Inject recently changed files when user wants to continue work
    if (config.contextInjection.recentChanges.enabled) {
      const keywords = config.contextInjection.recentChanges.onKeywords || [];
      
      if (containsKeywords(prompt, keywords)) {
        const result = runCommand(
          `git diff --name-only HEAD~5 2>/dev/null | head -${config.contextInjection.recentChanges.fileCount || 10}`,
          { cwd: projectRoot, timeout: 5000 }
        );

        if (result.success && result.output.trim()) {
          additionalContext += `\n## 📝 Recently Changed Files\n`;
          additionalContext += `

${result.output.trim()}

`;
        }
      }
    }

    // --- Conductor Context Injection ---
    // Always inject current task context if Conductor is active
    if (config.contextInjection.conductorState) {
      const conductor = loadConductorState(projectRoot);

      if (conductor && conductor.hasActiveTracks) {
        // Check if this seems like a work continuation prompt
        const isWorkPrompt = containsKeywords(prompt, [
          'implement', 'build', 'create', 'add', 'fix', 'update',
          'continue', 'next', 'task', 'phase', 'track'
        ]);

        if (isWorkPrompt) {
          const currentTask = findCurrentTask(conductor.plan);
          
          if (currentTask) {
            additionalContext += `\n## 🎯 Current Conductor Task\n`;
            additionalContext += `**Track:** ${conductor.trackName}\n`;
            additionalContext += `**Task:** ${currentTask}\n`;
            additionalContext += `**Progress:** ${conductor.progress.completed}/${conductor.progress.total} (${conductor.progress.percentage}%)\n`;
          }
        }
      }
    }

    // --- Build Output ---
    const output = {};

    if (additionalContext.trim()) {
      output.hookSpecificOutput = {
        additionalContext: additionalContext.trim()
      };
    }

    writeOutput(output);
  } catch (err) {
    log(`BeforeAgent hook error: ${err.message}`);
    // Don't fail - output empty response
    writeOutput({});
  }
}

main();
