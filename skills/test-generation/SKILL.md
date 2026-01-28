---
name: test-generation
description: |
  Generate comprehensive tests for code including unit tests, integration tests,
  and edge case coverage. Analyzes code to identify testable units and generates
  tests matching the project's testing framework and conventions.
---

# Test Generation Skill

## Goal

Generate comprehensive, maintainable tests that provide confidence in code correctness. Tests should cover happy paths, edge cases, and error conditions.

## Activation Triggers

- User asks to "write tests", "add tests", or "test this"
- After implementing new features
- When code coverage is mentioned
- Part of code review process

## Process

### 1. Detect Testing Environment

```bash
# Check for test frameworks
cat package.json 2>/dev/null | grep -E "(jest|vitest|mocha|pytest|go test)" || echo "NO_TEST_FRAMEWORK"

# Find existing tests
find . -name "*.test.*" -o -name "*.spec.*" -o -name "*_test.*" 2>/dev/null | head -10

# Check test configuration
ls jest.config.* vitest.config.* pytest.ini 2>/dev/null || echo "NO_TEST_CONFIG"
```

### 2. Analyze Existing Test Patterns

```bash
# Look at existing test structure
cat $(find . -name "*.test.ts" | head -1) 2>/dev/null | head -50
```

Key patterns to match:
- Import style (ES modules vs CommonJS)
- Test organization (describe/it vs test)
- Assertion library (expect, assert, chai)
- Mock patterns (jest.mock, vi.mock)
- Setup/teardown patterns

### 3. Analyze Code to Test

For the target file, identify:

#### Functions/Methods
- Input parameters and types
- Return values and types
- Side effects
- Error conditions

#### Classes
- Constructor parameters
- Public methods
- State management
- Dependencies to mock

#### Components (React/Vue/etc)
- Props and their types
- User interactions
- Rendered output
- State changes

### 4. Generate Test Cases

#### Test Categories

**Happy Path Tests**
- Normal expected inputs
- Successful operations
- Expected outputs

**Edge Cases**
- Empty inputs (null, undefined, [], "")
- Boundary values (0, -1, MAX_INT)
- Single element collections
- Maximum size inputs

**Error Cases**
- Invalid inputs
- Network failures
- Timeout conditions
- Permission errors

**Integration Points**
- Database operations
- API calls
- File system access
- External services

### 5. Write Tests

#### Test Structure Template

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// or: import { jest } from '@jest/globals';

import { functionToTest } from './module';

describe('functionToTest', () => {
  // Setup
  beforeEach(() => {
    // Reset state, setup mocks
  });

  afterEach(() => {
    // Cleanup
  });

  describe('happy path', () => {
    it('should return expected result for valid input', () => {
      const result = functionToTest(validInput);
      expect(result).toEqual(expectedOutput);
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const result = functionToTest('');
      expect(result).toEqual(emptyResult);
    });

    it('should handle null input', () => {
      expect(() => functionToTest(null)).toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw on invalid input', () => {
      expect(() => functionToTest(invalidInput)).toThrow(ExpectedError);
    });
  });
});
```

#### Mock Patterns

```typescript
// Mock module
vi.mock('./dependency', () => ({
  dependencyFunction: vi.fn().mockReturnValue('mocked'),
}));

// Mock API calls
vi.spyOn(global, 'fetch').mockResolvedValue({
  ok: true,
  json: async () => ({ data: 'mocked' }),
});

// Mock timers
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();
```

### 6. Verify Tests

```bash
# Run the new tests
npm test -- --testPathPattern="[filename]" 2>&1 | tail -30

# Check coverage
npm test -- --coverage --testPathPattern="[filename]" 2>&1 | tail -20
```

## Test Quality Checklist

- [ ] Tests are independent (no shared state)
- [ ] Tests are deterministic (same result every run)
- [ ] Tests are fast (mock slow operations)
- [ ] Tests are readable (clear names, AAA pattern)
- [ ] Tests cover edge cases
- [ ] Tests document expected behavior
- [ ] Mocks are minimal and focused

## Output Format

```
📋 Test Generation: [module-name]

### Analysis
- Functions found: 5
- Classes found: 1
- Existing tests: 2 files
- Framework: Vitest

### Generated Tests

**File:** `src/utils/helpers.test.ts`

```typescript
[generated test code]
```

### Coverage Targets
- Statements: 80%+
- Branches: 75%+
- Functions: 90%+
- Lines: 80%+

### Run Tests
```bash
npm test -- src/utils/helpers.test.ts
```
```

## Framework-Specific Patterns

### Jest/Vitest (JavaScript/TypeScript)
- Use `describe`/`it` blocks
- Use `expect` assertions
- Use `vi.mock`/`jest.mock` for mocking

### Pytest (Python)
- Use `test_` prefix for functions
- Use `@pytest.fixture` for setup
- Use `pytest.raises` for exceptions

### Go
- Use `func TestXxx(t *testing.T)`
- Use `t.Run` for subtests
- Use table-driven tests

## Persistence Integration

If persistence skill is active, keep generating and fixing tests until:
- All tests pass
- Coverage targets are met
- No flaky tests detected
