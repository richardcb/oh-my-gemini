# Conductor Mode

oh-my-gemini includes Conductor for Context-Driven Development.

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

## Architecture Note

**Templates are bundled with skills, not stored here.**

The templates used by Conductor commands are located in:
- `skills/conductor-setup/templates/` - Setup templates (product, tech-stack, workflow, etc.)
- `skills/track-creation/templates/` - Track templates (spec, plan, metadata)

This ensures the agent can always access them when the skills are activated.

## What Gets Created

When you run `/omg:conductor-setup`, it creates in YOUR project:

```
your-project/
└── conductor/
    ├── product.md          # What is this project?
    ├── tech-stack.md       # Technologies used
    ├── workflow.md         # How we work
    ├── tracks.md           # Track listing
    ├── code_styleguides/
    │   └── general.md      # Code principles
    └── tracks/             # Track directories
        └── feature_name_YYYYMMDD/
            ├── spec.md
            ├── plan.md
            └── metadata.json
```

## Customization

All generated files are meant to be edited! Customize them to match your team's workflow.
