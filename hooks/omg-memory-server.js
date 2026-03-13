#!/usr/bin/env node
/**
 * oh-my-gemini Memory MCP Server (PRD 0007)
 *
 * Lightweight HTTP JSON-RPC service exposing memory tools:
 * - omg_memory_search
 * - omg_memory_timeline
 * - omg_memory_get
 * - omg_memory_drift
 * - omg_memory_status
 */

const http = require('http');
const { URL } = require('url');
const { findProjectRoot, log, debug } = require('./lib/utils');
const { loadConfig, getConfigValue } = require('./lib/config');
const {
  withDatabase,
  searchObservations,
  getTimeline,
  getObservations,
  buildDriftReport,
  getTrackStatus
} = require('./lib/memory');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--port' && argv[i + 1]) {
      args.port = Number(argv[++i]);
    } else if (token === '--db' && argv[i + 1]) {
      args.dbPath = argv[++i];
    } else if (token === '--projectRoot' && argv[i + 1]) {
      args.projectRoot = argv[++i];
    }
  }
  return args;
}

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let settled = false;

    const safeResolve = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const safeReject = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    req.setEncoding('utf8');

    req.on('data', chunk => {
      if (settled) {
        return;
      }
      data += chunk;
      if (data.length > 1024 * 1024) {
        safeReject(new Error('Request body too large'));
        // Stop reading further data to avoid memory/CPU DoS
        req.destroy();
      }
    });

    req.on('end', () => {
      if (settled) {
        return;
      }
      if (!data) return safeResolve({});
      try {
        safeResolve(JSON.parse(data));
      } catch (err) {
        safeReject(new Error(`Invalid JSON body: ${err.message}`));
      }
    });

    req.on('error', safeReject);
  });
}

function toolDefinitions() {
  return [
    {
      name: 'omg_memory_search',
      description: 'Search memory observations by text/type/track/phase/agent role',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          type: { type: 'string' },
          track_id: { type: 'string' },
          phase: { type: 'string' },
          agent_role: { type: 'string' },
          limit: { type: 'number' }
        }
      }
    },
    {
      name: 'omg_memory_timeline',
      description: 'Retrieve chronological context around a timestamp or observation id',
      inputSchema: {
        type: 'object',
        properties: {
          track_id: { type: 'string' },
          around_id: { type: 'number' },
          around_time: { type: 'string' },
          range: { type: 'number' }
        }
      }
    },
    {
      name: 'omg_memory_get',
      description: 'Fetch full observation details by observation ids',
      inputSchema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'number' } }
        },
        required: ['ids']
      }
    },
    {
      name: 'omg_memory_drift',
      description: 'Compare current file checksums against last session_start for a track',
      inputSchema: {
        type: 'object',
        properties: {
          track_id: { type: 'string' }
        },
        required: ['track_id']
      }
    },
    {
      name: 'omg_memory_status',
      description: 'Get memory summary for a track (counts, phases, last session)',
      inputSchema: {
        type: 'object',
        properties: {
          track_id: { type: 'string' }
        },
        required: ['track_id']
      }
    }
  ];
}

function callTool(name, args, dbPath, projectRoot) {
  switch (name) {
    case 'omg_memory_search':
      return withDatabase(dbPath, db => searchObservations(db, args || {}));
    case 'omg_memory_timeline':
      return withDatabase(dbPath, db => getTimeline(db, args || {}));
    case 'omg_memory_get':
      return withDatabase(dbPath, db => getObservations(db, (args && args.ids) || []));
    case 'omg_memory_drift':
      if (!args || !args.track_id) {
        throw new Error('track_id is required');
      }
      return withDatabase(dbPath, db => buildDriftReport(db, {
        track_id: args && args.track_id,
        projectRoot
      }));
    case 'omg_memory_status':
      if (!args || !args.track_id) {
        throw new Error('track_id is required');
      }
      return withDatabase(dbPath, db => getTrackStatus(db, args && args.track_id));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function main() {
  const argConfig = parseArgs(process.argv.slice(2));
  const projectRoot = argConfig.projectRoot || findProjectRoot(process.cwd());
  const config = loadConfig(projectRoot);
  const memoryConfig = getConfigValue(config, 'memory', {});
  const port = Number.isFinite(argConfig.port) ? argConfig.port : (memoryConfig.mcpPort || 37888);
  const dbPath = argConfig.dbPath || memoryConfig.dbPath;

  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);
      if (req.method === 'GET' && reqUrl.pathname === '/health') {
        return jsonResponse(res, 200, {
          ok: true,
          server: 'omg-memory',
          port
        });
      }

      if (req.method === 'GET' && reqUrl.pathname === '/tools') {
        return jsonResponse(res, 200, { tools: toolDefinitions() });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/mcp') {
        const body = await readJsonBody(req);
        const id = Object.prototype.hasOwnProperty.call(body, 'id') ? body.id : null;

        if (body.method === 'tools/list') {
          return jsonResponse(res, 200, {
            jsonrpc: '2.0',
            id,
            result: { tools: toolDefinitions() }
          });
        }

        if (body.method === 'tools/call') {
          const name = body?.params?.name;
          const args = body?.params?.arguments || {};
          const result = callTool(name, args, dbPath, projectRoot);
          return jsonResponse(res, 200, {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              structuredContent: result
            }
          });
        }

        return jsonResponse(res, 400, {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unsupported method: ${body.method}` }
        });
      }

      if (req.method === 'POST' && reqUrl.pathname.startsWith('/tools/')) {
        const toolName = reqUrl.pathname.replace('/tools/', '');
        const args = await readJsonBody(req);
        const result = callTool(toolName, args, dbPath, projectRoot);
        return jsonResponse(res, 200, result);
      }

      return jsonResponse(res, 404, { error: 'Not found' });
    } catch (err) {
      log(`Memory server request error: ${err.message}`);
      return jsonResponse(res, 500, { error: err.message });
    }
  });

  server.listen(port, '127.0.0.1', () => {
    debug(`omg-memory-server listening on 127.0.0.1:${port}`);
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}

main().catch(err => {
  log(`Memory server startup failed: ${err.message}`);
  process.exit(1);
});
