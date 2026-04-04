/**
 * ChatMessageList — scrollable container that renders the conversation.
 *
 * Adapted from Chatbot-UI's components/chat/chat-messages.tsx.
 * Maps over the messages array and renders a ChatMessageItem for each.
 * Auto-scrolls to the bottom when new messages arrive.
 * Shows a typing indicator when the AI is generating a response.
 */

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { ChatMessageItem } from "./chat-message-item";
import { Bot } from "lucide-react";

const INITIAL_WINDOW_SIZE = 10;
const WINDOW_STEP = 10;

export const ChatMessageList: React.FC = () => {
    const { activeChatId, messages, isGenerating, error } = useChatContext();
    const bottomRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const shouldStickToBottomRef = useRef(true);
    const lastChatIdRef = useRef<string | null>(null);
    const [visibleStartIndex, setVisibleStartIndex] = useState(0);
    const [isHydratingHistory, setIsHydratingHistory] = useState(false);

    const streamingMessage = useMemo(
        () =>
            [...messages]
                .reverse()
                .find((message) => message.role === "assistant" && message.id.startsWith("temp_")),
        [messages]
    );
    const showThinking = isGenerating && !streamingMessage?.content?.trim();

    useEffect(() => {
        const chatChanged = activeChatId !== lastChatIdRef.current;
        if (chatChanged) {
            lastChatIdRef.current = activeChatId;
            setVisibleStartIndex(Math.max(0, messages.length - INITIAL_WINDOW_SIZE));
            setIsHydratingHistory(true);
            const timeout = window.setTimeout(() => setIsHydratingHistory(false), 320);
            return () => window.clearTimeout(timeout);
        }

        setVisibleStartIndex((prev) => {
            const maxStart = Math.max(0, messages.length - INITIAL_WINDOW_SIZE);
            return prev > maxStart ? maxStart : prev;
        });
    }, [activeChatId, messages.length]);

    const visibleMessages = useMemo(
        () => messages.slice(visibleStartIndex),
        [messages, visibleStartIndex]
    );

    const loadOlderMessages = () => {
        if (visibleStartIndex <= 0) return;
        setVisibleStartIndex((prev) => Math.max(0, prev - WINDOW_STEP));
    };

    const handleScroll = () => {
        const container = listRef.current;
        if (!container) return;
        const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;
        shouldStickToBottomRef.current = distanceFromBottom < 80;

        if (container.scrollTop < 64 && visibleStartIndex > 0) {
            loadOlderMessages();
        }
    };

    // Auto-scroll to bottom for new activity when user is already near bottom.
    useEffect(() => {
        if (shouldStickToBottomRef.current || isGenerating) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }, [messages, isGenerating, visibleStartIndex]);

    return (
        <div
            ref={listRef}
            onScroll={handleScroll}
            className="flex-1 custom-scrollbar overflow-y-auto"
        >
            <div className="max-w-6xl mx-auto py-4 px-4">
                {/* Render all messages uniformly — no voice session grouping */}
                {visibleMessages.map((msg, index) => (
                    <div
                        key={msg.id}
                        className="message-reveal-item"
                        style={
                            isHydratingHistory
                                ? { animationDelay: `${index * 35}ms` }
                                : undefined
                        }
                    >
                        <ChatMessageItem
                            message={msg}
                            isStreaming={streamingMessage?.id === msg.id}
                        />
                    </div>
                ))}

                {/* Typing indicator while waiting for AI response */}
                {showThinking && (
                    <div className="flex gap-3 px-4 py-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white thinking-pulse" />
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 rounded-2xl rounded-bl-sm px-4 py-3">
                            <span className="text-sm text-white/70 thinking-pulse">Thinking</span>
                            <span className="thinking-dots" aria-hidden="true">
                                <span>.</span>
                                <span>.</span>
                                <span>.</span>
                            </span>
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
