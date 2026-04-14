"use client";

import React from "react";
import { ChatComposer } from "@/modules/chat/ui/components/chat-composer";

interface ChatInputProps {
    onFirstMessage?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onFirstMessage }) => {
    return <ChatComposer onFirstMessage={onFirstMessage} />;
};
