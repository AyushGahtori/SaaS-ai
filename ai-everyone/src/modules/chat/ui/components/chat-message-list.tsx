/**
 * ChatMessageList — scrollable container that renders the conversation.
 *
 * Adapted from Chatbot-UI's components/chat/chat-messages.tsx.
 * Maps over the messages array and renders a ChatMessageItem for each.
 * Auto-scrolls to the bottom when new messages arrive.
 * Shows a typing indicator when the AI is generating a response.
 */

"use client";

import React, { useEffect, useRef } from "react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { ChatMessageItem } from "./chat-message-item";
import { Bot, Loader2 } from "lucide-react";

export const ChatMessageList: React.FC = () => {
    const { messages, isGenerating, error } = useChatContext();
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isGenerating]);

    return (
        <div className="flex-1 custom-scrollbar">
            <div className="max-w-5xl mx-auto py-4 px-4">
                {/* Render all messages uniformly — no voice session grouping */}
                {messages.map((msg) => (
                    <ChatMessageItem key={msg.id} message={msg} />
                ))}

                {/* Typing indicator while waiting for AI response */}
                {isGenerating && (
                    <div className="flex gap-3 px-4 py-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 rounded-2xl rounded-bl-sm px-4 py-3">
                            <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
                            <span className="text-sm text-white/60">Thinking...</span>
                        </div>
                    </div>
                )}

                {/* Error display */}
                {error && (
                    <div className="mx-4 my-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* Scroll anchor */}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};
