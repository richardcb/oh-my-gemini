#!/usr/bin/env node
/**
 * Manual verification script for keyword-registry.ts
 * Covers all test cases from PRD 0004 tasks plan (Tasks 11.0-13.0).
 *
 * Run: node test/manual-keyword-test.js
 * Expected: All tests pass, exit code 0.
 */

const kr = require('../dist/lib/keyword-registry');

let passed = 0;
let failed = 0;

function test(name, actual, expected) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    Expected: ${expectedStr}`);
    console.log(`    Actual:   ${actualStr}`);
  }
}

// --- Section 1: detectMagicKeywords (Task 11.0-11.2) ---
console.log('\n=== detectMagicKeywords ===\n');

test('research: prefix',
  kr.detectMagicKeywords('research: JWT best practices'),
  { primary: 'research', modifiers: [], remainder: 'JWT best practices' });

test('@researcher handle',
  kr.detectMagicKeywords('@researcher what about JWT?'),
  { primary: 'research', modifiers: [], remainder: 'what about JWT?' });

test('review: prefix',
  kr.detectMagicKeywords('review: check the auth module'),
  { primary: 'review', modifiers: [], remainder: 'check the auth module' });

test('@architect handle',
  kr.detectMagicKeywords('@architect trace the data flow'),
  { primary: 'review', modifiers: [], remainder: 'trace the data flow' });

test('implement: prefix',
  kr.detectMagicKeywords('implement: add validation'),
  { primary: 'implement', modifiers: [], remainder: 'add validation' });

test('build: prefix',
  kr.detectMagicKeywords('build: create API endpoint'),
  { primary: 'implement', modifiers: [], remainder: 'create API endpoint' });

test('@executor handle',
  kr.detectMagicKeywords('@executor fix the bug'),
  { primary: 'implement', modifiers: [], remainder: 'fix the bug' });

test('quickfix: prefix',
  kr.detectMagicKeywords('quickfix: null check'),
  { primary: 'quickfix', modifiers: [], remainder: 'null check' });

test('qf: prefix',
  kr.detectMagicKeywords('qf: typo in header'),
  { primary: 'quickfix', modifiers: [], remainder: 'typo in header' });

test('plan: prefix',
  kr.detectMagicKeywords('plan: notification system'),
  { primary: 'plan', modifiers: [], remainder: 'notification system' });

test('design: prefix',
  kr.detectMagicKeywords('design: database schema'),
  { primary: 'plan', modifiers: [], remainder: 'database schema' });

test('eco: modifier defaults to implement',
  kr.detectMagicKeywords('eco: add console.log'),
  { primary: 'implement', modifiers: ['eco'], remainder: 'add console.log' });

test('eco: + research: compound',
  kr.detectMagicKeywords('eco: research: find best practices'),
  { primary: 'research', modifiers: ['eco'], remainder: 'find best practices' });

test('no keyword match returns null',
  kr.detectMagicKeywords('find and fix the bug'),
  null);

test('UPPERCASE keyword (case-insensitive)',
  kr.detectMagicKeywords('RESEARCH: uppercase test'),
  { primary: 'research', modifiers: [], remainder: 'uppercase test' });

test('empty string returns null',
  kr.detectMagicKeywords(''),
  null);

test('undefined returns null',
  kr.detectMagicKeywords(undefined),
  null);

// --- Section 2: detectRalphKeywords (Task 11.3-11.4) ---
console.log('\n=== detectRalphKeywords ===\n');

test('ralph: keyword', kr.detectRalphKeywords('ralph: fix all errors'), true);
test('persistent: keyword', kr.detectRalphKeywords('persistent: keep going'), true);
test('@ralph handle', kr.detectRalphKeywords("@ralph don't give up"), true);
test('keep trying phrase', kr.detectRalphKeywords('keep trying on this'), true);
test("don't give up phrase", kr.detectRalphKeywords("don't give up"), true);
test('no ralph keyword', kr.detectRalphKeywords('fix the bug'), false);
test('empty string', kr.detectRalphKeywords(''), false);

// --- Section 3: False-positive elimination (Task 13.0) ---
console.log('\n=== False-positive elimination ===\n');

const falsePositiveTests = [
  'find and fix the null pointer in auth.js',
  'search the codebase for unused imports and remove them',
  'look up the function signature and add types',
  'debug the failing test and fix it',
  'design a new button component and implement it',
  'plan the refactoring and execute it',
  'analyze the error and apply the fix',
  'investigate the crash and patch it',
  'review this PR and merge it',
  'trace the bug, find the root cause, and fix it'
];

for (const prompt of falsePositiveTests) {
  const result = kr.detectMagicKeywords(prompt);
  // All should return null (no keyword match) — defaults to implement at call site
  test(`"${prompt}" → null (implement default)`, result, null);
}

// --- Summary ---
console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed > 0) {
  console.log('\n❌ SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED');
  process.exit(0);
}
