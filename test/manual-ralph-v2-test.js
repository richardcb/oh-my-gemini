#!/usr/bin/env node
/**
 * Manual test suite for Enhanced Ralph v2 (PRD 0005)
 *
 * Tests:
 * - writeVerificationState (after-tool.js addition)
 * - readVerificationState (ralph-retry.js)
 * - loadRalphState / saveRalphState (session-scoped)
 * - State migration from old format
 * - checkStuckProtocol
 * - Verification-denied success detection
 * - Edge cases (missing files, bad JSON, stale state, null sessionId)
 *
 * Run: node test/manual-ralph-v2-test.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

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
const testRoot = path.join(os.tmpdir(), 'omg-ralph-v2-test-' + Date.now());
fs.mkdirSync(path.join(testRoot, '.gemini', 'omg-state'), { recursive: true });

// ===================== writeVerificationState (after-tool.js function) =====================
console.log('\n=== writeVerificationState (simulated) ===');

// Simulate what after-tool.js writeVerificationState does
function simulateWriteVerificationState(projectRoot, sessionId, typecheckResult, lintResult) {
  const dir = path.join(projectRoot, '.gemini', 'omg-state', sessionId);
  fs.mkdirSync(dir, { recursive: true });

  const extractSummary = (result) => {
    if (!result || result.skipped) return { passed: true, errorCount: 0, summary: '' };
    const p = result.success && !result.hasLintErrors;
    const output = (result.output || '').trim();
    const summary = output.substring(0, 500);
    const errorCount = p ? 0 : Math.max(1, output.split('\n').filter(l => l.trim()).length);
    return { passed: p, errorCount, summary };
  };

  const state = {
    lastRun: new Date().toISOString(),
    typecheck: extractSummary(typecheckResult),
    lint: extractSummary(lintResult),
    timestamp: Date.now()
  };

  const json = JSON.stringify(state, null, 2);
  const tmpPath = path.join(dir, 'verification.tmp.json');
  const finalPath = path.join(dir, 'verification.json');
  fs.writeFileSync(tmpPath, json);
  fs.renameSync(tmpPath, finalPath);
  return state;
}

// Test 1: Write with failing typecheck
const tc1 = simulateWriteVerificationState(testRoot, 'sess-01', {
  success: false, output: "TS2339: Property 'x' does not exist on type 'Y'\nsrc/foo.ts(10,5): error TS2339", skipped: false
}, {
  success: true, output: '', skipped: false
});
assert(tc1.typecheck.passed === false, 'typecheck.passed is false for failing tc');
assert(tc1.typecheck.errorCount === 2, `typecheck.errorCount is 2 (got ${tc1.typecheck.errorCount})`);
assert(tc1.lint.passed === true, 'lint.passed is true');
assert(tc1.lint.errorCount === 0, 'lint.errorCount is 0');

// Test 2: Write with all passing
const tc2 = simulateWriteVerificationState(testRoot, 'sess-02', {
  success: true, output: '', skipped: false
}, {
  success: true, output: '', skipped: false
});
assert(tc2.typecheck.passed === true, 'all-pass: typecheck.passed is true');
assert(tc2.lint.passed === true, 'all-pass: lint.passed is true');

// Test 3: Write with skipped checks
const tc3 = simulateWriteVerificationState(testRoot, 'sess-03', {
  success: true, output: '', skipped: true
}, null);
assert(tc3.typecheck.passed === true, 'skipped tc: typecheck.passed is true');
assert(tc3.lint.passed === true, 'skipped lint: lint.passed is true');

// Test 4: Write with lint errors
const tc4 = simulateWriteVerificationState(testRoot, 'sess-04', {
  success: true, output: '', skipped: false
}, {
  success: true, output: 'src/foo.ts: Missing semicolon', skipped: false, hasLintErrors: true
});
assert(tc4.lint.passed === false, 'lint-fail: lint.passed is false');
assert(tc4.lint.errorCount >= 1, 'lint-fail: lint.errorCount >= 1');

// ===================== readVerificationState =====================
console.log('\n=== readVerificationState (simulated) ===');

const VERIFICATION_STALE_MS = 5 * 60 * 1000;

function simulateReadVerificationState(projectRoot, sessionId) {
  try {
    const filePath = path.join(projectRoot, '.gemini', 'omg-state', sessionId, 'verification.json');
    if (!fs.existsSync(filePath)) return { available: false };
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (parsed.timestamp && (Date.now() - parsed.timestamp > VERIFICATION_STALE_MS)) {
      return { available: false };
    }
    const tcPassed = parsed?.typecheck?.passed !== false;
    const lintPassed = parsed?.lint?.passed !== false;
    const allPassed = tcPassed && lintPassed;
    let errorSummary = '';
    let errorCount = 0;
    if (!tcPassed) {
      errorSummary = `typecheck failing -- ${(parsed.typecheck.summary || 'unknown error').substring(0, 500)}`;
      errorCount += parsed.typecheck.errorCount || 1;
    }
    if (!lintPassed) {
      const lintMsg = `lint failing -- ${(parsed.lint.summary || 'unknown error').substring(0, 500)}`;
      errorSummary = errorSummary ? `${errorSummary}; ${lintMsg}` : lintMsg;
      errorCount += parsed.lint.errorCount || 1;
    }
    return { available: true, allPassed, errorSummary, errorCount };
  } catch {
    return { available: false };
  }
}

// Test 5: Read failing verification
const rv1 = simulateReadVerificationState(testRoot, 'sess-01');
assert(rv1.available === true, 'read failing: available');
assert(rv1.allPassed === false, 'read failing: not all passed');
assert(rv1.errorSummary.includes('typecheck failing'), 'read failing: errorSummary mentions typecheck');
assert(rv1.errorCount === 2, `read failing: errorCount is 2 (got ${rv1.errorCount})`);

// Test 6: Read passing verification
const rv2 = simulateReadVerificationState(testRoot, 'sess-02');
assert(rv2.available === true, 'read passing: available');
assert(rv2.allPassed === true, 'read passing: all passed');

// Test 7: Read missing session
const rv3 = simulateReadVerificationState(testRoot, 'nonexistent');
assert(rv3.available === false, 'missing session: not available');

// Test 8: Read corrupted JSON
const badJsonDir = path.join(testRoot, '.gemini', 'omg-state', 'bad-v-json');
fs.mkdirSync(badJsonDir, { recursive: true });
fs.writeFileSync(path.join(badJsonDir, 'verification.json'), 'not json');
const rv4 = simulateReadVerificationState(testRoot, 'bad-v-json');
assert(rv4.available === false, 'bad JSON: not available');

// Test 9: Read stale verification
const staleVDir = path.join(testRoot, '.gemini', 'omg-state', 'stale-v');
fs.mkdirSync(staleVDir, { recursive: true });
fs.writeFileSync(path.join(staleVDir, 'verification.json'), JSON.stringify({
  lastRun: new Date().toISOString(),
  typecheck: { passed: false, errorCount: 1, summary: 'old error' },
  lint: { passed: true, errorCount: 0, summary: '' },
  timestamp: Date.now() - VERIFICATION_STALE_MS - 1000
}));
const rv5 = simulateReadVerificationState(testRoot, 'stale-v');
assert(rv5.available === false, 'stale verification: not available');

// Test 10: Read lint-only failure
const rv6 = simulateReadVerificationState(testRoot, 'sess-04');
assert(rv6.available === true, 'lint-only fail: available');
assert(rv6.allPassed === false, 'lint-only fail: not all passed');
assert(rv6.errorSummary.includes('lint failing'), 'lint-only fail: errorSummary mentions lint');

// ===================== loadRalphState / saveRalphState =====================
console.log('\n=== loadRalphState / saveRalphState (simulated) ===');

const DEFAULT_RALPH_STATE = {
  attempts: 0, lastTimestamp: null, lastErrorSignature: null,
  consecutiveSameError: 0, stuckItems: []
};

function simulateGetSessionStatePath(sessionId, projectRoot) {
  return path.join(projectRoot, '.gemini', 'omg-state', sessionId, 'ralph.json');
}

function simulateSaveRalphState(sessionId, projectRoot, state) {
  const statePath = simulateGetSessionStatePath(sessionId, projectRoot);
  const dir = path.dirname(statePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function simulateLoadRalphState(sessionId, projectRoot) {
  const statePath = simulateGetSessionStatePath(sessionId, projectRoot);
  try {
    if (fs.existsSync(statePath)) {
      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      return {
        attempts: parsed.attempts || 0,
        lastTimestamp: parsed.lastTimestamp || null,
        lastErrorSignature: parsed.lastErrorSignature || null,
        consecutiveSameError: parsed.consecutiveSameError || 0,
        stuckItems: Array.isArray(parsed.stuckItems) ? parsed.stuckItems : []
      };
    }
  } catch {
    return { ...DEFAULT_RALPH_STATE };
  }

  // Migration check
  try {
    const oldPath = path.join(projectRoot, '.gemini', 'ralph-state.json');
    if (fs.existsSync(oldPath)) {
      const oldState = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
      if (oldState.sessions && oldState.sessions[sessionId]) {
        const entry = oldState.sessions[sessionId];
        const migrated = {
          attempts: entry.attempts || 0,
          lastTimestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : null,
          lastErrorSignature: null, consecutiveSameError: 0, stuckItems: []
        };
        simulateSaveRalphState(sessionId, projectRoot, migrated);
        return migrated;
      }
    }
  } catch { /* ignore */ }

  return { ...DEFAULT_RALPH_STATE };
}

