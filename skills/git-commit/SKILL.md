---
name: git-commit
description: |
  Generate intelligent, conventional commit messages based on staged changes.
  Analyzes diffs, categorizes changes, and creates meaningful commit messages.
  Use when ready to commit changes and want high-quality commit history.
---

# Git Commit Skill

## Goal

Generate meaningful, conventional commit messages by analyzing staged changes. Creates commits that tell a story and make git history useful.

## Activation Triggers

- User says "commit", "git commit", or "save changes"
- User asks for a commit message
- After completing implementation tasks

## Process

### 1. Check Git Status

```bash
# Check if in a git repo
git rev-parse --git-dir 2>/dev/null || echo "NOT_A_GIT_REPO"

# Check staged changes
git diff --cached --stat

# Check unstaged changes
git status --short
```

### 2. Analyze Staged Changes

```bash
# Get detailed diff of staged changes
git diff --cached

# Get list of files changed
git diff --cached --name-only

# Get change statistics
git diff --cached --shortstat
```

### 3. Categorize Changes

Determine the commit type based on changes:

| Type | Description | Examples |
|------|-------------|----------|
| `feat` | New feature | New endpoint, new component, new capability |
| `fix` | Bug fix | Error handling, logic correction |
| `docs` | Documentation | README, comments, JSDoc |
| `style` | Formatting | Whitespace, semicolons, no logic change |
| `refactor` | Code restructuring | Rename, extract function, no behavior change |
| `perf` | Performance | Optimization, caching |
| `test` | Tests | New tests, test fixes |
| `chore` | Maintenance | Dependencies, build config |
| `ci` | CI/CD | GitHub Actions, deployment |

### 4. Identify Scope

Look at changed files to determine scope:
- Single component: Use component name as scope
- Multiple related files: Use feature/module name
- Many unrelated files: Consider splitting commit

### 5. Generate Commit Message

#### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Subject Rules
- Max 50 characters
- Imperative mood ("add" not "added")
- No period at end
- Lowercase

#### Body Rules
- Wrap at 72 characters
- Explain what and why, not how
- Separate from subject with blank line

#### Footer Rules
- Reference issues: `Closes #123`
- Breaking changes: `BREAKING CHANGE: description`

### 6. Execute Commit

```bash
# Commit with generated message
git commit -m "<type>(<scope>): <subject>" -m "<body>"

# Or if user wants to edit
git commit -e -m "<generated message>"
```

## Examples

### Simple Feature
```bash
# Staged: src/components/Button.tsx (new file)
git commit -m "feat(button): add reusable Button component"
```

### Bug Fix with Context
```bash
# Staged: src/api/auth.ts (modified)
git commit -m "fix(auth): handle expired refresh tokens

Previously, expired refresh tokens caused a 500 error.
Now properly returns 401 and clears the session.

Closes #456"
```

### Multiple Files, Same Feature
```bash
# Staged: src/api/users.ts, src/types/user.ts, tests/users.test.ts
git commit -m "feat(users): add user profile endpoint

- Add GET /api/users/:id endpoint
- Add User type definitions
- Add integration tests

Closes #789"
```

### Breaking Change
```bash
git commit -m "refactor(api)!: change response format to JSON:API

BREAKING CHANGE: All API responses now follow JSON:API spec.
Clients must update to handle the new response structure.

Migration guide: docs/migration-v2.md"
```

## Interactive Mode

If changes are complex, ask user:

```
I see changes to multiple areas:
- 3 files in src/components/ (UI changes)
- 2 files in src/api/ (backend changes)
- 1 file in tests/ (test updates)

Would you like to:
1. Create a single commit for all changes
2. Split into multiple focused commits
3. Let me suggest a commit message and you review

[1/2/3]?
```

## Verification

After committing:
```bash
# Show the commit
git log -1 --pretty=format:"%h %s%n%n%b"

# Verify it's pushed (if applicable)
git status
```

## Best Practices Enforced

1. **Atomic commits**: One logical change per commit
2. **Meaningful messages**: Explain why, not just what
3. **Conventional format**: Enables automated changelogs
4. **Issue linking**: Connect commits to tickets
5. **No WIP commits**: Clean, squashable history

## Output Format

```
📝 Commit Message Generated

Type: feat
Scope: authentication
Subject: add OAuth2 login flow

Body:
Implement OAuth2 authorization code flow with PKCE.
Supports Google and GitHub providers.

Footer:
Closes #123

---

Execute commit? [Y/n/edit]
```
