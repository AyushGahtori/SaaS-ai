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
import { MessageAttachmentList } from "./message-attachment-list";
import { AgentInstallSuggestionCard } from "./agent-install-suggestion-card";

interface ChatMessageItemProps {
    message: ChatMessage;
    isStreaming?: boolean;
}

interface AgentInstallSuggestionMeta {
    id: string;
    name: string;
    description: string;
    iconUrl: string;
    category: string;
    installCount: number;
    rating: number;
    requiresConnection: boolean;
    bundleId?: string;
    kind: "agent" | "bundle";
}

function getInstallSuggestionMeta(message: ChatMessage): AgentInstallSuggestionMeta | null {
    const meta = message.meta;
    if (!meta || typeof meta !== "object") return null;
    if (meta.kind !== "agent_install_suggestion") return null;
    const suggestion = meta.suggestion;
    if (!suggestion || typeof suggestion !== "object") return null;

    const typed = suggestion as Record<string, unknown>;
    if (
        typeof typed.id !== "string" ||
        typeof typed.name !== "string" ||
        typeof typed.description !== "string" ||
        typeof typed.iconUrl !== "string" ||
        typeof typed.category !== "string" ||
        typeof typed.installCount !== "number" ||
        typeof typed.rating !== "number" ||
        typeof typed.requiresConnection !== "boolean" ||
        (typed.kind !== "agent" && typed.kind !== "bundle")
    ) {
        return null;
    }

    return {
        id: typed.id,
        name: typed.name,
        description: typed.description,
        iconUrl: typed.iconUrl,
        category: typed.category,
        installCount: typed.installCount,
        rating: typed.rating,
        requiresConnection: typed.requiresConnection,
        bundleId: typeof typed.bundleId === "string" ? typed.bundleId : undefined,
        kind: typed.kind,
    };
}

function StreamingOpacityText({ content }: { content: string }) {
    const tokens = content.split(/(\s+)/);
    const nonSpaceIndices = tokens
        .map((token, idx) => ({ token, idx }))
        .filter(({ token }) => token.trim().length > 0)
        .map(({ idx }) => idx);
    const lastWordIndex = nonSpaceIndices[nonSpaceIndices.length - 1] ?? -1;

    const tailOpacity = (distanceFromEnd: number) => {
        if (distanceFromEnd <= 0) return 0.3;
        if (distanceFromEnd === 1) return 0.5;
        if (distanceFromEnd === 2) return 0.7;
        if (distanceFromEnd === 3) return 0.85;
        return 1;
    };

    return (
        <p className="whitespace-pre-wrap break-words">
            {tokens.map((token, tokenIndex) => {
                if (token.trim().length === 0) {
                    return <React.Fragment key={`ws-${tokenIndex}`}>{token}</React.Fragment>;
                }
                const distanceFromEnd = lastWordIndex - tokenIndex;
                return (
                    <span
                        key={`tk-${tokenIndex}`}
                        style={{ opacity: tailOpacity(distanceFromEnd), transition: "opacity 180ms ease-out" }}
                    >
                        {token}
                    </span>
                );
            })}
        </p>
    );
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
    message,
    isStreaming = false,
}) => {
    // Agent messages get their own specialized renderer
    if (message.role === "agent") {
        return <AgentTaskMessage message={message} />;
    }

    // Hide transient empty assistant placeholder messages.
    // The typing indicator is rendered separately by ChatMessageList.
    if (message.role === "assistant" && !message.content.trim()) {
        return null;
    }

    const isUser = message.role === "user";
    const installSuggestion = getInstallSuggestionMeta(message);

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
                className={`relative max-w-[76%] overflow-hidden rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser
                        ? "bg-white/10 text-white rounded-br-sm"
                        : "bg-white/5 text-[#E5E5E5] rounded-bl-sm"
                    }`}
            >
                {isUser ? (
                    <>
                        <MessageAttachmentList attachments={message.attachments || []} />
                        {/* User messages — plain text */}
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </>
                ) : (
                    // Assistant messages — rendered as markdown
                    <div className="prose prose-invert prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {isStreaming ? (
                            <StreamingOpacityText content={message.content} />
                        ) : (
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    pre: ({ children, ...props }) => (
                                        <pre
                                            {...props}
                                            className="custom-scrollbar max-w-full overflow-x-auto rounded-lg bg-black/25 p-3"
                                        >
                                            {children}
                                        </pre>
                                    ),
                                    code: ({ className, children, ...props }) => {
                                        const isBlock = Boolean(className && className.includes("language-"));
                                        if (isBlock) {
                                            return (
                                                <code {...props} className={className}>
                                                    {children}
                                                </code>
                                            );
                                        }
                                        return (
                                            <code
                                                {...props}
                                                className="rounded bg-white/10 px-1.5 py-0.5 text-[0.9em]"
                                            >
                                                {children}
                                            </code>
                                        );
                                    },
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        )}
                        {installSuggestion ? (
                            <AgentInstallSuggestionCard
                                message={undefined}
                                suggestion={installSuggestion}
                            />
                        ) : null}
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
