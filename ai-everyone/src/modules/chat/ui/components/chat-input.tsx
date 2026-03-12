/**
 * ChatInput — message input bar for the chat view.
 *
 * Reuses the same visual style as the existing HomeView prompt bar:
 * - Rounded container with #0C0D0D background
 * - AttachFile button on the left
 * - Textarea in the center (auto-grows)
 * - Send button on the right (replaces TextToSpeech when text is present)
 *
 * Adapted from Chatbot-UI's components/chat/chat-input.tsx.
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { AttachFile } from "@/modules/home/ui/components/attach-file";
import { TextToSpeech } from "@/modules/home/ui/components/text-to-speech";
import { SendHorizonal } from "lucide-react";

interface ChatInputProps {
    /** Optional: called when a message is submitted but no active chat exists (new chat flow). */
    onFirstMessage?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onFirstMessage }) => {
    const { sendMessage, isGenerating } = useChatContext();
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize the textarea as the user types.
    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = "auto";
            ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; // max ~6 lines
        }
    }, [value]);

    const handleSend = async () => {
        const trimmed = value.trim();
        if (!trimmed || isGenerating) return;

        setValue("");
        onFirstMessage?.();
        await sendMessage(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasText = value.trim().length > 0;

    return (
        <div className="w-full px-4 pb-4 pt-2">
            <div className="max-w-3xl mx-auto">
                <div
                    className="flex items-end w-full rounded-2xl border border-white/5 px-4 py-2 gap-2"
                    style={{ backgroundColor: "#0C0D0D" }}
                >
                    {/* LEFT — Attach File button */}
                    <div className="flex-shrink-0 mb-1">
                        <AttachFile onClick={() => { }} />
                    </div>

                    {/* CENTER — Textarea */}
                    <textarea
                        ref={textareaRef}
                        className="
              flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground
              outline-none border-none resize-none overflow-hidden leading-6
              py-1 px-2 min-h-[32px]
            "
                        rows={1}
                        placeholder="Ask anything..."
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isGenerating}
                        aria-label="Chat message input"
                    />

                    {/* RIGHT — Send button or TextToSpeech */}
                    <div className="flex-shrink-0 mb-1">
                        {hasText ? (
                            <button
                                onClick={handleSend}
                                disabled={isGenerating}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-40"
                                aria-label="Send message"
                            >
                                <SendHorizonal className="w-4 h-4 text-white" />
                            </button>
                        ) : (
                            <TextToSpeech onClick={() => { }} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
