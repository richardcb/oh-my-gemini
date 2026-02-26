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
  loadConductorState,
  findCurrentTask,
  detectAgentMode,
  runGitCommand,
  getRecentCommits,
  getRecentlyChangedFiles,
  isGitRepo,
  platform
} = require('./lib/utils');
const { loadConfig, isFeatureEnabled, getConfigValue } = require('./lib/config');

/**
 * Check if prompt matches any keywords
 * @param {string} prompt - User prompt
 * @param {string[]} keywords - Keywords to match
 * @returns {boolean} True if any keyword matches
 */
function matchesKeywords(prompt, keywords) {
  const promptLower = prompt.toLowerCase();
  return keywords.some(kw => promptLower.includes(kw.toLowerCase()));
}

/**
 * Main hook logic
 */
async function main() {
  try {
    const input = await readInput();
    const prompt = input.prompt || '';
    const cwd = input.cwd || process.cwd();
    
    log(`BeforeAgent hook fired. Prompt length: ${prompt.length}`);
    debug(`Platform: ${platform.isWindows ? 'Windows' : 'Unix'}`);
    
    // Find project root
    const projectRoot = findProjectRoot(cwd);
    
    // Load configuration
    const config = loadConfig(projectRoot);
    
    // Build context
    let additionalContext = '';
    
    // --- Agent Mode Detection ---
    const agentMode = detectAgentMode(prompt);
    debug(`Detected agent mode: ${agentMode}`);
    
    // --- Context Injection ---
    if (isFeatureEnabled(config, 'contextInjection')) {
      
      // Git History Injection (for bug fixes)
      const gitHistoryConfig = getConfigValue(config, 'contextInjection.gitHistory', {});
      if (gitHistoryConfig.enabled && isGitRepo(projectRoot)) {
        const gitKeywords = gitHistoryConfig.onKeywords || ['fix', 'bug', 'error', 'issue'];
        
        if (matchesKeywords(prompt, gitKeywords)) {
          const commitCount = gitHistoryConfig.commitCount || 5;
          const commits = getRecentCommits(commitCount, projectRoot);
          
          if (commits) {
            additionalContext += '## 📜 Recent Git History\n';
            additionalContext += '```\n' + commits + '\n```\n\n';
            log(`Injected ${commitCount} commits of git history`);
          }
        }
      }
      
      // Recent Changes Injection (for continuations)
      const recentChangesConfig = getConfigValue(config, 'contextInjection.recentChanges', {});
      if (recentChangesConfig.enabled && isGitRepo(projectRoot)) {
        const continueKeywords = recentChangesConfig.onKeywords || ['continue', 'resume', 'where were we'];
        
        if (matchesKeywords(prompt, continueKeywords)) {
          const fileCount = recentChangesConfig.fileCount || 10;
          const changedFiles = getRecentlyChangedFiles(5, projectRoot);
          
          if (changedFiles.length > 0) {
            const filesToShow = changedFiles.slice(0, fileCount);
            additionalContext += '## 📁 Recently Modified Files\n';
            additionalContext += filesToShow.map(f => `- ${f}`).join('\n') + '\n\n';
            log(`Injected ${filesToShow.length} recently changed files`);
          }
        }
      }
      
      // Conductor State Injection
      if (getConfigValue(config, 'contextInjection.conductorState', true)) {
        const conductor = loadConductorState(projectRoot);
        
        if (conductor && conductor.active) {
          const currentTask = findCurrentTask(conductor.plan);
          
          if (currentTask) {
            additionalContext += '## 🎯 Current Conductor Task\n';
            additionalContext += `**Track:** ${conductor.trackName}\n`;
            additionalContext += `**Task:** ${currentTask}\n`;
            additionalContext += `**Progress:** ${conductor.progress.completed}/${conductor.progress.total} (${conductor.progress.percentage}%)\n\n`;
            log(`Injected Conductor context: ${conductor.trackName}`);
          }
        }
      }
    }

    // --- Build Output (dual-channel for masking compatibility) ---
    const output = {};

    if (additionalContext.trim()) {
      output.hookSpecificOutput = {
        additionalContext: additionalContext.trim()
      };
      // Dual-channel: provide a brief systemMessage summary as fallback
      // in case tool output masking strips additionalContext
      const summaryParts = [];
      if (agentMode !== 'executor') {
        summaryParts.push(`Mode: ${agentMode}`);
      }
      if (additionalContext.includes('Conductor Task')) {
        summaryParts.push('Conductor context injected');
      }
      if (additionalContext.includes('Git History')) {
        summaryParts.push('Git history injected');
      }
      if (summaryParts.length > 0) {
        output.systemMessage = `[omg:context] ${summaryParts.join(' | ')}`;
      }
    }

    writeOutput(output);
  } catch (err) {
    log(`BeforeAgent hook error: ${err.message}`);
    // Don't fail - output empty response
    writeOutput({});
  }
}

main();
