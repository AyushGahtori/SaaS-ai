/**
 * ChatSidebarList — renders the chat history list in the sidebar.
 *
 * Adapted from Chatbot-UI's sidebar/items/chat/chat-item.tsx.
 * Shows each chat as a clickable item with:
 *  - Chat title (truncated)
 *  - Active chat highlighted
 *  - Delete button on hover
 */

"use client";

import React, { useState } from "react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { Trash2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const ChatSidebarList: React.FC = () => {
    const { chats, activeChatId, selectChat, removeChatById, isLoadingChats } =
        useChatContext();
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    if (isLoadingChats) {
        return (
            <div className="px-3 py-2 text-xs text-white/40">Loading chats...</div>
        );
    }

    if (chats.length === 0) {
        return (
            <div className="px-3 py-2 text-xs text-white/40">No chats yet</div>
        );
    }

    return (
        <div className="flex flex-col gap-0.5">
            {chats.map((chat) => {
                const isActive = chat.id === activeChatId;

                return (
                    <div
                        key={chat.id}
                        className={cn(
                            "group flex items-center gap-2 px-3 py-2 mx-1 rounded-md cursor-pointer text-sm transition-colors",
                            isActive
                                ? "bg-white/10 text-white"
                                : "text-[#E5E5E5] hover:bg-white/5"
                        )}
                        onClick={() => selectChat(chat.id)}
                        onMouseEnter={() => setHoveredId(chat.id)}
                        onMouseLeave={() => setHoveredId(null)}
                    >
                        <MessageSquare
                            className="w-4 h-4 flex-shrink-0 opacity-50"
                            stroke="white"
                            strokeWidth={2}
                        />

                        {/* Chat title — truncated */}
                        <span className="flex-1 truncate text-xs font-medium">
                            {chat.title}
                        </span>

                        {/* Delete button — visible on hover */}
                        {hoveredId === chat.id && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeChatById(chat.id);
                                }}
                                className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
                                aria-label={`Delete chat: ${chat.title}`}
                            >
                                <Trash2 className="w-3.5 h-3.5 text-white/50 hover:text-red-400" />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
