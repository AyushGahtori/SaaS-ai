/**
 * ChatInput — message input bar for the chat view.
 *
 * Features:
 * - Rounded container with #0C0D0D background
 * - AttachFile button on the left
 * - Textarea in the center (auto-grows)
 * - Model selector dropdown (cloud / local)
 * - Send button on the right (replaces TextToSpeech when text is present)
 * - Inline VoiceBar mode: clicking mic shrinks the bar into a voice input
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { AttachFile } from "@/modules/home/ui/components/attach-file";
import { TextToSpeech } from "@/modules/home/ui/components/text-to-speech";
import { SendHorizonal, ChevronDown, ChevronUp, Cloud, Cpu } from "lucide-react";
import VoiceBar from "@/modules/chat/ui/components/VoiceBar";

interface ChatInputProps {
    /** Optional: called when a message is submitted but no active chat exists (new chat flow). */
    onFirstMessage?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onFirstMessage }) => {
    const { sendMessage, isGenerating, selectedModel, setSelectedModel, availableModels } = useChatContext();
    const [value, setValue] = useState("");
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modelMenuRef = useRef<HTMLDivElement>(null);

    // Auto-resize the textarea as the user types.
    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = "auto";
            ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; // max ~6 lines
        }
    }, [value]);

    // Close model menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
                setIsModelMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
    const currentModelLabel = availableModels.find((m) => m.id === selectedModel)?.label || selectedModel;
    const isCloud = selectedModel.includes("cloud");

    return (
        <div className="w-full px-4 pb-6 pt-2">
            <div className="max-w-3xl mx-auto">
                {/* Wrapper with transition for voice bar swap */}
                <div
                    className="transition-all duration-300 ease-in-out"
                    style={{
                        maxWidth: isVoiceActive ? 420 : '100%',
                        margin: '0 auto',
                    }}
                >
                    {isVoiceActive ? (
                        /* ── Voice Bar Mode ─────────────────────────────────── */
                        <VoiceBar
                            onSendMessage={sendMessage}
                            onClose={() => setIsVoiceActive(false)}
                            onFirstMessage={onFirstMessage}
                        />
                    ) : (
                        /* ── Normal Chat Input Mode ─────────────────────────── */
                        <div
                            className="flex items-center w-full rounded-2xl border border-white/5 px-4 py-2 gap-2 transition-all duration-300 ease-in-out"
                            style={{ backgroundColor: "#0C0D0D" }}
                        >
                            {/* LEFT — Attach File button */}
                            <div className="flex-shrink-0">
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

                            {/* MODEL SELECTOR — Dropdown toggle */}
                            <div className="flex-shrink-0 relative" ref={modelMenuRef}>
                                <button
                                    onClick={() => setIsModelMenuOpen((prev) => !prev)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs text-white/70 hover:text-white"
                                    aria-label="Select AI model"
                                    title={`Model: ${selectedModel}`}
                                >
                                    {isCloud ? (
                                        <Cloud className="w-3.5 h-3.5" />
                                    ) : (
                                        <Cpu className="w-3.5 h-3.5" />
                                    )}
                                    <span className="hidden sm:inline max-w-[120px] truncate">{currentModelLabel}</span>
                                    {isModelMenuOpen ? (
                                        <ChevronUp className="w-3 h-3" />
                                    ) : (
                                        <ChevronDown className="w-3 h-3" />
                                    )}
                                </button>

                                {/* Dropdown menu */}
                                {isModelMenuOpen && (
                                    <div
                                        className="absolute bottom-full mb-2 right-0 w-56 rounded-xl border border-white/10 shadow-xl overflow-hidden z-50"
                                        style={{ backgroundColor: "#1A1B1E" }}
                                    >
                                        <div className="px-3 py-2 border-b border-white/5">
                                            <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Select Model</p>
                                        </div>
                                        {availableModels.map((model) => {
                                            const isActive = model.id === selectedModel;
                                            const isCloudModel = model.id.includes("cloud");
                                            return (
                                                <button
                                                    key={model.id}
                                                    onClick={() => {
                                                        setSelectedModel(model.id);
                                                        setIsModelMenuOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                                                        isActive
                                                            ? "bg-white/10 text-white"
                                                            : "text-white/60 hover:bg-white/5 hover:text-white/90"
                                                    }`}
                                                >
                                                    {isCloudModel ? (
                                                        <Cloud className="w-4 h-4 flex-shrink-0" />
                                                    ) : (
                                                        <Cpu className="w-4 h-4 flex-shrink-0" />
                                                    )}
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium truncate">{model.label}</span>
                                                        <span className="text-[10px] text-white/30 truncate">{model.id}</span>
                                                    </div>
                                                    {isActive && (
                                                        <span className="ml-auto text-emerald-400 text-xs">✓</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* RIGHT — Send button or TextToSpeech */}
                            <div className="flex-shrink-0">
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
                                    <TextToSpeech onClick={() => setIsVoiceActive(true)} />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
