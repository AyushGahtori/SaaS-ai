/**
 * Shared TypeScript types for the Persona / Memory system.
 *
 * These types describe the Firestore documents under:
 *   users/{uid}/memories/{memoryId}
 *   users/{uid}/persona/main
 *   users/{uid}/memorySettings/main
 */

// ---------------------------------------------------------------------------
// Memory Item
// ---------------------------------------------------------------------------

export type MemoryType =
    | "identity"
    | "role"
    | "goal"
    | "preference"
    | "context"
    | "skill"
    | "project"
    | "education";

export type MemoryScope = "stable" | "temporary";

export type MemoryStatus = "active" | "superseded" | "expired" | "deleted";

export type MemorySource = "survey" | "chat" | "system";

/** A single memory fact about the user. */
export interface MemoryItem {
    /** Firestore document ID (auto-generated). */
    id?: string;
    /** Predefined memory type. */
    type: MemoryType;
    /** Canonical field name, e.g. "role", "answer_style". */
    key: string;
    /** Extracted fact value. May be undefined for skipped survey fields. */
    value: string | undefined;
    /** Whether this memory expires (temporary) or is permanent (stable). */
    scope: MemoryScope;
    /** Confidence score 0–1. Survey = 1.0, LLM extraction varies. */
    confidence: number;
    /** Where this memory came from. */
    source: MemorySource;
    /** Lifecycle status. Only "active" memories are used in prompts. */
    status: MemoryStatus;
    /** ISO timestamp. */
    createdAt: string;
    /** ISO timestamp. */
    updatedAt: string;
    /** ISO timestamp. Only set for temporary memories (30 days from creation). */
    expiresAt: string | null;
    /** The chat document ID this was extracted from (if source=chat). */
    sourceChatId: string | null;
    /** The message document ID this was extracted from (if source=chat). */
    sourceMessageId: string | null;
}

// ---------------------------------------------------------------------------
// Persona Summary
// ---------------------------------------------------------------------------

/** The compiled persona document stored at users/{uid}/persona/main. */
export interface PersonaSummary {
    /** Short natural-language summary for injection into prompts. */
    summary: string;
    /** ISO timestamp of last rebuild. */
    updatedAt: string;
    /** Memory IDs that contributed to this summary. */
    topFacts: string[];
    /** Monotonically increasing version number. */
    version: number;
    /** Memory IDs used to generate this summary. */
    generatedFrom: string[];
    /** Denormalized for fast access without fetching memories. */
    role?: string;
    current_focus?: string;
    answer_style?: string;
}

// ---------------------------------------------------------------------------
// Memory Settings
// ---------------------------------------------------------------------------

/** Per-user memory configuration stored at users/{uid}/memorySettings/main. */
export interface MemorySettings {
    maxTotalMemories: number;
    tempMemoryTTLDays: number;
    requireConfirmation: boolean;
}

// ---------------------------------------------------------------------------
// Extraction types
// ---------------------------------------------------------------------------

/** A single extracted fact from a user message. */
export interface ExtractedMemory {
    key: string;
    value: string;
    confidence: number;
    /** The type to assign when saving. */
    type: MemoryType;
    /** The scope to assign when saving. */
    scope: MemoryScope;
}

// ---------------------------------------------------------------------------
// Canonical key → type/scope mapping
// ---------------------------------------------------------------------------

export const KEY_META: Record<string, { type: MemoryType; scope: MemoryScope }> = {
    name:               { type: "identity",   scope: "stable" },
    role:               { type: "role",       scope: "stable" },
    current_goal:       { type: "goal",       scope: "stable" },
    university_goal:    { type: "goal",       scope: "stable" },
    answer_style:       { type: "preference", scope: "stable" },
    communication_style:{ type: "preference", scope: "stable" },
    current_focus:      { type: "context",    scope: "temporary" },
    tech_stack:         { type: "skill",      scope: "stable" },
    current_project:    { type: "project",    scope: "temporary" },
    education_level:    { type: "education",  scope: "stable" },
};

/** Priority for cap eviction — lower = higher priority (kept longer). */
export const TYPE_PRIORITY: Record<MemoryType, number> = {
    role:       1,
    goal:       2,
    context:    3,
    preference: 4,
    skill:      5,
    project:    6,
    education:  7,
    identity:   8,
};

/** Per-type max active memory counts. */
export const TYPE_MAX_COUNT: Record<MemoryType, number> = {
    identity:   2,
    role:       1,
    goal:       3,
    preference: 3,
    context:    2,
    skill:      4,
    project:    2,
    education:  2,
};

export const GLOBAL_MAX_MEMORIES = 20;
export const TEMP_MEMORY_TTL_DAYS = 30;
