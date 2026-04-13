/**
 * oh-my-gemini Mode System Type Definitions
 *
 * Shared types for mode resolution, state persistence, and profile composition.
 * Imported by mode-state.ts and mode-config.ts; bundled inline by esbuild.
 */

// --- Primary Modes ---

export type PrimaryMode = "research" | "implement" | "review" | "quickfix" | "plan";

// --- Modifiers ---

export type Modifier = "eco";

// --- Mode State (persisted to .gemini/omg-state/{session}/mode.json) ---

export interface ModeState {
  primary: PrimaryMode;
  modifiers: Modifier[];
  resolvedAt: string;
  source: "keyword" | "default";
  
  // Research metrics for the Karpathy Loop (FR-7)
  baseline?: number | null;
  bestMetric?: number | null;
}

// --- Context Injection Profile ---

export interface ContextInjectionProfile {
  gitHistory: boolean | "keyword-triggered";
  conductorState: boolean | "summary";
  recentChanges: boolean;
}

// --- Auto Verification Profile ---

export interface AutoVerificationProfile {
  enabled: boolean;
  typecheck?: boolean;
  lint?: boolean;
}

// --- Mode Profile (defines behavior for a primary mode) ---

export interface ModeProfile {
  tools: string[] | "*" | null;
  mcpPassthrough?: boolean;
  suggestedSkills: string[];
  contextInjection: ContextInjectionProfile;
  autoVerification: AutoVerificationProfile;
  phaseGates: { enabled: boolean };
  note?: string;
}

// --- Modifier Profile (partial overrides applied on top of a primary mode) ---

export interface ModifierProfile {
  type: "modifier";
  overrides: Partial<Omit<ModeProfile, "tools" | "mcpPassthrough">>;
}

// --- Mode Config Map (maps mode names to profiles) ---

export type ModeConfigMap = Record<string, ModeProfile | ModifierProfile>;

// --- Default Mode State ---

export const DEFAULT_MODE_STATE: ModeState = {
  primary: "implement",
  modifiers: [],
  resolvedAt: "",
  source: "default",
};
