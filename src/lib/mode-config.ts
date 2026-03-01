/**
 * oh-my-gemini Mode Configuration
 *
 * Default mode profiles and composition logic.
 * Each mode defines: tool access, skill suggestions, context injection depth,
 * verification intensity, and phase gate behavior.
 */

import type {
  PrimaryMode,
  Modifier,
  ModeProfile,
  ModifierProfile,
  ModeConfigMap,
} from "./mode-types";

// --- Debug helper ---

function debugLog(message: string): void {
  if (process.env.OMG_DEBUG === "1" || process.env.OMG_DEBUG === "true") {
    process.stderr.write(`[omg:debug] ${message}\n`);
  }
}

// --- Validation Constants ---

export const VALID_PRIMARY_MODES: readonly PrimaryMode[] = [
  "research",
  "implement",
  "review",
  "quickfix",
  "plan",
] as const;

export const VALID_MODIFIERS: readonly Modifier[] = ["eco"] as const;

// --- Meta-tools always allowed (appended to restricted tool lists) ---

const META_TOOLS = [
  "delegate_to_agent",
  "ask_user",
  "activate_skill",
  "save_memory",
  "write_todos",
  "get_internal_docs",
];

// --- Default Mode Profiles ---

export const DEFAULT_MODE_PROFILES: ModeConfigMap = {
  research: {
    tools: [
      "google_web_search",
      "web_fetch",
      "read_file",
      "read_many_files",
      "list_directory",
      "glob",
      "grep_search",
      "delegate_to_agent",
    ],
    mcpPassthrough: true,
    suggestedSkills: ["research-methodology"],
    contextInjection: {
      gitHistory: false,
      conductorState: "summary",
      recentChanges: false,
    },
    autoVerification: { enabled: false },
    phaseGates: { enabled: false },
  },

  implement: {
    tools: "*",
    suggestedSkills: [],
    contextInjection: {
      gitHistory: "keyword-triggered",
      conductorState: true,
      recentChanges: true,
    },
    autoVerification: { enabled: true, typecheck: true, lint: true },
    phaseGates: { enabled: true },
  },

  review: {
    tools: [
      "read_file",
      "read_many_files",
      "list_directory",
      "glob",
      "grep_search",
      "delegate_to_agent",
    ],
    suggestedSkills: ["code-review"],
    contextInjection: {
      gitHistory: true,
      conductorState: "summary",
      recentChanges: false,
    },
    autoVerification: { enabled: true, typecheck: false, lint: true },
    phaseGates: { enabled: false },
  },

  quickfix: {
    tools: "*",
    suggestedSkills: [],
    contextInjection: {
      gitHistory: "keyword-triggered",
      conductorState: false,
      recentChanges: false,
    },
    autoVerification: { enabled: true, typecheck: true, lint: false },
    phaseGates: { enabled: false },
  },

  plan: {
    tools: null,
    suggestedSkills: ["technical-planning"],
    contextInjection: {
      gitHistory: false,
      conductorState: true,
      recentChanges: false,
    },
    autoVerification: { enabled: false },
    phaseGates: { enabled: false },
    note: "tools: null means no hook-based filtering; native plan mode restrictions apply",
  },

  eco: {
    type: "modifier",
    overrides: {
      suggestedSkills: [],
      contextInjection: {
        gitHistory: false,
        conductorState: "summary",
        recentChanges: false,
      },
      autoVerification: { enabled: true, typecheck: true, lint: false },
    },
  } as ModifierProfile,
};

/**
 * Deep merge source into target. Source values win for overlapping keys.
 * Arrays are replaced, not concatenated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (
      sourceVal !== null &&
      sourceVal !== undefined &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === "object" &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal, sourceVal);
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }

  return result;
}

/**
 * Compose a mode profile from a primary mode and zero or more modifiers.
 *
 * @param primary - The primary mode name
 * @param modifiers - Array of modifier names to apply
 * @param configModes - Optional custom mode profiles (from user/project config)
 * @returns Fully-populated ModeProfile
 */
export function composeModeProfile(
  primary: PrimaryMode,
  modifiers: Modifier[],
  configModes?: ModeConfigMap,
): ModeProfile {
  const profiles = configModes || DEFAULT_MODE_PROFILES;

  // Load primary profile
  let profile: ModeProfile;
  const primaryConfig = profiles[primary];

  if (primaryConfig && !("type" in primaryConfig)) {
    profile = { ...primaryConfig };
  } else {
    // Fall back to defaults if config is missing or wrong type
    const defaultPrimary = DEFAULT_MODE_PROFILES[primary];
    if (defaultPrimary && !("type" in defaultPrimary)) {
      profile = { ...defaultPrimary };
    } else {
      debugLog(`composeModeProfile: unknown primary mode "${primary}", using implement`);
      profile = { ...(DEFAULT_MODE_PROFILES.implement as ModeProfile) };
    }
  }

  // Apply modifiers in order
  for (const mod of modifiers) {
    const modConfig = profiles[mod] || DEFAULT_MODE_PROFILES[mod];

    if (!modConfig || !("type" in modConfig) || modConfig.type !== "modifier") {
      debugLog(`composeModeProfile: skipping invalid modifier "${mod}"`);
      continue;
    }

    const modProfile = modConfig as ModifierProfile;
    profile = deepMerge(profile, modProfile.overrides);
  }

  return profile;
}

/**
 * Get the meta-tools array that should always be allowed.
 * Exported so tool-filter.js can append them.
 */
export function getMetaTools(): string[] {
  return [...META_TOOLS];
}
