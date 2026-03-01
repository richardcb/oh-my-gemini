#!/usr/bin/env node
/**
 * Manual test suite for mode-state.ts and mode-config.ts (PRD 0003)
 *
 * Run: node test/manual-mode-state-test.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const { resolveModeFromPrompt, writeModeState, readModeState, cleanStaleState, getStatePath, STALE_THRESHOLD_MS, DEFAULT_MODE_STATE } = require('../dist/lib/mode-state');
const { composeModeProfile, VALID_PRIMARY_MODES, VALID_MODIFIERS, DEFAULT_MODE_PROFILES, getMetaTools } = require('../dist/lib/mode-config');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.log(`  FAIL: ${message}`);
    failed++;
  }
}

// --- Test temp directory ---
const testRoot = path.join(os.tmpdir(), 'omg-mode-test-' + Date.now());
fs.mkdirSync(path.join(testRoot, '.gemini'), { recursive: true });

// ===================== resolveModeFromPrompt =====================
console.log('\n=== resolveModeFromPrompt ===');

const r1 = resolveModeFromPrompt('research: JWT best practices');
assert(r1.primary === 'research', `research: → research (got ${r1.primary})`);
assert(r1.source === 'keyword', 'source is keyword');

const r2 = resolveModeFromPrompt('@architect review the auth module');
assert(r2.primary === 'review', `@architect → review (got ${r2.primary})`);

const r3 = resolveModeFromPrompt('implement: add dark mode');
assert(r3.primary === 'implement', `implement: → implement (got ${r3.primary})`);

const r4 = resolveModeFromPrompt('quickfix: typo in header');
assert(r4.primary === 'quickfix', `quickfix: → quickfix (got ${r4.primary})`);

const r5 = resolveModeFromPrompt('plan: design the API');
assert(r5.primary === 'plan', `plan: → plan (got ${r5.primary})`);

const r6 = resolveModeFromPrompt('add a button to the homepage');
assert(r6.primary === 'implement', `no keyword → implement (got ${r6.primary})`);
assert(r6.source === 'default', 'source is default');

const r7 = resolveModeFromPrompt('eco: fix the bug');
assert(r7.primary === 'implement', `eco: without primary → implement (got ${r7.primary})`);
assert(r7.modifiers.includes('eco'), 'eco modifier present');

const r8 = resolveModeFromPrompt('eco: research: JWT');
assert(r8.primary === 'research', `eco: research: → research (got ${r8.primary})`);
assert(r8.modifiers.includes('eco'), 'eco modifier present with primary');

// Backward compat
const r9 = resolveModeFromPrompt('@researcher find docs');
assert(r9.primary === 'research', `@researcher → research (got ${r9.primary})`);

const r10 = resolveModeFromPrompt('@executor build the feature');
assert(r10.primary === 'implement', `@executor → implement (got ${r10.primary})`);

const r11 = resolveModeFromPrompt('review: check the PR');
assert(r11.primary === 'review', `review: → review (got ${r11.primary})`);

const r12 = resolveModeFromPrompt('qf: fix typo');
assert(r12.primary === 'quickfix', `qf: → quickfix (got ${r12.primary})`);

const r13 = resolveModeFromPrompt('design: the new API');
assert(r13.primary === 'plan', `design: → plan (got ${r13.primary})`);

const r14 = resolveModeFromPrompt('build: the feature');
assert(r14.primary === 'implement', `build: → implement (got ${r14.primary})`);

// ===================== writeModeState + readModeState =====================
console.log('\n=== writeModeState + readModeState ===');

const testSessionId = 'test-session-001';
const testState = { primary: 'research', modifiers: ['eco'], resolvedAt: new Date().toISOString(), source: 'keyword' };

writeModeState(testSessionId, testState, testRoot);
const stateFile = getStatePath(testSessionId, testRoot);
assert(fs.existsSync(stateFile), 'mode.json created on disk');

const readBack = readModeState(testSessionId, testRoot);
assert(readBack.primary === 'research', `readModeState returns research (got ${readBack.primary})`);
assert(readBack.modifiers.includes('eco'), 'readModeState returns eco modifier');
assert(readBack.source === 'keyword', 'readModeState returns keyword source');

// Missing session returns default
const missing = readModeState('nonexistent-session', testRoot);
assert(missing.primary === 'implement', `missing session → implement (got ${missing.primary})`);

// Invalid primary returns default
const invalidDir = path.join(testRoot, '.gemini', 'omg-state', 'bad-session');
fs.mkdirSync(invalidDir, { recursive: true });
fs.writeFileSync(path.join(invalidDir, 'mode.json'), JSON.stringify({ primary: 'invalid_mode', modifiers: [], resolvedAt: new Date().toISOString(), source: 'keyword' }));
const invalidRead = readModeState('bad-session', testRoot);
assert(invalidRead.primary === 'implement', `invalid primary → implement (got ${invalidRead.primary})`);

// Bad JSON returns default
const badJsonDir = path.join(testRoot, '.gemini', 'omg-state', 'bad-json');
fs.mkdirSync(badJsonDir, { recursive: true });
fs.writeFileSync(path.join(badJsonDir, 'mode.json'), '{not valid json');
const badJsonRead = readModeState('bad-json', testRoot);
assert(badJsonRead.primary === 'implement', `bad JSON → implement (got ${badJsonRead.primary})`);

// ===================== cleanStaleState =====================
console.log('\n=== cleanStaleState ===');

// Create a stale entry (manually set old resolvedAt)
const staleDir = path.join(testRoot, '.gemini', 'omg-state', 'stale-session');
fs.mkdirSync(staleDir, { recursive: true });
const staleDate = new Date(Date.now() - STALE_THRESHOLD_MS - 1000).toISOString();
fs.writeFileSync(path.join(staleDir, 'mode.json'), JSON.stringify({ primary: 'research', modifiers: [], resolvedAt: staleDate, source: 'keyword' }));

// Current entry should survive
const freshDir = path.join(testRoot, '.gemini', 'omg-state', 'fresh-session');
fs.mkdirSync(freshDir, { recursive: true });
fs.writeFileSync(path.join(freshDir, 'mode.json'), JSON.stringify({ primary: 'implement', modifiers: [], resolvedAt: new Date().toISOString(), source: 'default' }));

const cleaned = cleanStaleState(testRoot);
assert(cleaned >= 2, `cleaned stale entries (got ${cleaned})`); // stale + bad-json (bad-session has fresh resolvedAt)
assert(!fs.existsSync(staleDir), 'stale dir removed');
assert(fs.existsSync(freshDir), 'fresh dir preserved');

// ===================== composeModeProfile =====================
console.log('\n=== composeModeProfile ===');

const researchProfile = composeModeProfile('research', []);
assert(Array.isArray(researchProfile.tools), 'research has array tools');
assert(researchProfile.mcpPassthrough === true, 'research has mcpPassthrough');
assert(researchProfile.autoVerification.enabled === false, 'research has verification disabled');
assert(researchProfile.phaseGates.enabled === false, 'research has phase gates disabled');
assert(researchProfile.suggestedSkills.includes('research-methodology'), 'research suggests research-methodology');

const implProfile = composeModeProfile('implement', []);
assert(implProfile.tools === '*', 'implement has * tools');
assert(implProfile.autoVerification.enabled === true, 'implement has verification enabled');
assert(implProfile.autoVerification.typecheck === true, 'implement has typecheck');
assert(implProfile.autoVerification.lint === true, 'implement has lint');
assert(implProfile.phaseGates.enabled === true, 'implement has phase gates enabled');

const reviewProfile = composeModeProfile('review', []);
assert(Array.isArray(reviewProfile.tools), 'review has array tools');
assert(reviewProfile.autoVerification.typecheck === false, 'review has no typecheck');
assert(reviewProfile.autoVerification.lint === true, 'review has lint');
assert(reviewProfile.phaseGates.enabled === false, 'review has phase gates disabled');

const quickfixProfile = composeModeProfile('quickfix', []);
assert(quickfixProfile.tools === '*', 'quickfix has * tools');
assert(quickfixProfile.autoVerification.typecheck === true, 'quickfix has typecheck');
assert(quickfixProfile.autoVerification.lint === false, 'quickfix has no lint');

const planProfile = composeModeProfile('plan', []);
assert(planProfile.tools === null, 'plan has null tools');
assert(planProfile.autoVerification.enabled === false, 'plan has verification disabled');

// Eco modifier composition
const ecoImplProfile = composeModeProfile('implement', ['eco']);
assert(ecoImplProfile.tools === '*', 'implement+eco still has * tools');
assert(ecoImplProfile.autoVerification.lint === false, 'implement+eco has no lint');
assert(ecoImplProfile.autoVerification.typecheck === true, 'implement+eco has typecheck');
assert(ecoImplProfile.contextInjection.conductorState === 'summary', 'implement+eco has summary conductor');
assert(ecoImplProfile.contextInjection.gitHistory === false, 'implement+eco has no git history');

const ecoResearchProfile = composeModeProfile('research', ['eco']);
assert(ecoResearchProfile.contextInjection.conductorState === 'summary', 'research+eco has summary conductor');

// ===================== getMetaTools =====================
console.log('\n=== getMetaTools ===');

const metaTools = getMetaTools();
assert(metaTools.includes('delegate_to_agent'), 'meta tools include delegate_to_agent');
assert(metaTools.includes('ask_user'), 'meta tools include ask_user');
assert(metaTools.includes('activate_skill'), 'meta tools include activate_skill');

// ===================== VALID_PRIMARY_MODES / VALID_MODIFIERS =====================
console.log('\n=== Validation constants ===');

assert(VALID_PRIMARY_MODES.length === 5, `5 primary modes (got ${VALID_PRIMARY_MODES.length})`);
assert(VALID_PRIMARY_MODES.includes('research'), 'includes research');
assert(VALID_PRIMARY_MODES.includes('implement'), 'includes implement');
assert(VALID_PRIMARY_MODES.includes('review'), 'includes review');
assert(VALID_PRIMARY_MODES.includes('quickfix'), 'includes quickfix');
assert(VALID_PRIMARY_MODES.includes('plan'), 'includes plan');
assert(VALID_MODIFIERS.length === 1, `1 modifier (got ${VALID_MODIFIERS.length})`);
assert(VALID_MODIFIERS.includes('eco'), 'includes eco');

// ===================== Cleanup =====================
try {
  fs.rmSync(testRoot, { recursive: true, force: true });
} catch { /* ignore */ }

// ===================== Summary =====================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
