# Contributing to oh-my-gemini

Thanks for your interest in contributing! This project is currently in early development.

## Getting Started

### Prerequisites
- [Gemini CLI](https://geminicli.com) installed and configured
- Git
- Google AI API key or Vertex AI credentials

### Local Development

1. Clone the repo:
```bash
git clone https://github.com/richardcb/oh-my-gemini.git
cd oh-my-gemini
```

2. Install as a local extension:
```bash
gemini extensions install . --local
```

3. Test your changes:
```bash
# In any project directory
/omg:status
```

## Project Structure

```
oh-my-gemini/
├── gemini-extension.json    # Extension manifest
├── commands/omg/            # Slash commands (/omg:*)
├── agents/                  # Agent definitions (TOML)
├── skills/                  # Skill definitions (SKILL.md)
├── conductor/templates/     # Conductor workflow templates
├── mcp/                     # MCP server configurations
├── templates/               # Project templates (GEMINI.md)
└── examples/                # Real-world configuration examples
```

## Making Changes

### Commands
Commands live in `commands/omg/*.toml`. Each file defines a slash command.

### Agents
Agent definitions live in `agents/*.toml`. These require experimental agent support.

### Skills
Skills live in `skills/*/SKILL.md`. Follow the standard SKILL.md format with YAML frontmatter.

## Code of Conduct

Be kind. Be helpful. Assume good intent.

## Questions?

Open an issue or reach out to the maintainers.
