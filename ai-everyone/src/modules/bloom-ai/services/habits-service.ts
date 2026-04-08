"use client";

import { bloomFetch } from "@/modules/bloom-ai/api/client";
import type { BloomHabit, BloomMutationResponse } from "@/modules/bloom-ai/types";

export function createBloomHabit(input: Pick<BloomHabit, "name" | "category" | "color">) {
    return bloomFetch<BloomMutationResponse<BloomHabit>>("/api/bloom-ai/habits", {
        method: "POST",
        body: input,
    });
}

export function updateBloomHabit(
    input: Partial<Pick<BloomHabit, "name" | "category" | "color" | "completedDates">> & {
        habitId: string;
    }
) {
    return bloomFetch<BloomMutationResponse<BloomHabit>>("/api/bloom-ai/habits", {
        method: "PATCH",
        body: input,
    });
}

export function deleteBloomHabit(habitId: string) {
    return bloomFetch<{ success: true }>("/api/bloom-ai/habits", {
        method: "DELETE",
        body: { habitId },
    });
}
