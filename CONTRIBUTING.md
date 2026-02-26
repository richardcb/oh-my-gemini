# Contributing to oh-my-gemini

Thanks for your interest in contributing! This project welcomes contributions.

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
gemini extensions install .
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
├── .gemini/agents/          # Agent definitions (SubAgent .md format)
├── skills/                  # Skill definitions (SKILL.md)
├── hooks/                   # Pre/post tool hooks
│   ├── hooks.json           # Hook definitions for Gemini CLI (REQUIRED)
│   └── *.js                 # Hook script implementations
├── conductor/templates/     # Conductor workflow templates
├── mcp/                     # MCP server configurations
├── templates/               # Project templates (GEMINI.md)
├── docs/                    # Documentation
└── examples/                # Real-world configuration examples
```

## Making Changes

### Commands
Commands live in `commands/omg/*.toml`. Each file defines a slash command.

**Format:**
```toml
[command]
description = "What this command does"

[command.prompt]
text = """
Your prompt here. Can include:
- Shell injection: !{command}
- File injection: @{path/to/file}
"""
```

### Agents
Agent definitions live in `.gemini/agents/*.md` using Gemini CLI's SubAgent format (Markdown with YAML frontmatter).

**YAML frontmatter fields:**
- `name` - Agent identifier
- `description` - When to use this agent
- `model` - Model to use (e.g., `gemini-2.5-pro`)
- `tools` - List of allowed tools
- Optional: `temperature`, `max_turns`, `timeout_mins`

The markdown body becomes the agent's system prompt.

### Skills
Skills live in `skills/*/SKILL.md`. Follow the standard format:

```markdown
---
name: skill-name
description: |
  What this skill does and when to use it.
---

# Skill Name

## Goal
What this skill accomplishes.

## Process
Step-by-step instructions.

## Output Format
Expected output structure.
```

### Hooks
Hooks live in `hooks/`. They're JavaScript files that run before/after tools.

## Testing

### Manual Testing
1. Install your local changes
2. Run commands in a test project
3. Verify expected behavior

### Things to Check
- [ ] Commands parse correctly
- [ ] Skills activate when expected
- [ ] Hooks run without errors
- [ ] Output matches documentation

## Pull Request Guidelines

1. **One feature per PR** - Keep PRs focused
2. **Update documentation** - If you change behavior, update docs
3. **Test locally** - Verify your changes work
4. **Conventional commits** - Use `feat:`, `fix:`, `docs:`, etc.

## Code Style

### TOML Files
- Use descriptive names
- Include comments for complex sections
- Keep prompts readable with proper indentation

### Markdown Files
- Use consistent heading levels
- Include code examples
- Keep lines under 100 characters

### JavaScript Hooks
- Use JSDoc comments
- Handle errors gracefully
- Log with `[omg-hook]` prefix

## Reporting Issues

When filing an issue, include:
1. Gemini CLI version (`gemini --version`)
2. oh-my-gemini version
3. Steps to reproduce
4. Expected vs actual behavior
5. Relevant error messages

## Questions?

Open an issue or reach out to the maintainers.

---

**Thank you for contributing to oh-my-gemini!**
