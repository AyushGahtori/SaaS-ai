/**
 * ChatView — main view that handles both the greeting state and active chat state.
 *
 * - No active chat + no messages → renders HomeView (greeting + action buttons)
 * - Active chat or messages exist → renders ChatMessageList + ChatInput
 */

"use client";

import React from "react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { ChatMessageList } from "@/modules/chat/ui/components/chat-message-list";
import { ChatInput } from "@/modules/chat/ui/components/chat-input";
import { HomeView } from "@/modules/home/ui/views/home-view";

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
