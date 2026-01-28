---
name: conductor-setup
description: |
  Initialize Conductor workflow in a project. Bundles all necessary templates
  for product context, tech stack, workflow, and tracks. Use when setting up
  Conductor for the first time via /omg:conductor-setup.
---

# Conductor Setup Skill

## Goal

Initialize a complete Conductor workflow in the user's project with all necessary configuration files.

## Bundled Resources

This skill includes all Conductor templates:
- `templates/product.md` - Product context template
- `templates/tech-stack.md` - Technology stack template
- `templates/workflow.md` - Development workflow template
- `templates/tracks.md` - Track listing template
- `templates/code_styleguides/general.md` - General code style guide

## Process

### 1. Check Existing Setup

```bash
ls -la conductor/ 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND"
```

If Conductor already exists, ask user if they want to:
- Skip (keep existing)
- Merge (add missing files)
- Replace (overwrite all)

### 2. Create Directory Structure

```bash
mkdir -p conductor/tracks
mkdir -p conductor/code_styleguides
```

### 3. Gather Product Context

Ask the user:
1. "What is this project? (one sentence)"
2. "Who are the main users?"
3. "What problem does it solve?"

### 4. Detect Tech Stack

Examine project files:
```bash
# Check for package.json (Node.js)
cat package.json 2>/dev/null | head -20

# Check for requirements.txt (Python)
cat requirements.txt 2>/dev/null | head -10

# Check for go.mod (Go)
cat go.mod 2>/dev/null | head -5

# Check for Cargo.toml (Rust)
cat Cargo.toml 2>/dev/null | head -10
```

Ask user to confirm/correct detected stack.

### 5. Write Configuration Files

Read each template from this skill's `templates/` directory and write to `conductor/`:

1. **product.md** - Customize with user's answers
2. **tech-stack.md** - Customize with detected/confirmed stack
3. **workflow.md** - Use as-is (or customize if user has preferences)
4. **tracks.md** - Initialize empty
5. **code_styleguides/general.md** - Use as-is

### 6. Verify Setup

```bash
ls -la conductor/
cat conductor/tracks.md
```

### 7. Report Success

```
✅ Conductor initialized!

Created:
- conductor/product.md
- conductor/tech-stack.md
- conductor/workflow.md
- conductor/tracks.md
- conductor/code_styleguides/general.md
- conductor/tracks/ (directory)

Next steps:
1. Review and refine the generated files
2. Run /omg:track "your first feature" to start planning
3. Run /omg:status to see your project state
```

## Customization Questions

### Workflow Preferences
- "Do you want to require PRDs before coding? [Y/n]"
- "Commit strategy: [P]hase completion / [T]ask completion / [M]anual?"
- "Test requirements: [R]equired / [R]ecommended / [N]one?"

### Product Guidelines (Optional)
- "Do you have design/product guidelines to add? [Y/n]"
- If yes, create `conductor/product-guidelines.md`

### Code Style (Optional)  
- "Do you have language-specific style guides? [Y/n]"
- If yes, help create additional files in `conductor/code_styleguides/`
