/**
 * ChatView — main view that handles both the greeting state and active chat state.
 *
 * - No active chat + no messages → greeting screen (like the original HomeView)
 * - Active chat or messages exist → message list + chat input
 *
 * This replaces HomeView on the dashboard page while preserving the greeting UI.
 * Adapted from Chatbot-UI's components/chat/chat-ui.tsx.
 */

"use client";

import React from "react";
import { useSession } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { ChatMessageList } from "@/modules/chat/ui/components/chat-message-list";
import { ChatInput } from "@/modules/chat/ui/components/chat-input";

export const ChatView: React.FC = () => {
    const { data: session } = useSession();
    const { activeChatId, messages, error } = useChatContext();

    // tRPC query — fetches a personalised greeting from the server.
    const trpc = useTRPC();
    const { data } = useQuery(
        trpc.hello.queryOptions({
            text: session?.user?.name || "User",
        })
    );

    // Show a loading state while the session is being fetched
    if (!session) {
        return (
            <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
        );
    }

    // Build the greeting string.
    const rawGreeting = data?.greeting ?? `hello ${session.user?.name || "User"}`;
    const capitalisedGreeting =
        rawGreeting.charAt(0).toUpperCase() + rawGreeting.slice(1);
    const displayGreeting = `${capitalisedGreeting}, Whats your agenda today ?`;

    // ── Determine which view to show ─────────────────────────────────────
    const hasConversation = activeChatId !== null || messages.length > 0;

    if (!hasConversation) {
        // ── Greeting view (no active chat) ─────────────────────────────────
        return (
            <div className="flex flex-col h-[calc(100vh-3.5rem)]">
                <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
                    {/* Greeting Text */}
                    <h1 className="text-foreground text-4xl font-semibold tracking-tight text-center">
                        {displayGreeting}
                    </h1>

                    {/* Error display — visible on greeting screen too */}
                    {error && (
                        <div className="w-full max-w-3xl rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}
                </div>

                {/* Chat input pinned at the bottom */}
                <ChatInput />
            </div>
        );
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
