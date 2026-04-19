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
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-primary/24 bg-primary/10 shadow-[0_8px_20px_rgb(92_53_229/22%)]">
                    <Bot className="h-5 w-5 text-violet-100" />
                </div>
            )}

            {/* Message content */}
            <div
                className={`relative max-w-[76%] overflow-hidden rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser
                        ? "rounded-br-sm border border-primary/28 bg-primary/16 text-white shadow-[0_10px_22px_rgb(92_53_229/20%)]"
                        : "ui-surface rounded-bl-sm text-[#E5E5E5]"
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
                                            className="custom-scrollbar max-w-full overflow-x-auto rounded-lg border border-white/8 bg-black/25 p-3"
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
                                                className="rounded-md border border-primary/22 bg-primary/14 px-1.5 py-0.5 text-[0.9em]"
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
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/14 bg-white/8">
                    <User className="h-5 w-5 text-white" />
                </div>
            )}
        </div>
    );
};
