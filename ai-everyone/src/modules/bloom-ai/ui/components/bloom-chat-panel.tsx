"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Leaf, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BLOOM_CHAT_SUGGESTIONS } from "@/modules/bloom-ai/constants/defaults";
import { formatBloomRelativeDate } from "@/modules/bloom-ai/lib/shared";
import type { BloomConversation, BloomSettings } from "@/modules/bloom-ai/types";

interface BloomChatPanelProps {
    conversation: BloomConversation | null;
    settings: BloomSettings;
    isSending: boolean;
    onSend: (message: string) => Promise<void>;
    onOpenSettings: () => void;
}

export function BloomChatPanel({
    conversation,
    settings,
    isSending,
    onSend,
    onOpenSettings,
}: BloomChatPanelProps) {
    const [draft, setDraft] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const hasMessages = Boolean(conversation && conversation.messages.length > 0);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }, [draft]);

    useEffect(() => {
        if (!hasMessages) return;
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversation?.messages, hasMessages, isSending]);

    const submit = async () => {
        const message = draft.trim();
        if (!message || isSending) return;
        setDraft("");
        await onSend(message);
    };

    if (!hasMessages) {
        return (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="flex justify-end px-6 pt-4 xl:px-8">
                    <Button
                        variant="ghost"
                        className="rounded-2xl border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                        onClick={onOpenSettings}
                    >
                        <Settings2 className="size-4" />
                    </Button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col justify-center px-6 pb-6 pt-4 xl:px-8">
                    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center text-center">
                        <div className="flex size-20 items-center justify-center rounded-[28px] border border-emerald-300/20 bg-white text-[#2C9363] shadow-[0_20px_45px_rgba(0,0,0,0.2)]">
                            <Leaf className="size-10" />
                        </div>
                        <h2 className="mt-8 max-w-4xl text-5xl font-semibold tracking-tight text-white">
                            How can I help you <span className="italic text-[#dcd5cb]">thrive</span> today?
                        </h2>
                        <p className="mt-4 max-w-2xl text-lg text-white/72">
                            I&apos;m connected to your personal workspace so I can turn reflection into
                            helpful next steps.
                        </p>
                        <p className="mt-2 text-sm text-white/40">
                            Bloom AI can make mistakes. Check important info.
                        </p>
                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                            {BLOOM_CHAT_SUGGESTIONS.map((chip) => (
                                <span
                                    key={chip}
                                    className="rounded-full border border-[#8FE7B5]/40 bg-[#effff5] px-4 py-1.5 text-sm font-medium text-[#246645]"
                                >
                                    {chip}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="mx-auto mt-8 w-full max-w-3xl">
                        <div
                            className="flex w-full flex-col gap-2 rounded-2xl border border-white/5 px-4 py-2 transition-all duration-300 ease-in-out"
                            style={{ backgroundColor: "#0C0D0D" }}
                        >
                            <Textarea
                                ref={textareaRef}
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        void submit();
                                    }
                                }}
                                placeholder="Ask anything..."
                                className="custom-scrollbar min-h-[32px] max-h-[160px] resize-none overflow-y-auto border-none bg-transparent px-2 py-1 text-base leading-6 text-white shadow-none focus-visible:ring-0"
                            />

                            <div className="flex items-center justify-between gap-3">
                                <div className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/70">
                                    {settings.modelId}
                                </div>

                                <Button
                                    onClick={() => void submit()}
                                    disabled={!draft.trim() || isSending}
                                    className="size-9 rounded-2xl bg-white text-black hover:bg-white/90"
                                >
                                    <ArrowUp className="size-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-5 xl:px-8">
                <div>
                    <h2 className="text-xl font-semibold text-white">{conversation?.title || "Conversation"}</h2>
                    <p className="mt-1 text-sm text-white/45">
                        Updated {formatBloomRelativeDate(conversation?.updatedAt)}
                    </p>
                </div>

                <Button
                    variant="ghost"
                    className="rounded-2xl border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                    onClick={onOpenSettings}
                >
                    <Settings2 className="size-4" />
                </Button>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6 xl:px-8">
                <div className="mx-auto w-full max-w-4xl space-y-4">
                    {conversation?.messages.map((message) => {
                        const assistant = message.role === "assistant";
                        return (
                            <div
                                key={message.id}
                                className={`flex ${assistant ? "justify-start" : "justify-end"}`}
                            >
                                <div
                                    className={`max-w-[82%] rounded-[26px] px-5 py-4 ${
                                        assistant
                                            ? "border border-white/10 bg-black/30 text-white"
                                            : "bg-[#8FE7B5] text-[#0d2415]"
                                    }`}
                                >
                                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                                    <p
                                        className={`mt-3 text-[11px] uppercase tracking-[0.16em] ${
                                            assistant ? "text-white/35" : "text-[#285235]/70"
                                        }`}
                                    >
                                        {formatBloomRelativeDate(message.createdAt)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    {isSending ? (
                        <div className="flex justify-start">
                            <div className="rounded-[22px] border border-white/8 bg-black/25 px-4 py-3 text-sm text-white/55">
                                Bloom AI is thinking...
                            </div>
                        </div>
                    ) : null}
                    <div ref={bottomRef} />
                </div>
            </div>

            <div className="border-t border-white/8 px-4 pb-5 pt-4 xl:px-8">
                <div
                    className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-white/5 px-4 py-2 transition-all duration-300 ease-in-out"
                    style={{ backgroundColor: "#0C0D0D" }}
                >
                    <Textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void submit();
                            }
                        }}
                        placeholder="Ask anything..."
                        className="custom-scrollbar min-h-[32px] max-h-[160px] resize-none overflow-y-auto border-none bg-transparent px-2 py-1 text-base leading-6 text-white shadow-none focus-visible:ring-0"
                    />

                    <div className="flex items-center justify-between gap-3">
                        <div className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/70">
                            {settings.modelId}
                        </div>

                        <Button
                            onClick={() => void submit()}
                            disabled={!draft.trim() || isSending}
                            className="size-9 rounded-2xl bg-white text-black hover:bg-white/90"
                        >
                            <ArrowUp className="size-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
