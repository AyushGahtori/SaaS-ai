/**
 * ChatView — main view that handles both the greeting state and active chat state.
 *
 * - No active chat + no messages → renders HomeView (greeting + action buttons)
 * - Active chat or messages exist → renders ChatMessageList + ChatInput
 */

"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { HomeView } from "@/modules/home/ui/views/home-view";

const ChatMessageList = dynamic(
    () =>
        import("@/modules/chat/ui/components/chat-message-list").then(
            (module) => module.ChatMessageList
        ),
    {
        ssr: false,
        loading: () => <div className="flex-1 animate-pulse bg-white/[0.02]" />,
    }
);

const ChatInput = dynamic(
    () => import("@/modules/chat/ui/components/chat-input").then((module) => module.ChatInput),
    {
        ssr: false,
        loading: () => <div className="h-24 border-t border-white/10 bg-black/40" />,
    }
);

export const ChatView: React.FC = () => {
    const { activeChatId, messages } = useChatContext();

    // ── Determine which view to show ─────────────────────────────────────
    const hasConversation = activeChatId !== null || messages.length > 0;

    if (!hasConversation) {
        // ── Greeting view (no active chat) ─────────────────────────────────
        return <HomeView />;
    }

    // ── Conversation view (active chat with messages) ────────────────────
    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)]">
            {/* Scrollable message list */}
            <ChatMessageList />

            {/* Chat input pinned at the bottom */}
            <ChatInput />
        </div>
    );
};
