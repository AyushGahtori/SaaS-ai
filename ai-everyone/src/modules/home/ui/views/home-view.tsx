"use client";

import React from "react";
import { CalendarDays, CheckSquare, FileText, Mail, MessageSquare, Phone, Presentation, Sparkles } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { ChatInput } from "@/modules/chat/ui/components/chat-input";

const QUICK_ACTIONS = [
  { label: "Schedule Meeting", prompt: "I want to schedule a meeting", icon: CalendarDays },
  { label: "Call", prompt: "I want to make a call", icon: Phone },
  { label: "Message", prompt: "I want to send a message", icon: MessageSquare },
  { label: "Generate PPT", prompt: "I want to generate a presentation", icon: Presentation },
  { label: "Summarize Document", prompt: "I want to summarize a document", icon: FileText },
  { label: "Update Todo", prompt: "I want to update my to-do list", icon: CheckSquare },
  { label: "Email", prompt: "I want to send an email", icon: Mail },
] as const;

const pickQuickActions = (labels: readonly string[]) =>
  labels.map((label) => {
    const action = QUICK_ACTIONS.find((item) => item.label === label);
    if (!action) {
      throw new Error(`Unknown quick action label: ${label}`);
    }
    return action;
  });

const TOP_ROW_ACTIONS = pickQuickActions(["Schedule Meeting", "Message", "Generate PPT", "Update Todo"]);
const BOTTOM_ROW_ACTIONS = pickQuickActions(["Call", "Summarize Document", "Email"]);

export const HomeView: React.FC = () => {
  const { data: session } = useSession();
  const { sendMessage, error } = useChatContext();

  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.hello.queryOptions({
      text: session?.user?.name || "User",
    })
  );

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const rawGreeting = data?.greeting ?? `hello ${session.user?.name || "User"}`;
  const capitalizedGreeting = rawGreeting.charAt(0).toUpperCase() + rawGreeting.slice(1);
  const displayGreeting = `${capitalizedGreeting}, What's your agenda today?`;

  const handleQuickAction = async (prompt: string) => {
    await sendMessage(prompt);
  };

  const renderQuickActionChip = (action: (typeof QUICK_ACTIONS)[number]) => {
    const Icon = action.icon;
    return (
      <button
        key={action.label}
        onClick={() => handleQuickAction(action.prompt)}
        className="interactive-lift inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-white/78 transition-[background-color,border-color,box-shadow,color,transform] hover:border-primary/35 hover:bg-primary/12 hover:text-white hover:shadow-[0_10px_24px_rgb(93_58_216/24%)]"
      >
        <Icon className="size-3.5" />
        <span>{action.label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 pb-8">
      <div className="content-fade-in w-full max-w-4xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Sparkles className="size-3.5" />
            Workspace Assistant
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {displayGreeting}
          </h1>
        </div>

        {error ? (
          <div className="status-pill-error mb-4 w-full rounded-lg px-4 py-3 text-sm">{error}</div>
        ) : null}

        <div className="w-full">
          <ChatInput />
        </div>

        <div className="mt-4 flex flex-col items-center gap-2.5">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {TOP_ROW_ACTIONS.map(renderQuickActionChip)}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {BOTTOM_ROW_ACTIONS.map(renderQuickActionChip)}
          </div>
        </div>
      </div>
    </div>
  );
};
