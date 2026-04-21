/**
 * Memory Extractor — Layers 2 and 3
 *
 * Layer 2: Rule-based slot extraction (deterministic, fast, no LLM).
 *          Runs multiple extractors on the same message simultaneously.
 *          Returns an array of ExtractedMemory items if confident.
 *          Returns null if the message is too ambiguous.
 *
 * Layer 3: LLM-based extraction via Gemini API.
 *          Only called when Layer 2 returns null or empty.
 *          Uses a strict JSON prompt and discards low-confidence results.
 *
 * This module must only be run server-side (imports happen in API routes).
 */

import { GoogleGenAI } from "@google/genai";
import type { ExtractedMemory } from "@/lib/memory/types";
import { KEY_META } from "@/lib/memory/types";

const DEFAULT_MEMORY_EXTRACTION_MODEL =
    process.env.GEMINI_MODEL_FLASH_LITE ||
    process.env.GEMINI_MODEL_FLASH ||
    "gemini-2.5-flash-lite";

// ---------------------------------------------------------------------------
// Layer 2 — Rule-based slot extractors
// ---------------------------------------------------------------------------

type SlotExtractor = (message: string) => ExtractedMemory | null;

/** Extract user's name. */
const nameExtractor: SlotExtractor = (msg) => {
    const m = msg.match(/(?:my name is|i am|i'm)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i);
    if (!m) return null;
    const value = m[1].trim();
    // Avoid capturing role words as names
    const roleWords = ["a", "an", "the", "developer", "student", "designer", "manager", "founder"];
    if (roleWords.includes(value.toLowerCase())) return null;
    return { key: "name", value, confidence: 0.9, type: "identity", scope: "stable" };
};

/** Extract user's professional role. */
const roleExtractor: SlotExtractor = (msg) => {
    const roles = [
        "developer", "software developer", "software engineer", "engineer", "programmer", "coder",
        "designer", "ui designer", "ux designer", "product designer",
        "student", "undergraduate", "graduate student", "phd student",
        "product manager", "pm",
        "data scientist", "data analyst", "analyst",
        "founder", "startup founder", "cto", "ceo",
        "teacher", "educator", "instructor",
        "marketer", "marketing manager",
        "freelancer", "consultant",
        "researcher", "scientist",
    ];
    const rolesPattern = roles.map((r) => r.replace(/\//g, "\\/")).join("|");
    const m = msg.match(new RegExp(`(?:i am|i'm|i work as)\\s+(?:a |an )?(?:${rolesPattern})`, "i"));
    if (!m) return null;
    const full = m[0];
    const extracted = full.replace(/^(?:i am|i'm|i work as)\s+(?:a |an )?/i, "").trim();
    // Normalize common abbreviations
    const normalized = extracted === "pm" ? "product manager" : extracted.toLowerCase();
    return { key: "role", value: normalized, confidence: 0.95, type: "role", scope: "stable" };
};

/** Extract user's current goal. */
const goalExtractor: SlotExtractor = (msg) => {
    const m = msg.match(/(?:my goal is|my main goal is|i want to(?:\s+eventually)?|i am trying to|i'm trying to)\s+(.+?)(?:\.|,|$)/i);
    if (!m) return null;
    const value = m[1].trim();
    if (value.length < 3) return null;
    return { key: "current_goal", value, confidence: 0.85, type: "goal", scope: "stable" };
};

/** Extract user's answer style preference. */
const preferenceExtractor: SlotExtractor = (msg) => {
    const m = msg.match(/(?:i prefer|i like)\s+(.+?)(?:\.|,|$)/i);
    if (!m) return null;
    const raw = m[1].trim().toLowerCase();
    // Map to canonical values
    const styleMap: Record<string, string> = {
        "concise": "concise", "short": "concise", "brief": "concise",
        "detailed": "detailed", "detailed explanations": "detailed", "in-depth": "detailed",
        "step by step": "step-by-step", "step-by-step": "step-by-step",
        "code": "code-heavy", "code examples": "code-heavy",
    };
    const mapped = Object.keys(styleMap).find((k) => raw.includes(k));
    if (!mapped) return null;
    return { key: "answer_style", value: styleMap[mapped], confidence: 0.9, type: "preference", scope: "stable" };
};

/** Extract current project. */
const projectExtractor: SlotExtractor = (msg) => {
    const m = msg.match(/(?:i(?:'m| am) (?:working on|building|developing|creating))\s+(.+?)(?:\.|,|$)/i);
    if (!m) return null;
    const value = m[1].trim();
    if (value.length < 3) return null;
    const meta = KEY_META["current_project"];
    return { key: "current_project", value, confidence: 0.85, ...meta };
};

/** Extract tech stack. */
const techStackExtractor: SlotExtractor = (msg) => {
    const m = msg.match(/(?:i use|my stack is|my tech stack (?:is|includes?)|i(?:'m| am) using)\s+(.+?)(?:\.|,|$)/i);
    if (!m) return null;
    const value = m[1].trim();
    if (value.length < 2) return null;
    const meta = KEY_META["tech_stack"];
    return { key: "tech_stack", value, confidence: 0.85, ...meta };
};

/** Extract current focus/context. */
const focusExtractor: SlotExtractor = (msg) => {
    const m = msg.match(/(?:i(?:'m| am) preparing for|i(?:'m| am) focused on|my current focus is|i(?:'m| am) currently focused on)\s+(.+?)(?:\.|,|$)/i);
    if (!m) return null;
    const value = m[1].trim();
    if (value.length < 3) return null;
    const meta = KEY_META["current_focus"];
    return { key: "current_focus", value, confidence: 0.85, ...meta };
};

/** Extract education level. */
const educationExtractor: SlotExtractor = (msg) => {
    const m = msg.match(/(?:i(?:'m| am)? (?:a )?(?:studying|enrolled in|doing(?: a| my)?)|i study)\s+(.+?)(?:\.|,|$)/i);
    if (!m) return null;
    const value = m[1].trim();
    if (value.length < 2) return null;
    return { key: "education_level", value, confidence: 0.8, type: "education", scope: "stable" };
};

/** Extract university/graduate goal. */
const universityGoalExtractor: SlotExtractor = (msg) => {
    const m = msg.match(/(?:i want to (?:get into|study at|attend|go to))\s+(.+?)(?:\.|,|$)/i);
    if (!m) return null;
    const value = m[1].trim();
    if (value.length < 2) return null;
    return { key: "university_goal", value, confidence: 0.85, type: "goal", scope: "stable" };
};

const ALL_EXTRACTORS: SlotExtractor[] = [
    nameExtractor,
    roleExtractor,
    goalExtractor,
    preferenceExtractor,
    projectExtractor,
    techStackExtractor,
    focusExtractor,
    educationExtractor,
    universityGoalExtractor,
];

export function runLayer2(message: string): ExtractedMemory[] | null {
    const results: ExtractedMemory[] = [];

    for (const extractor of ALL_EXTRACTORS) {
        try {
            const result = extractor(message);
            if (result) results.push(result);
        } catch {
            // Individual extractor failure shouldn't stop the others
        }
    }

    if (results.length === 0) return null;
    console.log(`[MemoryLayer2] extracted ${results.length} items:`, results.map((r) => r.key).join(", "));
    return results;
}

// ---------------------------------------------------------------------------
// Layer 3 — LLM extraction (Gemini)
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = (message: string) => `You are a memory extraction system. Extract persona facts from the user message.

User message: "${message}"

Return ONLY a valid JSON array. No explanation. No markdown. No prose.

Extract from these schema keys only:
- role (developer, student, designer, product_manager, data_scientist, founder, teacher, etc.)
- current_goal (what the user wants to achieve long-term)
- answer_style (concise, detailed, step-by-step, code-heavy)
- tech_stack (technologies the user works with)
- current_project (project being built)
- current_focus (current learning/work context like "interview prep", "learning React")
- name (user's first or full name)
- education_level (degree type, school type)
- university_goal (university or academic goal)

Example output:
[
  { "key": "role", "value": "developer", "confidence": 0.92 },
  { "key": "tech_stack", "value": "React, Next.js", "confidence": 0.88 }
]

If no memory-worthy facts exist, return exactly: []`;

let geminiLayer3WarningEmitted = false;

function readGeminiApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
    if (apiKey) return apiKey;

    if (!geminiLayer3WarningEmitted) {
        console.warn(
            `[MemoryLayer3] GEMINI_API_KEY is not configured${process.env.VERCEL ? " on Vercel" : ""
            }; Layer 3 extraction is disabled. Ollama is chat-only.`
        );
        geminiLayer3WarningEmitted = true;
    }

    return "";
}

function stripCodeFences(value: string): string {
    return value
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

export async function runLayer3(message: string): Promise<ExtractedMemory[]> {
    const apiKey = readGeminiApiKey();
    if (!apiKey) return [];
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: DEFAULT_MEMORY_EXTRACTION_MODEL,
            contents: [{ role: "user", parts: [{ text: EXTRACTION_PROMPT(message) }] }],
        });
        const raw = response.text?.trim() || "[]";
        const cleaned = stripCodeFences(raw);

        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) return [];

        const results: ExtractedMemory[] = [];
        for (const item of parsed) {
            if (
                !item ||
                typeof item !== "object" ||
                typeof (item as { key?: unknown }).key !== "string" ||
                typeof (item as { value?: unknown }).value !== "string" ||
                typeof (item as { confidence?: unknown }).confidence !== "number"
            ) {
                continue;
            }

            const key = (item as { key: string }).key;
            const value = (item as { value: string }).value;
            const confidence = (item as { confidence: number }).confidence;
            if (confidence < 0.6) continue; // discard low confidence

            const meta = KEY_META[key as keyof typeof KEY_META];
            if (!meta) continue; // only accept known keys

            results.push({
                key: key as ExtractedMemory["key"],
                value: value.trim(),
                confidence,
                type: meta.type,
                scope: meta.scope,
            });
        }

        console.log(`[MemoryLayer3] LLM extracted ${results.length} items`);
        return results;
    } catch (err) {
        console.error("[MemoryLayer3] Gemini extraction failed:", err);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Main extraction entry point
// ---------------------------------------------------------------------------

/**
 * Run the extraction pipeline (Layer 2 + optional Layer 3).
 * Layer 1 (trigger detection) must be called BEFORE this.
 */
export async function extractMemories(message: string): Promise<ExtractedMemory[]> {
    // Try Layer 2 first (rule-based, cheap)
    const layer2Result = runLayer2(message);
    if (layer2Result !== null) return layer2Result;

    // Layer 2 returned null → escalate to Layer 3 (LLM)
    console.log("[MemoryExtractor] Layer 2 inconclusive, escalating to Layer 3 (LLM)");
    return runLayer3(message);
}
