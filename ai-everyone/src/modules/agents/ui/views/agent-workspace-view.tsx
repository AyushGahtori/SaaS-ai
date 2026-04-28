"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, Loader2, MessageSquarePlus, Sparkles } from "lucide-react";
import { auth } from "@/lib/firebase";
import { getAgentById, type Agent } from "@/lib/firestore-agents";
import { getAgentCatalogEntry } from "@/lib/agents/catalog";
import { getAgentDetailContent } from "@/modules/agents/data/agent-details";
import { ChatInput } from "@/modules/chat/ui/components/chat-input";
import { ChatMessageList } from "@/modules/chat/ui/components/chat-message-list";
import { useChatContext } from "@/modules/chat/context/chat-context";
import { cn } from "@/lib/utils";

interface AgentWorkspaceViewProps {
  agentId: string;
}

interface AgentStateResponse {
  installedAgentIds: string[];
  accessibleAgentIds: string[];
  connectedBundleIds: string[];
}

async function getAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Authentication expired. Please sign in again.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function buildExamplePrompts(agent: Agent): string[] {
  const catalog = getAgentCatalogEntry(agent.id);
  const detail = getAgentDetailContent(agent.id);
  const examples = [
    ...(catalog?.examplePrompts || []),
    detail?.examplePrompt,
    agent.description,
  ].filter((item): item is string => Boolean(item && item.trim()));

  return Array.from(new Set(examples)).slice(0, 5);
}

function buildUseCases(agent: Agent): string[] {
  const catalog = getAgentCatalogEntry(agent.id);
  const detail = getAgentDetailContent(agent.id);
  const useCases = [
    ...(detail?.useCases || []),
    ...(catalog?.tags || agent.tags || []),
  ].filter(Boolean);

  return Array.from(new Set(useCases)).slice(0, 8);
}

export function AgentWorkspaceView({ agentId }: AgentWorkspaceViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    activeChatId,
    messages,
    createNewChat,
    sendMessage,
    setWorkspaceScope,
    workspaceScope,
  } = useChatContext();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessible, setIsAccessible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const consumedPromptRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [agentRecord, headers] = await Promise.all([
          getAgentById(agentId),
          getAuthHeaders(),
        ]);

        if (!agentRecord) {
          throw new Error("This agent does not exist in the marketplace.");
        }

        const stateResponse = await fetch("/api/agents", {
          method: "GET",
          headers,
        });
        if (!stateResponse.ok) {
          const data = await stateResponse.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load your agent access.");
        }

        const state = (await stateResponse.json()) as AgentStateResponse;
        const accessible =
          (state.accessibleAgentIds || []).includes(agentRecord.id) ||
          (!agentRecord.requiresConnection && (state.installedAgentIds || []).includes(agentRecord.id));

        if (cancelled) return;
        setAgent(agentRecord);
        setIsAccessible(accessible);
        setWorkspaceScope({
          type: "agent",
          agentId: agentRecord.id,
          agentName: agentRecord.name,
        });
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load this workspace.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [agentId, setWorkspaceScope]);

  const examples = useMemo(() => (agent ? buildExamplePrompts(agent) : []), [agent]);
  const useCases = useMemo(() => (agent ? buildUseCases(agent) : []), [agent]);
  const detailContent = useMemo(
    () => (agent ? getAgentDetailContent(agent.id) : undefined),
    [agent]
  );
  const hasConversation = activeChatId !== null || messages.length > 0;

  const sendWorkspacePrompt = useCallback(
    async (prompt: string, forceNewChat = false) => {
      if (!agent || !isAccessible) return;
      if (workspaceScope.type !== "agent" || workspaceScope.agentId !== agent.id) {
        setWorkspaceScope({ type: "agent", agentId: agent.id, agentName: agent.name });
      }
      await sendMessage(prompt, false, [], [], { forceNewChat });
    },
    [agent, isAccessible, sendMessage, setWorkspaceScope, workspaceScope]
  );

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (!prompt || !agent || !isAccessible) return;
    if (consumedPromptRef.current === prompt) return;
    consumedPromptRef.current = prompt;
    createNewChat();
    void sendWorkspacePrompt(prompt, true);
  }, [agent, createNewChat, isAccessible, searchParams, sendWorkspacePrompt]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
      </div>
    );
  }

  if (loadError || !agent) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center px-6">
        <div className="ui-surface max-w-lg rounded-2xl p-6 text-center">
          <Bot className="mx-auto mb-4 h-9 w-9 text-violet-200" />
          <h1 className="text-xl font-semibold text-white">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-white/55">{loadError}</p>
          <Link
            href="/agents"
            className="mt-5 inline-flex rounded-lg border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-semibold text-white hover:bg-primary/22"
          >
            Back to marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <div
        className={cn(
          "custom-scrollbar min-h-0 flex-1 overflow-y-auto",
          hasConversation ? "flex flex-col" : ""
        )}
      >
        {hasConversation ? (
          <ChatMessageList />
        ) : (
          <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Link
                  href="/"
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-primary/30 hover:bg-primary/12 hover:text-white"
                >
                  Home
                </Link>
                <Link
                  href="/agents"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-primary/30 hover:bg-primary/12 hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Agents
                </Link>
              </div>

              <button
                onClick={createNewChat}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/26 bg-primary/14 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/22"
              >
                <MessageSquarePlus className="h-4 w-4" />
                New {agent.name} Chat
              </button>
            </div>

            {!isAccessible ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4 text-sm text-amber-100">
                Install and connect {agent.name} from the marketplace before using this workspace.
              </div>
            ) : null}

            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(99,102,241,0.16),rgba(8,10,18,0.94)_44%,rgba(14,165,233,0.10))] p-6 shadow-[0_22px_70px_rgb(0_0_0/42%)]">
              <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_320px]">
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/12 bg-black/25 p-3 shadow-[0_18px_44px_rgb(0_0_0/35%)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={agent.iconUrl} alt={agent.name} className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/70">
                        Dedicated Workspace
                      </p>
                      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                        {agent.name}
                      </h1>
                      <p className="mt-3 max-w-3xl text-base leading-7 text-white/66">
                        {detailContent?.descriptionLines?.join(" ") || agent.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {useCases.map((useCase) => (
                      <span
                        key={useCase}
                        className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-medium text-white/68"
                      >
                        {useCase}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/22 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
                      <Sparkles className="h-4 w-4" />
                      Scope Lock
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/70">
                      Chats in this page can only call {agent.name}. Out-of-scope requests ask for clarification instead of falling back to another agent.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/22 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">
                      Actions
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(getAgentCatalogEntry(agent.id)?.actions || []).slice(0, 6).map((action) => (
                        <span
                          key={action}
                          className="rounded-lg border border-primary/18 bg-primary/10 px-2 py-1 text-[11px] text-white/62"
                        >
                          {action.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/44">
                  Example prompts
                </h2>
                <div className="mt-4 grid gap-2">
                  {examples.map((prompt) => (
                    <button
                      key={prompt}
                      disabled={!isAccessible}
                      onClick={() => void sendWorkspacePrompt(prompt, true)}
                      className="rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-left text-sm leading-6 text-white/74 transition hover:border-primary/30 hover:bg-primary/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                {["Recent chats stay scoped to this agent.", "The composer calls only this workspace endpoint.", "Task cards reuse the existing production renderers."].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-sm leading-6 text-white/68">{item}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/8 bg-black/82 backdrop-blur-xl">
        <ChatInput />
      </div>
    </div>
  );
}
