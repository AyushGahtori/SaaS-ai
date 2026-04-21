/**
 * Persona Builder
 *
 * Assembles a short natural-language persona summary from the user's
 * active memories. Stores the result in users/{uid}/persona/main.
 *
 * The summary is used for persona injection in chat prompts — but ONLY
 * when the current query is identified as needing personal context.
 *
 * Server-side only.
 */

import { GoogleGenAI } from "@google/genai";
import type { MemoryItem, PersonaSummary } from "@/lib/memory/types";
import { getActiveMemories, getPersona, savePersona } from "@/lib/memory/memory-repository.server";

const DEFAULT_PERSONA_SUMMARY_MODEL =
    process.env.GEMINI_MODEL_FLASH ||
    process.env.GEMINI_MODEL_FLASH_LITE ||
    "gemini-2.5-flash-lite";

let personaGeminiWarningEmitted = false;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildAssemblyPrompt(memories: MemoryItem[]): string {
    if (memories.length === 0) {
        return "The user has not provided any personal information yet.";
    }

    const factLines = memories
        .filter((m) => m.value !== undefined && m.value !== null)
        .map((m) => `- ${m.key}: ${m.value}`)
        .join("\n");

    return `You are a persona summarizer for an AI assistant.
Given these facts about a user, write a 2–3 sentence summary.
Be concise and natural. Write in third person. No bullet points. No lists.

User facts:
${factLines}

Output ONLY the summary. No explanation, no preamble.`;
}

// ---------------------------------------------------------------------------
// LLM summary generation
// ---------------------------------------------------------------------------

async function generateSummaryFromLLM(memories: MemoryItem[]): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
    if (!apiKey) {
        if (!personaGeminiWarningEmitted) {
            console.warn(
                `[PersonaBuilder] GEMINI_API_KEY is not configured${process.env.VERCEL ? " on Vercel" : ""
                }; using deterministic fallback summary. Ollama is chat-only.`
            );
            personaGeminiWarningEmitted = true;
        }
        return buildFallbackSummary(memories);
    }

    const ai = new GoogleGenAI({ apiKey });
    try {
        const response = await ai.models.generateContent({
            model: DEFAULT_PERSONA_SUMMARY_MODEL,
            contents: [{ role: "user", parts: [{ text: buildAssemblyPrompt(memories) }] }],
        });
        const summary = response.text?.trim() || "";
        return summary || buildFallbackSummary(memories);
    } catch (error) {
        console.error("[PersonaBuilder] Gemini summary failed:", error);
        return buildFallbackSummary(memories);
    }
}

/** Simple deterministic fallback summary if LLM fails. */
function buildFallbackSummary(memories: MemoryItem[]): string {
    const kvMap: Record<string, string> = {};
    for (const m of memories) {
        if (m.value) kvMap[m.key] = m.value;
    }

    const parts: string[] = [];
    if (kvMap["role"]) parts.push(`User is a ${kvMap["role"]}`);
    if (kvMap["current_goal"]) parts.push(`their goal is to ${kvMap["current_goal"]}`);
    if (kvMap["current_focus"]) parts.push(`currently focused on ${kvMap["current_focus"]}`);
    if (kvMap["answer_style"]) parts.push(`prefers ${kvMap["answer_style"]} responses`);
    if (kvMap["tech_stack"]) parts.push(`works with ${kvMap["tech_stack"]}`);

    if (parts.length === 0) return "";
    return parts.join(". ") + ".";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Rebuild the persona summary from all active memories and save it to Firestore.
 * Call this after saving new memories (fire-and-forget or awaited).
 */
export async function rebuildPersona(uid: string): Promise<PersonaSummary> {
    const memories = await getActiveMemories(uid);
    const activeWithValues = memories.filter((m) => m.status === "active" && m.value);

    const summary = await generateSummaryFromLLM(activeWithValues);

    const currentPersona = await getPersona(uid);
    const newVersion = (currentPersona?.version ?? 0) + 1;
    const memoryIds = activeWithValues.map((m) => m.id!).filter(Boolean);

    // Extract denormalized fast-access fields
    const kvMap: Record<string, string> = {};
    for (const m of activeWithValues) {
        if (m.value) kvMap[m.key] = m.value;
    }

    const persona: Omit<PersonaSummary, "updatedAt"> = {
        summary,
        topFacts: memoryIds.slice(0, 8),
        version: newVersion,
        generatedFrom: memoryIds,
        role: kvMap["role"],
        current_focus: kvMap["current_focus"],
        answer_style: kvMap["answer_style"],
    };

    await savePersona(uid, persona);
    console.log(`[PersonaBuilder] rebuilt persona v${newVersion} for uid=${uid}`);

    return { ...persona, updatedAt: new Date().toISOString() };
}

/**
 * Format the persona summary for injection into a system prompt.
 * Returns an empty string if no meaningful persona exists.
 */
export function formatPersonaForPrompt(persona: PersonaSummary | null): string {
    if (!persona || !persona.summary) return "";
    return `[User Persona]\n${persona.summary}`;
}
