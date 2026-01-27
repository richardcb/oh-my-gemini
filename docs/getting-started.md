# Getting Started with oh-my-gemini

## Prerequisites

1. **Gemini CLI** installed and configured
   ```bash
   npm install -g @google/gemini-cli
   gemini --version
   ```

2. **API Access** - Either:
   - Google AI API key, or
   - Vertex AI credentials configured

## Installation

```bash
gemini extensions install https://github.com/richardcb/oh-my-gemini
```

## Enable Experimental Features

oh-my-gemini uses experimental Gemini CLI features. Add to your `~/.gemini/settings.json`:

```json
{
  "experimental": {
    "enableAgents": true,
    "skills": true
  }
}
```

## First Run

### Option A: Quick Start (Autopilot)

Just start using it:
```
/omg:autopilot build a REST API for a todo list
```

### Option B: Full Setup (Recommended)

1. Navigate to your project directory
2. Run setup:
   ```
   /omg:setup
   ```
3. Follow the prompts to configure:
   - Conductor mode (recommended)
   - MCP servers (GitHub, Exa, Context7)
   - Project context

## Core Commands

| Command | Description |
|---------|-------------|
| `/omg:setup` | Initialize oh-my-gemini |
| `/omg:autopilot` | Autonomous task execution |
| `/omg:status` | Show current state |
| `/omg:conductor-setup` | Initialize Conductor workflow |
| `/omg:track` | Start a new feature track |
| `/omg:implement` | Execute the current plan |

## Workflow Modes

### Autopilot Mode
Best for quick one-off tasks:
```
/omg:autopilot "add dark mode support"
```

### Conductor Mode
Best for complex features:
```
/omg:conductor-setup          # Once per project
/omg:track "new feature"      # Start planning
/omg:implement                # Execute the plan
```

## MCP Server Setup

### GitHub
1. Get a PAT from https://github.com/settings/tokens
2. Token needs `repo` scope
3. Configure during `/omg:setup`

### Exa
1. Sign up at https://exa.ai
2. Get API key from dashboard
3. Configure during `/omg:setup`

### Context7
1. Sign up at https://context7.com
2. Get API key
3. Configure during `/omg:setup`

## Next Steps

1. Read the [Conductor documentation](../conductor/README.md)
2. Explore the [examples](../examples/)
3. Check out the available [skills](../skills/)
