#!/usr/bin/env node
/**
 * oh-my-gemini SessionStart Hook
 *
 * Event: SessionStart
 * Fires: On startup, resume, or clear
 *
 * Purpose:
 * - Load Conductor track state
 * - Inject project context for the session
 * - Display welcome message with current status
 *
 * Input: { source: "startup" | "resume" | "clear", session_id, cwd, ... }
 * Output: { hookSpecificOutput: { additionalContext }, systemMessage }
 */

const {
  readInput,
  writeOutput,
  log,
  findProjectRoot,
  loadConductorState
} = require('./lib/utils');
const { loadConfig } = require('./lib/config');

function main() {
  try {
    const input = readInput();
    const source = input.source || 'startup';
    const cwd = input.cwd || process.cwd();

    const projectRoot = findProjectRoot(cwd);
    const config = loadConfig(projectRoot);

    let additionalContext = '';
    let systemMessage = '';

    // Load Conductor state if enabled
    if (config.contextInjection.conductorState) {
      const conductor = loadConductorState(projectRoot);

      if (conductor && conductor.hasActiveTracks) {
        additionalContext += `
## 📋 Active Conductor Track

`;
        additionalContext += `**Track:** ${conductor.trackName}
`;
        additionalContext += `**ID:** ${conductor.trackId}
`;
        additionalContext += `**Phase:** ${conductor.currentPhase}
`;
        additionalContext += `**Progress:** ${conductor.progress.completed}/${conductor.progress.total} tasks (${conductor.progress.percentage}%)
`;

        // Add current task if available
        if (conductor.plan) {
          const currentTaskMatch = conductor.plan.match(/- [ ] (d+.d+[^\n]+)/);
          if (currentTaskMatch) {
            additionalContext += `**Current Task:** ${currentTaskMatch[1].trim()}
`;
          }
        }

        additionalContext += `
Use 
/omg:implement
 to continue working on this track.
`;

        systemMessage = `📋 Active track: ${conductor.trackName} (${conductor.progress.percentage}% complete)`;
      }
    }

    // Check if experimental agents are enabled
    // Note: We can't actually read Gemini CLI settings from here,
    // but we can check if our agents directory exists and warn about setup
    const fs = require('fs');
    const path = require('path');
    const agentsDir = path.join(projectRoot, '.gemini', 'agents');

    if (fs.existsSync(agentsDir)) {
      const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      if (agentFiles.length > 0) {
        additionalContext += `
## 🤖 Sub-Agents Available

${agentFiles.map(f => `- \`${f.replace('.md', '')}\``).join('\n')}

> **Note:** Ensure \`experimental.enableAgents: true\` is set in your settings.json for sub-agents to work.
`;
      }
    }

    // Customize message based on session source
    switch (source) {
      case 'startup':
        systemMessage = systemMessage
          ? `🚀 oh-my-gemini ready | ${systemMessage}`
          : '🚀 oh-my-gemini ready';
        break;

      case 'resume':
        systemMessage = systemMessage
          ? `♻️ Session resumed | ${systemMessage}`
          : '♻️ Session resumed';
        break;

      case 'clear':
        systemMessage = systemMessage
          ? `🔄 Context cleared | ${systemMessage}`
          : '🔄 Context cleared';
        break;

      default:
        systemMessage = systemMessage || '🚀 oh-my-gemini ready';
    }

    // Build output
    const output = {};

    if (additionalContext.trim()) {
      output.hookSpecificOutput = {
        additionalContext: additionalContext.trim()
      };
    }

    if (systemMessage) {
      output.systemMessage = systemMessage;
    }

    writeOutput(output);
  } catch (err) {
    log(`SessionStart hook error: ${err.message}`);
    // Don't fail the hook - just output empty response
    writeOutput({});
  }
}

main();
