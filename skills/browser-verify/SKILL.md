---
name: browser-verify
description: |
  Perform visual and runtime verification using a headless browser. 
  Checks for element visibility, layout integrity, and console errors.
---

# Browser Verify Skill

## Goal
To provide visual and runtime feedback for UI-related changes (CSS, JSX, HTML) to ensure the interface is not broken.

## Process

### 1. Dev Server Detection
- Verify if a local development server is running (e.g., checking `localhost:3000` or `localhost:5173`).
- If not running, attempt to start it using the project's start script.

### 2. Browser Execution
- Use a headless browser (Playwright or Puppeteer) to navigate to the target component or page.
- **Selector Check:** Verify that the modified elements exist in the DOM.
- **Visibility Check:** Ensure elements are not hidden by CSS (`display: none`) or overlapping incorrectly.

### 3. Console Audit
- Capture and report any `Error` or `Warning` messages from the browser console.
- Identify "Red Screens of Death" or hydration mismatches.

### 4. Visual Snapshot
- Take a screenshot of the viewport or specific component.
- (Future) Perform visual regression testing against a baseline.

## Output Format
```markdown
## 🌐 Browser Verification Report

### Status: [PASS / FAIL]

### Visual Check
- **Selector [X]**: [Visible / Hidden / Missing]
- **Layout**: [Stable / Broken / Overlapping]

### Console Logs
- ❌ Error: [Message]
- ⚠️ Warning: [Message]

### Decision
- **KEEP:** Changes are visually sound.
- **REVERT:** UI is broken or console errors detected.
```
