"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { HomeViewEmoji } from "@/modules/home/ui/views/home-view-emoji";

const ChatMessageList = dynamic(
  () =>
    import("@/modules/chat/ui/components/chat-message-list").then(
      (module) => module.ChatMessageList
    ),
  {
    ssr: false,
    loading: () => <div className="flex-1 animate-pulse bg-white/[0.02]" />,
  }
);

const ChatInput = dynamic(
  () => import("@/modules/chat/ui/components/chat-input").then((module) => module.ChatInput),
  {
    ssr: false,
    loading: () => <div className="h-24 border-t border-white/10 bg-black/40" />,
  }
);

export const ChatViewEmoji: React.FC = () => {
  const { activeChatId, messages } = useChatContext();
  const hasConversation = activeChatId !== null || messages.length > 0;

  if (!hasConversation) {
    return <HomeViewEmoji />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <ChatMessageList />
      <ChatInput />
    </div>
  );
};

