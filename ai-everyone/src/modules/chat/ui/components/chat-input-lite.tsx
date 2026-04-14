"use client";

import React from "react";
import { ChatComposer } from "@/modules/chat/ui/components/chat-composer";

interface ChatInputLiteProps {
    onFirstMessage?: () => void;
}

export const ChatInputLite: React.FC<ChatInputLiteProps> = ({ onFirstMessage }) => {
    return <ChatComposer onFirstMessage={onFirstMessage} />;
};