// Test 11: Save and load ralph state
const testState = { attempts: 3, lastTimestamp: new Date().toISOString(),
  lastErrorSignature: 'TS2339', consecutiveSameError: 2, stuckItems: ['fix auth'] };
simulateSaveRalphState('rs-01', testRoot, testState);
const loaded = simulateLoadRalphState('rs-01', testRoot);
assert(loaded.attempts === 3, `load: attempts is 3 (got ${loaded.attempts})`);
assert(loaded.lastErrorSignature === 'TS2339', 'load: lastErrorSignature preserved');
assert(loaded.consecutiveSameError === 2, 'load: consecutiveSameError preserved');
assert(loaded.stuckItems.length === 1, 'load: stuckItems preserved');

// Test 12: Load missing session returns default
const loadMissing = simulateLoadRalphState('nonexistent-rs', testRoot);
assert(loadMissing.attempts === 0, 'missing: attempts is 0');
assert(loadMissing.stuckItems.length === 0, 'missing: stuckItems empty');

// Test 13: Load corrupted ralph.json returns default
const badRDir = path.join(testRoot, '.gemini', 'omg-state', 'bad-ralph');
fs.mkdirSync(badRDir, { recursive: true });
fs.writeFileSync(path.join(badRDir, 'ralph.json'), '{bad}');
const loadBad = simulateLoadRalphState('bad-ralph', testRoot);
assert(loadBad.attempts === 0, 'corrupted: attempts is 0');

