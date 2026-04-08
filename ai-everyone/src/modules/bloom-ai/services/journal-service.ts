"use client";

import { bloomFetch } from "@/modules/bloom-ai/api/client";
import type { BloomJournalEntry, BloomMutationResponse } from "@/modules/bloom-ai/types";

export function createBloomJournalEntry(
    input: Pick<BloomJournalEntry, "title" | "content" | "mood" | "entryDate">
) {
    return bloomFetch<BloomMutationResponse<BloomJournalEntry>>("/api/bloom-ai/journal", {
        method: "POST",
        body: input,
    });
}

export function updateBloomJournalEntry(
    input: Partial<Pick<BloomJournalEntry, "title" | "content" | "mood" | "entryDate">> & {
        entryId: string;
    }
) {
    return bloomFetch<BloomMutationResponse<BloomJournalEntry>>("/api/bloom-ai/journal", {
        method: "PATCH",
        body: input,
    });
}

export function deleteBloomJournalEntry(entryId: string) {
    return bloomFetch<{ success: true }>("/api/bloom-ai/journal", {
        method: "DELETE",
        body: { entryId },
    });
}
