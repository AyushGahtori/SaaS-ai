"use client";

import { bloomFetch } from "@/modules/bloom-ai/api/client";
import type { BloomMutationResponse, BloomNote } from "@/modules/bloom-ai/types";

export function createBloomNote(input: Pick<BloomNote, "title" | "content" | "labels">) {
    return bloomFetch<BloomMutationResponse<BloomNote>>("/api/bloom-ai/notes", {
        method: "POST",
        body: input,
    });
}

export function updateBloomNote(
    input: Partial<Pick<BloomNote, "title" | "content" | "labels" | "status">> & { noteId: string }
) {
    return bloomFetch<BloomMutationResponse<BloomNote>>("/api/bloom-ai/notes", {
        method: "PATCH",
        body: input,
    });
}

export function deleteBloomNote(noteId: string) {
    return bloomFetch<{ success: true }>("/api/bloom-ai/notes", {
        method: "DELETE",
        body: { noteId },
    });
}
