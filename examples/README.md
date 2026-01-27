# Examples

This directory contains real-world examples of oh-my-gemini configurations.

## scoring-app/

A complete Conductor setup for a web application built with:
- React + TypeScript frontend
- Hono + Drizzle backend
- PostgreSQL database
- Cloudflare deployment

### Files

- `workflow.md` - A docs-first workflow with strict phase gates
- `tech-stack.md` - Full-stack TypeScript configuration
- `product.md` - Product context for an innovation platform

### What This Demonstrates

1. **Strict linear workflow** - No code until PRD + Tech Plan exist
2. **Phase verification gates** - Manual checkpoints between phases
3. **AI guardrails** - Explicit mitigations for common AI mistakes
4. **Project standards** - Test coverage, documentation, commit strategy

## Using These Examples

These files are for reference only. To use them in your project:

1. Copy the relevant files to your `conductor/` directory
2. Modify to match your project's specifics
3. Remove any project-specific details that don't apply

Or better yet, run `/omg:conductor-setup` and let it guide you through creating your own configuration!
