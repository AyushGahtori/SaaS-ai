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
import { ThemedErrorBanner } from "@/components/error-ui/themed-error-banner";
import { normalizeUserFacingError } from "@/lib/errors/user-facing-errors";

const INITIAL_WINDOW_SIZE = 10;
const WINDOW_STEP = 10;

export const ChatMessageList: React.FC = () => {
    const { activeChatId, messages, isGenerating, error, liveVoiceTranscript } = useChatContext();
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
    const mappedError = useMemo(
        () =>
            error
                ? normalizeUserFacingError(error, {
                    surface: "chat",
                    fallbackMessage: "I could not complete that response right now.",
                })
                : null,
        [error]
    );

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

    const visibleMessages = useMemo(() => {
        const visible = messages.slice(visibleStartIndex);
        const transcript = liveVoiceTranscript.trim();
        if (!transcript) return visible;

        const lastUser = [...messages].reverse().find((message) => message.role === "user");
        if (lastUser?.isVoice && lastUser.content.trim() === transcript) return visible;

        return [
            ...visible,
            {
                id: "voice_draft",
                chatId: activeChatId || "voice_draft",
                role: "user" as const,
                content: transcript,
                createdAt: new Date().toISOString(),
                isVoice: true,
                meta: { isVoiceDraft: true },
            },
        ];
    }, [activeChatId, liveVoiceTranscript, messages, visibleStartIndex]);

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
            className="custom-scrollbar flex-1 overflow-y-auto"
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
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 shadow-[0_8px_20px_rgb(92_53_229/24%)]">
                            <Bot className="thinking-pulse h-5 w-5 text-violet-100" />
                        </div>
                        <div className="ui-surface flex items-center gap-2 rounded-2xl rounded-bl-sm px-4 py-3">
                            <span className="thinking-pulse text-sm text-white/82">Thinking</span>
                            <span className="thinking-dots" aria-hidden="true">
                                <span>.</span>
                                <span>.</span>
                                <span>.</span>
                            </span>
                        </div>
                    </div>
                )}

                {/* Error display */}
                <ThemedErrorBanner error={mappedError} className="mx-4 my-2" />

                {/* Scroll anchor */}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};
