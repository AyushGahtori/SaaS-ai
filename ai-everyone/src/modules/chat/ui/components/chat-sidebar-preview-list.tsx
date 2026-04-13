"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFirebaseAuthHeaders } from "@/lib/firebase-client-lazy";
import {
    PENDING_CHAT_ID_STORAGE_KEY,
} from "@/modules/chat/constants";
import { readSidebarChatCache, writeSidebarChatCache, type ChatPreview } from "@/modules/chat/sidebar-cache";

export function ChatSidebarPreviewList() {
    const router = useRouter();
    const [chats, setChats] = useState<ChatPreview[]>(() => readSidebarChatCache());
    const [isLoading, setIsLoading] = useState(() => chats.length === 0);

    useEffect(() => {
        let isMounted = true;

        const refreshChats = async () => {
            try {
                const headers = await getFirebaseAuthHeaders();
                const response = await fetch("/api/chats/preview", { method: "GET", headers });
                const payload = (await response.json().catch(() => ({}))) as {
                    chats?: ChatPreview[];
                    error?: string;
                };
                if (!response.ok) {
                    throw new Error(payload.error || "Failed to load recent chats.");
                }
                if (!isMounted) return;

                const nextPreviews = Array.isArray(payload.chats) ? payload.chats : [];

                setChats(nextPreviews);
                writeSidebarChatCache(nextPreviews);
            } catch (error) {
                console.error("[ChatSidebarPreviewList] Failed to refresh chats:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        void refreshChats();

        return () => {
            isMounted = false;
        };
    }, []);

    const hasChats = useMemo(() => chats.length > 0, [chats.length]);

    if (isLoading && !hasChats) {
        return <div className="px-3 py-2 text-xs text-white/40">Loading chats...</div>;
    }

    if (!hasChats) {
        return <div className="px-3 py-2 text-xs text-white/40">No chats yet</div>;
    }

    return (
        <div className="flex flex-col gap-0.5">
            {chats.map((chat) => (
                <button
                    key={chat.id}
                    data-chat-sidebar-item="true"
                    className={cn(
                        "group flex items-center gap-2 px-3 py-2 mx-1 rounded-md text-sm transition-colors border bg-none",
                        "border-transparent text-[#E5E5E5] hover:bg-[#0F1213] hover:border-[#23282D]"
                    )}
                    onClick={() => {
                        if (typeof window !== "undefined") {
                            window.sessionStorage.setItem(PENDING_CHAT_ID_STORAGE_KEY, chat.id);
                        }
                        router.push("/");
                    }}
                >
                    <MessageSquare
                        className="w-4 h-4 flex-shrink-0 opacity-50"
                        stroke="white"
                        strokeWidth={2}
                        aria-hidden="true"
                    />
                    <span className="flex-1 truncate text-xs font-medium text-left">
                        {chat.title}
                    </span>
                </button>
            ))}
        </div>
    );
}
