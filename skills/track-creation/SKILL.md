---
name: track-creation
description: |
  Create new Conductor tracks with spec, plan, and metadata files. Bundles all
  templates needed for track creation. Use when starting a new feature track
  via /omg:track or when manually creating tracks.
---

# Track Creation Skill

## Goal

Create complete Conductor tracks with properly structured spec, plan, and metadata files.

## Bundled Resources

This skill includes templates that the agent can read and use:
- `templates/spec.md` - Track specification template
- `templates/plan.md` - Implementation plan template  
- `templates/metadata.json` - Track metadata template

## Process

### 1. Generate Track ID

Create a unique track ID:
```bash
FEATURE_SNAKE=$(echo "{{FEATURE_NAME}}" | tr '[:upper:]' '[:lower:]' | tr ' ' '_' | tr -cd '[:alnum:]_')
DATE=$(date +%Y%m%d)
TRACK_ID="${FEATURE_SNAKE}_${DATE}"
echo $TRACK_ID
```

### 2. Create Track Directory

```bash
mkdir -p conductor/tracks/${TRACK_ID}
```

### 3. Read and Customize Templates

Read each template from this skill's directory, replace placeholders, and write to the track directory.

**Placeholders to replace:**
- `{{FEATURE_NAME}}` - User-provided feature name
- `{{TRACK_ID}}` - Generated track ID
- `{{DATE}}` - Current date (YYYY-MM-DD)
- `{{ISO_TIMESTAMP}}` - Current ISO timestamp

### 4. Gather Requirements

Before writing the spec, ask clarifying questions:
- What problem does this solve?
- Who is the primary user?
- What are the must-have requirements?
- What's explicitly out of scope?

### 5. Write Files

Create three files in `conductor/tracks/${TRACK_ID}/`:
1. `spec.md` - Filled with user's requirements
2. `plan.md` - Phased implementation tasks
3. `metadata.json` - Track state tracking

### 6. Update tracks.md

Add entry to `conductor/tracks.md`:
```markdown
## [ ] Track: {{FEATURE_NAME}}
*ID: {{TRACK_ID}}*
*Link: [./tracks/{{TRACK_ID}}/]*
*Status: New*
*Created: {{DATE}}*
```

### 7. Verify Creation

```bash
ls -la conductor/tracks/${TRACK_ID}/
cat conductor/tracks/${TRACK_ID}/metadata.json
```

## Output

Confirm to user:
```
✅ Track created: {{FEATURE_NAME}}

📁 Location: conductor/tracks/{{TRACK_ID}}/
📋 Spec: conductor/tracks/{{TRACK_ID}}/spec.md
📝 Plan: conductor/tracks/{{TRACK_ID}}/plan.md

Next steps:
1. Review the spec and plan
2. Run /omg:implement to start implementation
3. Run /omg:status to check progress
```
