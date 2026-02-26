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
| `/omg:plan` | Activate plan mode with OMG context |
| `/omg:autopilot` | Autonomous task execution |
| `/omg:review` | Trigger structured code review |
| `/omg:status` | Show current state |
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
/omg:setup                    # Once per project (includes Conductor option)
/omg:track "new feature"      # Start planning
/omg:implement                # Execute the plan
```

## MCP Server Setup

### GitHub
1. Get a PAT from https://github.com/settings/tokens
2. Token needs `repo` scope
3. Configure during `/omg:setup`

### Exa
1. Works out of the box (free tier, rate limited)
2. For higher limits: sign up at https://exa.ai and get an API key
3. Update `mcp/servers.json` httpUrl to include your key

### Context7
1. Sign up at https://context7.com
2. Get API key
3. Configure during `/omg:setup`

## Next Steps

1. Read the [Conductor documentation](../conductor/README.md)
2. Explore the [examples](../examples/)
3. Check out the available [skills](../skills/)
