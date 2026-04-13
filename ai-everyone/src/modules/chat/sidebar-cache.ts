"use client";

import type { Chat } from "@/modules/chat/types";
import {
    SIDEBAR_CHAT_CACHE_STORAGE_KEY,
    SIDEBAR_CHAT_CACHE_TTL_MS,
} from "@/modules/chat/constants";

export interface ChatPreview {
    id: string;
    title: string;
    updatedAt: string;
}

interface ChatPreviewCache {
    timestamp: number;
    chats: ChatPreview[];
}

let memoryCache: ChatPreviewCache | null = null;

export function readSidebarChatCache(): ChatPreview[] {
    if (typeof window === "undefined") return [];

    const now = Date.now();
    if (memoryCache && now - memoryCache.timestamp <= SIDEBAR_CHAT_CACHE_TTL_MS) {
        return memoryCache.chats;
    }

    try {
        const raw = window.sessionStorage.getItem(SIDEBAR_CHAT_CACHE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as ChatPreviewCache;
        if (!parsed?.timestamp || !Array.isArray(parsed?.chats)) return [];
        if (now - parsed.timestamp > SIDEBAR_CHAT_CACHE_TTL_MS) return [];
        memoryCache = parsed;
        return parsed.chats;
    } catch {
        return [];
    }
}

export function writeSidebarChatCache(chats: ChatPreview[]) {
    if (typeof window === "undefined") return;
    const nextCache: ChatPreviewCache = {
        timestamp: Date.now(),
        chats,
    };
    memoryCache = nextCache;
    try {
        window.sessionStorage.setItem(SIDEBAR_CHAT_CACHE_STORAGE_KEY, JSON.stringify(nextCache));
    } catch {
        // Ignore storage write errors.
    }
}

export function toChatPreviews(chats: Chat[]): ChatPreview[] {
    return chats.slice(0, 50).map((chat) => ({
        id: chat.id,
        title: chat.title,
        updatedAt: chat.updatedAt,
    }));
}
