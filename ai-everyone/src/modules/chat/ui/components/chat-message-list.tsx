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

    const groupedMessages = React.useMemo(() => {
        const groups: { isVoice: boolean; messages: typeof messages }[] = [];
        for (const msg of messages) {
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && lastGroup.isVoice === !!msg.isVoice) {
                lastGroup.messages.push(msg);
            } else {
                groups.push({ isVoice: !!msg.isVoice, messages: [msg] });
            }
        }
        return groups;
    }, [messages]);

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto py-4 px-4">
                {groupedMessages.map((group, groupIdx) => {
                    if (!group.isVoice) {
                        return group.messages.map((msg) => (
                            <ChatMessageItem key={msg.id} message={msg} />
                        ));
                    }

                    // Render a Voice Session card for continuous voice interactions
                    const firstMsg = group.messages[0];
                    const startTimeString = new Date(firstMsg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    return (
                        <div key={`voice-session-${groupIdx}`} className="my-6 rounded-3xl border border-white/5 bg-[#121314] overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <Bot className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <span className="text-xs font-semibold tracking-widest text-[#5C8E9A]">VOICE SESSION</span>
                                </div>
                                <span className="text-xs font-mono text-white/30">{startTimeString}</span>
                            </div>

                            {/* Inner Messages */}
                            <div className="p-4 bg-gradient-to-b from-[#121314] to-transparent">
                                {group.messages.map((msg) => (
                                    <ChatMessageItem key={msg.id} message={msg} />
                                ))}
                            </div>
                        </div>
                    );
                })}

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
