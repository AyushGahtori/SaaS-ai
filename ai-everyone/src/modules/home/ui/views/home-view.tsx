"use client";

import React from "react";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { ChatInput } from "@/modules/chat/ui/components/chat-input";

const QUICK_ACTIONS = [
  { label: "Schedule Meeting", emoji: "\u{1F4C5}", prompt: "I want to schedule a meeting" },
  { label: "Call", emoji: "\u{1F4DE}", prompt: "I want to make a call" },
  { label: "Message", emoji: "\u{1F4AC}", prompt: "I want to send a message" },
  { label: "Generate PPT", emoji: "\u{1F4CA}", prompt: "I want to generate a presentation" },
  { label: "Summarize Document", emoji: "\u{1F4DD}", prompt: "I want to summarize a document" },
  { label: "Update Todo", emoji: "\u{2705}", prompt: "I want to update my to-do list" },
  { label: "Email", emoji: "\u{2709}\uFE0F", prompt: "I want to send an email" },
];

export const HomeView: React.FC = () => {
  const { sendMessage, error } = useChatContext();
  const displayGreeting = "What is your agenda today?";

  const handleQuickAction = async (prompt: string) => {
    await sendMessage(prompt);
  };

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] px-4">
      <h1 className="text-foreground text-4xl font-semibold tracking-tight text-center mb-8">
        {displayGreeting}
      </h1>

      {error && (
        <div className="w-full max-w-3xl rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-4">
          {error}
        </div>
      )}

      <div className="w-full max-w-3xl">
        <ChatInput />
      </div>

      <div className="flex flex-col items-center gap-2.5 mt-4">
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          {QUICK_ACTIONS.slice(0, 4).map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.prompt)}
              className="
                flex items-center gap-1.5 px-4 py-2 rounded-full
                border border-white/10 bg-white/[0.03]
                text-sm text-white/70
                hover:bg-white/[0.08] hover:text-white hover:border-white/20
                transition-all duration-200 ease-out
                cursor-pointer select-none
              "
            >
              <span className="text-base leading-none" aria-hidden="true">
                {action.emoji}
              </span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          {QUICK_ACTIONS.slice(4).map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.prompt)}
              className="
                flex items-center gap-1.5 px-4 py-2 rounded-full
                border border-white/10 bg-white/[0.03]
                text-sm text-white/70
                hover:bg-white/[0.08] hover:text-white hover:border-white/20
                transition-all duration-200 ease-out
                cursor-pointer select-none
              "
            >
              <span className="text-base leading-none" aria-hidden="true">
                {action.emoji}
              </span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
