# General Code Style Principles

This document outlines coding principles that apply across all languages and frameworks.

## Readability

- Code should be easy to read and understand by humans
- Avoid overly clever or obscure constructs
- Prefer explicit over implicit
- Use meaningful names that describe intent

## Consistency

- Follow existing patterns in the codebase
- Maintain consistent formatting, naming, and structure
- When in doubt, match what's already there
- Don't introduce new patterns without good reason

## Simplicity

- Prefer simple solutions over complex ones
- Break down complex problems into smaller, manageable parts
- Avoid premature optimization
- Don't over-engineer for hypothetical future needs

## Maintainability

- Write code that is easy to modify and extend
- Minimize dependencies and coupling
- Keep functions and files focused (single responsibility)
- Make the code testable

## Documentation

- Document *why* something is done, not just *what*
- Keep documentation up-to-date with code changes
- Use comments sparingly - prefer self-documenting code
- Document edge cases and non-obvious decisions

## Error Handling

- Handle errors explicitly, don't ignore them
- Provide meaningful error messages
- Fail fast and fail clearly
- Consider all failure modes

## Testing

- Write tests for new functionality
- Cover edge cases and error paths
- Keep tests readable and maintainable
- Tests are documentation too
