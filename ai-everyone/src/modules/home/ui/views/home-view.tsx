/**
 * HomeView — Homepage greeting view with action buttons.
 *
 * Renders when there is no active chat:
 *  - Centered greeting: "Hello {username}, Whats your agenda today?"
 *  - Chat input bar (via ChatInput)
 *  - 7 quick-action buttons below the input
 *
 * Everything is grouped and vertically centered as a single block.
 */

"use client";

import React from "react";
import { useSession } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { ChatInput } from "@/modules/chat/ui/components/chat-input";

// ── Quick-action buttons ─────────────────────────────────────────────────────

const QUICK_ACTIONS = [
    { label: "Schedule Meeting", emoji: "📅", prompt: "I want to schedule a meeting" },
    { label: "Call", emoji: "📞", prompt: "I want to make a call" },
    { label: "Message", emoji: "💬", prompt: "I want to send a message" },
    { label: "Generate PPT", emoji: "📊", prompt: "I want to generate a presentation" },
    { label: "Summarize Document", emoji: "📝", prompt: "I want to summarize a document" },
    { label: "Update Todo", emoji: "✅", prompt: "I want to update my to-do list" },
    { label: "Email", emoji: "✉️", prompt: "I want to send an email" },
];

export const HomeView: React.FC = () => {
    const { data: session } = useSession();
    const { sendMessage, error } = useChatContext();

    // tRPC query — fetches a personalised greeting from the server.
    const trpc = useTRPC();
    const { data } = useQuery(
        trpc.hello.queryOptions({
            text: session?.user?.name || "User",
        })
    );

    // Show loading state while session is being fetched
    if (!session) {
        return (
            <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
        );
    }

    // Build the greeting string
    const rawGreeting = data?.greeting ?? `hello ${session.user?.name || "User"}`;
    const capitalisedGreeting =
        rawGreeting.charAt(0).toUpperCase() + rawGreeting.slice(1);
    const displayGreeting = `${capitalisedGreeting}, Whats your agenda today ?`;

    // Handle quick-action button click
    const handleQuickAction = async (prompt: string) => {
        await sendMessage(prompt);
    };

    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] px-4">
            {/* ── All content grouped & centered ──────────────────── */}

            {/* Greeting Text */}
            <h1 className="text-foreground text-4xl font-semibold tracking-tight text-center mb-8">
                {displayGreeting}
            </h1>

            {/* Error display */}
            {error && (
                <div className="w-full max-w-3xl rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-4">
                    {error}
                </div>
            )}

            {/* Chat Input */}
            <div className="w-full max-w-3xl">
                <ChatInput />
            </div>

            {/* Quick-Action Buttons — Row 1 (4 buttons) + Row 2 (3 buttons) */}
            <div className="flex flex-col items-center gap-2.5 mt-4">
                <div className="flex items-center justify-center gap-2.5">
                    {QUICK_ACTIONS.slice(0, 4).map((action) => (
                        <button
                            key={action.label}
                            onClick={() => handleQuickAction(action.prompt)}
                            className="
                                flex items-center gap-1.5 px-4 py-2 rounded-full
                                border border-white/10 bg-white/[0.03]
                                text-sm text-white/70
                                hover:bg-white/[0.08] hover:text-white hover:border-white/20
                                transition-all duration-200 ease-out
                                cursor-pointer select-none
                            "
                        >
                            <span className="text-base">{action.emoji}</span>
                            <span>{action.label}</span>
                        </button>
                    ))}
                </div>
                <div className="flex items-center justify-center gap-2.5">
                    {QUICK_ACTIONS.slice(4).map((action) => (
                        <button
                            key={action.label}
                            onClick={() => handleQuickAction(action.prompt)}
                            className="
                                flex items-center gap-1.5 px-4 py-2 rounded-full
                                border border-white/10 bg-white/[0.03]
                                text-sm text-white/70
                                hover:bg-white/[0.08] hover:text-white hover:border-white/20
                                transition-all duration-200 ease-out
                                cursor-pointer select-none
                            "
                        >
                            <span className="text-base">{action.emoji}</span>
                            <span>{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
