# oh-my-gemini Policies

This directory contains TOML policy files for the Gemini CLI Policy Engine.

## Files

### `omg-security.toml`

Static security rules that integrate with Gemini CLI's native Policy Engine:

- **Blocked Commands** - Dangerous shell commands (rm -rf, fork bombs, etc.)
- **Protected Paths** - Directories that should never be written to (node_modules, .git, etc.)
- **Safe Operations** - Auto-allowed read-only operations

## How It Works

The Policy Engine evaluates rules in priority order:

| Priority | Meaning |
|----------|---------|
| 900-999 | Critical blocks (cannot be overridden easily) |
| 700-899 | Standard security (admin can override) |
| 100-200 | Convenience allows (user can override) |

## Customizing

To override these policies in your project, create `.gemini/policies/my-rules.toml`:

```toml
# Allow a specific command blocked by oh-my-gemini
[[rule]]
toolName = "run_shell_command"
commandPrefix = "my-safe-command"
decision = "allow"
priority = 950  # Higher than oh-my-gemini's block
```

User policies (in `~/.gemini/policies/`) are Tier 2 and can override extension defaults.

## Hybrid Approach

oh-my-gemini uses **both** TOML policies and hooks:

| Type | File | Purpose |
|------|------|---------|
| TOML | `policies/omg-security.toml` | Static rules, native performance |
| Hook | `hooks/before-tool.js` | Dynamic logic (git checkpoints, context-aware) |

See [hooks/README.md](../hooks/README.md) for hook documentation.
