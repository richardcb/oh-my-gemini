/**
 * oh-my-gemini Keyword Registry
 *
 * Single source of truth for mode keyword detection.
 * Pure computation — no I/O, no state, no side effects.
 *
 * Exports:
 *   detectMagicKeywords(prompt) — resolve primary mode + modifiers from keywords
 *   detectRalphKeywords(prompt) — check if any Ralph keyword is present
 *   stripKeywordPrefix(prompt) — remove keyword prefixes from prompt
 */

// --- Types ---

export interface KeywordMatch {
  primary: string;
  modifiers: string[];
  remainder: string;
}

interface KeywordEntry {
  pattern: RegExp;
  type: "primary" | "modifier";
  mode: string;
}

// --- Keyword Maps (compiled once at module load) ---

const KEYWORD_ENTRIES: readonly KeywordEntry[] = [
  // Primary keywords — colon variants (word boundary + colon + space-or-end)
  { pattern: /\bresearch:(?:\s|$)/i, type: "primary", mode: "research" },
  { pattern: /\breview:(?:\s|$)/i, type: "primary", mode: "review" },
  { pattern: /\bimplement:(?:\s|$)/i, type: "primary", mode: "implement" },
  { pattern: /\bbuild:(?:\s|$)/i, type: "primary", mode: "implement" },
  { pattern: /\bquickfix:(?:\s|$)/i, type: "primary", mode: "quickfix" },
  { pattern: /\bqf:(?:\s|$)/i, type: "primary", mode: "quickfix" },
  { pattern: /\bplan:(?:\s|$)/i, type: "primary", mode: "plan" },
  { pattern: /\bdesign:(?:\s|$)/i, type: "primary", mode: "plan" },

  // Primary keywords — @-handle variants
  { pattern: /@researcher\b/i, type: "primary", mode: "research" },
  { pattern: /@architect\b/i, type: "primary", mode: "review" },
  { pattern: /@executor\b/i, type: "primary", mode: "implement" },

  // Modifier keywords
  { pattern: /\beco:(?:\s|$)/i, type: "modifier", mode: "eco" },
  { pattern: /\beco\s/i, type: "modifier", mode: "eco" },
] as const;

const RALPH_KEYWORDS: readonly { pattern: RegExp }[] = [
  { pattern: /\bralph:(?:\s|$)/i },
  { pattern: /\bpersistent:(?:\s|$)/i },
  { pattern: /@ralph\b/i },
  { pattern: /don't give up/i },
  { pattern: /keep trying/i },
] as const;

// --- Debug helper ---

function debugLog(message: string): void {
  if (process.env.OMG_DEBUG === "1" || process.env.OMG_DEBUG === "true") {
    process.stderr.write(`[omg:debug] ${message}\n`);
  }
}

// --- Public API ---

/**
 * Detect magic keywords in a prompt for mode resolution.
 * Position-independent: scans entire prompt, first primary wins by position,
 * all modifiers are collected regardless of position.
 *
 * @param prompt - User prompt string
 * @returns KeywordMatch with primary mode, modifiers, and cleaned remainder, or null if no keywords found
 */
export function detectMagicKeywords(prompt: string): KeywordMatch | null {
  if (!prompt || typeof prompt !== "string") {
    debugLog("detectMagicKeywords: empty or non-string input, returning null");
    return null;
  }

  const input = prompt.toLowerCase();
  let primary: string | null = null;
  let firstPrimaryIndex = Infinity;
  const modifiers: string[] = [];

  for (const entry of KEYWORD_ENTRIES) {
    const match = entry.pattern.exec(input);
    if (!match) continue;

    if (entry.type === "modifier") {
      if (!modifiers.includes(entry.mode)) {
        modifiers.push(entry.mode);
      }
    } else if (entry.type === "primary" && match.index < firstPrimaryIndex) {
      primary = entry.mode;
      firstPrimaryIndex = match.index;
    }
  }

  // Modifier without primary defaults to implement
  if (primary === null && modifiers.length > 0) {
    primary = "implement";
  }

  // No match at all
  if (primary === null && modifiers.length === 0) {
    debugLog("detectMagicKeywords: no keyword match");
    return null;
  }

  const remainder = stripKeywordPrefix(prompt);

  debugLog(
    `detectMagicKeywords: primary=${primary}, modifiers=[${modifiers.join(",")}], remainder="${remainder}"`,
  );

  return {
    primary: primary!,
    modifiers,
    remainder,
  };
}

/**
 * Detect Ralph keywords in a prompt for skill suggestion.
 * Separate from mode keywords — Ralph does not affect mode resolution.
 *
 * @param prompt - User prompt string
 * @returns true if any Ralph keyword is present
 */
export function detectRalphKeywords(prompt: string): boolean {
  if (!prompt || typeof prompt !== "string") {
    return false;
  }

  const input = prompt.toLowerCase();

  for (const entry of RALPH_KEYWORDS) {
    if (entry.pattern.test(input)) {
      debugLog(`detectRalphKeywords: matched Ralph keyword`);
      return true;
    }
  }

  return false;
}

/**
 * Strip keyword prefixes from the prompt so keywords don't pollute LLM context.
 * Removes all matched keyword patterns, collapses whitespace, trims.
 *
 * @param prompt - Original user prompt
 * @returns Cleaned prompt with keyword prefixes removed
 */
export function stripKeywordPrefix(prompt: string): string {
  if (!prompt || typeof prompt !== "string") {
    return "";
  }

  // Collect all matches with their positions and lengths
  const matches: { index: number; length: number }[] = [];
  const input = prompt.toLowerCase();

  for (const entry of KEYWORD_ENTRIES) {
    const match = entry.pattern.exec(input);
    if (match) {
      // For patterns ending with \s, include the trailing space in the match
      // For patterns ending with $, just use the match length
      matches.push({ index: match.index, length: match[0].length });
    }
  }

  if (matches.length === 0) {
    return prompt;
  }

  // Sort by index descending to splice from end first (preserve indices)
  matches.sort((a, b) => b.index - a.index);

  let result = prompt;
  for (const m of matches) {
    result = result.slice(0, m.index) + result.slice(m.index + m.length);
  }

  // Collapse multiple spaces and trim
  result = result.replace(/\s{2,}/g, " ").trim();

  return result;
}
