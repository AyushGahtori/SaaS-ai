"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Cloud, Cpu, Sparkles } from "lucide-react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { SendStopButton } from "@/modules/chat/ui/components/send-stop-button";

interface ChatInputLiteProps {
    onFirstMessage?: () => void;
}

export const ChatInputLite: React.FC<ChatInputLiteProps> = ({ onFirstMessage }) => {
    const {
        sendMessage,
        isGenerating,
        isStopping,
        stopGeneration,
        selectedModel,
        setSelectedModel,
        availableModels,
    } = useChatContext();

    const [value, setValue] = useState("");
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modelMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }, [value]);

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (
                modelMenuRef.current &&
                !modelMenuRef.current.contains(event.target as Node)
            ) {
                setIsModelMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const handleSend = async () => {
        const trimmed = value.trim();
        if (!trimmed || isGenerating) return;
        setValue("");
        onFirstMessage?.();
        await sendMessage(trimmed);
    };

    const onTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSend();
        }
    };

    const hasInput = value.trim().length > 0;
    const sendDisabled = isGenerating;
    const currentModelLabel =
        availableModels.find((model) => model.id === selectedModel)?.label || selectedModel;

    return (
        <div className="w-full px-4 pb-6 pt-2">
            <div className="mx-auto max-w-3xl">
                <div
                    className="flex w-full items-center gap-2 rounded-2xl border border-white/5 px-4 py-2 transition-all duration-300 ease-in-out"
                    style={{ backgroundColor: "#0C0D0D" }}
                >
                    <textarea
                        ref={textareaRef}
                        className="custom-scrollbar min-h-[32px] max-h-[160px] flex-1 resize-none overflow-y-auto border-none bg-transparent px-2 py-1 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground"
                        rows={1}
                        placeholder="Ask anything..."
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        onKeyDown={onTextareaKeyDown}
                        aria-label="Chat message input"
                    />

                    <div className="relative shrink-0" ref={modelMenuRef}>
                        <button
                            onClick={() => setIsModelMenuOpen((prev) => !prev)}
                            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label="Select AI model"
                            title={`Model: ${selectedModel}`}
                        >
                            {selectedModel.includes("cloud") ? (
                                <Cloud className="h-3.5 w-3.5" />
                            ) : selectedModel.toLowerCase().includes("gemini") ? (
                                <Sparkles className="h-3.5 w-3.5" />
                            ) : (
                                <Cpu className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden max-w-[120px] truncate sm:inline">
                                {currentModelLabel}
                            </span>
                            {isModelMenuOpen ? (
                                <ChevronUp className="h-3 w-3" />
                            ) : (
                                <ChevronDown className="h-3 w-3" />
                            )}
                        </button>

                        {isModelMenuOpen && (
                            <div
                                className="absolute bottom-full right-0 z-50 mb-2 w-56 overflow-hidden rounded-xl border border-white/10 shadow-xl"
                                style={{ backgroundColor: "#1A1B1E" }}
                            >
                                <div className="border-b border-white/5 px-3 py-2">
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                                        Select Model
                                    </p>
                                </div>
                                {availableModels.map((model) => {
                                    const isActive = model.id === selectedModel;
                                    const isCloudModel = model.id.includes("cloud");
                                    const isGeminiModel = model.id
                                        .toLowerCase()
                                        .includes("gemini");

                                    return (
                                        <button
                                            key={model.id}
                                            onClick={() => {
                                                setSelectedModel(model.id);
                                                setIsModelMenuOpen(false);
                                            }}
                                            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                                                isActive
                                                    ? "bg-white/10 text-white"
                                                    : "text-white/60 hover:bg-white/5 hover:text-white/90"
                                            }`}
                                        >
                                            {isCloudModel ? (
                                                <Cloud className="h-4 w-4 shrink-0" />
                                            ) : isGeminiModel ? (
                                                <Sparkles className="h-4 w-4 shrink-0" />
                                            ) : (
                                                <Cpu className="h-4 w-4 shrink-0" />
                                            )}
                                            <div className="min-w-0">
                                                <span className="block truncate text-sm font-medium">
                                                    {model.label}
                                                </span>
                                                <span className="block truncate text-[10px] text-white/30">
                                                    {model.id}
                                                </span>
                                            </div>
                                            {isActive && (
                                                <span className="ml-auto text-xs text-emerald-400">
                                                    OK
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="shrink-0">
                        <SendStopButton
                            isGenerating={isGenerating}
                            isStopping={isStopping}
                            hasInput={hasInput}
                            sendDisabled={sendDisabled}
                            onSend={() => void handleSend()}
                            onStop={stopGeneration}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
