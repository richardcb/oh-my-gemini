/**
 * oh-my-gemini Hooks - Conductor Memory helpers (PRD 0007)
 *
 * SQLite-backed observation storage plus retrieval/drift helpers.
 * Driver fallback chain: node:sqlite -> better-sqlite3.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const platform = require('./platform');
const { runGitCommand } = require('./utils');

let ACTIVE_SQLITE_DRIVER = null;

function resolveSqliteDriver() {
  if (ACTIVE_SQLITE_DRIVER) {
    return ACTIVE_SQLITE_DRIVER;
  }

  const loadErrors = [];

  try {
    const nodeSqlite = require('node:sqlite');
    if (nodeSqlite && typeof nodeSqlite.DatabaseSync === 'function') {
      ACTIVE_SQLITE_DRIVER = {
        name: 'node:sqlite',
        createDatabase: (dbPath) => new nodeSqlite.DatabaseSync(dbPath)
      };
      return ACTIVE_SQLITE_DRIVER;
    }
    loadErrors.push('node:sqlite loaded but DatabaseSync was not available');
  } catch (err) {
    loadErrors.push(`node:sqlite: ${err.message}`);
  }

  try {
    const BetterSqlite3 = require('better-sqlite3');
    if (typeof BetterSqlite3 === 'function') {
      ACTIVE_SQLITE_DRIVER = {
        name: 'better-sqlite3',
        createDatabase: (dbPath) => new BetterSqlite3(dbPath)
      };
      return ACTIVE_SQLITE_DRIVER;
    }
    loadErrors.push('better-sqlite3 loaded but constructor was not available');
  } catch (err) {
    loadErrors.push(`better-sqlite3: ${err.message}`);
  }

  ACTIVE_SQLITE_DRIVER = {
    name: null,
    createDatabase: null,
    error: `SQLite driver unavailable. Tried node:sqlite and better-sqlite3. ${loadErrors.join(' | ')}`
  };
  return ACTIVE_SQLITE_DRIVER;
}

const OBSERVATION_TYPES = new Set([
  'phase_complete',
  'verification_failure',
  'retry_attempt',
  'stuck_escalation',
  'review_finding',
  'session_start',
  'decision',
  'drift_detected'
]);

function nowIso() {
  return new Date().toISOString();
}

function resolveDbPath(dbPath) {
  const configured = dbPath || '~/.oh-my-gemini/memory.db';
  if (configured.startsWith('~/')) {
    return path.join(platform.getHomeDir(), configured.slice(2));
  }
  if (configured === '~') {
    return platform.getHomeDir();
  }
  return path.resolve(configured);
}

function assertSqliteAvailable() {
  const driver = resolveSqliteDriver();
  if (!driver.createDatabase) {
    throw new Error(driver.error);
  }
}

function getActiveSqliteDriverName() {
  const driver = resolveSqliteDriver();
  return driver.name;
}

function initDatabase(dbPath) {
  assertSqliteAvailable();
  const driver = resolveSqliteDriver();
  const resolvedPath = resolveDbPath(dbPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const db = driver.createDatabase(resolvedPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS tracks (
      track_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT NOT NULL,
      phase TEXT,
      type TEXT NOT NULL,
      agent_role TEXT DEFAULT 'main',
      content TEXT NOT NULL,
      file_checksums TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (track_id) REFERENCES tracks(track_id)
    );

    CREATE INDEX IF NOT EXISTS idx_observations_track_created
      ON observations(track_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_observations_type
      ON observations(type);

    CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
      content,
      content='observations',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
      INSERT INTO observations_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
      INSERT INTO observations_fts(observations_fts, rowid, content) VALUES('delete', old.id, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE OF content ON observations BEGIN
      INSERT INTO observations_fts(observations_fts, rowid, content) VALUES('delete', old.id, old.content);
      INSERT INTO observations_fts(rowid, content) VALUES (new.id, new.content);
    END;
  `);

  return db;
}

function closeDatabase(db) {
  if (db && typeof db.close === 'function') {
    db.close();
  }
}

function withDatabase(dbPath, fn) {
  const db = initDatabase(dbPath);
  try {
    return fn(db);
  } finally {
    closeDatabase(db);
  }
}

function ensureTrack(db, trackId, name) {
  const safeTrackId = (trackId || '').trim();
  if (!safeTrackId) {
    throw new Error('track_id is required');
  }
  const safeName = (name || safeTrackId).trim();
  const timestamp = nowIso();
  const stmt = db.prepare(`
    INSERT INTO tracks(track_id, name, status, created_at, updated_at)
    VALUES(?, ?, 'active', ?, ?)
    ON CONFLICT(track_id) DO UPDATE SET
      name = excluded.name,
      updated_at = excluded.updated_at
  `);
  stmt.run(safeTrackId, safeName, timestamp, timestamp);
}

function normalizeObservationType(type) {
  if (!type) return 'decision';
  return OBSERVATION_TYPES.has(type) ? type : type;
}

function toJsonString(value) {
  if (value === null || value === undefined) return '{}';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseJsonSafe(value, fallback = {}) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function pruneTrack(db, trackId, maxObservationsPerTrack) {
  const max = Math.max(100, Math.min(maxObservationsPerTrack || 500, 5000));
  const countRow = db.prepare('SELECT COUNT(*) AS c FROM observations WHERE track_id = ?').get(trackId);
  const currentCount = countRow ? countRow.c : 0;
  if (currentCount <= max) {
    return;
  }

  const toDelete = currentCount - max;
  const ids = db.prepare(`
    SELECT id
    FROM observations
    WHERE track_id = ?
    ORDER BY created_at ASC, id ASC
    LIMIT ?
  `).all(trackId, toDelete);
  if (!ids.length) return;

  const placeholders = ids.map(() => '?').join(', ');
  const values = ids.map(r => r.id);
  db.prepare(`DELETE FROM observations WHERE id IN (${placeholders})`).run(...values);
}

function pruneTrackObservations(db, trackId, keepCount) {
  const keep = Math.max(1, Number(keepCount) || 200);
  const countRow = db.prepare('SELECT COUNT(*) AS c FROM observations WHERE track_id = ?').get(trackId);
  const currentCount = countRow ? countRow.c : 0;
  if (currentCount <= keep) {
    return;
  }

  const toDelete = currentCount - keep;
  const ids = db.prepare(`
    SELECT id
    FROM observations
    WHERE track_id = ?
    ORDER BY created_at ASC, id ASC
    LIMIT ?
  `).all(trackId, toDelete);
  if (!ids.length) return;

  const placeholders = ids.map(() => '?').join(', ');
  db.prepare(`DELETE FROM observations WHERE id IN (${placeholders})`).run(...ids.map(r => r.id));
}

function tryMergeVerificationFailure(db, observation) {
  if (observation.type !== 'verification_failure') return null;
  const contentObj = typeof observation.content === 'string'
    ? parseJsonSafe(observation.content, null)
    : observation.content;
  if (!contentObj || !contentObj.signature) return null;

  const recent = db.prepare(`
    SELECT id, content
    FROM observations
    WHERE track_id = ? AND type = 'verification_failure'
    ORDER BY id DESC
    LIMIT 10
  `).all(observation.track_id);

  for (const row of recent) {
    const existing = parseJsonSafe(row.content, null);
    if (!existing || existing.signature !== contentObj.signature) {
      continue;
    }
    const merged = {
      ...existing,
      count: Math.max(1, existing.count || 1) + 1,
      lastSeenAt: observation.created_at || nowIso(),
      latestSummary: contentObj.summary || existing.latestSummary || ''
    };
    db.prepare('UPDATE observations SET content = ? WHERE id = ?')
      .run(JSON.stringify(merged), row.id);
    return row.id;
  }

  return null;
}

function writeObservation(db, observation, options = {}) {
  const trackId = (observation.track_id || '').trim();
  if (!trackId) {
    throw new Error('writeObservation requires observation.track_id');
  }
  const type = normalizeObservationType(observation.type || 'decision');
  const createdAt = observation.created_at || nowIso();
  const agentRole = (observation.agent_role || 'main').trim() || 'main';
  const phase = observation.phase || null;
  const content = toJsonString(observation.content);
  const fileChecksums = observation.file_checksums ? toJsonString(observation.file_checksums) : null;

  ensureTrack(db, trackId, observation.track_name || trackId);

  const mergedId = tryMergeVerificationFailure(db, {
    ...observation,
    track_id: trackId,
    type,
    created_at: createdAt
  });
  if (mergedId) {
    return mergedId;
  }

  const insert = db.prepare(`
    INSERT INTO observations(track_id, phase, type, agent_role, content, file_checksums, created_at)
    VALUES(?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insert.run(trackId, phase, type, agentRole, content, fileChecksums, createdAt);
  pruneTrack(db, trackId, options.maxObservationsPerTrack);
  return Number(result.lastInsertRowid);
}

function buildSearchWhere(filters) {
  const where = [];
  const params = [];

  if (filters.type) {
    where.push('o.type = ?');
    params.push(filters.type);
  }
  if (filters.track_id) {
    where.push('o.track_id = ?');
    params.push(filters.track_id);
  }
  if (filters.phase) {
    where.push('o.phase = ?');
    params.push(filters.phase);
  }
  if (filters.agent_role) {
    where.push('o.agent_role = ?');
    params.push(filters.agent_role);
  }

  return { where, params };
}

function summarizeContent(content) {
  const parsed = parseJsonSafe(content, null);
  if (!parsed) {
    return (content || '').substring(0, 180);
  }
  const preferred = parsed.summary || parsed.message || parsed.phaseName || parsed.error || parsed.decision || JSON.stringify(parsed);
  return String(preferred).substring(0, 180);
}

function searchObservations(db, query = {}) {
  const limit = Math.max(1, Math.min(Number(query.limit) || 20, 100));
  const text = (query.text || '').trim();
  const { where, params } = buildSearchWhere(query);

  let rows = [];
  if (text) {
    try {
      const clauses = ['observations_fts MATCH ?'];
      const allParams = [text];
      if (where.length) {
        clauses.push(...where);
        allParams.push(...params);
      }
      allParams.push(limit);
      rows = db.prepare(`
        SELECT o.id, o.track_id, o.type, o.phase, o.agent_role, o.content, o.created_at
        FROM observations o
        JOIN observations_fts ON observations_fts.rowid = o.id
        WHERE ${clauses.join(' AND ')}
        ORDER BY o.created_at DESC
        LIMIT ?
      `).all(...allParams);
    } catch {
      const likeClauses = [...where, 'o.content LIKE ?'];
      const likeParams = [...params, `%${text}%`, limit];
      rows = db.prepare(`
        SELECT o.id, o.track_id, o.type, o.phase, o.agent_role, o.content, o.created_at
        FROM observations o
        WHERE ${likeClauses.join(' AND ')}
        ORDER BY o.created_at DESC
        LIMIT ?
      `).all(...likeParams);
    }
  } else {
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    rows = db.prepare(`
      SELECT o.id, o.track_id, o.type, o.phase, o.agent_role, o.content, o.created_at
      FROM observations o
      ${sqlWhere}
      ORDER BY o.created_at DESC
      LIMIT ?
    `).all(...params, limit);
  }

  return rows.map(row => ({
    id: row.id,
    track_id: row.track_id,
    type: row.type,
    phase: row.phase,
    agent_role: row.agent_role,
    created_at: row.created_at,
    summary_preview: summarizeContent(row.content)
  }));
}

function getObservations(db, ids = []) {
  const normalized = ids
    .map(n => Number(n))
    .filter(n => Number.isInteger(n) && n > 0);
  if (!normalized.length) return [];

  const placeholders = normalized.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT id, track_id, phase, type, agent_role, content, file_checksums, created_at
    FROM observations
    WHERE id IN (${placeholders})
    ORDER BY created_at ASC, id ASC
  `).all(...normalized);

  return rows.map(row => ({
    id: row.id,
    track_id: row.track_id,
    phase: row.phase,
    type: row.type,
    agent_role: row.agent_role,
    content: parseJsonSafe(row.content, row.content),
    file_checksums: parseJsonSafe(row.file_checksums, null),
    created_at: row.created_at
  }));
}

function getTimeline(db, options = {}) {
  const range = Math.max(1, Math.min(Number(options.range) || 20, 200));
  const trackId = options.track_id || null;

  if (options.around_id) {
    const row = db.prepare('SELECT created_at FROM observations WHERE id = ?').get(Number(options.around_id));
    if (row && row.created_at) {
      options.around_time = row.created_at;
    }
  }

  let rows;
  if (options.around_time) {
    if (trackId) {
      rows = db.prepare(`
        SELECT id, track_id, phase, type, agent_role, content, created_at
        FROM observations
        WHERE track_id = ?
        ORDER BY ABS(strftime('%s', created_at) - strftime('%s', ?)) ASC
        LIMIT ?
      `).all(trackId, options.around_time, range);
    } else {
      rows = db.prepare(`
        SELECT id, track_id, phase, type, agent_role, content, created_at
        FROM observations
        ORDER BY ABS(strftime('%s', created_at) - strftime('%s', ?)) ASC
        LIMIT ?
      `).all(options.around_time, range);
    }
  } else {
    if (trackId) {
      rows = db.prepare(`
        SELECT id, track_id, phase, type, agent_role, content, created_at
        FROM observations
        WHERE track_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(trackId, range);
    } else {
      rows = db.prepare(`
        SELECT id, track_id, phase, type, agent_role, content, created_at
        FROM observations
        ORDER BY created_at DESC
        LIMIT ?
      `).all(range);
    }
  }

  return rows
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map(row => ({
      id: row.id,
      track_id: row.track_id,
      phase: row.phase,
      type: row.type,
      agent_role: row.agent_role,
      created_at: row.created_at,
      summary_preview: summarizeContent(row.content)
    }));
}

function getObservationCount(db, trackId) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM observations WHERE track_id = ?').get(trackId);
  return row ? row.c : 0;
}

function getTrackStatus(db, trackId) {
  const total = getObservationCount(db, trackId);
  const byTypeRows = db.prepare(`
    SELECT type, COUNT(*) AS count
    FROM observations
    WHERE track_id = ?
    GROUP BY type
  `).all(trackId);
  const byType = {};
  for (const row of byTypeRows) {
    byType[row.type] = row.count;
  }

  const lastSession = db.prepare(`
    SELECT created_at
    FROM observations
    WHERE track_id = ? AND type = 'session_start'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(trackId);

  const phaseRows = db.prepare(`
    SELECT DISTINCT phase
    FROM observations
    WHERE track_id = ? AND type = 'phase_complete' AND phase IS NOT NULL
  `).all(trackId);

  const openIssueCount = (byType.verification_failure || 0) + (byType.stuck_escalation || 0);

  return {
    track_id: trackId,
    total_observations: total,
    observations_by_type: byType,
    phases_completed: phaseRows.map(r => r.phase).filter(Boolean),
    open_issue_count: openIssueCount,
    last_session_at: lastSession ? lastSession.created_at : null
  };
}

function normalizeRelative(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\/+/, '').trim();
}

function computeFileChecksums(projectRoot, files = []) {
  const normalizedFiles = [...new Set(files.map(normalizeRelative).filter(Boolean))];
  const checksums = {};
  const missing = [];
  const rootResolved = path.resolve(projectRoot);

  for (const relPath of normalizedFiles) {
    const candidatePath = relPath.split('/').join(path.sep);

    // Reject absolute paths (POSIX or Windows) outright.
    if (path.isAbsolute(candidatePath)) {
      missing.push(relPath);
      continue;
    }

    const absPath = path.resolve(rootResolved, candidatePath);

    // Ensure the resolved path is within the project root to prevent directory traversal.
    if (absPath !== rootResolved && !absPath.startsWith(rootResolved + path.sep)) {
      missing.push(relPath);
      continue;
    }

    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      missing.push(relPath);
      continue;
    }
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(absPath));
    checksums[relPath] = hash.digest('hex');
  }

  return { checksums, missing };
}

function extractTrackedFilesFromSessionStart(observation) {
  if (!observation) return [];
  const payload = typeof observation.content === 'string'
    ? parseJsonSafe(observation.content, {})
    : (observation.content || {});

  if (payload && payload.fileChecksums && typeof payload.fileChecksums === 'object') {
    return Object.keys(payload.fileChecksums);
  }
  if (observation.file_checksums && typeof observation.file_checksums === 'object') {
    return Object.keys(observation.file_checksums);
  }
  return [];
}

function getLatestSessionStartObservation(db, trackId) {
  const row = db.prepare(`
    SELECT id, track_id, type, content, file_checksums, created_at
    FROM observations
    WHERE track_id = ? AND type = 'session_start'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(trackId);
  if (!row) return null;
  return {
    ...row,
    content: parseJsonSafe(row.content, {}),
    file_checksums: parseJsonSafe(row.file_checksums, null)
  };
}

function compareChecksums(previousChecksums, currentChecksums) {
  const modified = [];
  const deleted = [];
  const added = [];

  for (const [file, oldHash] of Object.entries(previousChecksums || {})) {
    const newHash = currentChecksums[file];
    if (!newHash) {
      deleted.push(file);
      continue;
    }
    if (newHash !== oldHash) {
      modified.push(file);
    }
  }

  for (const file of Object.keys(currentChecksums || {})) {
    if (!Object.prototype.hasOwnProperty.call(previousChecksums || {}, file)) {
      added.push(file);
    }
  }

  return { modified, deleted, added };
}

function getGitCommitsSince(projectRoot, sinceIso, files = []) {
  const args = ['log', '--oneline', '--no-merges'];
  if (sinceIso) {
    args.push(`--since=${sinceIso}`);
  }
  args.push('--');
  for (const file of files) {
    args.push(file);
  }
  const result = runGitCommand(args, { cwd: projectRoot, timeout: 15000 });
  if (!result.success || !result.output.trim()) return [];
  return result.output.trim().split('\n').filter(Boolean);
}

function buildDriftReport(db, options = {}) {
  const trackId = options.track_id;
  const projectRoot = options.projectRoot;
  if (!trackId) {
    throw new Error('track_id is required for drift report');
  }
  if (!projectRoot) {
    throw new Error('projectRoot is required for drift report');
  }

  const latest = getLatestSessionStartObservation(db, trackId);
  if (!latest) {
    return {
      track_id: trackId,
      status: 'no_data',
      message: 'No session_start observation found for this track'
    };
  }

  const contentChecksums = latest.content && latest.content.fileChecksums && typeof latest.content.fileChecksums === 'object'
    ? latest.content.fileChecksums
    : {};
  const priorChecksums = Object.keys(contentChecksums).length > 0
    ? contentChecksums
    : (latest.file_checksums || {});

  const files = extractTrackedFilesFromSessionStart(latest);
  const current = computeFileChecksums(projectRoot, files);
  const changes = compareChecksums(priorChecksums, current.checksums);
  const commits = getGitCommitsSince(projectRoot, latest.created_at, files);

  return {
    track_id: trackId,
    status: 'ok',
    last_session_at: latest.created_at,
    tracked_files_count: files.length,
    missing_files: current.missing,
    modified_files: changes.modified,
    deleted_files: changes.deleted,
    new_files: changes.added,
    git_commits_since_last_session: commits
  };
}

module.exports = {
  OBSERVATION_TYPES,
  getActiveSqliteDriverName,
  resolveDbPath,
  initDatabase,
  closeDatabase,
  withDatabase,
  ensureTrack,
  writeObservation,
  searchObservations,
  getObservations,
  getTimeline,
  getObservationCount,
  getTrackStatus,
  pruneTrackObservations,
  computeFileChecksums,
  getLatestSessionStartObservation,
  buildDriftReport
};