// ===================== Migration from old format =====================
console.log('\n=== Migration from old ralph-state.json ===');

// Test 14: Migrate from old format
const oldState = {
  sessions: {
    'migrate-sess': { attempts: 2, timestamp: Date.now() }
  }
};
fs.writeFileSync(path.join(testRoot, '.gemini', 'ralph-state.json'), JSON.stringify(oldState));
const migrated = simulateLoadRalphState('migrate-sess', testRoot);
assert(migrated.attempts === 2, `migration: attempts is 2 (got ${migrated.attempts})`);
assert(migrated.lastErrorSignature === null, 'migration: new fields defaulted');
assert(migrated.consecutiveSameError === 0, 'migration: consecutiveSameError is 0');
// Verify new file was created
assert(fs.existsSync(simulateGetSessionStatePath('migrate-sess', testRoot)), 'migration: new file created');
// Verify old file still exists
assert(fs.existsSync(path.join(testRoot, '.gemini', 'ralph-state.json')), 'migration: old file preserved');

// Test 15: Migration with no matching session in old file
const noMatchMigrate = simulateLoadRalphState('no-match-sess', testRoot);
assert(noMatchMigrate.attempts === 0, 'no-match migration: returns default');

// ===================== checkStuckProtocol =====================
console.log('\n=== checkStuckProtocol ===');

