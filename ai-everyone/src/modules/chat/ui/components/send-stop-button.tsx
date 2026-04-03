"use client";

import { Loader2, SendHorizonal, Square } from "lucide-react";

interface SendStopButtonProps {
    isGenerating: boolean;
    isStopping: boolean;
    hasInput: boolean;
    sendDisabled: boolean;
    onSend: () => void;
    onStop: () => void;
}

/**
 * Single action button that morphs between:
 * - Send (idle)
 * - Stop (streaming)
 * - Stopping spinner (abort in progress)
 */
export function SendStopButton({
    isGenerating,
    isStopping,
    hasInput,
    sendDisabled,
    onSend,
    onStop,
}: SendStopButtonProps) {
    if (isGenerating) {
        return (
            <button
                onClick={onStop}
                disabled={isStopping}
                className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-all duration-300 hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Stop response"
                title={isStopping ? "Stopping..." : "Stop response"}
            >
                {isStopping && (
                    <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-300 border-r-cyan-300 animate-spin" />
                )}
                {isStopping ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                    <Square className="h-3.5 w-3.5 fill-white text-white" />
                )}
            </button>
        );
    }

    if (!hasInput) return null;

    return (
        <button
            onClick={onSend}
            disabled={sendDisabled}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-all duration-300 hover:bg-white/20 disabled:opacity-40"
            aria-label="Send message"
            title="Send message"
        >
            <SendHorizonal className="h-4 w-4 text-white" />
        </button>
    );
}
