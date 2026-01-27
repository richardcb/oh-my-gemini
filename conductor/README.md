# Conductor Mode

oh-my-gemini includes an enhanced version of [Conductor](https://github.com/gemini-cli-extensions/conductor) for Context-Driven Development.

## Philosophy

**Measure twice, code once.**

Conductor ensures you think before you build. By creating specs and plans before implementation, you:
- Catch issues early when they're cheap to fix
- Give agents clear direction
- Track progress across complex features
- Build a shared understanding

## Quick Start

```bash
# Initialize Conductor in your project
/omg:conductor-setup

# Create a new feature track
/omg:track "Add user authentication"

# Implement the plan
/omg:implement

# Check progress
/omg:status
```

## Workflow

### 1. Setup (Once per project)
Run `/omg:conductor-setup` to create:
- `conductor/product.md` - What is this project?
- `conductor/tech-stack.md` - What technologies do we use?
- `conductor/workflow.md` - How do we work?
- `conductor/tracks.md` - Track listing

### 2. New Track (Per feature)
Run `/omg:track "feature description"` to:
- Create a new track directory
- Generate `spec.md` through clarifying questions
- Generate `plan.md` with phases and tasks
- Register the track in `tracks.md`

### 3. Implement
Run `/omg:implement` to:
- Pick up the next pending task
- Execute with the appropriate agent
- Update task status as you go
- Verify phase completion

### 4. Review & Document
After implementation:
- Review changes
- Generate documentation
- Commit with meaningful messages

## Directory Structure

```
your-project/
└── conductor/
    ├── product.md
    ├── tech-stack.md
    ├── workflow.md
    ├── tracks.md
    └── tracks/
        └── 001-user-auth/
            ├── spec.md
            ├── plan.md
            └── metadata.json
```

## Templates

The `templates/` directory contains:
- `workflow.md` - Default workflow with docs-first methodology
- `product.md` - Product context template
- `tech-stack.md` - Technology stack template
- `product-guidelines.md` - Design/UX guidelines template
- `track/` - Templates for new tracks (spec, plan, metadata)
- `code_styleguides/` - Code style guide templates

## Customization

### Workflow Preferences
Edit `conductor/workflow.md` to change:
- Commit strategy
- Testing requirements
- Phase structure

### Skipping Conductor
Conductor is optional. Use `/omg:autopilot` directly for quick tasks.