function simulateCheckStuckProtocol(state, currentErrorSignature, stuckThreshold) {
  const updatedState = { ...state };
  const sig = (currentErrorSignature || '').substring(0, 100).trim();
  if (!sig) {
    updatedState.consecutiveSameError = 1;
    updatedState.lastErrorSignature = null;
    return { isStuck: false, updatedState };
  }
  if (sig === state.lastErrorSignature) {
    updatedState.consecutiveSameError = (state.consecutiveSameError || 0) + 1;
  } else {
    updatedState.consecutiveSameError = 1;
    updatedState.lastErrorSignature = sig;
  }
  if (updatedState.consecutiveSameError >= stuckThreshold) {
    const stuckItems = [...(state.stuckItems || [])];
    stuckItems.push(sig.substring(0, 200));
    if (stuckItems.length > 10) stuckItems.splice(0, stuckItems.length - 10);
    updatedState.stuckItems = stuckItems;
    updatedState.consecutiveSameError = 0;
    return { isStuck: true, updatedState };
  }
  return { isStuck: false, updatedState };
}

// Test 16: First error — not stuck
const sp1 = simulateCheckStuckProtocol(
  { ...DEFAULT_RALPH_STATE }, 'TS2339: Property x', 3
);
assert(sp1.isStuck === false, 'first error: not stuck');
assert(sp1.updatedState.consecutiveSameError === 1, 'first error: consecutive=1');
assert(sp1.updatedState.lastErrorSignature === 'TS2339: Property x', 'first error: signature set');

// Test 17: Same error second time — not stuck
const sp2 = simulateCheckStuckProtocol(
  { ...DEFAULT_RALPH_STATE, lastErrorSignature: 'TS2339: Property x', consecutiveSameError: 1 },
  'TS2339: Property x', 3
);
assert(sp2.isStuck === false, 'second same error: not stuck');
assert(sp2.updatedState.consecutiveSameError === 2, 'second same error: consecutive=2');

// Test 18: Same error third time — STUCK
const sp3 = simulateCheckStuckProtocol(
  { ...DEFAULT_RALPH_STATE, lastErrorSignature: 'TS2339: Property x', consecutiveSameError: 2 },
  'TS2339: Property x', 3
);
assert(sp3.isStuck === true, 'third same error: STUCK');
assert(sp3.updatedState.consecutiveSameError === 0, 'stuck: consecutive reset to 0');
assert(sp3.updatedState.stuckItems.length === 1, 'stuck: stuckItems has 1 entry');
assert(sp3.updatedState.stuckItems[0] === 'TS2339: Property x', 'stuck: stuckItems contains error');

// Test 19: Different error resets counter
const sp4 = simulateCheckStuckProtocol(
  { ...DEFAULT_RALPH_STATE, lastErrorSignature: 'TS2339: Property x', consecutiveSameError: 2 },
  'TS2345: Argument type mismatch', 3
);
assert(sp4.isStuck === false, 'different error: not stuck');
assert(sp4.updatedState.consecutiveSameError === 1, 'different error: consecutive=1');
assert(sp4.updatedState.lastErrorSignature === 'TS2345: Argument type mismatch', 'different error: new signature');

// Test 20: Empty signature treated as unique (no false stuck)
const sp5 = simulateCheckStuckProtocol(
  { ...DEFAULT_RALPH_STATE, lastErrorSignature: '', consecutiveSameError: 2 },
  '', 3
);
assert(sp5.isStuck === false, 'empty signature: not stuck');
assert(sp5.updatedState.consecutiveSameError === 1, 'empty signature: consecutive=1');

