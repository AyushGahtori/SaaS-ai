/**
 * ChatMessageItem — renders a single chat message bubble.
 *
 * - User messages: right-aligned, subtle background
 * - Assistant messages: left-aligned, with markdown rendering
 * - Agent messages: delegated to AgentTaskMessage component
 */

"use client";

import React from "react";
import type { ChatMessage } from "@/modules/chat/types";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AgentTaskMessage } from "./agent-task-message";

interface ChatMessageItemProps {
    message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
    message,
}) => {
    // Agent messages get their own specialized renderer
    if (message.role === "agent") {
        return <AgentTaskMessage message={message} />;
    }

    const isUser = message.role === "user";

    return (
        <div
            className={`flex gap-3 px-4 py-4 ${isUser ? "justify-end" : "justify-start"
                }`}
        >
            {/* Assistant avatar */}
            {!isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                </div>
            )}

            {/* Message content */}
            <div
                className={`relative max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser
                        ? "bg-white/10 text-white rounded-br-sm"
                        : "bg-white/5 text-[#E5E5E5] rounded-bl-sm"
                    }`}
            >
                {isUser ? (
                    // User messages — plain text
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                ) : (
                    // Assistant messages — rendered as markdown
                    <div className="prose prose-invert prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                        </ReactMarkdown>
                    </div>
                )}
            </div>

            {/* User avatar */}
            {isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                </div>
            )}
        </div>
    );
};
