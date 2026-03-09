/**
 * TextToSpeech Component
 * 
 * This component provides the voice/microphone button for the home AI input bar.
 * It is placed on the RIGHT side of the AI prompt input bar.
 * 
 * Currently the button is a UI-only element — no functionality is wired up yet.
 * TODO: Implement text-to-speech / voice input logic here
 *       (e.g., use the Web Speech API or a cloud-based STT service to convert
 *        spoken audio into text and populate the AI prompt input bar).
 */

"use client";

import { Button } from "@/components/ui/button";
import { MicIcon } from "lucide-react";

// Props interface — extend this when adding voice/TTS logic
interface TextToSpeechProps {
    // TODO: Add props such as onSpeechResult, isListening, language, etc. when implementing functionality
    onClick?: () => void;
}

/**
 * TextToSpeech button — renders a microphone icon button.
 * Placed on the right side of the AI prompt input bar.
 * Clicking this will eventually start a voice recording / speech-to-text session.
 */
export const TextToSpeech = ({ onClick }: TextToSpeechProps) => {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
            onClick={onClick}
            aria-label="Voice input"
            title="Speak your prompt"
        >
            {/* Microphone icon from lucide-react */}
            <MicIcon className="size-4" stroke="white" strokeWidth={2} />
        </Button>
    );
};
