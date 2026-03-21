/**
 * POST /api/survey
 *
 * Receives survey answers from the onboarding modal.
 * Converts them to MemoryItems, saves them to Firestore,
 * rebuilds the persona summary, and marks onboarding complete.
 */

import { NextRequest, NextResponse } from "next/server";
import { processExtractedMemories } from "@/lib/memory/deduper";
import { rebuildPersona } from "@/lib/memory/persona-builder";
import { markOnboardingComplete } from "@/lib/memory/memory-repository.server";
import type { ExtractedMemory } from "@/lib/memory/types";
import { KEY_META } from "@/lib/memory/types";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, answers } = body as {
            userId: string;
            answers: Array<{ key: string; value: string | undefined | null }>;
        };

        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        // Convert survey answers to ExtractedMemory format
        const extracted: ExtractedMemory[] = [];

        for (const answer of (answers ?? [])) {
            if (!answer.key) continue;
            // Skipped answers have undefined/null value — we DO NOT save a memory item for them
            if (answer.value === undefined || answer.value === null || answer.value === "") continue;

            const meta = KEY_META[answer.key];
            if (!meta) continue;

            extracted.push({
                key: answer.key,
                value: answer.value,
                confidence: 1.0, // survey answers are high confidence
                type: meta.type,
                scope: meta.scope,
            });
        }

        // Save memories (with deduplication)
        const savedCount = await processExtractedMemories(userId, extracted, "survey");

        // Rebuild persona summary (fire-and-forget, don't block response)
        rebuildPersona(userId).catch((err) =>
            console.error("[Survey API] Persona rebuild error:", err)
        );

        // Mark onboarding complete regardless of how many answers were given
        await markOnboardingComplete(userId);

        return NextResponse.json({
            success: true,
            memoriesSaved: savedCount,
        });
    } catch (error) {
        console.error("[Survey API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Survey processing failed" },
            { status: 500 }
        );
    }
}
