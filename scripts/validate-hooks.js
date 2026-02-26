#!/usr/bin/env node
/**
 * Validate that gemini-extension.json and hooks/hooks.json are in sync.
 *
 * Checks: hook names, commands, timeouts, descriptions, and matchers.
 * The manifest (gemini-extension.json) is the source of truth.
 *
 * Usage: node scripts/validate-hooks.js
 * Exit code 0 = in sync, 1 = mismatches found
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'gemini-extension.json');
const HOOKS_JSON_PATH = path.join(ROOT, 'hooks', 'hooks.json');

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Flatten the manifest hooks into a list of { event, name, command, timeout, description, matcher }
 */
function flattenManifest(manifest) {
  const hooks = [];
  for (const [event, entries] of Object.entries(manifest.hooks || {})) {
    for (const entry of entries) {
      hooks.push({
        event,
        name: entry.name,
        command: entry.command,
        timeout: entry.timeout,
        description: entry.description,
        matcher: entry.matcher || '*'
      });
    }
  }
  return hooks;
}

/**
 * Flatten hooks.json into the same shape
 */
function flattenHooksJson(hooksJson) {
  const hooks = [];
  for (const [event, matcherGroups] of Object.entries(hooksJson.hooks || {})) {
    for (const group of matcherGroups) {
      const matcher = group.matcher || '*';
      for (const entry of group.hooks || []) {
        hooks.push({
          event,
          name: entry.name,
          command: entry.command,
          timeout: entry.timeout,
          description: entry.description,
          matcher
        });
      }
    }
  }
  return hooks;
}

function main() {
  const manifest = loadJSON(MANIFEST_PATH);
  const hooksJson = loadJSON(HOOKS_JSON_PATH);

  const manifestHooks = flattenManifest(manifest);
  const jsonHooks = flattenHooksJson(hooksJson);

  // Index by name for comparison
  const manifestByName = new Map(manifestHooks.map(h => [h.name, h]));
  const jsonByName = new Map(jsonHooks.map(h => [h.name, h]));

  const errors = [];

  // Check all manifest hooks exist in hooks.json
  for (const [name, mHook] of manifestByName) {
    const jHook = jsonByName.get(name);
    if (!jHook) {
      errors.push(`MISSING in hooks.json: "${name}" (defined in manifest under ${mHook.event})`);
      continue;
    }

    // Compare fields (manifest is source of truth)
    if (mHook.event !== jHook.event) {
      errors.push(`EVENT mismatch for "${name}": manifest=${mHook.event}, hooks.json=${jHook.event}`);
    }
    if (mHook.command !== jHook.command) {
      errors.push(`COMMAND mismatch for "${name}": manifest=${mHook.command}, hooks.json=${jHook.command}`);
    }
    if (mHook.timeout !== jHook.timeout) {
      errors.push(`TIMEOUT mismatch for "${name}": manifest=${mHook.timeout}, hooks.json=${jHook.timeout}`);
    }
    if (mHook.description !== jHook.description) {
      errors.push(`DESCRIPTION mismatch for "${name}":\n  manifest: ${mHook.description}\n  hooks.json: ${jHook.description}`);
    }
    // Only compare matchers for tool-scoped events (BeforeTool, AfterTool).
    // Other events (SessionStart, BeforeAgent, AfterAgent, BeforeToolSelection)
    // use different matcher semantics between the two file formats.
    const toolScopedEvents = ['BeforeTool', 'AfterTool'];
    if (toolScopedEvents.includes(mHook.event) && mHook.matcher !== jHook.matcher) {
      errors.push(`MATCHER mismatch for "${name}": manifest=${mHook.matcher}, hooks.json=${jHook.matcher}`);
    }
  }

  // Check for hooks in hooks.json not in manifest
  for (const [name, jHook] of jsonByName) {
    if (!manifestByName.has(name)) {
      errors.push(`EXTRA in hooks.json: "${name}" (under ${jHook.event}) — not in manifest`);
    }
  }

  // Verify all hook script files exist
  for (const hook of manifestHooks) {
    const scriptPath = hook.command
      .replace('node ${extensionPath}/', '')
      .replace(/^node\s+/, '');
    const fullPath = path.join(ROOT, scriptPath);
    if (!fs.existsSync(fullPath)) {
      errors.push(`MISSING FILE: ${scriptPath} (referenced by "${hook.name}")`);
    }
  }

  // Report
  if (errors.length === 0) {
    console.log('✓ gemini-extension.json and hooks/hooks.json are in sync.');
    console.log(`  ${manifestHooks.length} hooks validated.`);
    process.exit(0);
  } else {
    console.error(`✗ Found ${errors.length} mismatch(es):\n`);
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    console.error('\nThe manifest (gemini-extension.json) is the source of truth.');
    process.exit(1);
  }
}

main();
