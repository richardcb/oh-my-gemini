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
  loadSessionOrGlobalPlan,
  findCurrentTask,
  findCurrentPhaseAndTask,
  runGitCommand,
  getRecentCommits,
  getRecentlyChangedFiles,
  isGitRepo,
  platform
} = require('./lib/utils');
const { loadConfig, isFeatureEnabled, getConfigValue } = require('./lib/config');

// Import keyword registry from compiled TypeScript (with fallback)
let detectMagicKeywords, detectRalphKeywords;
try {
  const kr = require('../dist/lib/keyword-registry');
  detectMagicKeywords = kr.detectMagicKeywords;
  detectRalphKeywords = kr.detectRalphKeywords;
} catch (err) {
  debug(`Failed to load keyword-registry: ${err.message}. Falling back to implement mode.`);
  detectMagicKeywords = () => null;
  detectRalphKeywords = () => false;
}

// Import mode state manager and mode config (with fallback)
let resolveModeFromPrompt, writeModeState, composeModeProfile;
try {
  const ms = require('../dist/lib/mode-state');
  resolveModeFromPrompt = ms.resolveModeFromPrompt;
  writeModeState = ms.writeModeState;
  const mc = require('../dist/lib/mode-config');
  composeModeProfile = mc.composeModeProfile;
} catch (err) {
  debug(`Failed to load mode-state/mode-config: ${err.message}. Using keyword-only mode.`);
  resolveModeFromPrompt = null;
  writeModeState = null;
  composeModeProfile = null;
}

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
    const sessionId = input.session_id || 'default';

    // --- Mode Resolution ---
    let mode, modifiers, modeSource, modeProfile;

    if (resolveModeFromPrompt && writeModeState && composeModeProfile) {
      // Full mode state system available
      const modeState = resolveModeFromPrompt(prompt);
      mode = modeState.primary;
      modifiers = modeState.modifiers;
      modeSource = modeState.source;

      // Persist mode state for downstream hooks
      writeModeState(sessionId, modeState, projectRoot);

      // Compose mode profile (primary + modifiers)
      modeProfile = composeModeProfile(mode, modifiers);
    } else {
      // Fallback: keyword-only detection (dist/ not built)
      const keywordResult = detectMagicKeywords(prompt);
      mode = keywordResult ? keywordResult.primary : 'implement';
      modifiers = keywordResult ? keywordResult.modifiers : [];
      modeSource = keywordResult ? 'keyword' : 'default';
      modeProfile = null;
    }

    debug(`Mode: ${mode}${modifiers.length ? '+' + modifiers.join('+') : ''} (source: ${modeSource})`);

    // --- Ralph Keyword Detection ---
    const isRalph = detectRalphKeywords(prompt);
    if (isRalph) {
      debug('Ralph keywords detected — will suggest ralph-mode skill');
    }

    // Load Conductor state once (used by both context injection and plan-mode check)
    const conductor = loadSessionOrGlobalPlan(sessionId, projectRoot, config);

    // --- Context Injection (mode-profile-aware) ---
    if (isFeatureEnabled(config, 'contextInjection')) {
      // Determine context injection behavior from mode profile or config
      const ciProfile = modeProfile ? modeProfile.contextInjection : null;

      // Git History Injection
      const gitHistoryConfig = getConfigValue(config, 'contextInjection.gitHistory', {});
      const profileGitHistory = ciProfile ? ciProfile.gitHistory : 'keyword-triggered';
      // false = skip entirely, true = always inject, "keyword-triggered" = check keywords
      if (profileGitHistory !== false && gitHistoryConfig.enabled && isGitRepo(projectRoot)) {
        let shouldInjectGit = false;
        if (profileGitHistory === true) {
          shouldInjectGit = true;
        } else {
          // "keyword-triggered" (default behavior)
          const gitKeywords = gitHistoryConfig.onKeywords || ['fix', 'bug', 'error', 'issue'];
          shouldInjectGit = matchesKeywords(prompt, gitKeywords);
        }

        if (shouldInjectGit) {
          const commitCount = gitHistoryConfig.commitCount || 5;
          const commits = getRecentCommits(commitCount, projectRoot);
          if (commits) {
            additionalContext += '## Recent Git History\n';
            additionalContext += '```\n' + commits + '\n```\n\n';
            log(`Injected ${commitCount} commits of git history`);
          }
        }
      }

      // Recent Changes Injection
      const recentChangesConfig = getConfigValue(config, 'contextInjection.recentChanges', {});
      const profileRecentChanges = ciProfile ? ciProfile.recentChanges : true;
      if (profileRecentChanges !== false && recentChangesConfig.enabled && isGitRepo(projectRoot)) {
        const continueKeywords = recentChangesConfig.onKeywords || ['continue', 'resume', 'where were we'];
        if (matchesKeywords(prompt, continueKeywords)) {
          const fileCount = recentChangesConfig.fileCount || 10;
          const changedFiles = getRecentlyChangedFiles(5, projectRoot);
          if (changedFiles.length > 0) {
            const filesToShow = changedFiles.slice(0, fileCount);
            additionalContext += '## Recently Modified Files\n';
            additionalContext += filesToShow.map(f => `- ${f}`).join('\n') + '\n\n';
            log(`Injected ${filesToShow.length} recently changed files`);
          }
        }
      }

      // Conductor State Injection
      const profileConductor = ciProfile ? ciProfile.conductorState : true;
      if (profileConductor !== false && getConfigValue(config, 'contextInjection.conductorState', true)) {
        if (conductor && conductor.active) {
          if (profileConductor === 'summary') {
            // Summary only (eco mode, research mode)
            additionalContext += `Conductor: ${conductor.trackName} (${conductor.progress.percentage}% complete)\n\n`;
            log(`Injected Conductor summary: ${conductor.trackName}`);
          } else {
            // Full context — try phase-aware first, fall back to task-only
            const configuredPhases = getConfigValue(config, 'phaseGates.phases', []);
            const phaseTask = findCurrentPhaseAndTask(conductor.plan, configuredPhases);
            const planLabel = conductor.source === 'global' ? 'global track' : 'session-specific';

            if (phaseTask) {
              additionalContext += '## Current Conductor Task\n';
              additionalContext += `**Track:** ${conductor.trackName}\n`;
              additionalContext += `**Plan:** ${planLabel}\n`;
              additionalContext += `**Phase:** ${phaseTask.phaseName} (${phaseTask.phaseIndex + 1}/${phaseTask.totalPhases})\n`;
              additionalContext += `**Task:** ${phaseTask.taskText}\n`;
              additionalContext += `**Progress:** ${conductor.progress.completed}/${conductor.progress.total} (${conductor.progress.percentage}%) — ${phaseTask.phaseRemaining} remaining in phase\n\n`;
              log(`Injected Conductor context with phase: ${conductor.trackName} / ${phaseTask.phaseName}`);
            } else {
              // Fallback: plan has no phase headers or all phases complete
              const currentTask = findCurrentTask(conductor.plan);
              if (currentTask) {
                additionalContext += '## Current Conductor Task\n';
                additionalContext += `**Track:** ${conductor.trackName}\n`;
                additionalContext += `**Plan:** ${planLabel}\n`;
                additionalContext += `**Task:** ${currentTask}\n`;
                additionalContext += `**Progress:** ${conductor.progress.completed}/${conductor.progress.total} (${conductor.progress.percentage}%)\n\n`;
                log(`Injected Conductor context (no phases): ${conductor.trackName}`);
              }
            }
          }
        }
      }
    }

    // --- Plan mode + Conductor awareness (M-2) ---
    if (mode === 'plan') {
      if (conductor && conductor.active) {
        additionalContext += '[omg:mode] plan mode active. An active Conductor track exists — using Conductor\'s planning phase. Native plan mode deferred.\n\n';
      }
    }

    // --- Build Output (dual-channel for masking compatibility) ---
    const output = {};

    if (additionalContext.trim()) {
      output.hookSpecificOutput = {
        additionalContext: additionalContext.trim()
      };
    }

    // Build systemMessage summary
    const summaryParts = [];
    const modeLabel = modifiers.length > 0 ? `${mode}+${modifiers.join('+')}` : mode;
    if (mode !== 'implement' || modifiers.length > 0) {
      summaryParts.push(`Mode: ${modeLabel}`);
    }
    // Skill suggestion from mode profile
    if (modeProfile && modeProfile.suggestedSkills && modeProfile.suggestedSkills.length > 0) {
      summaryParts.push(`[omg:mode] ${mode} mode active. Consider activating the ${modeProfile.suggestedSkills[0]} skill for structured guidance.`);
    }
    if (isRalph) {
      summaryParts.push('Ralph mode active. Consider activating the ralph-mode skill for structured persistence guidance.');
    }
    if (additionalContext.includes('Conductor Task') || additionalContext.includes('Conductor:')) {
      summaryParts.push('Conductor context injected');
    }
    if (additionalContext.includes('Git History')) {
      summaryParts.push('Git history injected');
    }
    if (summaryParts.length > 0) {
      output.systemMessage = `[omg:context] ${summaryParts.join(' | ')}`;
    }

    writeOutput(output);
  } catch (err) {
    log(`BeforeAgent hook error: ${err.message}`);
    // Don't fail - output empty response
    writeOutput({});
  }
}

main();
