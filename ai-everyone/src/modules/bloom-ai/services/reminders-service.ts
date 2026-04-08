"use client";

import { bloomFetch } from "@/modules/bloom-ai/api/client";
import type { BloomMutationResponse, BloomReminder } from "@/modules/bloom-ai/types";

export function createBloomReminder(
    input: Pick<BloomReminder, "title" | "details" | "scheduledFor" | "priority">
) {
    return bloomFetch<BloomMutationResponse<BloomReminder>>("/api/bloom-ai/reminders", {
        method: "POST",
        body: input,
    });
}

export function updateBloomReminder(
    input: Partial<Pick<BloomReminder, "title" | "details" | "scheduledFor" | "priority" | "status">> & {
        reminderId: string;
    }
) {
    return bloomFetch<BloomMutationResponse<BloomReminder>>("/api/bloom-ai/reminders", {
        method: "PATCH",
        body: input,
    });
}

export function deleteBloomReminder(reminderId: string) {
    return bloomFetch<{ success: true }>("/api/bloom-ai/reminders", {
        method: "DELETE",
        body: { reminderId },
    });
}
