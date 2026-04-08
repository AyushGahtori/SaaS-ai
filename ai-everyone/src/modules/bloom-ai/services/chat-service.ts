"use client";

import { bloomFetch } from "@/modules/bloom-ai/api/client";
import type { BloomChatResponse } from "@/modules/bloom-ai/types";

export function sendBloomMessage(input: {
    conversationId: string;
    message: string;
    modelId?: string;
}) {
    return bloomFetch<BloomChatResponse>("/api/bloom-ai/chat", {
        method: "POST",
        body: input,
    });
}

export function createBloomConversation(title?: string) {
    return bloomFetch<BloomChatResponse>("/api/bloom-ai/conversations", {
        method: "POST",
        body: { title },
    });
}

export function updateBloomConversation(input: {
    conversationId: string;
    title?: string;
    isPinned?: boolean;
    isArchived?: boolean;
}) {
    return bloomFetch<BloomChatResponse>("/api/bloom-ai/conversations", {
        method: "PATCH",
        body: input,
    });
}

export function deleteBloomConversation(conversationId: string) {
    return bloomFetch<{ success: true }>("/api/bloom-ai/conversations", {
        method: "DELETE",
        body: { conversationId },
    });
}
