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
                className="relative flex h-8 w-8 items-center justify-center rounded-full border border-primary/35 bg-primary/16 text-white shadow-[0_8px_22px_rgb(92_53_229/26%)] transition-all duration-200 hover:bg-primary/24 hover:shadow-[0_10px_24px_rgb(92_53_229/32%)] disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Stop response"
                title={isStopping ? "Stopping..." : "Stop response"}
            >
                {isStopping && (
                    <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet-200 border-r-violet-200" />
                )}
                {isStopping ? (
                    <Loader2 className="h-4 w-4 animate-spin text-violet-100" />
                ) : (
                    <Square className="h-3.5 w-3.5 fill-violet-50 text-violet-50" />
                )}
            </button>
        );
    }

    if (!hasInput) return null;

    return (
        <button
            onClick={onSend}
            disabled={sendDisabled}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/28 bg-primary/14 text-violet-50 shadow-[0_8px_22px_rgb(92_53_229/24%)] transition-all duration-200 hover:bg-primary/24 hover:shadow-[0_10px_24px_rgb(92_53_229/30%)] disabled:opacity-40"
            aria-label="Send message"
            title="Send message"
        >
            <SendHorizonal className="h-4 w-4 text-white" />
        </button>
    );
}
