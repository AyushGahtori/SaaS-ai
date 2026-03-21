/**
 * Memory Deduplicator
 *
 * Before saving a new memory, this module:
 * 1. Normalizes the key and value
 * 2. Checks if the exact same fact already exists (skip)
 * 3. Checks if a conflicting memory with the same key exists (supersede)
 * 4. Saves the new memory if appropriate
 * 5. Enforces cap and expiry policies
 *
 * This is the only place where memory writes should happen from the extraction pipeline.
 */

import type { ExtractedMemory, MemoryItem } from "@/lib/memory/types";
import {
    getActiveMemories,
    saveMemory,
    markSuperseded,
    applyExpiryPolicy,
    enforceCapPolicy,
} from "@/lib/memory/memory-repository.server";
import { KEY_META } from "@/lib/memory/types";

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Normalize a value for comparison (lowercase, trim, remove punctuation). */
function normalizeValue(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, "") // remove punctuation
        .replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Dedup and save
// ---------------------------------------------------------------------------

/**
 * Process a batch of extracted memories for a user.
 * Handles deduplication, superseding, and saving.
 *
 * @param uid - Firebase user ID
 * @param extracted - Array of extracted memories from the extraction pipeline
 * @param source - "chat" | "survey" | "system"
 * @param sourceChatId - Optional chat reference
 * @param sourceMessageId - Optional message reference
 * @returns Number of new memories saved
 */
export async function processExtractedMemories(
    uid: string,
    extracted: ExtractedMemory[],
    source: MemoryItem["source"],
    sourceChatId: string | null = null,
    sourceMessageId: string | null = null,
): Promise<number> {
    if (extracted.length === 0) return 0;

    // Fetch all current active memories at once to minimize reads
    const existingMemories = await getActiveMemories(uid);
    let savedCount = 0;

    for (const item of extracted) {
        try {
            const savedOrSkipped = await deduplicateAndSave(
                uid,
                item,
                existingMemories,
                source,
                sourceChatId,
                sourceMessageId,
            );
            if (savedOrSkipped) savedCount++;
        } catch (err) {
            console.error(`[MemoryDedup] Error processing key=${item.key}:`, err);
        }
    }

    if (savedCount > 0) {
        // Run policy checks asynchronously (fire and forget)
        Promise.all([
            applyExpiryPolicy(uid),
            enforceCapPolicy(uid),
        ]).catch((err) => console.error("[MemoryDedup] policy error:", err));
    }

    return savedCount;
}

async function deduplicateAndSave(
    uid: string,
    item: ExtractedMemory,
    existingMemories: MemoryItem[],
    source: MemoryItem["source"],
    sourceChatId: string | null,
    sourceMessageId: string | null,
): Promise<boolean> {
    const normalizedNew = normalizeValue(item.value);

    // Find memories with the same key
    const sameKeyMemories = existingMemories.filter((m) => m.key === item.key);

    for (const existing of sameKeyMemories) {
        if (!existing.value) continue;
        const normalizedExisting = normalizeValue(existing.value);

        if (normalizedExisting === normalizedNew) {
            // Exact match → skip
            console.log(`[MemoryDedup] skipped identical key=${item.key} value="${item.value}"`);
            return false;
        }

        // Same key, different value → check if new is better
        const newIsBetter =
            item.confidence > (existing.confidence ?? 0) ||
            // If same confidence, prefer newer (chat-based over survey if more recent)
            (item.confidence >= (existing.confidence ?? 0) && source === "chat" && existing.source === "survey");

        if (newIsBetter) {
            // Supersede old, save new
            await markSuperseded(uid, existing.id!);
            console.log(`[MemoryDedup] superseding id=${existing.id} key=${item.key}`);
        } else {
            // Existing is better — skip
            console.log(`[MemoryDedup] existing better, skipping key=${item.key}`);
            return false;
        }
    }

    // Get meta for this key
    const meta = KEY_META[item.key] ?? { type: item.type, scope: item.scope };

    const now = new Date().toISOString();
    await saveMemory(uid, {
        type: meta.type ?? item.type,
        key: item.key,
        value: item.value,
        scope: meta.scope ?? item.scope,
        confidence: item.confidence,
        source,
        status: "active",
        createdAt: now,
        updatedAt: now,
        expiresAt: null, // set in saveMemory based on scope
        sourceChatId,
        sourceMessageId,
    });

    return true;
}
