#!/usr/bin/env node
/**
 * oh-my-gemini Session Start Hook
 *
 * Event: SessionStart
 * Fires: When a new Gemini CLI session begins
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');
const {
  readInput,
  writeOutput,
  log,
  debug,
  findProjectRoot,
  loadSessionOrGlobalPlan,
  findCurrentTask,
  isGitRepo,
  hasUncommittedChanges,
  runGitCommand,
  extractFileReferences,
  platform
} = require('./lib/utils');
const { loadConfig, isFeatureEnabled, getConfigValue } = require('./lib/config');
const {
  initDatabase,
  closeDatabase,
  writeObservation,
  getObservationCount,
  computeFileChecksums
} = require('./lib/memory');

// Import mode state for stale cleanup
let cleanStaleState;
try {
  const ms = require('../dist/lib/mode-state');
  cleanStaleState = ms.cleanStaleState;
} catch (err) {
  debug(`Failed to load mode-state: ${err.message}. Stale cleanup skipped.`);
  cleanStaleState = null;
}

function ensureOmgStateGitignored(projectRoot) {
  const gitignorePath = path.join(projectRoot, '.gemini', '.gitignore');

  try {
    const geminiDir = path.join(projectRoot, '.gemini');
    if (!fs.existsSync(geminiDir)) {
      return;
    }

    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      if (content.includes('omg-state/')) {
        return;
      }
      const separator = content.endsWith('\n') ? '' : '\n';
      fs.writeFileSync(gitignorePath, content + separator + 'omg-state/\n', 'utf8');
    } else {
      fs.writeFileSync(gitignorePath, 'omg-state/\n', 'utf8');
    }
  } catch (err) {
    log(`ensureOmgStateGitignored: failed: ${err.message}`);
  }
}

function formatProgressBar(percentage, width = 20) {
  const safePercentage = Number.isFinite(percentage) ? percentage : 0;
  const filled = Math.round((safePercentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${safePercentage}%`;
}

function getMemoryCount(trackName, config) {
  if (!isFeatureEnabled(config, 'memory')) {
    return null;
  }
  if (!trackName) {
    return null;
  }

  try {
    const memoryConfig = getConfigValue(config, 'memory', {});
    const db = initDatabase(memoryConfig.dbPath);
    try {
      return getObservationCount(db, trackName);
    } finally {
      closeDatabase(db);
    }
  } catch (err) {
    log(`Memory count query failed: ${err.message}`);
    return null;
  }
}

function normalizeRelativePath(inputPath) {
  return String(inputPath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .trim();
}

function collectTrackedFiles(memoryConfig, projectRoot, planContent) {
  const checksumFiles = memoryConfig.checksumFiles;
  let files = [];

  if (checksumFiles === 'git') {
    const gitFiles = runGitCommand(['ls-files'], { cwd: projectRoot, timeout: 10000 });
    if (gitFiles.success) {
      files = gitFiles.output.trim().split('\n').filter(Boolean);
    }
  } else if (Array.isArray(checksumFiles)) {
    for (const candidate of checksumFiles) {
      if (!candidate || typeof candidate !== 'string') continue;
      const trimmed = candidate.trim();
      if (!trimmed) continue;

      if (trimmed.includes('*') || trimmed.includes('?')) {
        const result = runGitCommand(['ls-files', trimmed], { cwd: projectRoot, timeout: 10000 });
        if (result.success) {
          files.push(...result.output.trim().split('\n').filter(Boolean));
        }
      } else {
        files.push(trimmed);
      }
    }
  } else {
    files = extractFileReferences(planContent || '');
  }

  return [...new Set(files.map(normalizeRelativePath).filter(Boolean))];
}

function writeSessionStartObservation(projectRoot, sessionType, sessionId, conductor, config) {
  if (!isFeatureEnabled(config, 'memory')) {
    return;
  }
  if (!conductor || !conductor.active || !conductor.trackName) {
    return;
  }

  const memoryConfig = getConfigValue(config, 'memory', {});
  const trackedFiles = collectTrackedFiles(memoryConfig, projectRoot, conductor.plan || '');
  const checksumResult = computeFileChecksums(projectRoot, trackedFiles);

  const db = initDatabase(memoryConfig.dbPath);
  try {
    writeObservation(db, {
      track_id: conductor.trackName,
      type: 'session_start',
      agent_role: 'main',
      content: {
        sessionId,
        sessionType,
        trackedFiles,
        fileChecksums: checksumResult.checksums,
        missingFiles: checksumResult.missing
      },
      file_checksums: checksumResult.checksums,
      created_at: new Date().toISOString()
    }, {
      maxObservationsPerTrack: memoryConfig.maxObservationsPerTrack
    });
  } finally {
    closeDatabase(db);
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(250);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
  });
}

function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/health',
      method: 'GET',
      timeout: 300
    }, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function waitForHealth(port, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    if (await checkHealth(port)) {
      return true;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise(r => setTimeout(r, 120));
  }
  return false;
}

async function ensureMemoryServer(projectRoot, config) {
  if (!isFeatureEnabled(config, 'memory')) {
    return null;
  }

  const memoryConfig = getConfigValue(config, 'memory', {});
  if (memoryConfig.autoStart === false) {
    return null;
  }

  const basePort = Math.max(1024, Math.min(memoryConfig.mcpPort || 37888, 65535));
  const scriptPath = path.join(__dirname, 'omg-memory-server.js');
  if (!fs.existsSync(scriptPath)) {
    return null;
  }

  for (let offset = 0; offset < 10; offset++) {
    const port = basePort + offset;
    // eslint-disable-next-line no-await-in-loop
    const occupied = await isPortOpen(port);
    if (occupied) {
      // eslint-disable-next-line no-await-in-loop
      const healthy = await checkHealth(port);
      if (healthy) {
        return { running: true, port, started: false };
      }
      continue;
    }

    const child = spawn(process.execPath, [scriptPath, '--port', String(port), '--db', String(memoryConfig.dbPath || '')], {
      cwd: projectRoot,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();

    // eslint-disable-next-line no-await-in-loop
    const ready = await waitForHealth(port, 2000);
    if (ready) {
      const pidPath = path.join(platform.getHomeDir(), '.oh-my-gemini', 'memory.pid');
      try {
        fs.mkdirSync(path.dirname(pidPath), { recursive: true });
        fs.writeFileSync(pidPath, String(child.pid), 'utf8');
      } catch {
        // Non-fatal
      }
      return { running: true, port, started: true, pid: child.pid };
    }
  }

  return { running: false };
}

function buildFullContext(sessionId, projectRoot, config) {
  let additionalContext = '';
  let conductorSummary = '';
  let conductor = null;

  if (isFeatureEnabled(config, 'contextInjection')) {
    conductor = loadSessionOrGlobalPlan(sessionId, projectRoot, config);

    if (conductor && conductor.active) {
      const planLabel = conductor.source === 'global'
        ? 'Active (global)'
        : `Active (session ${sessionId})`;

      additionalContext += '## Conductor Status\n';
      additionalContext += `**Plan State:** ${planLabel}\n`;
      additionalContext += `**Active Track:** ${conductor.trackName}\n`;
      additionalContext += `**Progress:** ${formatProgressBar(conductor.progress.percentage)}\n`;
      additionalContext += `**Tasks:** ${conductor.progress.completed}/${conductor.progress.total} completed\n\n`;

      const currentTask = conductor.plan ? findCurrentTask(conductor.plan) : null;
      if (currentTask) {
        additionalContext += `**Current Task:** ${currentTask}\n\n`;
      }

      const observationCount = getMemoryCount(conductor.trackName, config);
      if (observationCount !== null) {
        additionalContext += '## Memory\n';
        additionalContext += `Track '${conductor.trackName}' has ${observationCount} memory observations. Use omg_memory_search to query history.\n\n`;
      }

      conductorSummary = `Conductor: ${conductor.trackName} (${conductor.progress.percentage}% complete)`;
    }
  }

  try {
    const homeDir = os.homedir();
    const settingsPath = path.join(homeDir, '.gemini', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const agentsEnabled = settings?.experimental?.enableAgents;
      if (!agentsEnabled) {
        additionalContext += '## Subagent Routing\n';
        additionalContext += '**Warning:** Native subagent routing is not enabled. Add `{ "experimental": { "enableAgents": true } }` to your Gemini CLI settings.json to enable delegate_to_agent routing to custom agents.\n\n';
      }
    }
  } catch (err) {
    debug(`Settings check skipped: ${err.message}`);
  }

  if (isGitRepo(projectRoot)) {
    const hasChanges = hasUncommittedChanges(projectRoot);
    if (hasChanges) {
      additionalContext += '## Git Status\n';
      additionalContext += 'You have uncommitted changes. Consider committing before major changes.\n\n';
    }
  }

  return { additionalContext, conductorSummary, conductor };
}

function buildResumeContext(sessionId, projectRoot, config) {
  let conductorSummary = '';
  let conductor = null;
  let memorySummary = '';

  if (isFeatureEnabled(config, 'contextInjection')) {
    try {
      conductor = loadSessionOrGlobalPlan(sessionId, projectRoot, config);
      if (conductor && conductor.active) {
        conductorSummary = `Conductor: ${conductor.trackName} (${conductor.progress.percentage}% complete)`;
        const observationCount = getMemoryCount(conductor.trackName, config);
        if (observationCount !== null) {
          memorySummary = `Memory: ${observationCount} observations`;
        }
      }
    } catch (err) {
      log(`Resume context: Conductor read skipped: ${err.message}`);
    }
  }

  return { conductorSummary, conductor, memorySummary };
}

async function main() {
  try {
    const input = await readInput();
    const cwd = input.cwd || process.cwd();
    const sessionType = input.session_type || 'start';
    const sessionId = input.session_id || null;

    log(`SessionStart hook fired. CWD: ${cwd}, Type: ${sessionType}`);
    log(`Platform: ${platform.isWindows ? 'Windows' : 'Unix'}`);

    const projectRoot = findProjectRoot(cwd);
    const config = loadConfig(projectRoot);

    if (sessionType !== 'resume') {
      ensureOmgStateGitignored(projectRoot);

      if (cleanStaleState) {
        try {
          const cleaned = cleanStaleState(projectRoot);
          if (cleaned > 0) {
            log(`Cleaned ${cleaned} stale mode state session(s)`);
          }
        } catch (err) {
          log(`Stale state cleanup failed: ${err.message}`);
        }
      }
    }

    const output = {};
    let systemMessage = '';

    if (sessionType === 'resume') {
      const { conductorSummary, memorySummary } = buildResumeContext(sessionId, projectRoot, config);
      const parts = ['Session resumed'];
      if (conductorSummary) parts.push(conductorSummary);
      if (memorySummary) parts.push(memorySummary);
      systemMessage = parts.join(' | ');
    } else {
      const { additionalContext, conductorSummary, conductor } = buildFullContext(sessionId, projectRoot, config);

      if (additionalContext.trim()) {
        output.hookSpecificOutput = {
          additionalContext: additionalContext.trim()
        };
      }

      if (conductor && conductor.active && isFeatureEnabled(config, 'memory')) {
        try {
          writeSessionStartObservation(projectRoot, sessionType, sessionId, conductor, config);
        } catch (memoryErr) {
          log(`SessionStart memory write skipped: ${memoryErr.message}`);
        }

        try {
          const serverStatus = await ensureMemoryServer(projectRoot, config);
          if (serverStatus && serverStatus.running) {
            const serverNote = serverStatus.started
              ? `Memory MCP started on :${serverStatus.port}`
              : `Memory MCP on :${serverStatus.port}`;
            output.systemMessage = output.systemMessage
              ? `${output.systemMessage} | ${serverNote}`
              : serverNote;
          }
        } catch (serverErr) {
          log(`Memory MCP auto-start skipped: ${serverErr.message}`);
        }
      }

      if (sessionType === 'clear') {
        systemMessage = conductorSummary
          ? `Context cleared | Modes: keyword-driven | ${conductorSummary}`
          : 'Context cleared | Modes: keyword-driven';
      } else {
        systemMessage = conductorSummary
          ? `oh-my-gemini ready | Modes: keyword-driven | ${conductorSummary}`
          : 'oh-my-gemini ready | Modes: keyword-driven';
      }
    }

    if (systemMessage) {
      output.systemMessage = output.systemMessage
        ? `${output.systemMessage} | ${systemMessage}`
        : systemMessage;
    }

    writeOutput(output);
  } catch (err) {
    log(`SessionStart hook error: ${err.message}`);
    writeOutput({});
  }
}

main();
