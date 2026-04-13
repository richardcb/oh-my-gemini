---
name: security-audit
description: |
  Perform a structured security audit using the STRIDE framework. 
  Identifies vulnerabilities in code changes and provides remediation steps.
---

# Security Audit Skill (STRIDE)

## Goal
To systematically identify and document security vulnerabilities in a feature or codebase using the STRIDE threat modeling framework.

## Process

### 1. Intelligence Gathering
- Read the PRD to understand data flow and trust boundaries.
- Inspect the diff to see what logic is being added or changed.
- Identify all points where external data enters the system (Inputs).

### 2. STRIDE Analysis
Evaluate the change against the six STRIDE categories:
- **Spoofing**: Verify authentication logic.
- **Tampering**: Check for lack of integrity checks or unprotected data.
- **Repudiation**: Ensure critical actions are logged.
- **Information Disclosure**: Check for PII in logs, hardcoded secrets, or verbose errors.
- **Denial of Service**: Look for unoptimized loops, large allocations, or missing timeouts.
- **Elevation of Privilege**: Check authorization checks on sensitive endpoints.

### 3. Vulnerability Documentation
For each finding, record:
- Name and severity.
- Root cause.
- Potential impact.
- Clear remediation instructions.

## Output Format
A structured **Security Audit Report** following the template provided in the @cso agent definition.
