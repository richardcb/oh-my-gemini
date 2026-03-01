---
name: research-methodology
description: |
  Structured research methodology for finding documentation, investigating APIs,
  and synthesizing technical information. Guides systematic research with source
  verification and organized output.
  Activate for: research, documentation lookup, investigate, explore concepts.
---

# Research Methodology Skill

## Goal

Guide systematic research with structured output. Find, verify, and synthesize technical information into actionable research briefs.

## Activation Triggers

This skill should be activated when:
- User includes `research:` or `@researcher` in their prompt
- Task requires finding external documentation or best practices
- User needs to investigate APIs, libraries, or technical concepts
- Comparative analysis of approaches is needed

## When NOT to Use

- User wants code written (use implementation instead)
- Simple questions answerable from local codebase
- Bug fixes or debugging (use debug-assistant)

## Research Process

### 1. Understand the Need

Clarify what specific information is being sought:
- API documentation?
- Implementation examples?
- Best practices or patterns?
- Troubleshooting guidance?
- Competitive/alternative analysis?

### 2. Search Strategically

Prioritize sources by reliability:
1. Official documentation
2. Code examples from reputable repositories
3. Technical blogs from known experts
4. Community discussions (StackOverflow, GitHub Issues)
5. General web results (verify carefully)

### 3. Verify Quality

For every finding:
- Check the publication date (recent is usually better for tech)
- Cross-reference with at least one other source
- Prefer sources with code examples over theory-only
- Note any version-specific caveats

### 4. Synthesize Clearly

Don't dump raw search results. Organize findings into:
- Key concepts explained simply
- Relevant code snippets (tested if possible)
- Gotchas and common mistakes
- Links for deeper reading

## Output Format: Research Brief

```markdown
## Research Brief: [Topic]

### Summary
[2-3 sentence overview of findings]

### Key Findings

#### 1. [Finding Title]
[Explanation with context]

**Code Example:**
```[language]
[relevant code]
```

#### 2. [Finding Title]
[Explanation]

### Gotchas & Common Mistakes
- [Mistake 1]: [How to avoid]
- [Mistake 2]: [How to avoid]

### Recommendations
Based on research, the recommended approach is:
[Specific recommendation with rationale]

### Sources
- [URL 1]: [What it provided]
- [URL 2]: [What it provided]

### Open Questions
- [Questions that need further research or user input]
```

## Guidelines

- **Be thorough but focused**: Answer the question, don't go on tangents
- **Cite your sources**: Always link to where you found information
- **Admit uncertainty**: If you can't find reliable info, say so
- **Think about the next step**: What will be needed for design or implementation?
- **Prefer examples**: Concrete examples are more useful than abstract explanations
