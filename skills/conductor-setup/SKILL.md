---
name: conductor-setup
description: |
  Initialize Conductor workflow in a project. Bundles all necessary templates
  for product context, tech stack, workflow, and tracks.
  v1.0: Hooks handle phase enforcement - setup focuses on file creation.
---

# Conductor Setup Skill

## Goal

Initialize a complete Conductor workflow in the user's project with all necessary configuration files.

## Activation Triggers

- User runs `/omg:setup` or `/omg:conductor-setup`
- User asks to "set up Conductor", "initialize workflow", or "enable planning"
- Project has no `conductor/` directory and user wants structured development

## Hook Integration

Conductor phase enforcement is now handled by the `phase-gate` hook:
- **Advisory mode (default):** Shows message at phase boundaries
- **Strict mode:** Blocks progression until user confirms

Setup now focuses on creating files; enforcement is automatic via hooks.

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
```

Ask user to confirm/correct detected stack.

### 5. Configure Hook Behavior (Optional)

Ask if they want to customize phase gate behavior:

```
Phase gates control how strictly Conductor enforces workflow phases.

**Advisory mode (default):**
- Shows a message when you complete a phase
- Suggests verification but allows continuation

**Strict mode:**
- Requires explicit confirmation before proceeding
- Better for complex projects or teams

Which mode? [A]dvisory (default) / [S]trict
```

If strict mode selected, create `.gemini/omg-config.json`:
```json
{
  "phaseGates": {
    "strict": true
  }
}
```

### 6. Write Configuration Files

Create files in `conductor/`:

1. **product.md** - Customize with user's answers
2. **tech-stack.md** - Customize with detected/confirmed stack
3. **workflow.md** - Use template (with hook-enforced workflow)
4. **tracks.md** - Initialize empty
5. **code_styleguides/general.md** - Use as-is

### 7. Verify Setup

```bash
ls -la conductor/
cat conductor/tracks.md
```

### 8. Report Success

```
✅ Conductor initialized!

Created:
- conductor/product.md
- conductor/tech-stack.md
- conductor/workflow.md
- conductor/tracks.md
- conductor/code_styleguides/general.md
- conductor/tracks/ (directory)

Hooks Active:
- phase-gate: [Advisory/Strict] mode
- after-tool: Auto-verification enabled

Next steps:
1. Review and refine the generated files
2. Run /omg:track "your first feature" to start planning
3. Run /omg:status to see your project state
```

## Hook Integration

The following hooks support Conductor workflows:

| Hook | Conductor Support |
|------|-------------------|
| `session-start` | Loads active track state on startup |
| `before-agent` | Injects current task context |
| `phase-gate` | Enforces phase boundaries (advisory/strict) |
| `after-tool` | Auto-verifies code changes |

## Customization Questions

### Workflow Preferences
- "Phase gate mode: [A]dvisory / [S]trict?"
- "Enable auto-verification? [Y/n]"
- "Create git checkpoints before changes? [Y/n]"

### Product Guidelines (Optional)
- "Do you have design/product guidelines to add? [Y/n]"
- If yes, create `conductor/product-guidelines.md`

### Code Style (Optional)  
- "Do you have language-specific style guides? [Y/n]"
- If yes, help create additional files in `conductor/code_styleguides/`
