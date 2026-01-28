#!/bin/bash
# generate-prd.sh - Generate a new PRD file with proper naming convention
# Usage: ./generate-prd.sh "feature name"

set -e

FEATURE_NAME="$1"

if [ -z "$FEATURE_NAME" ]; then
    echo "Usage: ./generate-prd.sh \"feature name\""
    exit 1
fi

# Create features directory if it doesn't exist
mkdir -p features

# Generate snake_case filename from feature name
SNAKE_NAME=$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '_' | tr -cd '[:alnum:]_')

# Find next PRD number
NEXT_NUM=$(ls features/*_prd_*.md 2>/dev/null | wc -l)
NEXT_NUM=$((NEXT_NUM + 1))
PADDED_NUM=$(printf "%04d" $NEXT_NUM)

# Generate filename
FILENAME="features/${PADDED_NUM}_prd_${SNAKE_NAME}.md"

# Get current date
CURRENT_DATE=$(date +%Y-%m-%d)

# Get git user name or fall back to system user
AUTHOR=$(git config user.name 2>/dev/null || whoami)

# Create the PRD file
cat > "$FILENAME" << EOF
# PRD: ${FEATURE_NAME}

> **Status:** Draft
> **Author:** ${AUTHOR}
> **Created:** ${CURRENT_DATE}
> **Last Updated:** ${CURRENT_DATE}

## 1. Project Overview

[Describe the feature and its primary purpose]

## 2. Problem Statement

[What problem does this solve?]

## 3. Goals

- [ ] [Goal 1]
- [ ] [Goal 2]

## 4. Non-Goals (Out of Scope)

- [What this feature will NOT do]

## 5. User Stories

As a [user type], I want to [action] so that [benefit].

## 6. Functional Requirements

### Must Have (P0)
- [ ] [Requirement]

### Should Have (P1)
- [ ] [Requirement]

## 7. Business Invariants

- [Rule that must never be violated]

## 8. Failure States

| Scenario | Expected Behavior |
|----------|-------------------|
| [Error case] | [How to handle] |

## 9. Technical Considerations

- **Tech Stack:** [Relevant technologies]
- **Dependencies:** [Required integrations]

## 10. Open Questions

- [ ] [Question to resolve]
EOF

echo "Created: $FILENAME"
echo "PRD Number: $PADDED_NUM"
