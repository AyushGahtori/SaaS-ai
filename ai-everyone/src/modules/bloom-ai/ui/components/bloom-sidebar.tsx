"use client";

import Link from "next/link";
import { useState } from "react";
import {
    ChevronLeft,
    Dot,
    Ellipsis,
    MessageSquarePlus,
    Trash2,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MAIN_APP_ROUTE } from "@/modules/bloom-ai/constants/navigation";
import { bloomSlideTransition } from "@/modules/bloom-ai/animations/transitions";
import { formatBloomRelativeDate } from "@/modules/bloom-ai/lib/shared";
import type { BloomConversation } from "@/modules/bloom-ai/types";
import { cn } from "@/lib/utils";

interface BloomSidebarProps {
    conversations: BloomConversation[];
    activeConversationId: string | null;
    onSelectConversation: (conversationId: string) => void;
    onCreateConversation: () => Promise<unknown>;
    onDeleteConversation: (conversationId: string) => Promise<void>;
    onOpenReminders: () => void;
}

export function BloomSidebar({
    conversations,
    activeConversationId,
    onSelectConversation,
    onCreateConversation,
    onDeleteConversation,
    onOpenReminders,
}: BloomSidebarProps) {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <aside className="flex h-full min-h-0 w-full max-w-[292px] flex-col overflow-hidden border-r border-white/8 pr-4">
            <div className="relative flex items-start justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Daily</p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">
                        Bloom <span className="text-[#8FE7B5]">AI</span>
                    </h2>
                </div>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setMenuOpen((current) => !current)}
                        className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/55 text-white hover:border-white/20"
                        aria-label="Toggle Bloom workspace switcher"
                    >
                        <ChevronLeft
                            className={cn(
                                bloomSlideTransition,
                                "size-5",
                                menuOpen ? "rotate-90" : "rotate-0"
                            )}
                        />
                    </button>

                    <div
                        className={cn(
                            bloomSlideTransition,
                            "absolute right-0 top-[60px] z-20 w-48 rounded-2xl border border-white/10 bg-[#151515]/95 p-2 shadow-2xl backdrop-blur",
                            menuOpen
                                ? "translate-y-0 opacity-100"
                                : "pointer-events-none -translate-y-2 opacity-0"
                        )}
                    >
                        <Link
                            href={MAIN_APP_ROUTE}
                            className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/6 hover:text-white"
                        >
                            <span>Back to Pian</span>
                            <ChevronLeft className="size-4" />
                        </Link>
                        <button
                            type="button"
                            onClick={onOpenReminders}
                            className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/6 hover:text-white"
                        >
                            <span>Daily Reminders</span>
                            <Dot className="size-5 text-[#8FE7B5]" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-white/38">Recent Chats</div>
                <Button
                    onClick={() => void onCreateConversation()}
                    className="mt-3 h-11 w-full justify-start rounded-2xl bg-white/12 px-4 text-white hover:bg-white/18"
                >
                    <MessageSquarePlus className="size-4" />
                    New Chat
                </Button>
            </div>

            <div className="custom-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto pr-2">
                <div className="space-y-2">
                    {conversations.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/45">
                            Your Bloom conversations will appear here.
                        </div>
                    ) : null}

                    {conversations.map((conversation) => {
                        const active = conversation.id === activeConversationId;
                        return (
                            <div
                                key={conversation.id}
                                className={cn(
                                    "rounded-2xl border p-3 transition",
                                    active
                                        ? "border-[#8FE7B5]/35 bg-[#111311]"
                                        : conversation.isArchived
                                          ? "border-white/8 bg-[#151515] text-white/55 opacity-75 hover:border-white/12 hover:opacity-100"
                                        : "border-white/8 bg-black/25 hover:border-white/12 hover:bg-white/[0.04]"
                                )}
                            >
                                <div className="flex items-start gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onSelectConversation(conversation.id)}
                                        className="flex-1 text-left"
                                    >
                                        <div className="flex items-center gap-2">
                                            <p className="line-clamp-1 text-sm font-medium text-white">
                                                {conversation.title}
                                            </p>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-xs text-white/45">
                                            {conversation.lastMessagePreview || "No messages yet"}
                                        </p>
                                        <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-white/28">
                                            {formatBloomRelativeDate(conversation.updatedAt)}
                                        </p>
                                    </button>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className="rounded-lg border border-white/8 p-1.5 text-white/50 hover:border-white/15 hover:text-white"
                                                aria-label={`Open ${conversation.title} actions`}
                                            >
                                                <Ellipsis className="size-4" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="end"
                                            className="w-44 border-white/10 bg-[#1c1c1c] text-white"
                                        >
                                            <DropdownMenuItem
                                                onSelect={() => void onDeleteConversation(conversation.id)}
                                                className="cursor-pointer text-rose-300 focus:text-rose-200"
                                            >
                                                <Trash2 className="mr-2 size-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}