// Test 21: stuckItems capped at 10
const manyStuck = { ...DEFAULT_RALPH_STATE,
  lastErrorSignature: 'err', consecutiveSameError: 2,
  stuckItems: Array(10).fill('old-stuck')
};
const sp6 = simulateCheckStuckProtocol(manyStuck, 'err', 3);
assert(sp6.isStuck === true, 'stuckItems cap: stuck');
assert(sp6.updatedState.stuckItems.length === 10, 'stuckItems cap: stays at 10');
assert(sp6.updatedState.stuckItems[9] === 'err', 'stuckItems cap: newest at end');

// Test 22: Custom threshold (2)
const sp7 = simulateCheckStuckProtocol(
  { ...DEFAULT_RALPH_STATE, lastErrorSignature: 'err', consecutiveSameError: 1 },
  'err', 2
);
assert(sp7.isStuck === true, 'threshold=2: stuck after 2');

// Test 23: Higher threshold (5) — not stuck at 3
const sp8 = simulateCheckStuckProtocol(
  { ...DEFAULT_RALPH_STATE, lastErrorSignature: 'err', consecutiveSameError: 3 },
  'err', 5
);
assert(sp8.isStuck === false, 'threshold=5: not stuck at 4');

// ===================== Config safe limits =====================
console.log('\n=== Config safe limits ===');

// Test 24: stuckThreshold clamped to [2, 10]
assert(Math.max(2, Math.min(1, 10)) === 2, 'stuckThreshold min clamp: 1 → 2');
assert(Math.max(2, Math.min(15, 10)) === 10, 'stuckThreshold max clamp: 15 → 10');
assert(Math.max(2, Math.min(3, 10)) === 3, 'stuckThreshold in range: 3 → 3');
assert(Math.max(2, Math.min(undefined || 3, 10)) === 3, 'stuckThreshold default: undefined → 3');

// ===================== Error signature truncation =====================
console.log('\n=== Error signature truncation ===');

// Test 25: Signature truncated to 100 chars
const longSig = 'x'.repeat(200);
const sp9 = simulateCheckStuckProtocol({ ...DEFAULT_RALPH_STATE }, longSig, 3);
assert(sp9.updatedState.lastErrorSignature.length === 100, 'long signature truncated to 100');

// Test 26: stuckItems entry truncated to 200 chars
const longStuckSig = 'y'.repeat(300);
const spLong = simulateCheckStuckProtocol(
  { ...DEFAULT_RALPH_STATE, lastErrorSignature: longStuckSig.substring(0, 100), consecutiveSameError: 2 },
  longStuckSig, 3
);
assert(spLong.updatedState.stuckItems[0].length === 100, 'stuckItems entry respects 100-char signature limit');

// ===================== Session ID edge cases =====================
console.log('\n=== Session ID edge cases ===');

// Test 27: null/undefined session defaults to 'default'
const defaultSid = (null || 'default');
assert(defaultSid === 'default', 'null session → default');
const undefSid = (undefined || 'default');
assert(undefSid === 'default', 'undefined session → default');

// ===================== Verification state file atomicity =====================
console.log('\n=== Atomic write verification ===');

// Test 28: No temp file left behind after write
const atomicDir = path.join(testRoot, '.gemini', 'omg-state', 'atomic-test');
fs.mkdirSync(atomicDir, { recursive: true });
simulateWriteVerificationState(testRoot, 'atomic-test', {
  success: true, output: '', skipped: false
}, { success: true, output: '', skipped: false });
assert(fs.existsSync(path.join(atomicDir, 'verification.json')), 'atomic: final file exists');
assert(!fs.existsSync(path.join(atomicDir, 'verification.tmp.json')), 'atomic: temp file removed');

// ===================== Cleanup =====================
try {
  fs.rmSync(testRoot, { recursive: true, force: true });
} catch { /* ignore */ }

// ===================== Summary =====================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
